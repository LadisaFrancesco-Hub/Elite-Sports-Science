/* ══════════════════════════════════════════════════════════════
   ELITE SPORTS SCIENCE — branding.js
   White-label: carica e applica il branding del coach a runtime.
   Piano Team richiesto per personalizzare nome + colore + logo.
   ══════════════════════════════════════════════════════════════ */

import { appState } from './state.js';
import { toast } from './utils.js';

// ─────────────────────────────────────────────────────────────
// loadBranding — chiama dopo loadCoachPlan()
// ─────────────────────────────────────────────────────────────
export async function loadBranding() {
    if (!window.mySupabase) return;
    try {
        const { data, error } = await window.mySupabase
            .from('coaches')
            .select('brand_name, brand_color, brand_logo_url, coach_role, head_coach_user_id')
            .eq('user_id', (await window.mySupabase.auth.getUser()).data.user.id)
            .single();

        if (error || !data) return;

        appState.brandName    = data.brand_name    || null;
        appState.brandColor   = data.brand_color   || '#f97316';
        appState.brandLogoUrl = data.brand_logo_url || null;
        appState.coachRole    = data.coach_role     || 'head';
        appState.headCoachId  = data.head_coach_user_id || null;

        applyBranding();
    } catch (e) {
        console.warn('[Branding] load error:', e);
    }
}


// ─────────────────────────────────────────────────────────────
// applyBranding — applica CSS + DOM
// ─────────────────────────────────────────────────────────────
export function applyBranding() {
    const name  = appState.brandName  || 'CoachOS';
    const color = appState.brandColor || '#f97316';
    const logo  = appState.brandLogoUrl || null;

    // CSS variable principale
    const root = document.documentElement;
    root.style.setProperty('--teal',   color);
    root.style.setProperty('--teal-d', hexToRgba(color, 0.12));
    root.style.setProperty('--teal-m', darken(color, 10));

    // Titolo pagina + meta theme-color
    document.title = name;
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', color);

    // Logo in sidebar
    const logoEl = document.querySelector('.logo');
    if (logoEl) {
        if (logo) {
            logoEl.innerHTML = `<img src="${logo}" alt="${name}" style="height:28px;object-fit:contain;max-width:140px">`;
        } else {
            logoEl.textContent = name;
        }
    }

    // Splash screen
    const splashBrand = document.querySelector('#splash-screen > div:first-child');
    if (splashBrand) splashBrand.textContent = name.toUpperCase();

    // apple-mobile-web-app-title
    const appleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appleMeta) appleMeta.setAttribute('content', name.slice(0, 12));
}


// ─────────────────────────────────────────────────────────────
// saveBranding — coach salva le impostazioni di branding
// ─────────────────────────────────────────────────────────────
export async function saveBranding() {
    if (appState.coachPlan !== 'team') {
        toast('⬆️ Il white-label richiede il piano Team');
        return;
    }
    if (!window.mySupabase) { toast('❌ Connessione non disponibile'); return; }

    const name  = document.getElementById('brand-name-input')?.value.trim() || null;
    const color = document.getElementById('brand-color-input')?.value || '#f97316';
    const logo  = document.getElementById('brand-logo-input')?.value.trim() || null;

    const { error } = await window.mySupabase
        .from('coaches')
        .update({ brand_name: name, brand_color: color, brand_logo_url: logo })
        .eq('user_id', (await window.mySupabase.auth.getUser()).data.user.id);

    if (error) { toast('❌ ' + error.message); return; }

    appState.brandName    = name;
    appState.brandColor   = color;
    appState.brandLogoUrl = logo;
    applyBranding();
    toast('✅ Branding salvato');
}


