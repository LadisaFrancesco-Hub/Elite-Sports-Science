/* ══════════════════════════════════════════════════════════════
   CoachOS — wearable.js
   Integrazione dispositivi wearable: Whoop, Polar, Apple Health
   Responsabilità:
     1. connectWearable(platform)    — avvia OAuth redirect
     2. checkWearableCallback()      — processa il ritorno OAuth
     3. initWearable(athleteId)      — carica connessioni + aggiorna UI
     4. syncWearableData(athleteId)  — fetch dati odierni + pre-fill wellness
     5. disconnectWearable(platform) — rimuove connessione dal DB
     6. renderWearableStatus()       — aggiorna card wearable nel pannello
   ══════════════════════════════════════════════════════════════ */

import { DB, appState } from './state.js';
import { toast } from './utils.js';

// ─────────────────────────────────────────────────────────────
// Configurazione piattaforme
// ─────────────────────────────────────────────────────────────
const PLATFORMS = {
    whoop: {
        name:    'Whoop',
        icon:    '⚡',
        color:   '#00f19f',
        authUrl: 'https://api.prod.whoop.com/oauth/oauth2/auth',
        scope:   'read:recovery read:sleep read:profile read:body_measurement offline',
        // WHOOP_CLIENT_ID deve essere impostato come secret Supabase
        // Per il flow browser usa il Client ID pubblico (non il secret)
        clientId: (typeof WHOOP_PUBLIC_CLIENT_ID !== 'undefined') ? WHOOP_PUBLIC_CLIENT_ID : '',
    },
    polar: {
        name:    'Polar',
        icon:    '🎯',
        color:   '#c0392b',
        authUrl: 'https://flow.polar.com/oauth2/authorization',
        scope:   'accesslink.read_all',
        clientId: (typeof POLAR_PUBLIC_CLIENT_ID !== 'undefined') ? POLAR_PUBLIC_CLIENT_ID : '',
    },
    apple_health: {
        name:       'Apple Health',
        icon:       '🍎',
        color:      '#ff3b30',
        nativeOnly: true,
    },
    garmin: {
        name:       'Garmin',
        icon:       '⌚',
        color:      '#007cc2',
        comingSoon: true,
    },
};

// Stato in memoria delle connessioni dell'atleta corrente
let _connections = {};
let _lastSyncTs  = null;
const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minuti tra sync automatici

// ─────────────────────────────────────────────────────────────
// 1. connectWearable(platform)
//    Avvia il flusso OAuth redirect verso la piattaforma.
// ─────────────────────────────────────────────────────────────
export function connectWearable(platform) {
    const cfg       = PLATFORMS[platform];
    const athleteId = appState.selAthId;

    if (!athleteId) { toast('Seleziona un atleta prima'); return; }
    if (!cfg)       { toast('Piattaforma non supportata'); return; }

    if (cfg.nativeOnly) {
        _syncAppleHealth(athleteId);
        return;
    }
    if (cfg.comingSoon) {
        toast(`${cfg.name} — disponibile a breve`);
        return;
    }
    if (!cfg.clientId) {
        toast(`Client ID ${cfg.name} non configurato`);
        return;
    }

    const state       = btoa(JSON.stringify({ platform, athleteId }));
    const redirectUri = window.location.origin;

    const params = new URLSearchParams({
        response_type: 'code',
        client_id:     cfg.clientId,
        scope:         cfg.scope,
        redirect_uri:  redirectUri,
        state,
    });

    window.location.href = `${cfg.authUrl}?${params}`;
}

