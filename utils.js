/* ══════════════════════════════════════════════════════════════
   ELITE SPORTS SCIENCE — utils.js
   Utility condivise: pure helpers + DOM micro-functions.
   Unica dipendenza: state.js (per athName/athById che leggono DB).
   ══════════════════════════════════════════════════════════════ */

import { DB } from './state.js';

// ─────────────────────────────────────────────────────────────
// PURE HELPERS
// ─────────────────────────────────────────────────────────────
export function uid() {
    return Math.random().toString(36).slice(2, 9);
}

export function escHtml(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

export function athName(id) {
    const a = DB.athletes.find(x => x.id === id);
    return a ? a.name : id;
}

export function athById(id) {
    return DB.athletes.find(x => x.id === id) || null;
}

// ─────────────────────────────────────────────────────────────
// DOM HELPERS
// ─────────────────────────────────────────────────────────────
// Toast non bloccante. Retrocompatibile: toast('msg') resta valido.
// opts.type: 'error' | 'success' (colore) · opts.duration: ms (default 2500).
export function toast(msg, opts = {}) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('toast-error', 'toast-success');
    if (opts.type === 'error') t.classList.add('toast-error');
    else if (opts.type === 'success') t.classList.add('toast-success');
    t.classList.add('show');
    clearTimeout(t._hideTimer);   // evita che un timer precedente nasconda un toast più recente
    t._hideTimer = setTimeout(() => t.classList.remove('show'), opts.duration || 2500);
}

export function openMo(id)  { document.getElementById(id).classList.add('show'); }
export function closeMo(id) { document.getElementById(id).classList.remove('show'); }

// ─────────────────────────────────────────────────────────────
// FORM-CHECK VIDEO (Supabase Storage)
// Bucket privato 'form-checks', path = {athId}/{ts}-{rand}.{ext}.
// I messaggi con media_type='video' portano in media_url il PATH
// (non l'URL pubblico): l'URL firmato è generato on-render e scade.
// ─────────────────────────────────────────────────────────────
export const FORM_CHECK_BUCKET = 'form-checks';
const FORM_CHECK_MAX_BYTES = 50 * 1024 * 1024; // 50MB, allineato al cap del bucket