// ─────────────────────────────────────────────────────────────
// renderBrandingSettings — pannello impostazioni branding
// ─────────────────────────────────────────────────────────────
export function renderBrandingSettings(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const isPro   = appState.coachPlan === 'team';
    const name    = appState.brandName  || '';
    const color   = appState.brandColor || '#f97316';
    const logo    = appState.brandLogoUrl || '';

    el.innerHTML = `
    <div class="card" style="border:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div class="card-t">🎨 White-Label & Branding</div>
            ${!isPro ? `<span style="font-size:10px;font-weight:700;padding:2px 8px;background:rgba(139,92,246,.15);color:#a78bfa;border-radius:10px;">TEAM</span>` : ''}
        </div>
        ${!isPro ? `<p style="font-size:12px;color:var(--muted);margin:0 0 14px">Il white-label è disponibile nel piano Team — gli atleti vedranno il tuo brand invece di "CoachOS".</p>` : ''}
        <div class="fg" style="${!isPro ? 'opacity:.45;pointer-events:none' : ''}">
            <label class="fl">Nome app</label>
            <input type="text" id="brand-name-input" value="${name}" placeholder="es. Forza & Performance"
                   style="background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);font-size:13px;width:100%;box-sizing:border-box">
        </div>
        <div class="fr" style="${!isPro ? 'opacity:.45;pointer-events:none' : ''}">
            <div class="fg">
                <label class="fl">Colore principale</label>
                <div style="display:flex;gap:8px;align-items:center">
                    <input type="color" id="brand-color-input" value="${color}"
                           style="width:44px;height:36px;border:1px solid var(--border);border-radius:6px;background:var(--s2);cursor:pointer;padding:2px">
                    <input type="text" id="brand-color-hex" value="${color}" maxlength="7"
                           style="background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:12px;width:90px;font-family:var(--fm)"
                           oninput="document.getElementById('brand-color-input').value=this.value">
                </div>
            </div>
            <div class="fg">
                <label class="fl">Preview</label>
                <div id="brand-preview" style="height:36px;background:${color};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;letter-spacing:.05em">
                    ${name || 'COACHOS'}
                </div>
            </div>
        </div>
        <div class="fg" style="${!isPro ? 'opacity:.45;pointer-events:none' : ''}">
            <label class="fl">Logo URL (opzionale)</label>
            <input type="url" id="brand-logo-input" value="${logo}" placeholder="https://... (PNG o SVG, altezza 28px)"
                   style="background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);font-size:12px;width:100%;box-sizing:border-box">
        </div>
        ${isPro ? `
        <button onclick="saveBranding()" class="btn btn-p" style="width:100%;margin-top:8px">
            💾 Applica branding
        </button>` : `
        <button onclick="window._showUpgradeModal && window._showUpgradeModal()" class="btn btn-g" style="width:100%;margin-top:8px;color:#a78bfa;border-color:rgba(139,92,246,.3)">
            ⬆️ Passa al piano Team per sbloccare
        </button>`}
    </div>`;

    // Live preview del colore
    const colorPicker = document.getElementById('brand-color-input');
    if (colorPicker && isPro) {
        colorPicker.addEventListener('input', () => {
            const hex = colorPicker.value;
            const hexInput = document.getElementById('brand-color-hex');
            if (hexInput) hexInput.value = hex;
            const preview = document.getElementById('brand-preview');
            if (preview) {
                preview.style.background = hex;
                const nameVal = document.getElementById('brand-name-input')?.value || 'COACHOS';
                preview.textContent = nameVal.toUpperCase().slice(0, 12);
            }
        });
        document.getElementById('brand-name-input')?.addEventListener('input', (e) => {
            const preview = document.getElementById('brand-preview');
            if (preview) preview.textContent = e.target.value.toUpperCase().slice(0, 12) || 'COACHOS';
        });
    }
}


// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function darken(hex, amount) {
    const r = Math.max(0, parseInt(hex.slice(1,3), 16) - amount);
    const g = Math.max(0, parseInt(hex.slice(3,5), 16) - amount);
    const b = Math.max(0, parseInt(hex.slice(5,7), 16) - amount);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