// ─────────────────────────────────────────────────────────────
// 2. checkWearableCallback()
//    Chiamata al DOMContentLoaded: processa ?code=&state= se presenti.
// ─────────────────────────────────────────────────────────────
export async function checkWearableCallback() {
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');
    const state  = params.get('state');
    if (!code || !state) return;

    let parsed;
    try { parsed = JSON.parse(atob(state)); } catch { return; }

    const { platform, athleteId } = parsed;
    if (!platform || !athleteId) return;

    // Pulisce la URL immediatamente
    window.history.replaceState({}, '', window.location.pathname);

    toast(`Connessione ${PLATFORMS[platform]?.name ?? platform}…`);

    try {
        const res = await window.mySupabase.functions.invoke('wearable-proxy', {
            body: { action: 'exchange', platform, code, redirect_uri: window.location.origin },
        });
        if (res.error) throw new Error(res.error.message);

        const d          = res.data;
        const expiry     = d.expires_in
            ? new Date(Date.now() + d.expires_in * 1000).toISOString()
            : null;

        await window.mySupabase.from('wearable_connections').upsert({
            id:               `${platform}_${athleteId}`,
            athlete_id:       athleteId,
            platform,
            access_token:     d.access_token   ?? null,
            refresh_token:    d.refresh_token   ?? null,
            token_expiry:     expiry,
            platform_user_id: d.platform_user_id ?? null,
            connected_at:     new Date().toISOString(),
        });

        toast(`✅ ${PLATFORMS[platform]?.name} connesso!`);
        await initWearable(athleteId);
        await syncWearableData(athleteId, true);

    } catch (err) {
        console.error('[Wearable] OAuth error:', err);
        toast('Errore connessione wearable — riprova');
    }
}

// ─────────────────────────────────────────────────────────────
// 3. initWearable(athleteId)
//    Carica le connessioni dal DB e aggiorna la UI della card.
// ─────────────────────────────────────────────────────────────
export async function initWearable(athleteId) {
    if (!athleteId || !window.mySupabase) return;

    const { data, error } = await window.mySupabase
        .from('wearable_connections')
        .select('*')
        .eq('athlete_id', athleteId);

    if (error) { console.warn('[Wearable] initWearable error:', error); return; }

    _connections = {};
    (data ?? []).forEach(c => { _connections[c.platform] = c; });

    renderWearableStatus();
}

// ─────────────────────────────────────────────────────────────
// 4. syncWearableData(athleteId, force)
//    Recupera i dati odierni da ogni piattaforma connessa
//    e pre-compila i campi HRV/RHR/ore-sonno nel pannello Wellness.
// ─────────────────────────────────────────────────────────────
export async function syncWearableData(athleteId, force = false) {
    if (!athleteId || !window.mySupabase) return;

    // Cooldown: non risincronizzare troppo spesso
    const now = Date.now();
    if (!force && _lastSyncTs && (now - _lastSyncTs) < SYNC_COOLDOWN_MS) return;

    const connected = Object.values(_connections);
    if (connected.length === 0) return;

    _setSyncBadge('loading');

    let merged = { hrv: null, rhr: null, sleep_hours: null, recovery_score: null, source: null };

    for (const conn of connected) {
        if (conn.platform === 'apple_health') continue; // gestito nativamente

        // Refresh token scaduto se necessario
        const token = await _ensureFreshToken(conn);
        if (!token) continue;

        try {
            const res = await window.mySupabase.functions.invoke('wearable-proxy', {
                body: { action: 'sync', platform: conn.platform, access_token: token },
            });
            if (res.error || !res.data) continue;

            const d = res.data;
            if (d.hrv         != null && merged.hrv         == null) merged.hrv         = d.hrv;
            if (d.rhr         != null && merged.rhr         == null) merged.rhr         = d.rhr;
            if (d.sleep_hours != null && merged.sleep_hours == null) merged.sleep_hours = d.sleep_hours;
            if (d.recovery_score != null && merged.recovery_score == null) merged.recovery_score = d.recovery_score;
            if (!merged.source) merged.source = d.source;

        } catch (e) {
            console.warn(`[Wearable] sync ${conn.platform} failed:`, e);
        }
    }

    _prefillWellnessFields(merged);
    _lastSyncTs = now;
    _setSyncBadge('done', merged.source);

    // Aggiorna last_sync nel DB
    if (merged.source && _connections[merged.source]) {
        await window.mySupabase.from('wearable_connections').update({
            last_sync: new Date().toISOString()
        }).eq('id', _connections[merged.source].id);
    }
}