// Carica un file video nel bucket. Ritorna il path salvato, o lancia con messaggio pulito.
export async function uploadFormCheckVideo(file, athId) {
    if (!window.mySupabase) throw new Error('Connessione assente.');
    if (!file) throw new Error('Nessun file.');
    if (!/^video\//.test(file.type || '')) throw new Error('Serve un file video.');
    if (file.size > FORM_CHECK_MAX_BYTES) {
        throw new Error(`Video troppo grande (max 50MB, il tuo è ${(file.size / 1048576).toFixed(0)}MB).`);
    }
    const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
    const path = `${athId}/${Date.now()}-${uid()}.${ext}`;
    const { error } = await window.mySupabase.storage
        .from(FORM_CHECK_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(error.message || 'Upload fallito.');
    return path;
}

// Genera un URL firmato (default 2h) per un path del bucket. Null se fallisce.
export async function signFormCheckUrl(path, expiresSec = 7200) {
    if (!window.mySupabase || !path) return null;
    try {
        const { data, error } = await window.mySupabase.storage
            .from(FORM_CHECK_BUCKET)
            .createSignedUrl(path, expiresSec);
        if (error) return null;
        return data ? data.signedUrl : null;
    } catch { return null; }
}

// Post-processa un container di chat: per ogni <video data-mpath> firma il path e imposta la src.
export async function hydrateMediaBubbles(container) {
    if (!container) return;
    const vids = container.querySelectorAll('video[data-mpath]:not([data-hydrated])');
    for (const v of vids) {
        v.setAttribute('data-hydrated', '1');
        const url = await signFormCheckUrl(v.getAttribute('data-mpath'));
        if (url) v.src = url;
        else {
            const err = document.createElement('div');
            err.style.cssText = 'font-size:11px;color:var(--muted);padding:6px 0';
            err.textContent = 'Video non disponibile';
            v.replaceWith(err);
        }
    }
}

// HTML di una bolla-video (placeholder: la src è iniettata da hydrateMediaBubbles).
export function mediaBubbleHtml(path, caption, isMine) {
    const cap = caption && caption.trim()
        ? `<div style="font-size:11.5px;color:${isMine ? '#000' : 'var(--text)'};opacity:.85;margin-top:5px;word-break:break-word">${escHtml(caption)}</div>`
        : '';
    return `<video data-mpath="${escHtml(path)}" controls preload="metadata" playsinline
        style="max-width:100%;width:220px;border-radius:10px;background:#000;display:block"></video>${cap}`;
}

// ─────────────────────────────────────────────────────────────
// FORM-CHECK ANNOTAZIONI (overlay vettoriale sincronizzato ai timestamp)
// Un'annotazione = { v:1, shapes:[ {id,t,type,color,...} ] } salvata in
// messages.annotations. shape.t = secondi nel video; coord normalizzate 0..1
// sul content-rect del frame (così l'allineamento regge su schermi diversi).
// type 'pen' → { pts:[[x,y],...], w }; type 'text' → { x, y, text }.
// ─────────────────────────────────────────────────────────────

export function hasAnnotations(msg) {
    return !!(msg && msg.annotations && Array.isArray(msg.annotations.shapes) && msg.annotations.shapes.length);
}

// Rettangolo reale del frame dentro l'elemento <video> (letterbox object-fit:contain),
// in px relativi all'elemento. Senza dimensioni intrinseche → usa l'intero box.
export function videoContentRect(videoEl) {
    if (!videoEl) return { x: 0, y: 0, w: 0, h: 0 };
    const bw = videoEl.clientWidth, bh = videoEl.clientHeight;
    const vw = videoEl.videoWidth, vh = videoEl.videoHeight;
    if (!vw || !vh || !bw || !bh) return { x: 0, y: 0, w: bw, h: bh };
    const scale = Math.min(bw / vw, bh / vh);
    const w = vw * scale, h = vh * scale;
    return { x: (bw - w) / 2, y: (bh - h) / 2, w, h };
}

const _snapT = (t) => Math.round((t || 0) * 1000) / 1000;

// Shapes del momento attivo a t: il momento "vive" dal suo timestamp fino a quello
// del momento successivo. Prima del primo momento → [].
export function activeMomentShapes(shapes, t) {
    if (!Array.isArray(shapes) || !shapes.length) return [];
    const moments = [...new Set(shapes.map(s => _snapT(s.t)))].sort((a, b) => a - b);
    let active = null;
    for (const m of moments) { if (m <= t + 1e-3) active = m; else break; }
    if (active === null) return [];
    return shapes.filter(s => _snapT(s.t) === active);
}

// Momenti distinti ordinati con conteggio shapes (per lista + markers scrubber).
export function annotationMoments(shapes) {
    if (!Array.isArray(shapes) || !shapes.length) return [];
    const map = new Map();
    for (const s of shapes) { const t = _snapT(s.t); map.set(t, (map.get(t) || 0) + 1); }
    return [...map.entries()].map(([t, count]) => ({ t, count })).sort((a, b) => a.t - b.t);
}

// Disegna gli shapes sul contesto 2D. rect = content-rect (px); coord shape 0..1.
export function drawAnnotationShapes(ctx, shapes, rect) {
    if (!ctx || !Array.isArray(shapes) || !rect || !rect.w || !rect.h) return;
    const { x, y, w, h } = rect;
    const px = (nx) => x + nx * w, py = (ny) => y + ny * h;
    for (const s of shapes) {
        ctx.save();
        ctx.strokeStyle = s.color || '#ff3b30';
        ctx.fillStyle = s.color || '#ff3b30';
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        if (s.type === 'pen' && Array.isArray(s.pts) && s.pts.length) {
            ctx.lineWidth = Math.max(2, (s.w || 0.006) * w);
            if (s.pts.length === 1) {
                ctx.beginPath();
                ctx.arc(px(s.pts[0][0]), py(s.pts[0][1]), ctx.lineWidth / 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.moveTo(px(s.pts[0][0]), py(s.pts[0][1]));
                for (let i = 1; i < s.pts.length; i++) ctx.lineTo(px(s.pts[i][0]), py(s.pts[i][1]));
                ctx.stroke();
            }
        } else if (s.type === 'text' && s.text) {
            const fs = Math.max(13, 0.04 * h);
            ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
            ctx.textBaseline = 'top';
            const tx = px(s.x || 0), ty = py(s.y || 0);
            const mw = ctx.measureText(s.text).width;
            const padX = fs * 0.4, padY = fs * 0.25;
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(tx - padX, ty - padY, mw + padX * 2, fs + padY * 2);
            ctx.fillStyle = s.color || '#ffd60a';
            ctx.fillText(s.text, tx, ty);
        }
        ctx.restore();
    }
}

export function updateCloudStatus(statusKey) {
    const dot = document.getElementById('save-dot');
    const txt = document.getElementById('save-txt');
    if (!dot || !txt) return;

    dot.style.animation = 'none';
    const timeStr = new Date().getHours() + ':' + String(new Date().getMinutes()).padStart(2, '0');

    switch (statusKey) {
        case 'saving':
            dot.style.background = '#ff7a55'; txt.style.color = '#ff7a55';
            txt.textContent = 'Sincronizzazione...';
            dot.style.animation = 'pulse 0.8s infinite alternate';
            break;
        case 'cloud':
            dot.style.background = 'var(--teal)'; txt.style.color = 'var(--text)';
            txt.textContent = 'Cloud Sincronizzato ' + timeStr;
            break;
        case 'local':
            dot.style.background = 'var(--blue)'; txt.style.color = 'var(--blue)';
            txt.textContent = 'Salvato in Locale ' + timeStr;
            break;
        case 'error':
            dot.style.background = '#ef4444'; txt.style.color = '#ef4444';
            txt.textContent = 'Errore Cloud';
            break;
    }
}

// ─────────────────────────────────────────────────────────────
// APP ATLETA v4 — micro-interazioni + tema grafici
// ─────────────────────────────────────────────────────────────

// Colori sRGB equivalenti ai token oklch (il canvas di Chart.js non risolve var(--x)).
export const AX = {
    accent:   '#FF9044',   // oklch(0.76 0.16 52)
    accentHi: '#FFB160',   // oklch(0.83 0.14 62)
    accentLo: '#EB6F32',   // oklch(0.68 0.17 44)
    neutral:  '#9AA3AE',   // --mono-dim (serie secondaria)
    tick:     '#6B7480',
    grid:     'rgba(255,255,255,0.05)',
    bg:       '#0A0C0F',
    mono:     "'IBM Plex Mono', monospace",
};

// Riempimento verticale accento → trasparente, calcolato sull'area reale del grafico.
export function axAreaFill(alphaTop = 0.32) {
    return (c) => {
        const { ctx, chartArea } = c.chart;
        if (!chartArea) return `rgba(255,144,68,${alphaTop / 3})`;
        const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        g.addColorStop(0, `rgba(255,144,68,${alphaTop})`);
        g.addColorStop(0.65, `rgba(255,144,68,${alphaTop / 5})`);
        g.addColorStop(1, 'rgba(255,144,68,0)');
        return g;
    };
}

// Opzioni condivise: tooltip scuro, assi mono, griglia tratteggiata, animazione morbida.
export function axChartOptions(extra = {}) {
    const font = { family: AX.mono, size: 9.5, weight: '500' };
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        animation: { duration: 900, easing: 'easeOutQuart' },
        layout: { padding: { top: 8, right: 6 } },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(17,20,25,.96)',
                borderColor: 'rgba(255,144,68,.35)', borderWidth: 1,
                titleColor: '#9AA3AE', bodyColor: '#E6E9ED',
                titleFont: { family: AX.mono, size: 10, weight: '500' },
                bodyFont:  { family: AX.mono, size: 12, weight: '600' },
                padding: 10, cornerRadius: 10, displayColors: false, caretSize: 5,
            },
        },
        scales: {
            x: { grid: { display: false }, border: { display: false },
                 ticks: { color: AX.tick, font, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
            y: { grid: { color: AX.grid }, border: { display: false, dash: [3, 4] },
                 ticks: { color: AX.tick, font, maxTicksLimit: 5, padding: 6 } },
        },
        ...extra,
    };
}

// Range Y onesto: almeno ±4% del valore, così 147→150 kg non sembra un salto verticale.
export function axHonestRange(values, minPadPct = 0.04) {
    const v = values.filter(x => isFinite(x) && x > 0);
    if (!v.length) return {};
    const lo = Math.min(...v), hi = Math.max(...v);
    const pad = Math.max((hi - lo) * 0.25, hi * minPadPct);
    return { suggestedMin: Math.floor(lo - pad), suggestedMax: Math.ceil(hi + pad) };
}

// Evidenzia solo l'ultimo punto (il "tu, adesso"): gli altri restano linea pulita.
export function axLastPointOnly(n, r = 5) {
    return Array.from({ length: n }, (_, i) => (i === n - 1 ? r : 0));
}

// Ingresso pannello atleta: count-up dei numeri KPI + sweep del ring readiness.
// Solo animazione visiva: il testo finale resta identico a quello renderizzato.
export function playEntrance(panel) {
    if (!panel || !document.body.classList.contains('is-athlete')) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    // Esclusi i KPI live della sessione: endWorkout() li rilegge dal DOM.
    panel.querySelectorAll('.kpi-v, .ring-n, .ax-stat-v, .ax-rec-v').forEach(el => {
        if (el.closest('#p-sessione')) return;
        const node = [...el.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
        if (!node) return;
        const m = node.textContent.match(/^(\s*)(\d+(?:\.\d+)?)(.*)$/s);
        if (!m) return;
        const target = parseFloat(m[2]);
        if (!isFinite(target) || target === 0) return;
        const dec = (m[2].split('.')[1] || '').length;
        const t0 = performance.now(), dur = 750;
        const step = now => {
            if (!node.isConnected) return;            // ri-render nel frattempo: stop
            const p = Math.min(1, (now - t0) / dur);
            const e = 1 - Math.pow(1 - p, 3);
            node.textContent = m[1] + (target * e).toFixed(dec) + m[3];
            if (p < 1) requestAnimationFrame(step);
        };
        node.textContent = m[1] + (0).toFixed(dec) + m[3];
        requestAnimationFrame(step);
    });

    const ring = panel.querySelector('#ring-f');
    if (ring) {
        const final = ring.style.strokeDashoffset;
        ring.style.transition = 'none';
        ring.style.strokeDashoffset = '289';
        ring.getBoundingClientRect();                 // forza il reflow
        ring.style.transition = '';
        requestAnimationFrame(() => { ring.style.strokeDashoffset = final; });
    }
}

// ─────────────────────────────────────────────────────────────
// MESOCICLO A BLOCCHI (fasi) — helper puri, condivisi coach/atleta
//
// Un mesociclo = sequenza di blocchi. Ogni blocco copre un intervallo
// di settimane [weekStart..weekEnd] e ha il PROPRIO split (sedute) +
// esercizi. La progressione per-settimana esistente gestisce il carico
// DENTRO il blocco. Il blocco attivo è determinato dalla data d'inizio
// mesociclo (mesoStartDate): settimana = giorni_trascorsi / 7.
//
// Retro-compatibilità: una scheda senza `blocks`/`blockId` = un blocco
// unico implicito che copre 1..duration → comportamento identico al
// vecchio (tutte le sedute sempre visibili).
// ─────────────────────────────────────────────────────────────

/** Normalizza la scheda: garantisce almeno un blocco e blockId su ogni seduta. Muta e ritorna sch. */
export function ensureBlocks(sch) {
    if (!sch) return sch;
    if (!Array.isArray(sch.sessions)) sch.sessions = [];
    const dur = sch.duration || 4;
    if (!Array.isArray(sch.blocks) || sch.blocks.length === 0) {
        const blockId = 'blk_default';
        sch.blocks = [{
            id: blockId, name: 'Blocco 1', weekStart: 1, weekEnd: dur,
            scheduledDays: [...(sch.scheduledDays || [])]
        }];
        sch.sessions.forEach(s => { if (!s.blockId) s.blockId = blockId; });
    }
    // Ogni seduta deve puntare a un blocco esistente (riassegna gli orfani al primo).
    const validIds = new Set(sch.blocks.map(b => b.id));
    sch.sessions.forEach(s => { if (!validIds.has(s.blockId)) s.blockId = sch.blocks[0].id; });
    return sch;
}

/** Settimana corrente del mesociclo dalla data d'inizio, o null se non impostata. Clampata a [1, duration]. */
export function mesoWeekFromDate(sch) {
    if (!sch || !sch.mesoStartDate) return null;
    const start = new Date(sch.mesoStartDate + 'T00:00:00');
    if (isNaN(start.getTime())) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - start) / 86400000);
    const dur = sch.duration || 4;
    if (diffDays < 0) return 1;
    return Math.min(dur, Math.floor(diffDays / 7) + 1);
}

/** Blocco attivo per una data settimana. null quando 0/1 blocco (→ tutte le sedute visibili, legacy). */
export function activeBlock(sch, week) {
    if (!sch || !Array.isArray(sch.blocks) || sch.blocks.length <= 1) return null;
    const w = week || 1;
    return sch.blocks.find(b => w >= (b.weekStart || 1) && w <= (b.weekEnd || 9999))
        || sch.blocks[sch.blocks.length - 1];   // oltre l'ultimo blocco → resta sull'ultimo
}

/** Sedute visibili nella settimana indicata (filtrate sul blocco attivo). */
export function sessionsForWeek(sch, week) {
    if (!sch || !Array.isArray(sch.sessions)) return [];
    const blk = activeBlock(sch, week);
    if (!blk) return sch.sessions;
    const f = sch.sessions.filter(s => s.blockId === blk.id);
    return f.length ? f : sch.sessions;   // safety: blocco senza sedute → non nascondere tutto
}

/** Giorni programmati effettivi per la settimana (del blocco attivo, con fallback a livello scheda). */
export function activeScheduledDays(sch, week) {
    const blk = activeBlock(sch, week);
    if (blk && Array.isArray(blk.scheduledDays) && blk.scheduledDays.length) return blk.scheduledDays;
    return (sch && sch.scheduledDays && sch.scheduledDays.length) ? sch.scheduledDays : null;
}

/**
 * Converte un oggetto sessione locale (camelCase) in una riga cloud che contiene
 * SOLO le colonne realmente esistenti nella tabella `sessions`.
 * Evita il bug PGRST204: uno spread {...sessObj} portava chiavi non-colonna
 * (athlete, session, sRPE, maxE1rm, e1rmDom, e1rmNDom) → upsert 400 e sessione
 * mai salvata (storico/calendario non aggiornati) mentre il messaggio in chat sì.
 */
export function sessionCloudRow(s) {
    return {
        id:           s.id,
        athlete_id:   s.athlete,
        date:         s.date,
        session_name: s.session,
        session_type: s.sessionType || 'Palestra',
        week:         s.week,
        phase:        s.phase,
        readiness:    s.readiness,
        vol:          s.vol,
        srpe:         s.sRPE,
        rpe:          s.rpe,
        qual:         s.qual,
        hrv:          s.hrv || 0,
        max_e1rm:     s.maxE1rm  || 0,
        e1rm_dom:     s.e1rmDom  || 0,
        e1rm_ndom:    s.e1rmNDom || 0,
        doms:         s.doms  || '',
        flag:         s.flag  || '',
        notes:        s.notes || '',
        reply:        s.reply || '',
        variations:   s.variations || ''
    };
}
