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