// ─────────────────────────────────────────────────────────────
// 5. disconnectWearable(platform)
// ─────────────────────────────────────────────────────────────
export async function disconnectWearable(platform) {
    const athleteId = appState.selAthId;
    if (!athleteId) return;

    await window.mySupabase.from('wearable_connections')
        .delete()
        .eq('id', `${platform}_${athleteId}`);

    delete _connections[platform];
    toast(`${PLATFORMS[platform]?.name ?? platform} disconnesso`);
    renderWearableStatus();
}

// ─────────────────────────────────────────────────────────────
// 6. renderWearableStatus()
//    Aggiorna la sezione wearable dentro la card wellness.
// ─────────────────────────────────────────────────────────────
export function renderWearableStatus() {
    const el = document.getElementById('wearable-platform-list');
    if (!el) return;

    el.innerHTML = Object.entries(PLATFORMS).map(([key, cfg]) => {
        const conn = _connections[key];
        const isConnected = !!conn;

        if (cfg.comingSoon) {
            return `<div class="wr-chip" style="opacity:.45;cursor:default;">
                <span>${cfg.icon}</span>
                <span style="font-size:11px;">${cfg.name}</span>
                <span style="font-size:9px;color:var(--muted)">Presto</span>
            </div>`;
        }
        if (cfg.nativeOnly) {
            const isNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform?.();
            if (!isNative) {
                return `<div class="wr-chip" style="opacity:.45;cursor:default;">
                    <span>${cfg.icon}</span>
                    <span style="font-size:11px;">${cfg.name}</span>
                    <span style="font-size:9px;color:var(--muted)">App nativa</span>
                </div>`;
            }
        }

        if (isConnected) {
            const lastSync = conn.last_sync
                ? new Date(conn.last_sync).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                : '—';
            return `<div class="wr-chip wr-connected" style="border-color:${cfg.color};background:${cfg.color}18;">
                <span>${cfg.icon}</span>
                <span style="font-size:11px;font-weight:800;color:${cfg.color};">${cfg.name}</span>
                <span style="font-size:9px;color:var(--muted)">↑ ${lastSync}</span>
                <button onclick="disconnectWearable('${key}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:10px;padding:0 2px;" title="Disconnetti">✕</button>
            </div>`;
        }

        return `<button class="wr-chip" onclick="connectWearable('${key}')" style="border-color:var(--border);cursor:pointer;">
            <span>${cfg.icon}</span>
            <span style="font-size:11px;">${cfg.name}</span>
            <span style="font-size:9px;color:var(--teal)">+ Connetti</span>
        </button>`;
    }).join('');
}

// ─────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────

function _prefillWellnessFields(data) {
    const { hrv, rhr, sleep_hours, recovery_score, source } = data;
    const platform = source ? (PLATFORMS[source]?.name ?? source) : '';

    let filled = false;

    if (hrv != null) {
        const el = document.getElementById('w-hrv');
        if (el && !el.dataset.manuallySet) {
            el.value             = hrv;
            el.dataset.wearable  = '1';
            el.title             = `Importato da ${platform}`;
            el.style.color       = 'var(--teal)';
            if (typeof window.upW === 'function') window.upW();
            filled = true;
        }
    }
    if (rhr != null) {
        const el = document.getElementById('w-rhr');
        if (el && !el.dataset.manuallySet) {
            el.value             = rhr;
            el.dataset.wearable  = '1';
            el.style.color       = 'var(--teal)';
            filled = true;
        }
    }
    if (sleep_hours != null) {
        const el = document.getElementById('w-sleep-hours');
        if (el && !el.dataset.manuallySet) {
            el.value             = sleep_hours;
            el.dataset.wearable  = '1';
            el.style.color       = 'var(--teal)';
            if (typeof window.upW === 'function') window.upW();
            filled = true;
        }
    }

    // Badge "fonte dati"
    const badge = document.getElementById('wearable-sync-badge');
    if (badge && filled && platform) {
        badge.textContent      = `📡 ${platform} — ${recovery_score != null ? `Recovery ${recovery_score}%` : 'sincronizzato'}`;
        badge.style.display    = 'block';
    }

    // Marker manuale: se l'atleta modifica i campi a mano, non sovrascrivere
    ['w-hrv', 'w-rhr', 'w-sleep-hours'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', () => { el.dataset.manuallySet = '1'; el.style.color = ''; }, { once: true });
    });
}

