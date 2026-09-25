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