function _setSyncBadge(state, source) {
    const btn = document.getElementById('wearable-sync-btn');
    if (!btn) return;
    if (state === 'loading') {
        btn.textContent = '⏳ Sync…';
        btn.disabled    = true;
    } else {
        btn.textContent = '↻ Sync';
        btn.disabled    = false;
    }
}

async function _ensureFreshToken(conn) {
    if (!conn.token_expiry) return conn.access_token;

    const expiresAt = new Date(conn.token_expiry).getTime();
    if (Date.now() < expiresAt - 60000) return conn.access_token; // ancora valido

    // Token scaduto — refresh
    try {
        const res = await window.mySupabase.functions.invoke('wearable-proxy', {
            body: { action: 'refresh', platform: conn.platform, refresh_token: conn.refresh_token },
        });
        if (res.error || !res.data?.access_token) return null;

        const d      = res.data;
        const expiry = d.expires_in
            ? new Date(Date.now() + d.expires_in * 1000).toISOString()
            : conn.token_expiry;

        await window.mySupabase.from('wearable_connections').update({
            access_token: d.access_token,
            token_expiry: expiry,
            ...(d.refresh_token ? { refresh_token: d.refresh_token } : {}),
        }).eq('id', conn.id);

        _connections[conn.platform] = { ...conn, access_token: d.access_token, token_expiry: expiry };
        return d.access_token;

    } catch { return null; }
}

// Apple Health via Capacitor (attivo solo su iOS/Android nativo)
async function _syncAppleHealth(athleteId) {
    if (typeof Capacitor === 'undefined' || !Capacitor.isNativePlatform?.()) {
        toast('Apple Health disponibile solo nell\'app nativa');
        return;
    }
    try {
        const { CapacitorHealth } = await import('@capacitor-community/health');
        await CapacitorHealth.requestAuthorization({
            read: ['HRV', 'HEART_RATE', 'SLEEP_STAGE', 'STEP_COUNT'],
        });
        const today = new Date();
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

        const [hrvRes, sleepRes] = await Promise.all([
            CapacitorHealth.query({ startDate: yesterday.toISOString(), endDate: today.toISOString(), dataType: 'HRV', limit: 1 }),
            CapacitorHealth.query({ startDate: yesterday.toISOString(), endDate: today.toISOString(), dataType: 'SLEEP_STAGE', limit: 50 }),
        ]);

        const hrv         = hrvRes?.values?.[0]?.value ?? null;
        const totalSleepMs = (sleepRes?.values ?? [])
            .filter(s => s.sourceId !== 'AWAKE')
            .reduce((acc, s) => acc + (new Date(s.endDate) - new Date(s.startDate)), 0);
        const sleep_hours = totalSleepMs > 0 ? Math.round(totalSleepMs / 360000) / 10 : null;

        _prefillWellnessFields({ hrv, rhr: null, sleep_hours, recovery_score: null, source: 'apple_health' });
        toast('Apple Health sincronizzato ✅');

    } catch (e) {
        console.error('[Wearable] Apple Health error:', e);
        toast('Errore Apple Health — controlla i permessi');
    }
}
