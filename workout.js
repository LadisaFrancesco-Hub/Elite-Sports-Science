/* ══════════════════════════════════════════════════════════════
   ELITE SPORTS SCIENCE — workout.js
   Responsabilità:
     1. Stato condiviso della sessione live  (liveState, realLog,
        carichiFuturi, activeTimers, activeIsoTimers, sharedAudioCtx)
     2. Caricamento scheda live              (loadLive)
     3. Calcolo istantaneo dei totali        (updateLiveTotals)
     4. Touch/Swipe intelligente sui pallini (attachDotSwipe, toggleDot)
     5. Log reale Rep/Kg per set             (openRealLog, saveRealLog)
     6. Sovraccarico progressivo live        (saveLiveNextLoad)
     7. Audio iOS e suono di fine timer      (unlockAudio, playTimerEndSound)
     8. Timer recupero (REST)                (startTimer)
     9. Timer isometria                      (startIsoTimer)
    10. Utilità                              (formatTime)

   Dipendenze globali (definite in app.js / auth.js):
     DB, appState.selAthId, KEY, uid(), window.saveDB(), window.getEdExercises(),
     openMo(), closeMo(), window.go(), toast(),
     window.renderAnalytics(), window.renderDashboard(), window.renderE1rmChart()
   ══════════════════════════════════════════════════════════════ */

import { DB, appState, EXERCISE_LIBRARY, KEY } from './state.js';
import { uid, escHtml, toast, openMo, closeMo, athName, athById, updateCloudStatus,
         mesoWeekFromDate, sessionsForWeek, sessionCloudRow } from './utils.js';


// ─────────────────────────────────────────────────────────────
// Riconciliazione: ri-sincronizza le sessioni rimaste solo in locale
// (upsert fallito / offline). Marcate con _synced === false (campo locale,
// NON nella whitelist sessionCloudRow → non raggiunge il cloud). Chiamata su
// 'online', ritorno in foreground e una volta dopo l'hydration. Nessun polling.
// ─────────────────────────────────────────────────────────────
export function reconcileUnsyncedSessions() {
    if (!window.mySupabase || !navigator.onLine) return;
    const pending = DB.sessions.filter(s => s._synced === false);
    if (!pending.length) return;
    updateCloudStatus('saving');
    const rows = pending.map(sessionCloudRow);
    window.mySupabase.from('sessions').upsert(rows)
        .then(({ error }) => {
            if (error) { console.error('[reconcile sessions]', error); updateCloudStatus('error'); return; }
            pending.forEach(s => { s._synced = true; });
            window.saveDB?.();
            updateCloudStatus('cloud');
        });
}


// ─────────────────────────────────────────────────────────────
// 1. STATO CONDIVISO DELLA SESSIONE LIVE
// ─────────────────────────────────────────────────────────────

/** Mappa { exIndex → { wDone: Set, lDone: Set } } — pallini attivi */
let liveState = {};

/** Stato dei circuiti a tempo attivi — { circuitIdx → { running, phase, round, exIdx, interval, endTime } } */
if (!window.circuitStates) window.circuitStates = {};

/**
 * window.realLog → { logKey → { rep, kg } }
 * logKey = "{sessId}-w{week}-{exIndex}-{setIndex}"
 * Inizializzato da loadLive e persistito in localStorage ad ogni set.
 */
if (!window.realLog)        window.realLog        = {};

/**
 * window.carichiFuturi → { "{sessId}-{exIndex}" → valore stringa }
 * Nota del campo "Prossimo Carico" dell'atleta durante la sessione.
 */
if (!window.carichiFuturi)  window.carichiFuturi  = {};

/** Contatori e1RM calcolati durante la sessione — esposti globalmente */
window.liveMaxE1rm  = 0;
window.liveE1rmDom  = 0;
window.liveE1rmNDom = 0;

// ─────────────────────────────────────────────────────────────
// Persistenza sessione live (ripresa dopo chiusura/crash)
// Scoping: la ripresa vale SOLO per lo stesso atleta e lo stesso
// giorno; i pallini si riapplicano solo alla stessa sessione+settimana.
// ─────────────────────────────────────────────────────────────
const LK_DOTS = 'coachOS_live_dots';
const LK_LOG  = 'coachOS_real_log';
const LK_CTX  = 'coachOS_live_ctx';
const _todayISO = () => new Date().toISOString().slice(0, 10);

function _readLiveCtx() {
    try { return JSON.parse(localStorage.getItem(LK_CTX) || 'null'); } catch { return null; }
}

/** Salva il contesto della ripresa insieme a pallini + realLog. */
export function saveLiveCtx(sessId, week) {
    try {
        localStorage.setItem(LK_CTX, JSON.stringify({
            athId: appState.selAthId, sessId: String(sessId || ''),
            week: String(week || '1'), date: _todayISO(),
        }));
    } catch { /* storage pieno/negato: ignora */ }
}

/** Cancella ogni traccia della sessione in corso (a fine allenamento o su richiesta). */
export function clearLiveRecovery() {
    _cancelLiveProgressSave();   // evita che un flush in coda ri-crei la sessione appena pulita
    localStorage.removeItem(LK_DOTS);
    localStorage.removeItem(LK_LOG);
    localStorage.removeItem(LK_CTX);
    window.realLog = {};
}

// ── P4: persistenza progresso live DEBOUNCED (auto-save anti-crash iOS) ──────
// Prima si scriveva su localStorage ad OGNI tap set dentro updateLiveTotals
// (querySelectorAll + 2× JSON.stringify sincroni) → micro-jank sul tapping rapido.
// Ora coalizzato: max una scrittura ogni ~400ms. Rete di sicurezza: flush SINCRONO
// su pagehide / visibilitychange(hidden) → se iOS killa o sospende la tab, l'ultimo
// stato viene comunque salvato (più robusto del write-per-tap precedente).
let _liveSaveTimer = null;

function _flushLiveProgress() {
    _liveSaveTimer = null;
    const dots = [];
    document.querySelectorAll('.dot.done').forEach(d => dots.push(d.id));
    try {
        localStorage.setItem(LK_DOTS, JSON.stringify(dots));
        localStorage.setItem(LK_LOG,  JSON.stringify(window.realLog || {}));
    } catch { /* storage pieno/negato: ignora */ }
    if (dots.length > 0 || Object.keys(window.realLog || {}).length > 0) {
        const sel  = document.getElementById('lv-sess');
        const wkEl = document.getElementById('lv-week');
        saveLiveCtx(sel ? sel.value : '', (wkEl && parseInt(wkEl.value)) || 1);
    }
}

function scheduleLiveProgressSave() {
    if (_liveSaveTimer) return;                 // già in coda: coalizza il burst di tap
    _liveSaveTimer = setTimeout(_flushLiveProgress, 400);
}

function _cancelLiveProgressSave() {
    if (_liveSaveTimer) { clearTimeout(_liveSaveTimer); _liveSaveTimer = null; }
}

// Flush immediato quando la tab passa in background o viene chiusa (iOS kill/suspend).
if (typeof window !== 'undefined') {
    const _flushNow = () => { if (_liveSaveTimer) { clearTimeout(_liveSaveTimer); _flushLiveProgress(); } };
    window.addEventListener('pagehide', _flushNow);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') _flushNow(); });
}

/**
 * Ripristina window.realLog se la ripresa è dello stesso atleta e di oggi.
 * Se è di un altro atleta o di un giorno passato, pulisce i residui.
 * Ritorna il ctx valido (o null).
 */
function _rehydrateLiveRecovery() {
    const ctx = _readLiveCtx();
    if (!ctx || ctx.athId !== appState.selAthId || ctx.date !== _todayISO()) {
        if (ctx) clearLiveRecovery();   // stantio o di un altro atleta
        return null;
    }
    try {
        const saved = JSON.parse(localStorage.getItem(LK_LOG) || '{}');
        if (saved && typeof saved === 'object') window.realLog = saved;
    } catch { /* ignora */ }
    return ctx;
}

/** Pulisce il recovery via UI ("Ricomincia da capo") e ricarica la sessione. */
export function restartLiveSession() {
    clearLiveRecovery();
    loadLive();
}

/** Banner "Riprendi la sessione di oggi" quando ci sono set già registrati. */
function _renderResumeBanner(sessId, week, sessionName, ctxMatches) {
    const box = document.getElementById('lv-resume');
    if (!box) return;
    const prefix = `${sessId}-w${week}-`;
    const logged = ctxMatches
        ? Object.keys(window.realLog || {}).filter(k => k.startsWith(prefix)).length
        : 0;
    if (!logged) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = 'block';
    box.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;
                  background:var(--accent-wash,rgba(249,115,22,.12));
                  border:1px solid var(--accent,#f97316);border-radius:12px;
                  padding:11px 13px;margin-bottom:10px">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:800;color:var(--text)">Sessione in corso — ripresa</div>
          <div style="font-size:11.5px;color:var(--muted);margin-top:2px">
            ${logged} set già registrati oggi in "${escHtml(sessionName)}". Continua da dove avevi lasciato.
          </div>
        </div>
        <button onclick="restartLiveSession()"
                style="flex-shrink:0;background:transparent;border:1px solid var(--border);
                       color:var(--muted);border-radius:8px;padding:6px 10px;font-size:11px;
                       font-weight:700;cursor:pointer">Ricomincia da capo</button>
      </div>`;
}


// Istruzioni contestuali per ogni protocollo series_type
const SERIES_TYPE_INSTRUCTIONS = {
    drop_set:        'Arriva a cedimento (o al RIR previsto), poi riduci subito il carico del 20-30% e continua senza pausa fino a un nuovo cedimento. Ripeti il drop 1-2 volte come indicato.',
    rest_pause:      'Esegui la serie a cedimento, riposa 15-20", poi riparti con lo stesso carico per altre reps. Ripeti 2-3 mini-serie: sfrutti il recupero parziale per accumulare volume ad alta intensità.',
    myo_reps:        'Set di attivazione al cedimento relativo, poi mini-set da 3 reps con 20" di riposo. Smetti quando non riesci a completare 3 reps pulite.',
    cluster:         'Dividi le rep in cluster con 15" di pausa intra-serie. Mantieni il carico alto — la pausa permette di recuperare ATP senza scaricare i muscoli.',
    triphasic:       'Alterna fasi: eccentrica lenta (5s), isometrica (3s al punto di massima tensione), concentrica esplosiva. Una tecnica per settimana.',
    wave_load:       'Schemi 3-2-1 con carico crescente. Al termine del ciclo, ricomincia con +2.5% rispetto all\'onda precedente.',
    hyper_stretch:   'Esegui le ultime 4-5 reps con range ampliato in allungamento massimale. Controlla la discesa — non rimbalzare.',
    amrap_top:       'Top set: vai a cedimento (AMRAP). Poi riduci del 20% e completa i back-off sets con le reps indicate.',
    wendler_531:     'Schema 5/3/1: settimana 1 = 3×5, settimana 2 = 3×3, settimana 3 = 3×1+ (AMRAP sull\'ultimo set). Settimana 4 = deload.',
    hyper_metabolic: 'Densità metabolica: brevi pause (20-30") tra i set per massimizzare il pump e la risposta ormonale.',
    double_prog:     'Doppia progressione: aumenta le reps fino al range alto, poi aumenta il carico di 2.5 kg e ricomincia dal basso.',
    linear_classic:  'Progressione lineare: aggiungi 2.5 kg ogni sessione fino al plateau, poi esegui un deload prima di ricominciare.',
    step_load:       'Carico a gradini: aumenta ogni 2-3 settimane a scaglioni, poi uno scarico prima della fase successiva.',
    overreach:       'Settimana di sovraccarico intenzionale. Tecnica rigorosa — il recupero avverrà nella settimana di scarico.',
    wave_contrast:   'Alterna serie pesanti (3-5 reps) e serie esplosive/leggere (6-8 reps). Il contrasto attiva più unità motorie.',
    french_contrast: 'Sequenza 4 esercizi: sforzo massimale → balistico → plyometrico → reattivo, senza pausa. Potenzia la forza esplosiva.',
    hyper_block_dup: 'Duplicazione del blocco: ripeti le stesse sessioni due volte per blocco, aumentando il carico alla seconda ripetizione.',
    block_period:    'Periodizzazione a blocchi: ogni fase è specializzata (accumulo, intensificazione, realizzazione). Segui l\'ordine della scheda.',
    lin_taper:       'Taper lineare: volume decresce progressivamente avvicinandosi alla gara. Mantieni l\'intensità alta, riduci solo le serie.',
};

// Dettaglio numerico compatto di una tecnica, calcolato da rep/kg base (non salvato nel DB).
// Serve al riquadro "Come eseguire" lato atleta: tiene i numeri fuori dalla casella reps.
function describeTechnique(tech, rep, kg) {
    const r = parseInt(rep) || 0;
    const k = parseFloat(kg) || 0;
    const round = v => Math.round(v / 2.5) * 2.5;
    switch (tech) {
        case 'drop_set':
            return k > 0 ? `${k} → ${round(k * 0.75)} → ${round(k * 0.55)} kg · a cedimento`
                         : 'a cedimento, poi −20/30% kg e continua';
        case 'rest_pause':
            return 'a cedimento, rec 15–20″, riparti · 2–3 mini-serie';
        case 'myo_reps':
            return `${Math.max(10, r + 2) || 10} + 3 + 3 + 3 · rec 20″`;
        case 'cluster': {
            const m = Math.round(r / 3) || 2;
            return `${m}.${m}.${m} · 15″ intra-serie`;
        }
        case 'hyper_stretch':
            return `${r || ''} + 4/5 parziali in allungamento`.trim();
        case 'hyper_metabolic': {
            const act = Math.max(12, r * 2) || 12, cl = Math.round(r / 2) || 3;
            return `${act} + ${cl} + ${cl} + ${cl} · rec 15″`;
        }
        case 'amrap_top':
            return 'top set a cedimento (AMRAP) + back-off';
        default:
            return '';
    }
}

// Indici 0-based delle serie bersaglio di una tecnica. 'all' → tutte; 'last' → ultima;
// 'lastN' → ultime N; numero → quella serie (1-based in input).
function _resolveTechSets(techSet, total) {
    const s = new Set();
    if (!total) return s;
    const t = String(techSet || 'all');
    if (t === 'all') { for (let i = 0; i < total; i++) s.add(i); return s; }
    if (t === 'last') { s.add(total - 1); return s; }
    const mLast = t.match(/^last(\d+)$/);
    if (mLast) { const n = Math.min(total, parseInt(mLast[1])); for (let i = total - n; i < total; i++) s.add(i); return s; }
    const n = parseInt(t);
    if (n >= 1 && n <= total) s.add(n - 1);
    return s;
}

// Etichetta leggibile della serie bersaglio (per il riquadro "Come eseguire").
function _techSetLabel(techSet, total) {
    const t = String(techSet || 'all');
    if (t === 'all' || !t) return '';
    if (t === 'last') return 'Ultima serie';
    const m = t.match(/^last(\d+)$/);
    if (m) return `Ultime ${m[1]} serie`;
    const n = parseInt(t);
    return n >= 1 ? `Serie ${n}` : '';
}

// Separa una stringa rep in { meta: versione corta per la casella, detail: schema completo }.
// Evita che schemi auto-generati tipo "16 + 4 + 4 + 4 (15\" rest)" sforino su mobile:
// la casella mostra "16+4+4+4", il resto va nel riquadro "Come eseguire".
function _compactRep(rep) {
    const full = (rep == null) ? '' : String(rep);
    const isCompound = /[+(]/.test(full) || full.length > 10;
    if (!isCompound) return { meta: full, detail: '' };
    let meta = full.split('(')[0].replace(/\s*\+\s*/g, '+').replace(/\s*,\s*/g, ',').trim();
    if (meta.length > 12) meta = meta.split(/[+\s]/)[0] + '…';
    return { meta, detail: full };
}

// Riconosce una serie "a tempo" (es. 45", 45'', 1', 1'30", 45s) e la converte in secondi.
// Ritorna 0 se NON è un tempo (es. "10" reps, range "8-10") → il pallino resta un set normale.
function _setTimeSeconds(raw) {
    if (raw == null) return 0;
    let s = String(raw).trim()
        .replace(/[’′]/g, "'")   // normalizza apici tipografici
        .replace(/[”″]/g, '"');
    if (!s || !/['"s]/i.test(s)) return 0; // serve un marcatore di tempo
    // Schemi compositi/a intervalli (es. "30''/lato + 12/lato", "5x(1'+4')") → NON un singolo timer
    if (/[+(]/.test(s) || /\d\s*x/i.test(s)) return 0;
    // 1'30" / 1'30'' / 1'30 → minuti + secondi
    let m = s.match(/^(\d+)\s*'\s*(\d+)/);
    if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
    // 1' → minuti interi
    m = s.match(/^(\d+)\s*'\s*$/);
    if (m) return parseInt(m[1]) * 60;
    // 45" / 45'' / 45s / 45 sec → secondi
    m = s.match(/^(\d+)\s*(?:''|"|s)/i);
    if (m) return parseInt(m[1]);
    return 0;
}

/** Mini-grafico SVG: barre = carico REALMENTE FATTO per settimana (kg) + reps in etichetta.
 *  Fonte: DB.sessions[].donePerExercise[nome] salvato a fine sessione. Nessun Chart.js. Focus-only via CSS. */
function _weeklyLoadChart(ex, currentWeek, isVBT, isIso) {
    const head = `<div class="ax-wk-head"><span class="ax-overline">Carico fatto / settimana</span></div>`;
    if (isVBT || isIso) return '';                       // carico non espresso in kg

    // Raccogli il carico fatto per settimana da tutte le sessioni dell'atleta per questo esercizio.
    const byWeek = {};
    (DB.sessions || []).forEach(s => {
        if (s.athlete !== appState.selAthId) return;
        const d = s.donePerExercise && s.donePerExercise[ex.name];
        if (!d || !(d.kg > 0)) return;
        const w = parseInt(s.week) || 1;
        // Per settimana tieni il set più pesante registrato (coerente con il "top set" salvato)
        if (!byWeek[w] || d.kg > byWeek[w].kg) byWeek[w] = { kg: d.kg, reps: d.reps };
    });

    let pts = Object.keys(byWeek)
        .map(w => ({ w: parseInt(w), kg: byWeek[w].kg, reps: byWeek[w].reps }))
        .sort((a, b) => a.w - b.w)
        .slice(-6);                                      // ultime 6 settimane con dati

    // Nessuno storico ancora → empty-state (si popola dopo le prime sessioni)
    if (!pts.length) {
        return `<div class="ax-wk-chart">${head}
          <div class="ax-wk-empty">I tuoi carichi appariranno qui dopo le prime sessioni.</div></div>`;
    }

    const curW  = parseInt(currentWeek) || 1;
    const W = 320, H = 112, padX = 16, padT = 20, padB = 32;
    const plotH = H - padT - padB;
    const maxV  = Math.max(...pts.map(p => p.kg)) || 1;
    const step  = (W - padX * 2) / pts.length;
    const bw    = Math.min(30, step * 0.52);
    const xOf   = i => padX + step * i + (step - bw) / 2;
    const cx    = i => padX + step * i + step / 2;

    const topOf = p => padT + plotH - Math.max((p.kg / maxV) * plotH, 2);

    // Barre (carico fatto)
    const bars = pts.map((p, i) => {
        const h = Math.max((p.kg / maxV) * plotH, 2);
        const fill = p.w === curW ? 'var(--accent)' : 'rgba(255,255,255,.12)';
        return `<rect x="${xOf(i).toFixed(1)}" y="${(padT + plotH - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" style="fill:${fill}"></rect>`;
    }).join('');

    // Linea di tendenza che collega le colonne (andamento del carico)
    const trend = pts.length > 1
        ? `<polyline points="${pts.map((p, i) => `${cx(i).toFixed(1)},${topOf(p).toFixed(1)}`).join(' ')}"
             style="fill:none;stroke:var(--text);stroke-width:1.6;stroke-opacity:.6;stroke-linejoin:round;stroke-linecap:round"></polyline>`
        : '';
    const marks = pts.map((p, i) =>
        `<circle cx="${cx(i).toFixed(1)}" cy="${topOf(p).toFixed(1)}" r="${p.w === curW ? 3.2 : 2.6}" style="fill:var(--text)"></circle>`
    ).join('');

    // Etichette: kg sopra il punto, W{n} e ×reps sotto
    const labels = pts.map((p, i) => {
        const acc = p.w === curW;
        const kgTxt = (Math.round(p.kg * 10) / 10).toString().replace('.0', '');
        return `<text x="${cx(i).toFixed(1)}" y="${(topOf(p) - 9).toFixed(1)}" text-anchor="middle" style="font-size:10px;font-weight:700;font-family:var(--fmono);fill:${acc ? 'var(--accent)' : 'var(--text)'}">${kgTxt}</text>`
          + `<text x="${cx(i).toFixed(1)}" y="${(H - 16).toFixed(1)}" text-anchor="middle" style="font-size:9px;font-family:var(--fmono);fill:${acc ? 'var(--accent)' : 'var(--muted)'}">W${p.w}</text>`
          + `<text x="${cx(i).toFixed(1)}" y="${(H - 5).toFixed(1)}" text-anchor="middle" style="font-size:9px;font-family:var(--fmono);fill:var(--muted)">×${p.reps}</text>`;
    }).join('');

    return `<div class="ax-wk-chart">${head}
      <svg class="ax-wk-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Carico fatto per settimana con andamento">
        ${bars}${trend}${marks}${labels}
      </svg></div>`;
}

/* ─── "Ultima volta" ─────────────────────────────────────────────
 *  Riferimento storico per il sovraccarico progressivo: il top set di lavoro
 *  fatto l'ultima volta su questo esercizio (sessione passata più recente).
 *  Fonte: DB.sessions[].donePerExercise[nome]={kg,reps} (durabile nel cloud da v7.31).
 *  Esclude la seduta odierna in corso (s.date === oggi). null se nessuno storico. */
function _lastTimeFor(exName, athId) {
    const today = _todayISO();
    let best = null; // { kg, reps, date }
    (DB.sessions || []).forEach(s => {
        if (s.athlete !== athId) return;
        if (!s.date || s.date >= today) return;          // escludi oggi/in corso
        const d = s.donePerExercise && s.donePerExercise[exName];
        if (!d || !(d.kg > 0)) return;
        if (!best || s.date > best.date) best = { kg: d.kg, reps: d.reps, date: s.date };
    });
    return best;
}

/* Etichetta relativa breve da una data ISO (YYYY-MM-DD): oggi / ieri / N gg fa / N sett. fa. */
function _daysAgoLabel(iso) {
    const d = new Date(iso + 'T00:00:00');
    const now = new Date(_todayISO() + 'T00:00:00');
    const days = Math.round((now - d) / 86400000);
    if (days <= 0) return 'oggi';
    if (days === 1) return 'ieri';
    if (days < 14) return `${days} gg fa`;
    const wk = Math.round(days / 7);
    if (wk < 9) return `${wk} sett. fa`;
    return `${Math.round(days / 30)} mesi fa`;
}

/* Storico per-serie dell'ultima volta su questo esercizio (stile Hevy "Previous").
 *  Ritorna { sets:[{s,kg,reps},…], date } della sessione passata più recente con dati per-serie,
 *  o null. Stesso filtro di _lastTimeFor (esclude la seduta odierna in corso). */
function _lastTimeSetsFor(exName, athId) {
    const today = _todayISO();
    let best = null; // { sets, date }
    (DB.sessions || []).forEach(s => {
        if (s.athlete !== athId) return;
        if (!s.date || s.date >= today) return;
        const arr = s.setsPerExercise && s.setsPerExercise[exName];
        if (!Array.isArray(arr) || !arr.length) return;
        if (!best || s.date > best.date) best = { sets: arr, date: s.date };
    });
    return best;
}

// ─────────────────────────────────────────────────────────────
// 2. loadLive()
//    Carica e renderizza la scheda della sessione selezionata.
//    Gestisce:
//      - Fallback per atleta senza scheda assegnata
//      - Auto-selezione intelligente della settimana
//        (ultima completata + 1 per quella sessione specifica)
//      - Divisione in fasi (Warm-up / Centrale / Cool-down)
//      - Badge Autoregolazione da Readiness
//      - Ramping warm-up calcolato automaticamente
//      - Badge RIR, TUT, link Video
//      - Timer REST inline per ogni esercizio
//      - Ripristino pallini da crash recovery (localStorage)
// ─────────────────────────────────────────────────────────────
export function loadLive() {
    try {
    const select     = document.getElementById('lv-sess');
    const selectWeek = document.getElementById('lv-week');
    if (!select) return;

    // Ripristina i valori reali (kg/reps) di una sessione in corso PRIMA del render,
    // così i set completati mostrano i dati veri e non i target programmati.
    const _recoveryCtx = _rehydrateLiveRecovery();

    const wrap = document.getElementById('lv-exs');

    // ── Pulizia preventiva garantita ─────────────────────────
    // Svuota entrambi i contenitori PRIMA di qualsiasi logica,
    // così nessun residuo del mesociclo precedente rimane visibile
    // indipendentemente dal path di esecuzione che segue.
    const ultimaSessioneSelezionata = select.value;
    select.innerHTML = '';
    if (wrap) wrap.innerHTML = '';

    const sch = DB.schedules[appState.selAthId];

    // ── Fallback: nessuna scheda assegnata ───────────────────
    if (!sch || !sch.sessions || sch.sessions.length === 0) {
        select.innerHTML = '<option value="">Nessuna scheda</option>';
        if (wrap) {
            wrap.innerHTML = `
              <div style="text-align:center; padding:30px 10px; color:var(--muted);
                          background:var(--s2); border-radius:12px; border:1px dashed var(--border);">
                <div style="font-size:30px; margin-bottom:10px;">📋</div>
                <div style="font-size:14px; font-weight:700; color:var(--text); margin-bottom:5px;">Nessuna scheda assegnata</div>
                <div style="font-size:12px;">Il coach non ha ancora preparato il tuo programma.</div>
              </div>`;
        }
        ['lv-vol', 'lv-e1rm', 'lv-edom', 'lv-endom'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '0 kg';
        });
        const filterDivFallback = document.getElementById('e1rm-ex-filter');
        if (filterDivFallback) filterDivFallback.innerHTML = '';
        try { window.renderE1rmChart(); } catch (e) { console.warn('[loadLive] window.renderE1rmChart fallback:', e); }
        return;
    }

    // ── Settimana corrente + blocco attivo ───────────────────
    // Con data d'inizio impostata la settimana è guidata dal calendario
    // (mesoWk); il blocco/fase attivo è scelto di conseguenza. Senza data,
    // si resta al comportamento manuale (selettore settimana).
    const mesoWk = mesoWeekFromDate(sch);
    const uiWeekRaw = parseInt(selectWeek && selectWeek.value);
    const effWeek = mesoWk || (Number.isFinite(uiWeekRaw) ? uiWeekRaw : 1);
    const visSessions = sessionsForWeek(sch, effWeek);

    // ── Rigenerazione dinamica del menu sessioni ─────────────
    // Mostra SOLO le sessioni del blocco attivo per la settimana corrente.
    visSessions.forEach(s => {
        select.innerHTML += `<option value="${escHtml(s.id)}" data-sesstype="${escHtml(s.sessType||'Palestra')}">${escHtml(s.name)}</option>`;
    });

    const fallbackSessions = visSessions.length ? visSessions : sch.sessions;
    if (ultimaSessioneSelezionata && [...select.options].some(o => o.value === ultimaSessioneSelezionata)) {
        select.value = ultimaSessioneSelezionata;
    } else if (fallbackSessions.length > 0) {
        select.value = fallbackSessions[0].id;
    }

    let sessId = select.value;
    if (!sessId && fallbackSessions.length > 0) { sessId = fallbackSessions[0].id; select.value = sessId; }

    const curSess     = fallbackSessions.find(x => x.id === sessId) || fallbackSessions[0];
    const sessionName = curSess ? curSess.name : '';
    const exs         = curSess ? curSess.exercises : [];

    // ── Auto-selezione intelligente della settimana ──────────
    if (selectWeek) {
        const weeksCount       = sch.duration || 4;
        const isSessionChanged = (select.dataset.lastSess !== sessId);
        select.dataset.lastSess = sessId;

        let targetWeekToSet = selectWeek.value || '1';

        if (mesoWk) {
            // Data d'inizio impostata → la settimana segue il calendario.
            targetWeekToSet = String(mesoWk);
        } else if (isSessionChanged) {
            // Trova l'ultima settimana completata per QUESTA sessione
            const pastPerformances = DB.sessions.filter(
                s => s.athlete === appState.selAthId && s.session === sessionName
            );
            let maxCompletedWeek = 0;
            if (pastPerformances.length > 0) {
                maxCompletedWeek = Math.max(...pastPerformances.map(s => s.week || 1));
            }
            // Suggerisci automaticamente la settimana successiva
            let suggestedWeek = maxCompletedWeek + 1;
            if (suggestedWeek > weeksCount) suggestedWeek = weeksCount;
            targetWeekToSet = suggestedWeek.toString();
        }

        selectWeek.innerHTML = '';
        for (let w = 1; w <= weeksCount; w++) {
            selectWeek.innerHTML += `<option value="${w}">${w}</option>`;
        }
        selectWeek.value = targetWeekToSet;
    }

    // ── GAP 4: Badge fase mesociclo + obiettivo nell'header ──
    let phaseObjEl = document.getElementById('lv-phase-obj');
    if (!phaseObjEl) {
        phaseObjEl = document.createElement('div');
        phaseObjEl.id = 'lv-phase-obj';
        phaseObjEl.style.cssText = 'padding:0 0 8px 0;';
        const frRow = document.querySelector('#lv-sess')?.closest('.fr');
        if (frRow) frRow.after(phaseObjEl);
    }
    if (phaseObjEl) {
        const totalWeeks = sch.duration || 4;
        const currentWeekVal = (selectWeek && selectWeek.value) ? selectWeek.value : '1';
        phaseObjEl.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:${sch.objective ? '4px' : '0'};">
            ${sch.phase ? `<span class="tag tn" style="white-space:nowrap;">${escHtml(sch.phase)}</span>` : ''}
            <span style="font-size:11px;color:var(--muted);">Settimana ${escHtml(currentWeekVal)} di ${totalWeeks}</span>
          </div>
          ${sch.objective ? `<div style="font-size:11px;color:var(--muted);font-style:italic;">Obiettivo: ${escHtml(sch.objective)}</div>` : ''}`;
    }

    // ── Inizializzazione stato pallini ───────────────────────
    liveState = {};
    exs.forEach((_, i) => { liveState[i] = { wDone: new Set(), lDone: new Set() }; });

    // Hint long-press: visibile finché l'atleta non usa il log reale almeno una volta.
    const showHint = !localStorage.getItem('coachOS_hint_seen');
    let   hintShown = false;

    if (!exs.length) {
        if (wrap) wrap.innerHTML = '<div style="color:var(--muted);padding:10px;text-align:center;">Nessun esercizio programmato per questa seduta.</div>';
        const filterDivEmpty = document.getElementById('e1rm-ex-filter');
        if (filterDivEmpty) filterDivEmpty.innerHTML = '';
        try { window.renderE1rmChart(sessionName); } catch (e) { console.warn('[loadLive] window.renderE1rmChart empty:', e); }
        return;
    }

    // Calcola i modificatori fisiologici per questa sessione
    const mods = (typeof computeSessionModifiers === 'function')
        ? computeSessionModifiers()
        : { kgMultiplier: 1.0, setModifier: 0, warningType: 'none', messages: [] };

    // Banner autoregolazione + Tip
    if (wrap) {
        let sessionBanner = '';
        if (mods.warningType !== 'none') {
            const bc = mods.warningType === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)';
            const fc = mods.warningType === 'critical' ? 'var(--coral)' : 'var(--amber)';
            sessionBanner = `<div style="background:${bc};border:1px solid ${fc};color:${fc};
                padding:12px 14px;border-radius:10px;margin-bottom:12px;font-size:11px;font-weight:800;
                letter-spacing:0.3px;">🤖 AUTOREGOLAZIONE ATTIVA
                <div style="font-weight:500;margin-top:6px;line-height:1.8;font-size:11px;">
                    ${mods.messages.join('<br>')}
                </div></div>`;
        }
        const _nWork = exs.filter(ex => ex.section !== 'warmup' && ex.type !== 'circuit').length;
        wrap.innerHTML = sessionBanner + `
        <div id="live-prog-header" style="padding:12px 14px;background:var(--e2);border:1px solid var(--line);border-radius:12px;margin-bottom:12px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <span class="prog-text" style="font-family:var(--fmono);font-size:12px;font-weight:600;color:var(--text)">0/${_nWork} esercizi</span>
                <span class="prog-pct" style="font-family:var(--fmono);font-size:11px;color:var(--muted)">0%</span>
            </div>
            <div style="height:5px;background:rgba(255,255,255,.06);border-radius:99px;overflow:hidden">
                <div class="prog-fill" style="width:0%;height:100%;background:var(--accent);border-radius:99px;transition:width .4s cubic-bezier(.22,1,.36,1);box-shadow:0 0 10px -2px var(--accent)"></div>
            </div>
        </div>`;
        // Tip "Tap sul pallino…" rimosso: l'anteprima non è interattiva (i pallini sono solo in Focus).
    }

    const currentWeek = document.getElementById('lv-week').value || '1';

    // ── Mappa colori per tipo di esercizio ───────────────────
    // v4: un solo accento per tutti i tipi (i 7 colori non avevano legenda né significato di stato);
    // il tipo resta leggibile nei badge SUPERSET/JUMP SET e nel badge serie.
    const typeColors = {};

    // ── Mappa groupId → lettera per il badge atleta ─────────
    // Raccoglie tutti i groupId unici di superset/jump set nell'ordine
    // in cui compaiono e assegna A, B, C… per la visualizzazione.
    const _liveGroupIds = [];
    exs.forEach(e => {
        if ((e.type === 'superset' || e.type === 'jump set') &&
            e.groupId && !_liveGroupIds.includes(e.groupId)) {
            _liveGroupIds.push(e.groupId);
        }
    });
    const _liveGLetter = gid => {
        if (!gid) return '';
        const idx = _liveGroupIds.indexOf(gid);
        return idx >= 0 ? ' ' + String.fromCharCode(65 + idx) : '';
    };

    // ── Fasi della sessione (scompartimenti clinici) ─────────
    const fasiAtleta = [
        { id: 'warmup',   n: '01', label: 'Warm-up & attivazione' },
        { id: 'centrale', n: '02', label: 'Parte centrale / performance' },
        { id: 'cooldown', n: '03', label: 'Cool-down & recupero' }
    ];

    fasiAtleta.forEach(fase => {
        // Filtra gli esercizi di questa fase, mantenendo l'indice originale
        const itemsFase = exs
            .map((ex, originalIndex) => ({ ex, originalIndex }))
            .filter(item => (item.ex.section || 'centrale') === fase.id);

        if (itemsFase.length === 0) return;

        // Intestazione di fase
        const headerDiv = document.createElement('div');
        headerDiv.className = 'ax-phase-h';
        headerDiv.innerHTML = `<b>${fase.n}</b>Fase · ${fase.label}`;
        if (wrap) wrap.appendChild(headerDiv);

        // Wrapper di gruppo superset/jump-set aperto: in Focus il gruppo è UNA pagina.
        // Resettato a ogni fase (un gruppo non attraversa mai un confine di fase).
        let curGroup = null;

        // Card esercizi
        itemsFase.forEach(item => {
            const ex = item.ex;
            const i  = item.originalIndex; // Indice atomico — NON va modificato

            // Fallback campi opzionali: evita crash se il profilo atleta ha esercizi vecchi
            if (ex.trackE1rm === undefined) ex.trackE1rm = false;
            if (ex.wset      === undefined) ex.wset      = 0;

            // ── Circuito a Tempo — render dedicato ───────────
            if (ex.type === 'circuit') {
                const circDiv = _buildCircuitCard(ex, i);
                // Marker Focus Mode: rende la card una "pagina" del pager
                circDiv.classList.add('lv-card');
                circDiv.dataset.exIdx  = i;
                circDiv.dataset.exName = ex.name || 'Circuito';
                circDiv.dataset.phase  = fase.label;
                if (wrap) wrap.appendChild(circDiv);
                curGroup = null; // un circuito chiude sempre un eventuale gruppo
                return;
            }

            // Progressione settimanale
            let targetSet = ex.set;
            let targetRep = ex.rep;
            let targetKg  = ex.kg;
            let targetRir = ex.rir;
            let targetTut = ex.tut;
            // Tecnica d'intensità attiva: prima quella della settimana (progressione),
            // poi il fallback al series_type fisso dell'esercizio.
            let activeTech = (ex.series_type && ex.series_type !== 'manual') ? ex.series_type : '';
            let activeTechSet = 'all';
            if (ex.progression && ex.progression[`w${currentWeek}`]) {
                const pW  = ex.progression[`w${currentWeek}`];
                targetSet = pW.set;
                targetRep = pW.rep;
                targetKg  = pW.kg;
                // RIR/TUT per-settimana (fallback al valore fisso dell'esercizio)
                if (pW.rir != null && pW.rir !== '') targetRir = pW.rir;
                if (pW.tut != null && pW.tut !== '') targetTut = pW.tut;
                // Tecnica per-settimana: se presente sovrascrive quella fissa
                if (pW.tech) activeTech = pW.tech;
                // Serie bersaglio della tecnica (default: tutte)
                if (pW.techSet) activeTechSet = pW.techSet;
            }
            // Reps compatte per la casella meta (schema completo → riquadro "Come eseguire")
            const repCompact = _compactRep(targetRep);

            // ── Tipo esercizio e colore bordo ─────────────────
            const currentType = (ex.type || 'normal').toLowerCase();
            const borderColor = typeColors[currentType] || 'var(--accent)';
            const _stLabels = { myo_reps:'MYO', hyper_block_dup:'BLK', hyper_stretch:'STRCH', hyper_metabolic:'META', block_period:'BLOCK', double_prog:'DBL', overreach:'OVER', lin_taper:'TAPER', step_load:'STEP', wave_contrast:'WAVE', french_contrast:'FC', cluster:'CLST', wave_load:'WL', wup:'WUP', triphasic:'TRI', wendler_531:'531', linear_classic:'LIN', amrap_top:'AMRAP', drop_set:'DROP', rest_pause:'RP' };
            // Badge tecnica vicino al nome solo se applicata a TUTTE le serie (esercizio-level).
            // Per le tecniche su serie specifiche l'evidenziazione sta sui pallini.
            const seriesTypeBadge = (activeTech && activeTechSet === 'all')
                ? `<span class="tag tn">${_stLabels[activeTech] || activeTech.toUpperCase().slice(0,5)}</span>`
                : '';

            // ── GAP 2: Istruzioni protocollo collassabili ─────
            const stInstr = activeTech && SERIES_TYPE_INSTRUCTIONS[activeTech];
            const stLabel = activeTech ? (_stLabels[activeTech] || activeTech.toUpperCase().slice(0,5)) : '';
            const techSetLbl = _techSetLabel(activeTechSet, targetSet);
            const techDetail = activeTech ? (describeTechnique(activeTech, targetRep, targetKg) || repCompact.detail) : '';
            // Riga titolo: "Come eseguire: DROP" + eventuale serie bersaglio ("· Ultima serie")
            const stHeadTxt = `Come eseguire: ${stLabel}${techSetLbl ? ` · ${techSetLbl}` : ''}`;
            const seriesTypeInfoHtml = stInstr ? `
              <div style="margin-top:8px;">
                <div onclick="(function(el){var b=el.nextElementSibling;var a=el.querySelector('.st-arr');b.style.display=b.style.display==='none'?'block':'none';a.textContent=b.style.display==='none'?'▾':'▴';})(this)"
                     style="display:flex;align-items:center;gap:6px;cursor:pointer;min-height:44px;padding:6px 10px;background:var(--e2);border:1px solid var(--line);border-radius:8px;">
                  <span style="font-size:12px;color:var(--text2);">ℹ</span>
                  <span style="font-size:11px;color:var(--muted);">${escHtml(stHeadTxt)}</span>
                  <span class="st-arr" style="font-size:10px;color:var(--muted);margin-left:auto;">▾</span>
                </div>
                <div style="display:none;padding:8px 10px;background:var(--e2);border:1px solid var(--line);border-top:none;border-radius:0 0 8px 8px;">
                  ${techDetail ? `<div style="font-family:var(--fmono);font-size:11.5px;color:var(--accent);font-weight:600;margin-bottom:6px;">${escHtml(techDetail)}</div>` : ''}
                  <span style="font-size:11px;color:var(--muted);line-height:1.6;">${escHtml(stInstr)}</span>
                </div>
              </div>` : '';

            // ── Autoregolazione (Readiness + CNS + Ciclo) ─────
            let numKg       = parseFloat(targetKg) || 0;
            const isVBT     = (typeof targetKg === 'string' && targetKg.toLowerCase().includes('m/s'))
                               || (numKg > 0 && numKg <= 2.5);
            const isIso     = typeof targetKg === 'string' && /['"]/.test(targetKg);
            const isHighCns = ['max effort', 'dynamic effort'].includes(currentType);

            let actualKg     = numKg;
            let actualSet    = targetSet;
            let autoRegBadge = '';

            if (!isVBT && !isIso && numKg > 0 && mods.kgMultiplier < 1.0) {
                actualKg = Math.round((numKg * mods.kgMultiplier) / 2.5) * 2.5;
                const pct = Math.round((1 - mods.kgMultiplier) * 100);
                const fc  = mods.warningType === 'critical' ? 'var(--coral)' : 'var(--amber)';
                const bg  = mods.warningType === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)';

                // ── GAP 3: Messaggio empatico contestuale ────────
                const _sleep  = DB.wellness?.sleep  ?? 3;
                const _stress = DB.wellness?.stress ?? 3;
                const _hasInj = Array.isArray(DB.injuries) && DB.injuries.some(
                    inj => inj.athlete === appState.selAthId && inj.status === 'Attivo');
                let _contextMsg = '';
                if (mods.readiness < 50 && _sleep <= 2) {
                    _contextMsg = `Hai dormito poco stanotte. Ho ridotto il carico del ${pct}% per proteggerti. Concentrati sulla tecnica oggi, non sulla quantità.`;
                } else if (mods.readiness < 50 && _stress >= 4) {
                    _contextMsg = `Lo stress è alto in questo periodo. Lavora sotto-soglia oggi — l'adattamento avviene anche così.`;
                } else if (mods.readiness < 75 && _hasInj) {
                    const _inj = DB.injuries.find(inj => inj.athlete === appState.selAthId && inj.status === 'Attivo');
                    _contextMsg = `Zona ${_inj?.zone || 'sensibile'} sotto controllo. Carico ridotto precauzionalmente. Se senti dolore, fermati e contatta il coach.`;
                } else if (mods.readiness >= 75) {
                    _contextMsg = `Piccolo aggiustamento preventivo. Sei in buona forma — dai il massimo.`;
                }

                autoRegBadge = `${_contextMsg ? `<div style="font-size:11px;font-weight:500;font-style:italic;color:var(--muted);margin-top:8px;margin-bottom:4px;line-height:1.5;">${_contextMsg}</div>` : ''}<div style="background:${bg};color:${fc};border:1px solid ${fc};font-size:10px;padding:4px 8px;border-radius:6px;font-weight:700;display:inline-block;">🤖 Carico autoregolato: <span style="text-decoration:line-through;opacity:0.6;">${numKg}kg</span> → <strong>${actualKg}kg</strong> (-${pct}%)</div>`;
            }

            if (isHighCns && mods.setModifier < 0 && targetSet > 1) {
                actualSet = Math.max(1, targetSet + mods.setModifier);
                autoRegBadge += `<div style="background:rgba(245,158,11,0.1);color:var(--amber);border:1px solid var(--amber);font-size:10px;padding:4px 8px;border-radius:6px;margin-top:4px;font-weight:700;display:inline-block;">🧠 SNC: set ridotti ${targetSet} → <strong>${actualSet}</strong></div>`;
            }

            // ── Rilevamento superset / jump set collegati ─────
            // Il collegamento usa groupId, NON la sola adiacenza per tipo.
            // Così 4 jump-set consecutivi producono blocchi separati se hanno
            // groupId diversi, invece di fondersi in un unico blocco da 8.
            const prevEx   = exs[i - 1];
            const nextEx   = exs[i + 1];
            const isCombo  = currentType === 'superset' || currentType === 'jump set';

            const linkedToNext = isCombo && !!nextEx &&
                !!ex.groupId && nextEx.groupId === ex.groupId &&
                (nextEx.section || 'centrale') === fase.id;
            const linkedToPrev = isCombo && !!prevEx &&
                !!ex.groupId && prevEx.groupId === ex.groupId &&
                (prevEx.section || 'centrale') === fase.id;

            // Stili card collegamento visivo
            let cardRadius    = '12px';
            let cardMargin    = '8px'; // anteprima compatta (Focus azzera a 0 via CSS)
            let cardBorderTop = '1px solid var(--line)';
            let linkBadge     = '';

            const groupLabel = `${currentType.toUpperCase()}${_liveGLetter(ex.groupId)}`;

            if (linkedToNext && !linkedToPrev) {
                cardRadius = '12px 12px 0 0'; cardMargin = '0';
                linkBadge  = `<div class="ax-link-badge">↳ ${groupLabel}</div>`;
            } else if (linkedToPrev && linkedToNext) {
                cardRadius = '0'; cardMargin = '0'; cardBorderTop = '1px dashed rgba(255,255,255,0.1)';
                linkBadge  = `<div class="ax-link-badge">↳ ${groupLabel}</div>`;
            } else if (linkedToPrev && !linkedToNext) {
                cardRadius = '0 0 12px 12px'; cardMargin = '8px'; cardBorderTop = '1px dashed rgba(255,255,255,0.1)';
            }

            // ── Generazione pallini ───────────────────────────
// Solo serie allenanti: i pallini warm-up ('W') sono stati rimossi — il riscaldamento
// è già mostrato dalla tabella RAMPING (più chiara e senza occupare spazio ai set).
let dots = '';

// Analizziamo il formato delle ripetizioni (es: "10-8-6-4" o "10,8,6,4" o range "8-10")
let repParts = [];
if (typeof targetRep === 'string') {
    repParts = targetRep.includes('-') ? targetRep.split('-') : targetRep.split(',');
}
// Se i pezzi sono meno delle serie è un range (es. "8-10" con 3 serie) → mostra il range su ogni dot
const isRepRange = repParts.length > 0 && repParts.length < actualSet;

// Serie bersaglio della tecnica (solo se NON applicata a tutte) → evidenziazione pallino
const techFlagged = (activeTech && activeTechSet !== 'all') ? _resolveTechSets(activeTechSet, actualSet) : null;
const techAbbr    = activeTech ? (_stLabels[activeTech] || activeTech.toUpperCase().slice(0,5)) : '';

for (let l = 0; l < actualSet; l++) {
    const logKey = `${sessId}-w${currentWeek}-${i}-${l}`;

    let defaultLabel, rawRepForSet;
    if (isRepRange) {
        defaultLabel = repCompact.meta; // range uguale su tutti i pallini (compattato, no overflow)
        rawRepForSet = targetRep;
    } else if (repParts.length > 1 && repParts[l]) {
        defaultLabel = repParts[l].trim(); // piramidale: rep specifica per serie
        rawRepForSet = repParts[l];
    } else {
        // Rep singola (es. "10") → mostra le reps nel pallino, non il numero di serie
        defaultLabel = (repCompact.meta !== '' && repCompact.meta != null) ? repCompact.meta : (l + 1);
        rawRepForSet = l + 1;
    }

    let label  = defaultLabel;
    let cls    = 'dot';
    // Etichette multi-carattere (es. "8-10") → font ridotto per non debordare dal cerchio
    if (String(defaultLabel).length > 2) cls += ' lbl-sm';

    if (window.realLog && window.realLog[logKey]) {
        const logged = window.realLog[logKey];
        label = logged.rep;
        const isPr = _checkSetPR(ex, logged.rep, logged.kg, appState.selAthId);
        cls += isPr ? ' done is-pr' : ' done is-log';
    }
    // Serie "a tempo" → il pallino diventa un timer tap-to-start
    const dotSecs = _setTimeSeconds(rawRepForSet);
    let dataAttr = ` data-label="${escHtml(String(defaultLabel))}"`;
    if (dotSecs > 0) { cls += ' timed'; dataAttr += ` data-secs="${dotSecs}"`; }
    if (techFlagged && techFlagged.has(l)) { cls += ' tech'; dataAttr += ` data-tech="${techAbbr}"`; }
    dots += `<div class="${cls}" id="ld-${i}-${l}"${dataAttr}>${label}</div>`;
}

            // ── Label braccio dominante ───────────────────────
            const armLabel = (ex.arm && ex.arm !== 'Bi')
                ? `<span style="color:var(--text);font-weight:700">[${ex.arm}]</span> `
                : '';

            // ── Parsing rest → secondi ────────────────────────
            let parsedRest   = parseFloat(ex.rest) || 0;
            let totalSeconds = parsedRest > 0
                ? (parsedRest < 10 ? Math.round(parsedRest * 60) : Math.round(parsedRest))
                : 90;

            // ── Campo "Prossimo Carico" ───────────────────────
            const activeSessId         = select ? select.value : 'unknown';
            const notaChiave           = `${activeSessId}-${i}`;
            const valoreNotaPrecedente = window.carichiFuturi ? (window.carichiFuturi[notaChiave] || '') : '';

            // ── Badge video ───────────────────────────────────
            const videoBadge = ex.ytUrl
                ? `<button onclick="openVideoModal('${ex.ytUrl}','${ex.name.replace(/'/g,"\\'")}')" class="ax-chip-btn">
                    <span>▶</span><span>Video</span></button>`
                : '';

            // ── Composizione display carico (usa actualKg post-autoregolazione) ─
            let renderTargetLoad = isIso
                ? String(targetKg)
                : isVBT
                    ? (String(targetKg).includes('m/s') ? targetKg : targetKg + ' m/s')
                    : actualKg + 'kg';

            // ── Ramping warm-up automatico ────────────────────
            let rampingHtml = '';
            if (ex.wset > 0 && actualKg > 0 && !isVBT && !isIso) {
                let warmUps = [];
                for (let w = 1; w <= ex.wset; w++) {
                    let perc = ex.wset === 1 ? 0.75
                             : ex.wset === 2 ? (w === 1 ? 0.60 : 0.85)
                             : (w === 1 ? 0.50 : w === 2 ? 0.70 : 0.85);
                    let wKg = Math.round((actualKg * perc) / 2.5) * 2.5;
                    warmUps.push(wKg + 'kg');
                }
                rampingHtml = `<div class="ax-ramp">RAMPING <span class="ax-sep">·</span><b>
                    ${warmUps.join(' <span class="ax-sep">→</span> ')}
                    </b></div>`;
            }

            // ── Riga parametri prominente: RIR · TUT · RPE (settimana corrente) ──
            // RPE non è in progression → usa il valore base dell'esercizio (ex.rpe).
            const pW_          = ex.progression && ex.progression[`w${currentWeek}`];
            const targetRpe    = (pW_ && pW_.rpe != null && pW_.rpe !== '') ? pW_.rpe : (ex.rpe || '');
            const _isSet = v => v != null && v !== '' && v !== '—' && v !== '-';
            const _paramChip = (label, val) => _isSet(val)
                ? `<span class="ax-param"><span class="ax-param-l">${label}</span><span class="ax-param-v">${escHtml(String(val))}</span></span>`
                : '';
            const paramsRow = (() => {
                const chips = _paramChip('RIR', targetRir) + _paramChip('TUT', targetTut) + _paramChip('RPE', targetRpe);
                return chips ? `<div class="ax-params">${chips}</div>` : '';
            })();

            // ── Timer REST o etichetta NO REST ────────────────
            let restTimerHtml = '';
            if (!linkedToNext) {
                restTimerHtml = `
                <div class="timer-container" id="timer-container-${i}"
                     data-seconds="${totalSeconds}"
                     style="display:flex; align-items:center; gap:8px; margin-top:0;">
                  <button class="timer-btn" id="timer-btn-${i}"
                          onClick="startTimer(${i}, ${totalSeconds})">
                    START REST
                  </button>
                  <span class="timer-display" id="timer-display-${i}">${formatTime(totalSeconds)}</span>
                  <span class="ax-timer-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#ic-timer"/></svg></span>
                </div>`;
            } else {
                restTimerHtml = `
                <div class="ax-norest">NO REST · VAI AL PROSSIMO</div>`;
            }

            // ── Recupero accorpato alla riga serie×reps•kg (solo anteprima; in Focus c'è START REST) ──
            const metaRestHtml = linkedToNext
                ? `<span class="ax-meta-rest"><span class="ax-sep">·</span> No rest</span>`
                : `<span class="ax-meta-rest"><span class="ax-sep">·</span> Rec ${formatTime(totalSeconds)}</span>`;

            // ── "Ultima volta": top set storico su questo esercizio (sovraccarico progressivo) ──
            let lastTimeHtml = '';
            if (!isVBT && !isIso) {
                const lt = _lastTimeFor(ex.name, appState.selAthId);
                if (lt) {
                    // Freccia vs carico programmato di oggi: progressione a colpo d'occhio
                    let arrow = '';
                    if (actualKg > 0) {
                        if (actualKg > lt.kg)      arrow = `<span class="ax-lt-up">↑</span>`;
                        else if (actualKg < lt.kg) arrow = `<span class="ax-lt-down">↓</span>`;
                        else                       arrow = `<span class="ax-lt-eq">=</span>`;
                    }
                    lastTimeHtml = `<div class="ax-lasttime">${arrow}Ultima volta <b>${lt.reps}×${lt.kg}kg</b>
                        <span class="ax-sep">·</span> ${_daysAgoLabel(lt.date)}</div>`;
                }
            }

            // ── Badge infortuni zona anatomica ────────────────
            let injBadgeHtml = '';
            if (ex.anatomicalZone && ex.anatomicalZone !== '') {
                if (!DB.injuries) DB.injuries = [];
                const activeInj = DB.injuries.find(inj =>
                    inj.athlete === appState.selAthId &&
                    inj.status  === 'Attivo' &&
                    inj.vas     >= 4 &&
                    inj.zone    === ex.anatomicalZone
                );
                if (activeInj) {
                    injBadgeHtml = `<div style="background:var(--bad-wash);border:1px solid oklch(0.66 0.20 22 / .5);
                        color:var(--coral);padding:8px 12px;border-radius:8px;margin-top:8px;
                        font-size:12px;font-weight:700;letter-spacing:0.2px;">
                        ⚠️ ATTENZIONE: Zona infortunata (VAS ${activeInj.vas}) — Tessuto: ${escHtml(activeInj.tissue || activeInj.type)}. Modula il carico.
                    </div>`;
                }
            }

            // ── Hint long-press (primo esercizio, finché non usato) ──
            let hintHtml = '';
            if (showHint && !hintShown) {
                hintShown = true;
                hintHtml = `<div id="hint-lp-first" style="margin-top:10px; font-size:10.5px; color:var(--muted); text-align:left; font-weight:600;"><span style="color:var(--accent)">✎</span> tieni premuto per registrare rep/kg reali</div>`;
            }

            // ── Assemblaggio card esercizio ───────────────────
            const div = document.createElement('div');
            div.style.cssText = 'width:100%; position:relative;';
            div.innerHTML = `
              <div class="ax-ex" style="border-top:${cardBorderTop}; border-left-color:${borderColor};
                          border-radius:${cardRadius}; margin-bottom:${cardMargin};">
                ${linkBadge}

                <!-- 1. Nome esercizio (+ pulsante video a fianco) -->
                <div class="ax-ex-head">
                  <span class="ax-ex-name">${escHtml(ex.name)}</span>
                  ${videoBadge}
                  ${seriesTypeBadge}
                  <span id="pr-badge-${i}" class="ax-pr-badge" style="display:none;">PR</span>
                  <span class="ax-ex-vol" id="lvol-${i}">0 kg</span>
                </div>

                <!-- 2. Serie e ripetizioni -->
                <p class="ax-ex-meta">
                  ${armLabel}${actualSet}×${repCompact.meta}
                  <span class="ax-sep">•</span>
                  <b class="ax-load${autoRegBadge ? ' autoreg' : ''}">${renderTargetLoad}</b>
                  ${metaRestHtml}
                </p>

                <!-- 3. Ultima volta (riferimento storico) -->
                ${lastTimeHtml}

                <!-- 4. RIR · TUT · RPE (stessa riga, senza riquadro) -->
                ${paramsRow}
                ${autoRegBadge}
                ${injBadgeHtml}
                ${seriesTypeInfoHtml}

                <!-- 5. Cue del coach -->
                ${ex.note
                    ? `<div class="ax-cue"><div class="ax-overline">◇ Cue del coach</div><div>${escHtml(ex.note)}</div></div>`
                    : ''}

                <!-- 6. Pallini delle serie -->
                <div class="ax-dots">${dots}</div>
                ${hintHtml}

                <!-- 7. Ramping -->
                ${rampingHtml}

                <!-- 8. Rest -->
                <div class="ax-rest-row">${restTimerHtml}</div>

                <!-- 9. Prossimo carico -->
                <div class="ax-nextload">
                  <span class="ax-next-l">Prossimo carico</span>
                  <input type="text" id="next-load-${i}"
                         value="${escHtml(valoreNotaPrecedente)}"
                         oninput="window.carichiFuturi['${notaChiave}'] = this.value"
                         onchange="saveLiveNextLoad(${i}, this.value)"
                         class="ax-next-in"
                         placeholder="+2.5 kg">
                </div>

                <!-- 10. Grafico -->
                ${_weeklyLoadChart(ex, currentWeek, isVBT, isIso)}
              </div>`;

            // Marker Focus Mode: rende la card una "pagina" del pager
            div.classList.add('lv-card');
            div.dataset.exIdx  = i;
            div.dataset.exName = ex.name;
            div.dataset.phase  = fase.label;

            // ── Raggruppamento superset/jump-set ──────────────
            // In anteprima il wrapper è trasparente (le card restano adiacenti e fuse);
            // in Focus (.focus-stage) il wrapper diventa l'unità-pagina del pager → il
            // gruppo intero è una sola schermata con tutti gli esercizi impilati.
            if (linkedToNext && !linkedToPrev) {
                // Inizio gruppo: crea il wrapper-pagina + header "↳ SUPERSET A · N giri"
                curGroup = document.createElement('div');
                curGroup.className   = 'ax-group';
                curGroup.dataset.phase  = fase.label;
                curGroup.dataset.exName = groupLabel;
                const gh = document.createElement('div');
                gh.className = 'ax-group-head';
                gh.innerHTML = `<span>↳ ${groupLabel}</span><span class="ax-group-rounds"></span>`;
                curGroup.appendChild(gh);
                curGroup.appendChild(div);
                if (wrap) wrap.appendChild(curGroup);
            } else if (linkedToPrev && curGroup) {
                // Continuazione (ed eventuale fine) del gruppo corrente
                curGroup.appendChild(div);
                if (!linkedToNext) {
                    // Fine gruppo: "N giri" = max serie allenanti tra i membri
                    const rounds = Math.max(...Array.from(curGroup.querySelectorAll('.lv-card'))
                        .map(c => c.querySelectorAll('.ax-dots .dot:not(.warm)').length));
                    const rEl = curGroup.querySelector('.ax-group-rounds');
                    if (rEl && rounds > 0) rEl.textContent = ` · ${rounds} giri`;
                    curGroup = null;
                }
            } else {
                // Esercizio standalone
                if (wrap) wrap.appendChild(div);
                curGroup = null;
            }
        });
    });

    // ── Ripresa sessione: ripristina i pallini SOLO se la sessione+settimana
    //    corrisponde alla ripresa in corso (stesso atleta+giorno già validato). ──
    const _curWeek = (selectWeek && selectWeek.value) ? String(selectWeek.value) : '1';
    const _ctxMatches = _recoveryCtx && _recoveryCtx.sessId === String(sessId) && _recoveryCtx.week === _curWeek;
    if (_ctxMatches) {
        try {
            const cachePallini = JSON.parse(localStorage.getItem(LK_DOTS));
            if (cachePallini && Array.isArray(cachePallini)) {
                cachePallini.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.classList.add('done');
                });
                setTimeout(() => updateLiveTotals(window.getEdExercises()), 100);
            }
        } catch (e) { /* Silenzioso: primo avvio senza cache */ }
    }
    // Banner "Riprendi": mostrato quando ci sono set già registrati per questa sessione+settimana.
    _renderResumeBanner(sessId, _curWeek, sessionName, _ctxMatches);

    // ── Popola filtro esercizi per il grafico e1RM ───────────
    const filterDiv = document.getElementById('e1rm-ex-filter');
    if (filterDiv) {
        filterDiv.innerHTML = '';
        const trackableExs = exs.filter(ex => 
    (ex.section || 'centrale') === 'centrale' && 
    (ex.trackE1rm === true) && 
    (parseFloat(ex.kg) > 0 || false) && 
    (parseInt(ex.rep) > 0 || false)
);
        if (trackableExs.length > 0) {
            trackableExs.forEach((ex, idx) => {
                const btn = document.createElement('button');
                btn.textContent = ex.name;
                btn.dataset.exName   = ex.name;
                btn.dataset.sessName = sessionName;
                btn.style.cssText = 'background:var(--s2); border:1px solid var(--border); color:var(--muted);'
                    + 'border-radius:20px; padding:4px 10px; font-size:11px; font-weight:600; cursor:pointer;'
                    + 'transition:all 0.15s; white-space:nowrap;';
                if (idx === 0) {
                    btn.style.background   = 'var(--teal)';
                    btn.style.color        = 'var(--accent-ink)';
                    btn.style.borderColor  = 'var(--teal)';
                }
                btn.addEventListener('click', function () {
                    filterDiv.querySelectorAll('button').forEach(b => {
                        b.style.background  = 'var(--s2)';
                        b.style.color       = 'var(--muted)';
                        b.style.borderColor = 'var(--border)';
                    });
                    this.style.background  = 'var(--teal)';
                    this.style.color       = 'var(--accent-ink)';
                    this.style.borderColor = 'var(--teal)';
                    window.renderE1rmChart(this.dataset.sessName, this.dataset.exName);
                });
                filterDiv.appendChild(btn);
            });
        }
    }

    // Avvia il grafico sul primo esercizio tracciabile della sessione
    const defaultEx = exs.find(ex =>
        (ex.section || 'centrale') === 'centrale' &&
        parseFloat(ex.kg) > 0 &&
        parseInt(ex.rep) > 0
    );
    try { window.renderE1rmChart(sessionName, defaultEx ? defaultEx.name : null); } catch (e) { console.warn('[loadLive] window.renderE1rmChart main:', e); }
    attachDotSwipe();

    } catch (err) { console.error('Crash loadLive:', err); }
}


// ─────────────────────────────────────────────────────────────
// 3. updateLiveTotals(exs)
//    Calcolo matematico ad alta precisione dei totali live.
//    Per ogni set completato (pallino.done):
//      - Usa i dati del realLog se disponibili (priorità assoluta)
//      - Accumula volume totale (esclude VBT m/s)
//      - Stima e1RM con formula Brzycki-like (solo ≤6 reps effettive)
//      - Aggiorna KPI nella UI: vol, e1rm, e1rmDom, e1rmNDom
//      - Persiste pallini e realLog in localStorage (anti-crash iOS)
//      - Se tutti i set completati: crea/aggiorna sessione nel DB
//        e propone il redirect al Post-Workout log
// ─────────────────────────────────────────────────────────────
export function updateLiveTotals(exs) {
    let vol                 = 0;
    let sets                = 0;
    let maxE1rm             = 0;
    let e1rmDom             = 0;
    let e1rmNDom            = 0;
    let tuttiiSetCompletati = true;
    const e1rmPerExercise   = {};
    // Storico "carico fatto": set di lavoro più pesante realmente eseguito per esercizio
    const donePerExercise   = {};
    // Storico per-serie: [{s, kg, reps}, …] allineato all'indice serie (stile Hevy "Previous")
    const setsPerExercise   = {};

    const selectLiveSess = document.getElementById('lv-sess');
    const sessId         = selectLiveSess ? selectLiveSess.value : 'unknown';
    const sessionName    = selectLiveSess
        ? (selectLiveSess.options[selectLiveSess.selectedIndex].text || 'Allenamento')
        : 'Allenamento';
    const weekVal = parseInt(document.getElementById('lv-week').value) || 1;

    // Se l'atleta è loggato, gli esercizi vanno presi dalla scheda (non dall'editor)
    if (!exs || exs.length === 0 || window.userRole === 'ATLETA') {
        const sch     = DB.schedules[appState.selAthId];
        const curSess = sch && sch.sessions ? sch.sessions.find(x => x.id === sessId) : null;
        exs = curSess ? curSess.exercises : [];
    }

    exs.forEach(function (ex, i) {
        if (ex.type === 'circuit') return; // i circuiti non contribuiscono al volume meccanico

        let count = 0;
        let exVol = 0;

        // Legge la progressione della settimana corrente
        let targetRep = ex.rep;
        let targetKg  = ex.kg;
        if (ex.progression && ex.progression[`w${weekVal}`]) {
            targetRep = ex.progression[`w${weekVal}`].rep;
            targetKg  = ex.progression[`w${weekVal}`].kg;
        }

        // Conta i dot effettivamente renderizzati (possono essere < ex.set se CNS ha ridotto i set)
        let maxSet = 0;
        while (document.getElementById(`ld-${i}-${maxSet}`)) maxSet++;
        if (maxSet === 0) maxSet = ex.set; // fallback: DOM non ancora pronto (crash recovery)

        for (let l = 0; l < maxSet; l++) {
            const el = document.getElementById('ld-' + i + '-' + l);
            if (el && el.classList.contains('done')) {
                count++;

                const logKey = `${sessId}-w${weekVal}-${i}-${l}`;

// Estrattore intelligente per il volume teorico
let sRep = 0;
if (typeof targetRep === 'string') {
    let parts = targetRep.includes('-') ? targetRep.split('-') : targetRep.split(',');
    const isRange = parts.length > 0 && parts.length < maxSet;
    if (!isRange && parts.length > 1 && parts[l]) {
        sRep = parseInt(parts[l]) || 0; // piramidale: rep specifica per serie
    } else {
        sRep = parseInt(targetRep) || 0; // range "8-10" → usa il primo valore (bound inferiore)
    }
} else {
    sRep = parseInt(targetRep) || 0;
}

let sKg  = parseFloat(targetKg)  || 0;

                // 🔴 IL CUORE DEL SISTEMA: il realLog sovrascrive il target programmato
                if (window.realLog && window.realLog[logKey]) {
                    sRep = window.realLog[logKey].rep;
                    sKg  = window.realLog[logKey].kg;
                }

                // Esclude i set VBT (velocità m/s) dal volume meccanico
                let isSpeed    = (typeof targetKg === 'string' && targetKg.toLowerCase().includes('m/s'))
                                 || (sKg > 0 && sKg <= 2.5);
                let actualVol  = sRep * (isSpeed ? 0 : sKg);
                exVol         += actualVol;

                // Stima e1RM — formula Epley semplificata
                // Limite scientifico: efficace solo per ≤6 reps effettive (sRep + RIR)
                if (sRep > 0 && sKg > 0 && !isSpeed) {
                    let rirVal       = parseInt(ex.rir);
                    let effectiveReps = sRep + (isNaN(rirVal) ? 0 : rirVal);
                    if (effectiveReps > 0 && effectiveReps <= 6) {
                        let est1rm = sKg * (1 + (effectiveReps / 30));
                        if (est1rm > maxE1rm) maxE1rm = est1rm;
                        if (ex.arm === 'Dom'  && est1rm > e1rmDom)  e1rmDom  = est1rm;
                        if (ex.arm === 'NDom' && est1rm > e1rmNDom) e1rmNDom = est1rm;
                        if (ex.name && est1rm > (e1rmPerExercise[ex.name] || 0)) {
                            e1rmPerExercise[ex.name] = est1rm;
                        }
                    }
                }

                // Traccia il set di lavoro più pesante davvero fatto (storico "carico fatto")
                if (ex.name && sRep > 0 && sKg > 0 && !isSpeed) {
                    const prevDone = donePerExercise[ex.name];
                    if (!prevDone || sKg > prevDone.kg) donePerExercise[ex.name] = { kg: sKg, reps: sRep };
                    // Storico per-serie (allineato all'indice serie l → s = l+1)
                    if (!setsPerExercise[ex.name]) setsPerExercise[ex.name] = [];
                    setsPerExercise[ex.name].push({ s: l + 1, kg: sKg, reps: sRep });
                }
            }
        }

        if (count < maxSet) tuttiiSetCompletati = false;

        vol  += exVol;
        sets += count;

        const lvolEl = document.getElementById('lvol-' + i);
        if (lvolEl) lvolEl.textContent = Math.round(exVol) + ' kg';
    });

    // ── Auto-save anti-crash iOS (debounced, vedi scheduleLiveProgressSave) ──
    // Niente più scrittura localStorage sincrona ad ogni tap: coalizzata a ~400ms
    // + flush su pagehide/visibilitychange. Persiste pallini .done, realLog e ctx.
    scheduleLiveProgressSave();

    // ── Aggiornamento KPI nella UI ───────────────────────────
    document.getElementById('lv-vol').textContent  = Math.round(vol).toLocaleString('it-IT') + ' kg';
    document.getElementById('lv-e1rm').textContent = Math.round(maxE1rm) + ' kg';
    if (document.getElementById('lv-edom'))  document.getElementById('lv-edom').textContent  = Math.round(e1rmDom)  + ' kg';
    if (document.getElementById('lv-endom')) document.getElementById('lv-endom').textContent = Math.round(e1rmNDom) + ' kg';

    // Esposizione globale per analytics e wellness
    window.liveE1rmDom  = Math.round(e1rmDom);
    window.liveE1rmNDom = Math.round(e1rmNDom);
    window.liveMaxE1rm  = Math.round(maxE1rm);
    // Storico "carico fatto" per esercizio (kg×reps del set di lavoro più pesante)
    window.liveDonePerExercise = Object.fromEntries(
        Object.entries(donePerExercise).map(([k, v]) => [k, { kg: Math.round(v.kg * 10) / 10, reps: v.reps }])
    );
    // Storico per-serie per esercizio (kg arrotondato a 0.1, ordine serie)
    window.liveSetsPerExercise = Object.fromEntries(
        Object.entries(setsPerExercise).map(([k, arr]) =>
            [k, arr.map(x => ({ s: x.s, kg: Math.round(x.kg * 10) / 10, reps: x.reps }))])
    );

    // Focus Mode: riempi i pallini di progresso globali ad ogni set completato
    updateFocusChrome();

    // ── Sessione completata: auto-salvataggio + redirect ─────
    if (tuttiiSetCompletati && maxE1rm > 0) {
        const today   = new Date().toISOString().slice(0, 10);
        let sessioneEsistente = DB.sessions.find(
            s => s.athlete === appState.selAthId && s.session === sessionName && s.date === today
        );

        const roundedE1rmPerEx = Object.fromEntries(
            Object.entries(e1rmPerExercise).map(([k, v]) => [k, Math.round(v)])
        );

        if (sessioneEsistente) {
            // Aggiorna la sessione in corso
            sessioneEsistente.maxE1rm         = Math.round(maxE1rm);
            sessioneEsistente.vol             = vol;
            sessioneEsistente.e1rmDom         = Math.round(e1rmDom);
            sessioneEsistente.e1rmNDom        = Math.round(e1rmNDom);
            sessioneEsistente.e1rmPerExercise = roundedE1rmPerEx;
            sessioneEsistente.donePerExercise = window.liveDonePerExercise || {};
            sessioneEsistente.setsPerExercise = window.liveSetsPerExercise || {};
        } else {
            // Crea la sessione automaticamente
            DB.sessions.push({
                id:               'live_speed_' + uid(),
                athlete:          appState.selAthId,
                date:             today,
                session:          sessionName,
                week:             weekVal,
                phase:            DB.schedules[appState.selAthId] ? DB.schedules[appState.selAthId].phase : 'Accumulo',
                readiness:        parseInt(document.getElementById('ring-n').textContent) || 80,
                vol:              vol,
                e1rmDom:          Math.round(e1rmDom),
                e1rmNDom:         Math.round(e1rmNDom),
                maxE1rm:          Math.round(maxE1rm),
                e1rmPerExercise:  roundedE1rmPerEx,
                donePerExercise:  window.liveDonePerExercise || {},
                setsPerExercise:  window.liveSetsPerExercise || {},
                sRPE:             0,
                rpe:              8,
                qual:             4,
                doms:             '',
                flag:             'In Corso',
                notes:            'Aggiornamento istantaneo automatico',
                reply:            ''
            });
        }

        // Focus Mode: ultimo set dell'ultimo esercizio chiuso → ferma il cronometro
        // (congela il display; il timestamp resta per prefillare la durata, azzerato a fine).
        _focusTimerStop(false);
        const _durMin = _focusElapsedMin();
        if (_durMin > 0) {
            const _pwDur = document.getElementById('pw-dur');
            if (_pwDur && !_pwDur.value) {
                _pwDur.value = _durMin;
                if (window.calcSrpe) { try { window.calcSrpe(); } catch (e) {} }
            }
        }

        window.saveDB();
        if (typeof renderAnalytics  === 'function') window.renderAnalytics();
        if (typeof renderDashboard  === 'function') window.renderDashboard();

        // Proposta redirect Post-Workout (con leggero delay per iOS)
        setTimeout(function () {
            const lvSess    = document.getElementById('lv-sess');
            const tipoSess  = (lvSess && lvSess.selectedIndex >= 0)
                ? (lvSess.options[lvSess.selectedIndex].dataset.sesstype || 'Palestra')
                : 'Palestra';

            const existing = document.getElementById('mo-session-done');
            if (existing) existing.remove();

            document.body.insertAdjacentHTML('beforeend', `
                <div class="mo show" id="mo-session-done" style="z-index:99999;">
                    <div class="mo-box" style="max-width:300px; text-align:center; border:1px solid var(--teal);">
                        <div style="font-size:40px; margin-bottom:10px;">🎯</div>
                        <div style="font-family:var(--fh); font-size:18px; font-weight:800; color:var(--teal); margin-bottom:6px;">Sessione Completata!</div>
                        <div style="font-size:13px; color:var(--muted); margin-bottom:20px; line-height:1.5;">Ottimo lavoro. Compila il feedback Post-Workout per inviarlo al coach.</div>
                        <div style="display:flex; flex-direction:column; gap:8px;">
                            <button id="session-done-yes" class="btn btn-p" style="width:100%; padding:14px; font-weight:800; background:var(--teal); color:#000;">
                                Compila feedback →
                            </button>
                            <button id="session-done-no" class="btn btn-g" style="width:100%; padding:12px;">
                                Più tardi
                            </button>
                        </div>
                    </div>
                </div>`);

            document.getElementById('session-done-yes').addEventListener('click', () => {
                document.getElementById('mo-session-done').remove();
                window.go('feedback');
                const pwType = document.getElementById('pw-type');
                if (pwType) pwType.value = tipoSess;
            });
            document.getElementById('session-done-no').addEventListener('click', () => {
                document.getElementById('mo-session-done').remove();
            });
        }, 800);
    }

    // ── Aggiorna progress header ─────────────────────────────
    const progHeader = document.getElementById('live-prog-header');
    if (progHeader && exs.length) {
        const workExs     = exs.map((ex, i) => ({ ex, i })).filter(({ ex }) => ex.section !== 'warmup' && ex.type !== 'circuit');
        const completedEx = workExs.filter(({ i }) => {
            let maxSet = 0;
            while (document.getElementById(`ld-${i}-${maxSet}`)) maxSet++;
            if (maxSet === 0) return false;
            return Array.from({ length: maxSet }, (_, j) => document.getElementById(`ld-${i}-${j}`))
                .every(d => d && d.classList.contains('done'));
        }).length;
        const total   = workExs.length;
        const pct     = total ? Math.round(completedEx / total * 100) : 0;
        const fillEl  = progHeader.querySelector('.prog-fill');
        const textEl  = progHeader.querySelector('.prog-text');
        const pctEl   = progHeader.querySelector('.prog-pct');
        if (fillEl) { fillEl.style.width = pct + '%'; fillEl.style.background = pct === 100 ? 'var(--green)' : 'var(--accent)'; }
        if (textEl) textEl.textContent = `${completedEx}/${total} esercizi`;
        if (pctEl)  pctEl.textContent  = pct + '%';
    }
}


// ─────────────────────────────────────────────────────────────
// 4. attachDotSwipe()
//    Collega gli event listener touch/pointer su ogni pallino.
//    Distingue tre gesti:
//      - TAP     (dito fermo < 10px) → toggleDot
//      - SWIPE   (drag orizzontale > 40px) → toggleDot
//      - LONG PRESS (>400ms) → openRealLog (modifica Rep/Kg)
//    Ignora i movimenti verticali (scroll della pagina).
// ─────────────────────────────────────────────────────────────
export function attachDotSwipe() {
    document.querySelectorAll('.dot').forEach(dot => {
        let startX = 0, startY = 0;
        let pressTimer;
        let hasLongPressed  = false;
        let isPointerDown   = false;

        dot.addEventListener('pointerdown', e => {
            if (e.pointerType === 'mouse' && e.button !== 0) return; // Ignora tasto destro

            isPointerDown  = true;
            hasLongPressed = false;
            startX         = e.clientX;
            startY         = e.clientY;

            // Attiva Long Press solo sui pallini lavorativi (ld-), non sui warm-up (wd-)
            if (dot.id.startsWith('ld-')) {
                const parts = dot.id.split('-');
                pressTimer  = setTimeout(() => {
                    hasLongPressed = true;
                    openRealLog(parts[1], parts[2]);
                }, 400);
            }
        });

        dot.addEventListener('pointermove', e => {
            if (!isPointerDown) return;
            const dx = Math.abs(e.clientX - startX);
            const dy = Math.abs(e.clientY - startY);
            // Scorrimento pagina → annulla il long press
            if (dx > 10 || dy > 10) clearTimeout(pressTimer);
        });

        dot.addEventListener('pointerup', e => {
            isPointerDown = false;
            clearTimeout(pressTimer);

            // Il long press ha già gestito l'evento → ignora il tap
            if (hasLongPressed) { e.preventDefault(); return; }

            const dx = e.clientX - startX;
            const dy = Math.abs(e.clientY - startY);

            // Valida TAP (< 10px) o SWIPE destra (> 40px orizzontale, < 20px verticale)
            if ((Math.abs(dx) < 10 && dy < 10) || (dx > 40 && dy < 20)) {
                // Serie a tempo non ancora completata → avvia/annulla il countdown
                if (dot.classList.contains('timed') && !dot.classList.contains('done')) {
                    startSetTimer(dot);
                } else {
                    toggleDot(dot);
                }
            }
        });

        dot.addEventListener('pointercancel', () => { isPointerDown = false; clearTimeout(pressTimer); });
        dot.addEventListener('pointerleave',  () => { isPointerDown = false; clearTimeout(pressTimer); });
    });
}


// ─────────────────────────────────────────────────────────────
// 5. toggleDot(dot)
//    Toggle completamento di un set:
//      - ON  → aggiunge .done + haptic feedback
//      - OFF → rimuove .done, resetta stili e cancella realLog
//    Aggiorna i totali live con un micro-delay per iOS.
// ─────────────────────────────────────────────────────────────
export function toggleDot(dot) {
    dot.classList.toggle('done');

    if (!dot.classList.contains('done')) {
        // Deselezionato: ripristina aspetto neutro
        dot.style.background   = '';
        dot.style.borderColor  = '';
        dot.style.color        = '';
        dot.classList.remove('is-log', 'is-pr');

        // Cancella il log reale per questo set
        if (dot.id.startsWith('ld-')) {
            const parts       = dot.id.split('-');
            // Ripristina l'etichetta originale (tempo/piramidale) o il numero del set
            dot.textContent   = dot.dataset.label || (parseInt(parts[2]) + 1);

            const activeSessId  = document.getElementById('lv-sess').value;
            const currentWeek   = document.getElementById('lv-week').value || '1';
            const logKey        = `${activeSessId}-w${currentWeek}-${parts[1]}-${parts[2]}`;
            if (window.realLog && window.realLog[logKey]) delete window.realLog[logKey];
        }
    } else {
        // Completato: haptic feedback
        if (navigator.vibrate) navigator.vibrate(40);

        // Auto-start timer REST solo per set reali (ld-) con timer configurato
        if (dot.id.startsWith('ld-')) {
            const exIdx = parseInt(dot.id.split('-')[1]);
            _autoStartRestTimer(exIdx);
        }
    }

    // Micro-delay necessario per far aggiornare la UI grafica prima del calcolo su iOS
    setTimeout(() => updateLiveTotals(window.getEdExercises()), 10);
}


// ─────────────────────────────────────────────────────────────
// 5-bis. startSetTimer(dot)
//    Trasforma una serie "a tempo" (pallino con classe .timed) in un
//    countdown vero e proprio direttamente sul pallino:
//      - 1° tap  → parte il conto alla rovescia (es. 45 → 0) sul pallino
//      - a 0     → suono + vibrazione (playTimerEndSound), set completato
//                  e avvio automatico del timer REST
//      - tap durante il countdown → annulla e ripristina l'etichetta
//    Il long-press resta disponibile per registrare rep/kg reali.
// ─────────────────────────────────────────────────────────────
export function startSetTimer(dot) {
    unlockAudio(); // sblocca l'audio iOS sul primo gesto utente

    // Countdown già in corso → annulla e ripristina
    if (dot._setTimerInt) {
        clearInterval(dot._setTimerInt);
        dot._setTimerInt = null;
        dot.classList.remove('running');
        dot.textContent = dot.dataset.label || dot.textContent;
        return;
    }

    const secs = parseInt(dot.dataset.secs) || 0;
    if (secs <= 0) { toggleDot(dot); return; } // fallback di sicurezza

    const fmt = (n) => n >= 60 ? formatTime(n) : String(n); // <60s → "45"; ≥60s → "1:30"
    const endTime = Date.now() + secs * 1000;
    dot.classList.add('running');
    dot.textContent = fmt(secs);
    if (navigator.vibrate) navigator.vibrate(30);

    dot._setTimerInt = setInterval(() => {
        const left = Math.round((endTime - Date.now()) / 1000);
        if (left <= 0) {
            clearInterval(dot._setTimerInt);
            dot._setTimerInt = null;
            dot.classList.remove('running');
            dot.classList.add('done');
            dot.textContent = dot.dataset.label || '✓';
            playTimerEndSound(); // beep 880Hz + vibrazione

            // Avvio automatico del recupero, come per un set normale completato
            if (dot.id.startsWith('ld-')) {
                _autoStartRestTimer(parseInt(dot.id.split('-')[1]));
            }
            setTimeout(() => updateLiveTotals(window.getEdExercises()), 10);
        } else {
            dot.textContent = fmt(left);
        }
    }, 250);
}


// ─────────────────────────────────────────────────────────────
// 6. openRealLog(exIndex, setIndex)
//    Apre il modale di modifica Rep/Kg reali per un set.
//    Pre-compila con:
//      - Il target programmato dalla scheda (o progressione)
//      - I valori già inseriti dall'atleta per quel set (se esistono)
//    Emette un haptic leggero di apertura.
// ─────────────────────────────────────────────────────────────
export function openRealLog(exIndex, setIndex) {
    const sch         = DB.schedules[appState.selAthId];
    const activeSessId = document.getElementById('lv-sess').value;
    const curSess     = sch.sessions.find(x => x.id === activeSessId);
    const ex          = curSess.exercises[exIndex];

    const w         = document.getElementById('lv-week').value || '1';
    let targetRep   = ex.rep;
    let targetKg    = ex.kg;
    if (ex.progression && ex.progression[`w${w}`]) {
        targetRep = ex.progression[`w${w}`].rep;
        targetKg  = ex.progression[`w${w}`].kg;
    }

    document.getElementById('rl-set-num').textContent = parseInt(setIndex) + 1;
    document.getElementById('rl-ex-i').value  = exIndex;
    document.getElementById('rl-set-l').value = setIndex;

    const isIso = typeof targetKg === 'string' && /['"]/.test(targetKg);

    if (isIso) {
        const secs = parseIsometricSeconds(String(targetKg));
        document.getElementById('rl-target').textContent = `Target: ${targetRep} serie da ${targetKg}`;
        window._isoTimerTarget    = secs;
        window._isoTimerRemaining = secs;
        window._isoTimerRunning   = false;
        if (window._isoTimerInterval) { clearInterval(window._isoTimerInterval); window._isoTimerInterval = null; }
        const disp = document.getElementById('rl-timer-display');
        const btn  = document.getElementById('rl-timer-btn');
        const save = document.getElementById('rl-timer-save');
        disp.textContent        = secs;
        disp.style.color        = 'var(--purple)';
        btn.textContent         = '▶ START';
        btn.style.background    = 'var(--purple)';
        save.style.opacity      = '0.35';
        save.style.pointerEvents = 'none';
        document.getElementById('rl-normal-section').style.display = 'none';
        document.getElementById('rl-timer-section').style.display  = 'block';
    } else {
        document.getElementById('rl-target').textContent = `Target Originale: ${_compactRep(targetRep).meta} rep @ ${targetKg} ${String(targetKg).includes('m/s') ? '' : 'kg'}`;

        // ── "Ultima volta": storico per-serie (stile Hevy) con fallback al top set + tap "usa" ──
        const ltBox = document.getElementById('rl-lasttime');
        if (ltBox) {
            const lblEl = document.getElementById('rl-lt-lbl');
            const stt   = _lastTimeSetsFor(ex.name, appState.selAthId);
            const thisSet = stt && stt.sets.find(x => x.s === parseInt(setIndex) + 1);
            if (thisSet) {
                // Serie specifica della volta scorsa
                if (lblEl) lblEl.textContent = `Ultima volta (serie ${parseInt(setIndex) + 1})`;
                document.getElementById('rl-lt-txt').textContent = `${thisSet.reps}×${thisSet.kg}kg`;
                window._rlLastTime = { rep: thisSet.reps, kg: thisSet.kg };
                ltBox.style.display = 'flex';
            } else {
                // Fallback: top set (sessioni pre-feature o serie non presente la volta scorsa)
                const lt = _lastTimeFor(ex.name, appState.selAthId);
                if (lt) {
                    if (lblEl) lblEl.textContent = 'Ultima volta';
                    document.getElementById('rl-lt-txt').textContent = `${lt.reps}×${lt.kg}kg`;
                    window._rlLastTime = { rep: lt.reps, kg: lt.kg };
                    ltBox.style.display = 'flex';
                } else {
                    window._rlLastTime = null;
                    ltBox.style.display = 'none';
                }
            }
        }

        const logKey  = `${activeSessId}-w${w}-${exIndex}-${setIndex}`;
        let actualRep = parseInt(targetRep)  || 0;
        let actualKg  = parseFloat(targetKg) || 0;
        if (window.realLog && window.realLog[logKey]) {
            actualRep = window.realLog[logKey].rep;
            actualKg  = window.realLog[logKey].kg;
        }

        // RPE adattativo: se esiste un aggiustamento calcolato dal set precedente, applicalo
        const adjBanner = document.getElementById('rl-rpe-adj');
        const prevAdj   = window.rpeAdjustments?.[String(exIndex)];
        if (prevAdj && parseInt(setIndex) > 0) {
            actualKg = prevAdj.kg;
            if (adjBanner) {
                adjBanner.style.display = 'block';
                adjBanner.textContent   = `🤖 Carico aggiustato: ${prevAdj.fromKg}kg → ${prevAdj.kg}kg (RPE ${prevAdj.rpe} su target ${prevAdj.targetRpe})`;
            }
        } else if (adjBanner) {
            adjBanner.style.display = 'none';
        }

        document.getElementById('rl-rep').value = actualRep;
        document.getElementById('rl-kg').value  = actualKg;

        // Init bottoni RPE (reset selezione)
        window._setRpe = null;
        const rpeRow = document.getElementById('rl-rpe-row');
        if (rpeRow) {
            rpeRow.innerHTML = '';
            [6, 7, 8, 9, 10].forEach(v => {
                const b = document.createElement('button');
                b.className   = 'rpe-b';
                b.textContent = v;
                b.dataset.v   = v;
                b.type        = 'button';
                b.onclick = () => {
                    window._setRpe = v;
                    rpeRow.querySelectorAll('.rpe-b').forEach(x => { x.className = 'rpe-b'; });
                    b.classList.add(v <= 7 ? 'ag' : v <= 8 ? 'aa' : 'ac');
                };
                rpeRow.appendChild(b);
            });
        }

        document.getElementById('rl-normal-section').style.display = 'block';
        document.getElementById('rl-timer-section').style.display  = 'none';
    }

    openMo('mo-reallog');
    if (navigator.vibrate) navigator.vibrate(20);
}

// Pre-compila rep/kg nel modale con i valori dell'ultima volta (un tap → pronto a battere).
export function useLastTime() {
    const lt = window._rlLastTime;
    if (!lt) return;
    const repEl = document.getElementById('rl-rep');
    const kgEl  = document.getElementById('rl-kg');
    if (repEl) repEl.value = lt.rep;
    if (kgEl)  kgEl.value  = lt.kg;
    if (navigator.vibrate) navigator.vibrate(20);
}

// Converte stringhe tipo "45''", "1'30''", "45s" in secondi
function parseIsometricSeconds(str) {
    str = str.trim();
    // "1'30''" → 1 minuto e 30 secondi
    const minsec = str.match(/^(\d+)'(\d+)''/);
    if (minsec) return parseInt(minsec[1]) * 60 + parseInt(minsec[2]);
    // "45''" → 45 secondi
    const sec = str.match(/^(\d+)''/);
    if (sec) return parseInt(sec[1]);
    // "1'" → 1 minuto
    const min = str.match(/^(\d+)'$/);
    if (min) return parseInt(min[1]) * 60;
    // "45s" o "45sec"
    const s = str.match(/^(\d+)\s*s/i);
    if (s) return parseInt(s[1]);
    return parseInt(str) || 0;
}

export function toggleIsometricTimer() {
    const disp = document.getElementById('rl-timer-display');
    const btn  = document.getElementById('rl-timer-btn');

    if (window._isoTimerRunning) {
        // Pausa
        clearInterval(window._isoTimerInterval);
        window._isoTimerInterval = null;
        window._isoTimerRunning  = false;
        btn.textContent      = '▶ RIPRENDI';
        btn.style.background = '#555';
        return;
    }

    if (window._isoTimerRemaining <= 0) return; // già finito

    window._isoTimerRunning = true;
    btn.textContent      = '⏸ PAUSA';
    btn.style.background = '#e67e22';

    window._isoTimerInterval = setInterval(() => {
        window._isoTimerRemaining--;
        disp.textContent = window._isoTimerRemaining;

        if (window._isoTimerRemaining <= 0) {
            clearInterval(window._isoTimerInterval);
            window._isoTimerInterval = null;
            window._isoTimerRunning  = false;
            disp.textContent      = '✓';
            disp.style.color      = '#2ecc71';
            btn.textContent       = '✓ COMPLETATO';
            btn.style.background  = '#2ecc71';
            btn.disabled          = true;
            const save            = document.getElementById('rl-timer-save');
            save.style.opacity      = '1';
            save.style.pointerEvents = 'auto';
            if (navigator.vibrate) navigator.vibrate([100, 60, 100, 60, 200]);
        }
    }, 1000);
}

export function abortIsometricTimer() {
    if (window._isoTimerInterval) { clearInterval(window._isoTimerInterval); window._isoTimerInterval = null; }
    window._isoTimerRunning = false;
    closeMo('mo-reallog');
}

export function saveTimerSet() {
    const exI  = document.getElementById('rl-ex-i').value;
    const setL = document.getElementById('rl-set-l').value;

    const activeSessId = document.getElementById('lv-sess').value;
    const w            = document.getElementById('lv-week').value || '1';
    const logKey       = `${activeSessId}-w${w}-${exI}-${setL}`;

    if (!window.realLog) window.realLog = {};
    window.realLog[logKey] = { rep: window._isoTimerTarget, kg: 0 };

    const dot = document.getElementById(`ld-${exI}-${setL}`);
    if (dot) {
        dot.classList.add('done', 'is-log');
        dot.textContent       = '✓';
    }

    if (window._isoTimerInterval) { clearInterval(window._isoTimerInterval); window._isoTimerInterval = null; }
    window._isoTimerRunning = false;
    closeMo('mo-reallog');
    updateLiveTotals(window.getEdExercises ? window.getEdExercises() : []);
    if (navigator.vibrate) navigator.vibrate([80, 40, 80, 40, 160]);
}


// ─────────────────────────────────────────────────────────────
// 7. saveRealLog()
//    Salva Rep e Kg reali per il set corrente in window.realLog,
//    trasforma il pallino in Viola Elite con il numero di reps,
//    chiude il modale e ricalcola i totali live.
//    Emette una tripla vibrazione di conferma.
// ─────────────────────────────────────────────────────────────
export function saveRealLog() {
    const exI  = document.getElementById('rl-ex-i').value;
    const setL = document.getElementById('rl-set-l').value;
    const rep  = parseInt(document.getElementById('rl-rep').value)   || 0;
    const kg   = parseFloat(document.getElementById('rl-kg').value)  || 0;

    const activeSessId = document.getElementById('lv-sess').value;
    const w            = document.getElementById('lv-week').value || '1';
    const logKey       = `${activeSessId}-w${w}-${exI}-${setL}`;

    if (!window.realLog) window.realLog = {};
    window.realLog[logKey] = { rep, kg };

    // ── Aggiorna visivamente il pallino ──────────────────────
    const dot = document.getElementById(`ld-${exI}-${setL}`);

    // Recupera esercizio per PR check
    const _sch  = DB.schedules[appState.selAthId];
    const _sess = _sch?.sessions?.find(s => s.id === activeSessId);
    const _ex   = _sess?.exercises[parseInt(exI)];
    const prE1rm = _checkSetPR(_ex, rep, kg, appState.selAthId);

    if (dot) {
        dot.classList.add('done');
        dot.classList.remove('is-log', 'is-pr');
        dot.classList.add(prE1rm ? 'is-pr' : 'is-log');
        dot.textContent = rep;
    }

    // ── PR: badge sul card + toast + haptic ──────────────────
    if (prE1rm) {
        const badge = document.getElementById(`pr-badge-${exI}`);
        if (badge) { badge.style.display = 'inline-flex'; badge.textContent = `🏆 PR — ${prE1rm}kg`; }
        toast(`🏆 PR! ${_ex.name} — ${prE1rm}kg e1RM`);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 300]);
    }

    // ── RPE adattativo: calcola aggiustamento per il prossimo set ──
    if (window._setRpe && kg > 0 && _ex) {
        const actualRpe = window._setRpe;
        const rir       = parseInt(_ex.rir);
        const targetRpe = (!isNaN(rir) && rir >= 0) ? Math.min(10, 10 - rir) : 8;
        const rawAdj    = kg * (1 + (targetRpe - actualRpe) * 0.03);
        const adjKg     = Math.max(0, Math.round(rawAdj * 2) / 2); // arrotonda a 0.5kg
        if (!window.rpeAdjustments) window.rpeAdjustments = {};
        window.rpeAdjustments[String(exI)] = { kg: adjKg, fromKg: kg, rpe: actualRpe, targetRpe };
        if (adjKg !== kg) {
            const dir = adjKg > kg ? `+${(adjKg - kg).toFixed(1)}kg` : `${(adjKg - kg).toFixed(1)}kg`;
            toast(`🤖 Set successivo: ${adjKg}kg (${dir})`);
        }
        window._setRpe = null;
    }

    // Auto-start timer REST dopo salvataggio log reale
    _autoStartRestTimer(parseInt(exI));

    // Al primo salvataggio reale: rimuove l'hint e lo sopprime per sempre
    localStorage.setItem('coachOS_hint_seen', '1');
    document.getElementById('hint-lp-first')?.remove();

    closeMo('mo-reallog');
    updateLiveTotals(window.getEdExercises());

    // Tripla vibrazione di conferma (pattern premium)
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
}


// ─────────────────────────────────────────────────────────────
// 8. saveLiveNextLoad(exIndex, val)
//    Sovraccarico progressivo live — scrive il carico della
//    settimana successiva nella progressione dell'esercizio.
//    Supporta tre formati di input:
//      "+2.5"  → aggiunge al carico corrente
//      "-5"    → sottrae al carico corrente
//      "65"    → imposta il valore diretto in kg
//    Salva in localStorage e sincronizza su Supabase.
// ─────────────────────────────────────────────────────────────
export async function saveLiveNextLoad(exIndex, val) {
    if (!val || val.trim() === '') return;

    const selectLiveSess = document.getElementById('lv-sess');
    const activeSessId   = selectLiveSess ? selectLiveSess.value : null;
    const currentWeekStr = document.getElementById('lv-week') ? document.getElementById('lv-week').value : '1';
    const currentWeekNum = parseInt(currentWeekStr) || 1;
    const nextWeekNum    = currentWeekNum + 1;
    const maxWeeks       = DB.schedules[appState.selAthId] ? (DB.schedules[appState.selAthId].duration || 4) : 4;

    // Non scrivere oltre la durata del mesociclo
    if (!activeSessId || nextWeekNum > maxWeeks) return;

    const sch = DB.schedules[appState.selAthId];
    if (!sch || !sch.sessions) return;

    const curSess = sch.sessions.find(x => x.id === activeSessId);
    if (!curSess || !curSess.exercises || !curSess.exercises[exIndex]) return;

    const ex = curSess.exercises[exIndex];

    // Inizializza la struttura di progressione se mancante
    if (!ex.progression) {
        ex.progression = {};
        for (let w = 1; w <= maxWeeks; w++) {
            ex.progression[`w${w}`] = { set: ex.set, rep: ex.rep, kg: ex.kg };
        }
    }

    // Calcola il carico di partenza dalla settimana corrente
    let currentKg = ex.progression[`w${currentWeekNum}`]
        ? parseFloat(ex.progression[`w${currentWeekNum}`].kg) || 0
        : (parseFloat(ex.kg) || 0);

    let newKg    = currentKg;
    const inputStr = val.trim().replace(',', '.').toLowerCase();

    if (inputStr.startsWith('+')) {
        const addVal = parseFloat(inputStr.replace('+', ''));
        if (!isNaN(addVal)) newKg = currentKg + addVal;
    } else if (inputStr.startsWith('-')) {
        const subVal = parseFloat(inputStr.replace('-', ''));
        if (!isNaN(subVal)) newKg = Math.max(0, currentKg - subVal);
    } else {
        const directVal = parseFloat(inputStr.replace(/[^0-9.]/g, ''));
        if (!isNaN(directVal)) newKg = directVal;
    }

    // Inizializza la settimana successiva se mancante
    if (!ex.progression[`w${nextWeekNum}`]) {
        ex.progression[`w${nextWeekNum}`] = { set: ex.set, rep: ex.rep, kg: ex.kg };
    }
    ex.progression[`w${nextWeekNum}`].kg = Math.round(newKg / 2.5) * 2.5;

    // Salvataggio locale immediato
    await localforage.setItem(KEY, DB);

    // Sincronizzazione cloud — aggiorna SOLO exercises.
    // Un upsert completo riscriveva anche il campo meso con il valore
    // presente in memoria, che poteva essere errato se loadDB aveva caricato
    // un meso stantio. Aggiornare solo exercises spezza il loop di corruzione.
    if (window.mySupabase) {
        const { error } = await window.mySupabase
            .from('schedules')
            .update({ exercises: curSess.exercises })
            .eq('id', curSess.id);
        if (error) {
            console.error('[saveLiveNextLoad] Errore sync Supabase:', error);
            toast('⚠️ Carico salvato in locale, sincronizzazione cloud fallita.');
        } else if (window._rtBroadcast) {
            window._rtBroadcast.send({
                type: 'broadcast', event: 'schedule_updated',
                payload: { athlete_id: appState.selAthId }
            });
        }
    }
}


// ─────────────────────────────────────────────────────────────
// 9. AUDIO — Sblocco iOS e suono di fine timer
// ─────────────────────────────────────────────────────────────

/** AudioContext condiviso — creato al primo tap dell'utente */
let sharedAudioCtx = null;

/**
 * unlockAudio()
 * Tecnica standard per sbloccare l'AudioContext di Safari/iOS:
 * crea e riproduce un buffer silenzioso al primo gesto utente.
 * Deve essere chiamata da qualsiasi handler touch prima
 * di qualsiasi suono reale.
 */
export function unlockAudio() {
    if (!sharedAudioCtx) {
        sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const buf = sharedAudioCtx.createBuffer(1, 1, 22050);
    const src = sharedAudioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(sharedAudioCtx.destination);
    src.start(0);
    if (sharedAudioCtx.state === 'suspended') sharedAudioCtx.resume();
}

/**
 * playTimerEndSound()
 * Segnale acustico di fine timer:
 *   - Vibrazione [500ms ON, 200ms OFF, 500ms ON]
 *   - Oscillatore sinusoidale a 880 Hz con fade-out in 1s
 * Usa sharedAudioCtx già sbloccato da unlockAudio().
 */
export function playTimerEndSound() {
    if ('vibrate' in navigator) navigator.vibrate([500, 200, 500]);

    try {
        const ctx  = sharedAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 1);
    } catch (e) {
        console.log('Audio non supportato:', e);
    }
}


// ─────────────────────────────────────────────────────────────
// 10. TIMER RECUPERO (REST)
// ─────────────────────────────────────────────────────────────

/** Mappa { exerciseId → { interval, endTime } } — timer attivi */
let activeTimers = {};

/**
 * _autoStartRestTimer(exIdx)
 * Avvia automaticamente il timer REST per un esercizio dopo il completamento di un set.
 * Se il timer è già in corso lo riavvia da capo (nuovo set → nuovo recupero completo).
 * Skip silenzioso se non c'è timer-container (superset NO REST o circuiti).
 */
function _autoStartRestTimer(exIdx) {
    const container = document.getElementById(`timer-container-${exIdx}`);
    if (!container) return; // NO REST o blocco circuit — skip
    const seconds = parseInt(container.dataset.seconds) || 90;
    if (!seconds || seconds <= 0) return;

    // Ferma il timer corrente se in esecuzione, poi avvia fresco
    if (activeTimers[exIdx]) {
        clearInterval(activeTimers[exIdx].interval);
        delete activeTimers[exIdx];
        container.classList.remove('timer-running');
        const display = document.getElementById(`timer-display-${exIdx}`);
        const btn     = document.getElementById(`timer-btn-${exIdx}`);
        if (display) display.textContent = formatTime(seconds);
        if (btn)     btn.textContent     = 'START REST';
    }
    startTimer(exIdx, seconds);
}

/**
 * startTimer(exerciseId, defaultSeconds)
 * Avvia (o resetta) il timer di recupero per un esercizio.
 *   - Prima chiamata → avvia il countdown, bottone "RESET"
 *   - Seconda chiamata (reset) → ferma e ripristina a defaultSeconds
 * Al termine: display "VIA!", suono + vibrazione.
 */
export function startTimer(exerciseId, defaultSeconds) {
    unlockAudio(); // Sblocca audio iOS al primo tap

    // Se il timer è già attivo → RESET
    if (activeTimers[exerciseId]) {
        clearInterval(activeTimers[exerciseId].interval);
        document.getElementById(`timer-container-${exerciseId}`).classList.remove('timer-running');
        document.getElementById(`timer-display-${exerciseId}`).textContent = formatTime(defaultSeconds);
        document.getElementById(`timer-btn-${exerciseId}`).textContent     = 'START REST';
        delete activeTimers[exerciseId];
        return;
    }

    const endTime   = Date.now() + (defaultSeconds * 1000);
    const display   = document.getElementById(`timer-display-${exerciseId}`);
    const container = document.getElementById(`timer-container-${exerciseId}`);
    const btn       = document.getElementById(`timer-btn-${exerciseId}`);

    container.classList.add('timer-running');
    btn.textContent = 'RESET';

    const interval = setInterval(() => {
        const timeLeft = Math.round((endTime - Date.now()) / 1000);

        if (timeLeft <= 0) {
            clearInterval(interval);
            container.classList.remove('timer-running');
            display.textContent = 'VIA!';
            btn.textContent     = 'START REST';
            delete activeTimers[exerciseId];
            playTimerEndSound();
        } else {
            display.textContent = formatTime(timeLeft);
        }
    }, 250); // 250ms per avere il display fluido senza drift

    activeTimers[exerciseId] = { interval, endTime };
}


// ─────────────────────────────────────────────────────────────
// 11. TIMER ISOMETRIA
// ─────────────────────────────────────────────────────────────

/** Mappa { exerciseId → { interval, endTime } } — iso-timer attivi */
let activeIsoTimers = {};

/**
 * startIsoTimer(exerciseId, defaultSeconds)
 * Avvia (o ferma) il timer isometrico per un esercizio.
 *   - Prima chiamata  → countdown viola, bottone "STOP" rosso
 *   - Seconda chiamata → ferma e ripristina
 * Al termine: display "FINE!", suono + vibrazione.
 */
export function startIsoTimer(exerciseId, defaultSeconds) {
    unlockAudio();

    // Se il timer è già attivo → STOP/RESET
    if (activeIsoTimers[exerciseId]) {
        clearInterval(activeIsoTimers[exerciseId].interval);
        document.getElementById(`iso-timer-container-${exerciseId}`).classList.remove('iso-running');
        document.getElementById(`iso-timer-display-${exerciseId}`).textContent     = formatTime(defaultSeconds);
        document.getElementById(`iso-timer-btn-${exerciseId}`).textContent         = '▶ GO';
        document.getElementById(`iso-timer-btn-${exerciseId}`).style.backgroundColor = '#8B5CF6';
        delete activeIsoTimers[exerciseId];
        return;
    }

    const endTime   = Date.now() + (defaultSeconds * 1000);
    const display   = document.getElementById(`iso-timer-display-${exerciseId}`);
    const container = document.getElementById(`iso-timer-container-${exerciseId}`);
    const btn       = document.getElementById(`iso-timer-btn-${exerciseId}`);

    container.classList.add('iso-running');
    btn.textContent             = 'STOP';
    btn.style.backgroundColor   = '#EF4444'; // Rosso = fermalo ora

    const interval = setInterval(() => {
        const timeLeft = Math.round((endTime - Date.now()) / 1000);

        if (timeLeft <= 0) {
            clearInterval(interval);
            container.classList.remove('iso-running');
            display.textContent             = 'FINE!';
            btn.textContent                 = '▶ GO';
            btn.style.backgroundColor       = '#8B5CF6';
            delete activeIsoTimers[exerciseId];
            playTimerEndSound();
        } else {
            display.textContent = formatTime(timeLeft);
        }
    }, 250);

    activeIsoTimers[exerciseId] = { interval, endTime };
}


// ─────────────────────────────────────────────────────────────
// 12. formatTime(seconds)
//    Converte secondi interi nel formato M:SS (es. 90 → "1:30").
// ─────────────────────────────────────────────────────────────
export function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}


// ─────────────────────────────────────────────────────────────
// 13. CIRCUITO A TEMPO
//     _buildCircuitCard  — crea la card HTML nel POV atleta
//     startCircuit       — avvia / resetta il circuito
//     _tickCircuit       — gestisce la state machine interna
//     _resetCircuitUI    — ripristina la UI allo stato idle
// ─────────────────────────────────────────────────────────────

/**
 * _buildCircuitCard(ex, i)
 * Dispatch per modo: circuit / emom / amrap / tabata
 */
export function _buildCircuitCard(ex, i) {
    const mode = ex.circuitMode || 'circuit';
    if (mode === 'emom')   return _buildEmomCard(ex, i);
    if (mode === 'amrap')  return _buildAmrapCard(ex, i);
    if (mode === 'tabata') return _buildTabataCard(ex, i);
    return _buildCircuitCardInner(ex, i);
}

function _buildCircuitCardInner(ex, i) {
    const meta    = ex.circuitMeta    || { workTime: 40, restBetweenEx: 20, restBetweenRounds: 120, rounds: 3 };
    const circExs = ex.circuitExercises || [];

    const exListHtml = circExs.map((ce, idx) => {
        // Controllo se esiste il link video e genero il badge
        const videoBadge = (ce.video && ce.video.trim() !== '')
            ? `<button onclick="openVideoModal('${ce.video}','${(ce.name||'').replace(/'/g,"\\'")}')"
                style="display:inline-flex;align-items:center;gap:3px;cursor:pointer;
                background:rgba(249,115,22,0.15);border:1px solid rgba(249,115,22,0.4);border-radius:5px;
                padding:3px 8px;flex-shrink:0;margin-left:4px;">
                <span style="color:#f97316;font-size:10px;font-weight:700;">▶ Video</span>
               </button>`
            : '';

        return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;
                     background:rgba(0,0,0,0.2);border-radius:7px;
                     border-left:2px solid rgba(251,191,36,0.4);">
            <span style="color:var(--amber);font-weight:800;font-size:12px;min-width:18px;">${idx + 1}.</span>
            <span id="circ-ex-item-${i}-${idx}" style="color:var(--text);font-size:13px;font-weight:600;">${escHtml(ce.name)}</span>
            ${videoBadge}
            ${ce.note ? `<span style="color:var(--muted);font-size:11px;margin-left:auto;text-align:right;">${escHtml(ce.note)}</span>` : ''}
        </div>`;
    }).join('');

    const div = document.createElement('div');
    div.style.cssText = 'width:100%; position:relative;';
    div.innerHTML = `
      <div class="circuit-block" id="circuit-block-${i}">

        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <span style="font-size:20px;">⏱</span>
          <div>
            <div style="font-size:16px;font-weight:800;color:var(--text);">${escHtml(ex.name || 'Circuito a Tempo')}</div>
            <div style="font-size:10px;color:var(--amber);font-weight:800;text-transform:uppercase;letter-spacing:0.8px;">Circuito a Tempo</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;
                    padding:10px;background:rgba(0,0,0,0.25);border-radius:10px;
                    border:1px dashed rgba(251,191,36,0.2);">
          <div style="text-align:center;">
            <div style="font-size:9px;color:var(--amber);font-weight:800;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">LAVORO</div>
            <div style="font-size:24px;font-weight:800;color:var(--text);font-variant-numeric:tabular-nums;">${meta.workTime}"</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:9px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">REST ES.</div>
            <div style="font-size:24px;font-weight:800;color:var(--text);font-variant-numeric:tabular-nums;">${meta.restBetweenEx}"</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:9px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">REST GIRO</div>
            <div style="font-size:20px;font-weight:800;color:var(--text);font-variant-numeric:tabular-nums;">${formatTime(meta.restBetweenRounds)}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:9px;color:var(--teal);font-weight:800;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">GIRI</div>
            <div style="font-size:24px;font-weight:800;color:var(--teal);font-variant-numeric:tabular-nums;">${meta.rounds}</div>
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-size:11px;font-weight:800;color:var(--text);text-transform:uppercase;
                      letter-spacing:0.5px;margin-bottom:6px;">Esercizi (${circExs.length})</div>
          <div id="circ-exlist-${i}" style="display:flex;flex-direction:column;gap:4px;">
            ${exListHtml || '<div style="color:var(--muted);font-size:11px;font-style:italic;">Nessun esercizio nel circuito.</div>'}
          </div>
        </div>

        <div class="circuit-timer-box" id="circ-timer-box-${i}">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--amber);"
               id="circ-phase-${i}">Pronto</div>
          <div class="circuit-time-display" id="circ-display-${i}"
               style="color:var(--text);">${formatTime(meta.workTime)}</div>
          <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:4px;"
               id="circ-exname-${i}">${circExs[0] ? circExs[0].name : '—'}</div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:14px;"
               id="circ-progress-${i}">Giro 1/${meta.rounds} · Esercizio 1/${circExs.length}</div>
          <button id="circ-btn-${i}"
                  onclick="startCircuit(${i})"
                  style="width:100%;padding:14px;background:var(--amber);color:#000;border:none;
                         border-radius:10px;font-size:14px;font-weight:800;cursor:pointer;
                         letter-spacing:0.5px;">
            ▶ START CIRCUITO
          </button>
        </div>

      </div>`;
    return div;
}

function _buildEmomCard(ex, i) {
    const meta    = ex.circuitMeta || {};
    const circExs = ex.circuitExercises || [];
    const dur     = meta.duration || 10;

    const exListHtml = circExs.map((ce, idx) => {
        const videoBadge = (ce.video && ce.video.trim())
            ? `<button onclick="openVideoModal('${ce.video}','${(ce.name||'').replace(/'/g,"\\'")}')" style="display:inline-flex;align-items:center;gap:3px;cursor:pointer;background:rgba(249,115,22,0.15);border:1px solid rgba(249,115,22,0.4);border-radius:5px;padding:3px 8px;flex-shrink:0;margin-left:4px;"><span style="color:#f97316;font-size:10px;font-weight:700;">▶ Video</span></button>` : '';
        return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(0,0,0,0.2);border-radius:7px;border-left:2px solid rgba(16,185,129,0.4);">
            <span style="color:var(--teal);font-weight:800;font-size:12px;min-width:20px;">M${idx + 1}.</span>
            <span id="circ-ex-item-${i}-${idx}" style="color:var(--text);font-size:13px;font-weight:600;">${escHtml(ce.name)}</span>
            ${videoBadge}
            ${ce.note ? `<span style="color:var(--muted);font-size:11px;margin-left:auto;">${escHtml(ce.note)}</span>` : ''}
        </div>`;
    }).join('');

    const div = document.createElement('div');
    div.style.cssText = 'width:100%;position:relative;';
    div.innerHTML = `
      <div class="circuit-block" id="circuit-block-${i}" style="border:2px solid rgba(16,185,129,0.3);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <span style="font-size:20px;">⏱</span>
          <div>
            <div style="font-size:16px;font-weight:800;color:var(--text);">${escHtml(ex.name || 'EMOM')}</div>
            <div style="font-size:10px;color:var(--teal);font-weight:800;text-transform:uppercase;letter-spacing:0.8px;">EMOM — ${dur} minuti · ${circExs.length} esercizi</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;padding:10px;background:rgba(0,0,0,0.25);border-radius:10px;border:1px dashed rgba(16,185,129,0.2);">
          <div style="text-align:center;"><div style="font-size:9px;color:var(--teal);font-weight:800;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">DURATA</div><div style="font-size:24px;font-weight:800;color:var(--text);">${dur}'</div></div>
          <div style="text-align:center;"><div style="font-size:9px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">PER MINUTO</div><div style="font-size:24px;font-weight:800;color:var(--text);">60"</div></div>
          <div style="text-align:center;"><div style="font-size:9px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">ESERCIZI</div><div style="font-size:24px;font-weight:800;color:var(--teal);">${circExs.length}</div></div>
        </div>
        <div style="margin-bottom:12px;">
          <div style="font-size:11px;font-weight:800;color:var(--teal);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Schema EMOM</div>
          <div id="circ-exlist-${i}" style="display:flex;flex-direction:column;gap:4px;">${exListHtml || '<div style="color:var(--muted);font-size:11px;font-style:italic;">Nessun esercizio.</div>'}</div>
        </div>
        <div class="circuit-timer-box" id="circ-timer-box-${i}">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--teal);" id="circ-phase-${i}">Pronto</div>
          <div class="circuit-time-display" id="circ-display-${i}" style="color:var(--text);">1:00</div>
          <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:4px;" id="circ-exname-${i}">${circExs[0] ? circExs[0].name : '—'}</div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:14px;" id="circ-progress-${i}">Minuto 1/${dur}</div>
          <button id="circ-btn-${i}" onclick="startCircuit(${i})" style="width:100%;padding:14px;background:var(--teal);color:#000;border:none;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer;letter-spacing:0.5px;">▶ START EMOM</button>
        </div>
      </div>`;
    return div;
}

function _buildAmrapCard(ex, i) {
    const meta    = ex.circuitMeta || {};
    const circExs = ex.circuitExercises || [];
    const dur     = meta.duration || 12;

    const exListHtml = circExs.map((ce, idx) => {
        const videoBadge = (ce.video && ce.video.trim())
            ? `<button onclick="openVideoModal('${ce.video}','${(ce.name||'').replace(/'/g,"\\'")}')" style="display:inline-flex;align-items:center;gap:3px;cursor:pointer;background:rgba(249,115,22,0.15);border:1px solid rgba(249,115,22,0.4);border-radius:5px;padding:3px 8px;flex-shrink:0;margin-left:4px;"><span style="color:#f97316;font-size:10px;font-weight:700;">▶ Video</span></button>` : '';
        return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(0,0,0,0.2);border-radius:7px;border-left:2px solid rgba(59,130,246,0.4);">
            <span style="color:var(--blue);font-weight:800;font-size:12px;min-width:18px;">${idx + 1}.</span>
            <span id="circ-ex-item-${i}-${idx}" style="color:var(--text);font-size:13px;font-weight:600;">${escHtml(ce.name)}</span>
            ${videoBadge}
            ${ce.note ? `<span style="color:var(--muted);font-size:11px;margin-left:auto;">${escHtml(ce.note)}</span>` : ''}
        </div>`;
    }).join('');

    const div = document.createElement('div');
    div.style.cssText = 'width:100%;position:relative;';
    div.innerHTML = `
      <div class="circuit-block" id="circuit-block-${i}" style="border:2px solid rgba(59,130,246,0.3);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <span style="font-size:20px;">🔁</span>
          <div>
            <div style="font-size:16px;font-weight:800;color:var(--text);">${escHtml(ex.name || 'AMRAP')}</div>
            <div style="font-size:10px;color:var(--blue);font-weight:800;text-transform:uppercase;letter-spacing:0.8px;">AMRAP — ${dur} minuti</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px;padding:10px;background:rgba(0,0,0,0.25);border-radius:10px;border:1px dashed rgba(59,130,246,0.2);">
          <div style="text-align:center;"><div style="font-size:9px;color:var(--blue);font-weight:800;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">DURATA</div><div style="font-size:24px;font-weight:800;color:var(--text);">${dur}'</div></div>
          <div style="text-align:center;"><div style="font-size:9px;color:var(--teal);font-weight:800;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">GIRI COMP.</div><div style="font-size:24px;font-weight:800;color:var(--teal);" id="circ-amrap-rounds-${i}">0</div></div>
        </div>
        <div style="margin-bottom:12px;">
          <div style="font-size:11px;font-weight:800;color:var(--blue);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Schema Round</div>
          <div style="display:flex;flex-direction:column;gap:4px;">${exListHtml || '<div style="color:var(--muted);font-size:11px;font-style:italic;">Nessun esercizio.</div>'}</div>
        </div>
        <div class="circuit-timer-box" id="circ-timer-box-${i}">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--blue);" id="circ-phase-${i}">Pronto</div>
          <div class="circuit-time-display" id="circ-display-${i}" style="color:var(--text);">${formatTime(dur * 60)}</div>
          <div style="font-size:13px;font-weight:700;color:var(--muted);margin-bottom:14px;" id="circ-progress-${i}">Giri completati: 0</div>
          <button id="circ-lap-${i}" onclick="amrapLap(${i})" style="display:none;width:100%;padding:12px;background:var(--teal);color:#000;border:none;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;margin-bottom:8px;">✅ Giro Completato</button>
          <button id="circ-btn-${i}" onclick="startCircuit(${i})" style="width:100%;padding:14px;background:var(--blue);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer;letter-spacing:0.5px;">▶ START AMRAP</button>
        </div>
      </div>`;
    return div;
}

function _buildTabataCard(ex, i) {
    const meta    = ex.circuitMeta || {};
    const circExs = ex.circuitExercises || [];
    const work    = meta.workTime || 20;
    const rest    = meta.restTime || 10;
    const rounds  = meta.rounds   || 8;

    const exListHtml = circExs.map((ce, idx) => {
        const videoBadge = (ce.video && ce.video.trim())
            ? `<button onclick="openVideoModal('${ce.video}','${(ce.name||'').replace(/'/g,"\\'")}')" style="display:inline-flex;align-items:center;gap:3px;cursor:pointer;background:rgba(249,115,22,0.15);border:1px solid rgba(249,115,22,0.4);border-radius:5px;padding:3px 8px;flex-shrink:0;margin-left:4px;"><span style="color:#f97316;font-size:10px;font-weight:700;">▶ Video</span></button>` : '';
        return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(0,0,0,0.2);border-radius:7px;border-left:2px solid rgba(239,68,68,0.4);">
            <span style="color:var(--coral);font-weight:800;font-size:12px;min-width:18px;">${idx + 1}.</span>
            <span id="circ-ex-item-${i}-${idx}" style="color:var(--text);font-size:13px;font-weight:600;">${escHtml(ce.name)}</span>
            ${videoBadge}
            ${ce.note ? `<span style="color:var(--muted);font-size:11px;margin-left:auto;">${escHtml(ce.note)}</span>` : ''}
        </div>`;
    }).join('');

    const totalTime = circExs.length * rounds * (work + rest);
    const div = document.createElement('div');
    div.style.cssText = 'width:100%;position:relative;';
    div.innerHTML = `
      <div class="circuit-block" id="circuit-block-${i}" style="border:2px solid rgba(239,68,68,0.3);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <span style="font-size:20px;">🔥</span>
          <div>
            <div style="font-size:16px;font-weight:800;color:var(--text);">${escHtml(ex.name || 'Tabata')}</div>
            <div style="font-size:10px;color:var(--coral);font-weight:800;text-transform:uppercase;letter-spacing:0.8px;">TABATA — ${work}s/${rest}s · ${rounds} round/es. · ~${Math.round(totalTime/60)}' tot</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;padding:10px;background:rgba(0,0,0,0.25);border-radius:10px;border:1px dashed rgba(239,68,68,0.2);">
          <div style="text-align:center;"><div style="font-size:9px;color:var(--coral);font-weight:800;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">LAVORO</div><div style="font-size:24px;font-weight:800;color:var(--text);">${work}"</div></div>
          <div style="text-align:center;"><div style="font-size:9px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">RIPOSO</div><div style="font-size:24px;font-weight:800;color:var(--text);">${rest}"</div></div>
          <div style="text-align:center;"><div style="font-size:9px;color:var(--teal);font-weight:800;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">ROUND</div><div style="font-size:24px;font-weight:800;color:var(--teal);">${rounds}</div></div>
          <div style="text-align:center;"><div style="font-size:9px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">ESERCIZI</div><div style="font-size:24px;font-weight:800;color:var(--text);">${circExs.length}</div></div>
        </div>
        <div style="margin-bottom:12px;">
          <div style="font-size:11px;font-weight:800;color:var(--coral);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Esercizi (${circExs.length})</div>
          <div id="circ-exlist-${i}" style="display:flex;flex-direction:column;gap:4px;">${exListHtml || '<div style="color:var(--muted);font-size:11px;font-style:italic;">Nessun esercizio.</div>'}</div>
        </div>
        <div class="circuit-timer-box" id="circ-timer-box-${i}">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--coral);" id="circ-phase-${i}">Pronto</div>
          <div class="circuit-time-display" id="circ-display-${i}" style="color:var(--text);">${work}"</div>
          <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:4px;" id="circ-exname-${i}">${circExs[0] ? circExs[0].name : '—'}</div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:14px;" id="circ-progress-${i}">Es. 1/${circExs.length} · Round 1/${rounds}</div>
          <button id="circ-btn-${i}" onclick="startCircuit(${i})" style="width:100%;padding:14px;background:var(--coral);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer;letter-spacing:0.5px;">▶ START TABATA</button>
        </div>
      </div>`;
    return div;
}

/**
 * startCircuit(circuitIdx)
 * Avvia il circuito oppure, se già in corso, lo resetta.
 */
export function startCircuit(circuitIdx) {
    unlockAudio();

    const sch          = DB.schedules[appState.selAthId];
    const activeSessId = document.getElementById('lv-sess').value;
    const curSess      = sch && sch.sessions ? sch.sessions.find(x => x.id === activeSessId) : null;
    if (!curSess) return;
    const ex = curSess.exercises[circuitIdx];
    if (!ex || ex.type !== 'circuit') return;

    const state = window.circuitStates[circuitIdx];

    // Se già in esecuzione → RESET
    if (state && state.running) {
        clearInterval(state.interval);
        window.circuitStates[circuitIdx] = null;
        _resetCircuitUI(circuitIdx, ex);
        return;
    }

    // Nuova esecuzione — stato iniziale per-mode
    const mode = ex.circuitMode || 'circuit';
    window.circuitStates[circuitIdx] = {
        running: true,
        phase:   'work',
        round:   1,
        exIdx:   0,
        minute:  1,         // EMOM
        amrapRounds: 0,     // AMRAP
        interval: null,
        endTime:  null
    };

    _tickCircuit(circuitIdx, ex);
}

/**
 * _tickCircuit(circuitIdx, ex)
 * Avvia un intervallo per la fase corrente della state machine
 * e gestisce la transizione alla fase successiva.
 */
export function _tickCircuit(circuitIdx, ex) {
    const state = window.circuitStates[circuitIdx];
    if (!state || !state.running) return;

    const mode = ex.circuitMode || 'circuit';
    if (mode === 'emom')   { _tickEmom(circuitIdx, ex, state);   return; }
    if (mode === 'amrap')  { _tickAmrap(circuitIdx, ex, state);  return; }
    if (mode === 'tabata') { _tickTabata(circuitIdx, ex, state); return; }

    const meta    = ex.circuitMeta    || {};
    const circExs = ex.circuitExercises || [];

    let phaseDuration, phaseLabel, phaseColor;

    if (state.phase === 'work') {
        phaseDuration = meta.workTime       || 40;
        phaseLabel    = 'LAVORO';
        phaseColor    = 'var(--teal)';
    } else if (state.phase === 'rest-ex') {
        phaseDuration = meta.restBetweenEx  || 20;
        phaseLabel    = 'RECUPERO';
        phaseColor    = 'var(--amber)';
    } else {
        phaseDuration = meta.restBetweenRounds || 120;
        phaseLabel    = 'RIPOSO TRA GIRI';
        phaseColor    = 'var(--blue)';
    }

    const totalRounds = meta.rounds || 3;
    const currentEx   = circExs[state.exIdx];

    // Aggiorna UI
    const box    = document.getElementById(`circ-timer-box-${circuitIdx}`);
    const phaseEl= document.getElementById(`circ-phase-${circuitIdx}`);
    const dispEl = document.getElementById(`circ-display-${circuitIdx}`);
    const exNameEl= document.getElementById(`circ-exname-${circuitIdx}`);
    const progEl = document.getElementById(`circ-progress-${circuitIdx}`);
    const btn    = document.getElementById(`circ-btn-${circuitIdx}`);

    if (box)     box.classList.add('circuit-running');
    if (phaseEl) { phaseEl.textContent = phaseLabel; phaseEl.style.color = phaseColor; }
    if (dispEl)  { dispEl.textContent = formatTime(phaseDuration); dispEl.style.color = phaseColor; }
    if (exNameEl)exNameEl.textContent = state.phase === 'rest-round'
        ? '— Riposo tra i giri —'
        : (currentEx ? currentEx.name : '—');
    if (progEl)  progEl.textContent =
        `Giro ${state.round}/${totalRounds} · Esercizio ${state.exIdx + 1}/${circExs.length}`;
    if (btn)     { btn.textContent = '■ RESET'; btn.style.background = 'var(--coral)'; btn.style.color = '#fff'; }

    // Evidenzia l'esercizio corrente nella lista
    circExs.forEach((_, idx) => {
        const el = document.getElementById(`circ-ex-item-${circuitIdx}-${idx}`);
        if (!el) return;
        el.style.color  = (idx === state.exIdx && state.phase !== 'rest-round') ? 'var(--amber)' : 'var(--text)';
        el.style.fontWeight = (idx === state.exIdx && state.phase !== 'rest-round') ? '800' : '600';
    });

    const endTime = Date.now() + phaseDuration * 1000;
    state.endTime = endTime;

    state.interval = setInterval(() => {
        const timeLeft = Math.round((state.endTime - Date.now()) / 1000);

        if (timeLeft <= 0) {
            clearInterval(state.interval);
            playTimerEndSound();

            // Transizione di fase
            if (state.phase === 'work') {
                if (state.exIdx < circExs.length - 1) {
                    // Ci sono altri esercizi nello stesso giro
                    state.exIdx++;
                    state.phase = 'rest-ex';
                } else if (state.round < totalRounds) {
                    // Fine del giro, ma ci sono altri giri
                    state.phase = 'rest-round';
                } else {
                    // Circuito completato!
                    state.running = false;
                    window.circuitStates[circuitIdx] = null;
                    if (box)     box.classList.remove('circuit-running');
                    if (phaseEl) { phaseEl.textContent = 'COMPLETATO!'; phaseEl.style.color = 'var(--teal)'; }
                    if (dispEl)  { dispEl.textContent = '0:00'; dispEl.style.color = 'var(--teal)'; }
                    if (exNameEl)exNameEl.textContent = 'Ottimo lavoro!';
                    if (progEl)  progEl.textContent = `${totalRounds} giri completati`;
                    if (btn)     { btn.textContent = '▶ RICOMINCIA'; btn.style.background = 'var(--teal)'; btn.style.color = '#000'; }
                    if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
                    return;
                }
            } else if (state.phase === 'rest-ex') {
                state.phase = 'work';
            } else if (state.phase === 'rest-round') {
                state.round++;
                state.exIdx = 0;
                state.phase = 'work';
            }

            _tickCircuit(circuitIdx, ex);
        } else {
            if (dispEl) dispEl.textContent = formatTime(timeLeft);
        }
    }, 250);
}

function _tickEmom(idx, ex, state) {
    const meta    = ex.circuitMeta || {};
    const circExs = ex.circuitExercises || [];
    const dur     = meta.duration || 10;
    const exIdx   = (state.minute - 1) % Math.max(circExs.length, 1);
    const curEx   = circExs[exIdx];

    const phaseEl  = document.getElementById(`circ-phase-${idx}`);
    const dispEl   = document.getElementById(`circ-display-${idx}`);
    const exNameEl = document.getElementById(`circ-exname-${idx}`);
    const progEl   = document.getElementById(`circ-progress-${idx}`);
    const btn      = document.getElementById(`circ-btn-${idx}`);
    const box      = document.getElementById(`circ-timer-box-${idx}`);

    if (box)     box.classList.add('circuit-running');
    if (phaseEl) { phaseEl.textContent = `MINUTO ${state.minute}/${dur}`; phaseEl.style.color = 'var(--teal)'; }
    if (dispEl)  { dispEl.textContent = '1:00'; dispEl.style.color = 'var(--teal)'; }
    if (exNameEl)exNameEl.textContent = curEx ? curEx.name : '—';
    if (progEl)  progEl.textContent   = curEx && curEx.note ? curEx.note : `Minuto ${state.minute}/${dur}`;
    if (btn)     { btn.textContent = '■ RESET'; btn.style.background = 'var(--coral)'; btn.style.color = '#fff'; }

    circExs.forEach((_, i) => {
        const el = document.getElementById(`circ-ex-item-${idx}-${i}`);
        if (el) { el.style.color = i === exIdx ? 'var(--teal)' : 'var(--text)'; el.style.fontWeight = i === exIdx ? '800' : '600'; }
    });

    const endTime = Date.now() + 60000;
    state.endTime = endTime;
    state.interval = setInterval(() => {
        const left = Math.round((state.endTime - Date.now()) / 1000);
        if (left <= 0) {
            clearInterval(state.interval);
            playTimerEndSound();
            if (state.minute >= dur) {
                state.running = false; window.circuitStates[idx] = null;
                if (box)     box.classList.remove('circuit-running');
                if (phaseEl) { phaseEl.textContent = 'COMPLETATO!'; phaseEl.style.color = 'var(--teal)'; }
                if (dispEl)  { dispEl.textContent = '0:00'; dispEl.style.color = 'var(--teal)'; }
                if (exNameEl)exNameEl.textContent = 'Ottimo lavoro!';
                if (progEl)  progEl.textContent = `${dur} minuti completati`;
                if (btn)     { btn.textContent = '▶ RICOMINCIA'; btn.style.background = 'var(--teal)'; btn.style.color = '#000'; }
                if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
            } else {
                state.minute++;
                _tickEmom(idx, ex, state);
            }
        } else {
            if (dispEl) dispEl.textContent = formatTime(left);
        }
    }, 250);
}

function _tickAmrap(idx, ex, state) {
    const meta = ex.circuitMeta || {};
    const dur  = (meta.duration || 12) * 60;

    const phaseEl  = document.getElementById(`circ-phase-${idx}`);
    const dispEl   = document.getElementById(`circ-display-${idx}`);
    const progEl   = document.getElementById(`circ-progress-${idx}`);
    const btn      = document.getElementById(`circ-btn-${idx}`);
    const lapBtn   = document.getElementById(`circ-lap-${idx}`);
    const box      = document.getElementById(`circ-timer-box-${idx}`);

    if (box)     box.classList.add('circuit-running');
    if (phaseEl) { phaseEl.textContent = 'IN CORSO'; phaseEl.style.color = 'var(--blue)'; }
    if (dispEl)  { dispEl.textContent = formatTime(dur); dispEl.style.color = 'var(--blue)'; }
    if (lapBtn)  lapBtn.style.display = 'block';
    if (btn)     { btn.textContent = '■ STOP'; btn.style.background = 'var(--coral)'; btn.style.color = '#fff'; }

    const endTime = Date.now() + dur * 1000;
    state.endTime = endTime;
    state.interval = setInterval(() => {
        const left = Math.round((state.endTime - Date.now()) / 1000);
        const rounds = state.amrapRounds || 0;
        if (progEl) progEl.textContent = `Giri completati: ${rounds}`;
        const roundsEl = document.getElementById(`circ-amrap-rounds-${idx}`);
        if (roundsEl) roundsEl.textContent = rounds;
        if (left <= 0) {
            clearInterval(state.interval);
            playTimerEndSound();
            state.running = false; window.circuitStates[idx] = null;
            if (box)     box.classList.remove('circuit-running');
            if (phaseEl) { phaseEl.textContent = 'TEMPO!'; phaseEl.style.color = 'var(--coral)'; }
            if (dispEl)  { dispEl.textContent = '0:00'; dispEl.style.color = 'var(--coral)'; }
            if (progEl)  progEl.textContent = `${rounds} giri completati`;
            if (lapBtn)  lapBtn.style.display = 'none';
            if (btn)     { btn.textContent = '▶ RICOMINCIA'; btn.style.background = 'var(--blue)'; btn.style.color = '#fff'; }
            if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
        } else {
            if (dispEl) dispEl.textContent = formatTime(left);
        }
    }, 250);
}

export function amrapLap(idx) {
    const state = window.circuitStates[idx];
    if (!state || !state.running) return;
    state.amrapRounds = (state.amrapRounds || 0) + 1;
    if (navigator.vibrate) navigator.vibrate(50);
    const roundsEl = document.getElementById(`circ-amrap-rounds-${idx}`);
    if (roundsEl) roundsEl.textContent = state.amrapRounds;
    const progEl = document.getElementById(`circ-progress-${idx}`);
    if (progEl) progEl.textContent = `Giri completati: ${state.amrapRounds}`;
}

function _tickTabata(idx, ex, state) {
    const meta    = ex.circuitMeta || {};
    const circExs = ex.circuitExercises || [];
    const work    = meta.workTime || 20;
    const rest    = meta.restTime || 10;
    const rounds  = meta.rounds   || 8;

    const isWork   = state.phase !== 'rest-ex';
    const phaseDur = isWork ? work : rest;
    const curEx    = circExs[state.exIdx] || { name: '—' };

    const phaseEl  = document.getElementById(`circ-phase-${idx}`);
    const dispEl   = document.getElementById(`circ-display-${idx}`);
    const exNameEl = document.getElementById(`circ-exname-${idx}`);
    const progEl   = document.getElementById(`circ-progress-${idx}`);
    const btn      = document.getElementById(`circ-btn-${idx}`);
    const box      = document.getElementById(`circ-timer-box-${idx}`);

    if (box)     box.classList.add('circuit-running');
    if (phaseEl) { phaseEl.textContent = isWork ? 'LAVORO' : 'RIPOSO'; phaseEl.style.color = isWork ? 'var(--coral)' : 'var(--muted)'; }
    if (dispEl)  { dispEl.textContent = formatTime(phaseDur); dispEl.style.color = isWork ? 'var(--coral)' : 'var(--muted)'; }
    if (exNameEl)exNameEl.textContent = isWork ? curEx.name : '—';
    if (progEl)  progEl.textContent   = `Es. ${state.exIdx + 1}/${circExs.length} · Round ${state.round}/${rounds}`;
    if (btn)     { btn.textContent = '■ RESET'; btn.style.background = 'var(--coral)'; btn.style.color = '#fff'; }

    circExs.forEach((_, i) => {
        const el = document.getElementById(`circ-ex-item-${idx}-${i}`);
        if (el) { el.style.color = (i === state.exIdx && isWork) ? 'var(--coral)' : 'var(--text)'; el.style.fontWeight = (i === state.exIdx && isWork) ? '800' : '600'; }
    });

    const endTime = Date.now() + phaseDur * 1000;
    state.endTime = endTime;
    state.interval = setInterval(() => {
        const left = Math.round((state.endTime - Date.now()) / 1000);
        if (left <= 0) {
            clearInterval(state.interval);
            playTimerEndSound();
            if (isWork) {
                state.phase = 'rest-ex';
            } else {
                state.phase = 'work';
                if (state.round < rounds) {
                    state.round++;
                } else {
                    // Tutti i round di questo esercizio finiti
                    if (state.exIdx < circExs.length - 1) {
                        state.exIdx++;
                        state.round = 1;
                    } else {
                        // Tabata completata
                        state.running = false; window.circuitStates[idx] = null;
                        if (box)     box.classList.remove('circuit-running');
                        if (phaseEl) { phaseEl.textContent = 'COMPLETATO!'; phaseEl.style.color = 'var(--teal)'; }
                        if (dispEl)  { dispEl.textContent = '0:00'; dispEl.style.color = 'var(--teal)'; }
                        if (exNameEl)exNameEl.textContent = 'Ottimo lavoro!';
                        if (progEl)  progEl.textContent = `${circExs.length} esercizi · ${rounds} round completati`;
                        if (btn)     { btn.textContent = '▶ RICOMINCIA'; btn.style.background = 'var(--coral)'; btn.style.color = '#fff'; }
                        if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
                        return;
                    }
                }
            }
            _tickTabata(idx, ex, state);
        } else {
            if (dispEl) dispEl.textContent = formatTime(left);
        }
    }, 250);
}

/**
 * _resetCircuitUI(circuitIdx, ex)
 * Riporta la card del circuito allo stato idle.
 */
export function _resetCircuitUI(circuitIdx, ex) {
    const mode    = ex.circuitMode || 'circuit';
    const meta    = ex.circuitMeta || {};
    const circExs = ex.circuitExercises || [];

    const box     = document.getElementById(`circ-timer-box-${circuitIdx}`);
    const phaseEl = document.getElementById(`circ-phase-${circuitIdx}`);
    const dispEl  = document.getElementById(`circ-display-${circuitIdx}`);
    const exNameEl= document.getElementById(`circ-exname-${circuitIdx}`);
    const progEl  = document.getElementById(`circ-progress-${circuitIdx}`);
    const btn     = document.getElementById(`circ-btn-${circuitIdx}`);
    const lapBtn  = document.getElementById(`circ-lap-${circuitIdx}`);

    if (box) box.classList.remove('circuit-running');
    if (lapBtn) lapBtn.style.display = 'none';
    circExs.forEach((_, idx) => {
        const el = document.getElementById(`circ-ex-item-${circuitIdx}-${idx}`);
        if (el) { el.style.color = 'var(--text)'; el.style.fontWeight = '600'; }
    });

    if (mode === 'emom') {
        const dur = meta.duration || 10;
        if (phaseEl) { phaseEl.textContent = 'Pronto'; phaseEl.style.color = 'var(--teal)'; }
        if (dispEl)  { dispEl.textContent = '1:00'; dispEl.style.color = 'var(--text)'; }
        if (exNameEl)exNameEl.textContent = circExs[0] ? circExs[0].name : '—';
        if (progEl)  progEl.textContent = `Minuto 1/${dur}`;
        if (btn)     { btn.textContent = '▶ START EMOM'; btn.style.background = 'var(--teal)'; btn.style.color = '#000'; }
    } else if (mode === 'amrap') {
        const dur = meta.duration || 12;
        if (phaseEl) { phaseEl.textContent = 'Pronto'; phaseEl.style.color = 'var(--blue)'; }
        if (dispEl)  { dispEl.textContent = formatTime(dur * 60); dispEl.style.color = 'var(--text)'; }
        if (progEl)  progEl.textContent = 'Giri completati: 0';
        const roundsEl = document.getElementById(`circ-amrap-rounds-${circuitIdx}`);
        if (roundsEl) roundsEl.textContent = '0';
        if (btn)     { btn.textContent = '▶ START AMRAP'; btn.style.background = 'var(--blue)'; btn.style.color = '#fff'; }
    } else if (mode === 'tabata') {
        const work = meta.workTime || 20; const rounds = meta.rounds || 8;
        if (phaseEl) { phaseEl.textContent = 'Pronto'; phaseEl.style.color = 'var(--coral)'; }
        if (dispEl)  { dispEl.textContent = formatTime(work); dispEl.style.color = 'var(--text)'; }
        if (exNameEl)exNameEl.textContent = circExs[0] ? circExs[0].name : '—';
        if (progEl)  progEl.textContent = `Es. 1/${circExs.length} · Round 1/${rounds}`;
        if (btn)     { btn.textContent = '▶ START TABATA'; btn.style.background = 'var(--coral)'; btn.style.color = '#fff'; }
    } else {
        if (phaseEl) { phaseEl.textContent = 'Pronto'; phaseEl.style.color = 'var(--amber)'; }
        if (dispEl)  { dispEl.textContent = formatTime(meta.workTime || 40); dispEl.style.color = 'var(--text)'; }
        if (exNameEl)exNameEl.textContent = circExs[0] ? circExs[0].name : '—';
        if (progEl)  progEl.textContent = `Giro 1/${meta.rounds || 3} · Esercizio 1/${circExs.length}`;
        if (btn)     { btn.textContent = '▶ START CIRCUITO'; btn.style.background = 'var(--amber)'; btn.style.color = '#000'; }
    }
}

/**
 * _checkSetPR(ex, rep, kg, athId)
 * Restituisce l'e1RM stimato SE supera il massimo storico per quell'esercizio,
 * altrimenti null. Usa formula Epley con RIR. Valida solo per ≤6 reps effettive.
 */
function _checkSetPR(ex, rep, kg, athId) {
    if (!ex || !rep || !kg || ex.trackE1rm === false) return null;
    const rirVal = parseInt(ex.rir);
    const effectiveReps = rep + (isNaN(rirVal) ? 0 : rirVal);
    if (effectiveReps <= 0 || effectiveReps > 6) return null;

    const newE1rm = kg * (1 + effectiveReps / 30);

    const historicBest = DB.sessions
        .filter(s => s.athlete === athId && s.e1rmPerExercise && s.e1rmPerExercise[ex.name])
        .reduce((best, s) => Math.max(best, s.e1rmPerExercise[ex.name] || 0), 0);

    return (historicBest > 0 && newE1rm > historicBest) ? Math.round(newE1rm) : null;
}


// ─────────────────────────────────────────────────────────────
// VIDEO MODAL
// ─────────────────────────────────────────────────────────────
export function openVideoModal(rawUrl, title = '') {
    const iframe = document.getElementById('mo-video-iframe');
    const titleEl = document.getElementById('mo-video-title');
    if (!iframe) return;

    // Estrae l'ID video da qualsiasi formato YouTube
    let videoId = '';
    try {
        const u = new URL(rawUrl);
        if (u.hostname === 'youtu.be') {
            videoId = u.pathname.slice(1).split('?')[0];
        } else if (u.hostname.includes('youtube.com')) {
            videoId = u.searchParams.get('v') || u.pathname.split('/').pop();
        }
    } catch (_) {
        videoId = rawUrl; // fallback: tratta come ID diretto
    }

    // youtube-nocookie: niente cookie pubblicitari finché l'utente non interagisce (GDPR/ePrivacy)
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
    if (titleEl) titleEl.textContent = title || 'Video esercizio';
    openMo('mo-video');
}

export function closeVideoModal() {
    const iframe = document.getElementById('mo-video-iframe');
    if (iframe) iframe.src = ''; // stop playback
    closeMo('mo-video');
}

// ─────────────────────────────────────────────────────────────
// endWorkout()
//   Bottom sheet che sale dal basso al termine dell'allenamento.
//   Raccoglie RPE, stelle e nota opzionale inline — nessuna
//   navigazione a sezioni separate. Al tap "Invia" salva la
//   sessione e manda un messaggio strutturato in chat al coach.
// ─────────────────────────────────────────────────────────────
export function endWorkout() {
    // Focus Mode: ferma e azzera il cronometro, chiudi l'overlay (il bottom sheet
    // sale sull'anteprima ripristinata). No-op se non si è in Focus Mode.
    _focusTimerStop(true);
    exitFocus();

    const lvSess   = document.getElementById('lv-sess');
    const lvWeek   = document.getElementById('lv-week');
    const sessName = lvSess?.selectedIndex >= 0
        ? lvSess.options[lvSess.selectedIndex].text : 'Allenamento';
    const weekVal  = parseInt(lvWeek?.value) || 1;

    const vol     = parseInt((document.getElementById('lv-vol')?.textContent  || '0').replace(/\D/g,'')) || 0;
    const maxE1rm = parseInt((document.getElementById('lv-e1rm')?.textContent || '0').replace(/\D/g,'')) || 0;
    const dotsTotal = document.querySelectorAll('.dot').length;
    const dotsDone  = document.querySelectorAll('.dot.done').length;
    const partial   = dotsDone < dotsTotal;

    let _rpe = 0, _stars = 0;

    document.getElementById('ew-sheet')?.remove();

    document.body.insertAdjacentHTML('beforeend', `
    <div id="ew-sheet" style="
        position:fixed; inset:0; z-index:99999;
        background:rgba(0,0,0,0.55); display:flex;
        align-items:flex-end; justify-content:center;">
      <div id="ew-sheet-inner" style="
          width:100%; max-width:520px;
          background:var(--s1); border-radius:24px 24px 0 0;
          padding:24px 20px 36px; box-shadow:0 -8px 40px rgba(0,0,0,0.4);
          transform:translateY(100%); transition:transform .32s cubic-bezier(.32,1,.5,1);">

        <!-- Handle -->
        <div style="width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 20px;"></div>

        <!-- Stats -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
          <div style="font-size:28px;">${partial ? '💪' : '🎯'}</div>
          <div>
            <div style="font-size:17px;font-weight:800;color:var(--text)">
              ${partial ? 'Allenamento completato' : 'Sessione completata!'}
            </div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px">
              ${sessName}${partial ? ` · ${dotsDone}/${dotsTotal} set` : ''}
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;">
          <div style="background:var(--s2);border-radius:10px;padding:10px 12px;">
            <div style="font-size:10px;color:var(--muted);margin-bottom:2px">Volume</div>
            <div style="font-size:18px;font-weight:800;color:var(--teal)">${vol>0?Math.round(vol/100)/10+'t':'—'}</div>
          </div>
          <div style="background:var(--s2);border-radius:10px;padding:10px 12px;">
            <div style="font-size:10px;color:var(--muted);margin-bottom:2px">e1RM max</div>
            <div style="font-size:18px;font-weight:800;color:var(--amber)">${maxE1rm>0?maxE1rm+' kg':'—'}</div>
          </div>
        </div>

        <!-- RPE -->
        <div style="margin-bottom:16px;">
          <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Com'è andata? (RPE)</div>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;" id="ew-rpe-row">
            ${[6,7,8,9,10].map(v => {
              const col = v<=7?'#22c55e':v<=8?'#fbbf24':v<=9?'#f97316':'#ef4444';
              return `<button data-rpe="${v}" onclick="window._ewSetRpe(${v})" style="
                padding:12px 0;border-radius:10px;border:2px solid var(--border);
                background:var(--s2);color:var(--text);font-size:15px;font-weight:800;
                cursor:pointer;transition:all .15s;" id="ew-rpe-${v}">${v}</button>`;
            }).join('')}
          </div>
        </div>

        <!-- Stelle -->
        <div style="margin-bottom:16px;">
          <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Qualità sessione</div>
          <div style="display:flex;gap:0;justify-content:space-between;" id="ew-stars-row">
            ${[1,2,3,4,5].map(s=>`<button data-s="${s}" onclick="window._ewSetStars(${s})" style="
              font-size:36px;background:none;border:none;cursor:pointer;padding:4px 6px;
              color:#fbbf24;opacity:.25;transition:opacity .15s,transform .1s;
              touch-action:manipulation;" id="ew-star-${s}">★</button>`).join('')}
          </div>
        </div>

        <!-- Nota -->
        <div style="margin-bottom:20px;">
          <input id="ew-note" type="text" placeholder="Nota al coach (opzionale)..." style="
            width:100%;padding:12px 14px;border-radius:10px;font-size:14px;
            background:var(--s2);border:1px solid var(--border);color:var(--text);">
        </div>

        <!-- Azioni -->
        <button id="ew-send" style="
          width:100%;padding:16px;border-radius:14px;border:none;
          background:var(--teal);color:#000;font-size:16px;font-weight:800;
          cursor:pointer;margin-bottom:10px;opacity:.45;pointer-events:none;
          transition:opacity .2s;">Invia al coach →</button>
        <button id="ew-skip" style="
          width:100%;padding:12px;border-radius:14px;border:1px solid var(--border);
          background:none;color:var(--muted);font-size:14px;cursor:pointer;">
          Salta per ora
        </button>
      </div>
    </div>`);

    // Slide-up animation
    requestAnimationFrame(() => requestAnimationFrame(() => {
        document.getElementById('ew-sheet-inner').style.transform = 'translateY(0)';
    }));

    // RPE selection
    window._ewSetRpe = (v) => {
        _rpe = v;
        [6,7,8,9,10].forEach(x => {
            const b = document.getElementById(`ew-rpe-${x}`);
            if (!b) return;
            const col = x<=7?'#22c55e':x<=8?'#fbbf24':x<=9?'#f97316':'#ef4444';
            b.style.background  = x===v ? col : 'var(--s2)';
            b.style.color       = x===v ? '#000' : 'var(--text)';
            b.style.borderColor = x===v ? col : 'var(--border)';
        });
        _checkEwReady();
    };

    // Stars selection
    window._ewSetStars = (s) => {
        _stars = s;
        [1,2,3,4,5].forEach(x => {
            const b = document.getElementById(`ew-star-${x}`);
            if (!b) return;
            b.style.opacity   = x <= s ? '1' : '.25';
            b.style.transform = x <= s ? 'scale(1.15)' : 'scale(1)';
        });
        _checkEwReady();
    };

    function _checkEwReady() {
        const btn = document.getElementById('ew-send');
        if (!btn) return;
        const ready = _rpe > 0 && _stars > 0;
        btn.style.opacity       = ready ? '1' : '.45';
        btn.style.pointerEvents = ready ? 'auto' : 'none';
    }

    function _closeSheet() {
        const sheet = document.getElementById('ew-sheet');
        if (!sheet) return;
        document.getElementById('ew-sheet-inner').style.transform = 'translateY(100%)';
        setTimeout(() => sheet.remove(), 320);
    }

    function _saveAndSend() {
        const note   = document.getElementById('ew-note')?.value.trim() || '';
        const today  = new Date().toISOString().slice(0, 10);
        const athId  = appState.selAthId || window.mioIdLoggato;
        const ath    = window.athById?.(athId);

        // Salva/aggiorna sessione con RPE e qualità
        const existing = DB.sessions.find(
            s => s.athlete === athId && s.session === sessName && s.date === today
        );
        const sessObj = {
            id:        existing?.id || ('live_end_' + uid()),
            athlete:   athId, date: today, session: sessName, week: weekVal,
            phase:     DB.schedules[athId]?.phase || 'Accumulo',
            readiness: parseInt(document.getElementById('ring-n')?.textContent) || 80,
            vol, maxE1rm,
            e1rmDom:  window.liveE1rmDom  || 0,
            e1rmNDom: window.liveE1rmNDom || 0,
            e1rmPerExercise: existing?.e1rmPerExercise || {},
            donePerExercise: window.liveDonePerExercise || existing?.donePerExercise || {},
            setsPerExercise: window.liveSetsPerExercise || existing?.setsPerExercise || {},
            sRPE: _rpe * 60, rpe: _rpe, qual: _stars,
            doms: '', flag: partial ? 'Parziale' : '',
            notes: note || (partial ? `Completati ${dotsDone}/${dotsTotal} set` : ''),
            reply: ''
        };
        let stored;
        if (existing) { Object.assign(existing, sessObj); stored = existing; }
        else { DB.sessions.push(sessObj); stored = sessObj; }
        stored._synced = false;
        window.saveDB();
        if (window.mySupabase) {
            updateCloudStatus('saving');
            const cloud = sessionCloudRow(stored);
            window.mySupabase.from('sessions').upsert([cloud])
                .then(({ error }) => {
                    if (error) { console.error('[session upsert]', error); stored._synced = false; toast('Allenamento salvato in locale — sync cloud non riuscita.'); updateCloudStatus('error'); }
                    else { stored._synced = true; updateCloudStatus('cloud'); window.saveDB?.(); }
                });
        }
        window._updateFeedbackBadge?.(athId);

        // Invia messaggio strutturato in chat al coach
        const stars  = '★'.repeat(_stars) + '☆'.repeat(5 - _stars);
        const volStr = vol > 0 ? `${Math.round(vol/100)/10}t` : null;
        const e1Str  = maxE1rm > 0 ? `${maxE1rm}kg e1RM` : null;
        const parts  = [sessName, volStr, e1Str, `RPE ${_rpe}`, stars].filter(Boolean);
        const msgBody = parts.join(' · ') + (note ? `\n${note}` : '');

        if (window.mySupabase) {
            const msgRow = { athlete_id: athId, from_type: 'athlete', content: msgBody };
            window.mySupabase.from('messages').insert([msgRow]).select().single()
                .then(({ data, error }) => {
                    if (!error && data) {
                        if (!DB.messages) DB.messages = {};
                        if (!DB.messages[athId]) DB.messages[athId] = [];
                        DB.messages[athId].push({ ...msgRow, id: data.id, created_at: data.created_at });
                        window.updateMsgBadge?.();
                    }
                });
        }

        toast('Inviato al coach!');
        _closeSheet();
        window.go?.('ath-home');
    }

    document.getElementById('ew-send').addEventListener('click', _saveAndSend);
    document.getElementById('ew-skip').addEventListener('click', () => {
        // Salva senza RPE, torna alla home
        const today = new Date().toISOString().slice(0, 10);
        const athId = appState.selAthId || window.mioIdLoggato;
        const ex = DB.sessions.find(s => s.athlete === athId && s.session === sessName && s.date === today);
        if (!ex) DB.sessions.push({
            id: 'live_end_' + uid(), athlete: athId, date: today, session: sessName,
            week: weekVal, phase: DB.schedules[athId]?.phase || 'Accumulo',
            readiness: parseInt(document.getElementById('ring-n')?.textContent) || 80,
            vol, maxE1rm, e1rmDom: window.liveE1rmDom||0, e1rmNDom: window.liveE1rmNDom||0,
            sRPE:0, rpe:0, qual:0, doms:'', flag: partial?'Parziale':'', notes:'', reply:''
        });
        window.saveDB();
        if (window.mySupabase) {
            const sk = DB.sessions.find(s => s.athlete === athId && s.session === sessName && s.date === today);
            if (sk) {
                sk._synced = false;
                updateCloudStatus('saving');
                const cloud = sessionCloudRow(sk);
                window.mySupabase.from('sessions').upsert([cloud])
                    .then(({ error }) => {
                        if (error) { console.error('[session upsert skip]', error); sk._synced = false; toast('Salvato in locale — sync cloud non riuscita.'); updateCloudStatus('error'); }
                        else { sk._synced = true; updateCloudStatus('cloud'); window.saveDB?.(); }
                    });
            }
        }
        window._updateFeedbackBadge?.(athId);
        _closeSheet();
        window.go?.('ath-home');
    });

    // Chiudi toccando lo sfondo
    document.getElementById('ew-sheet').addEventListener('click', (e) => {
        if (e.target.id === 'ew-sheet') _closeSheet();
    });
}


// ═════════════════════════════════════════════════════════════
// FOCUS MODE — allenamento "un esercizio alla volta"
// Pager full-screen che RIUSA le card già renderizzate da loadLive()
// (pallini, log reale, timer recupero, e1RM, tecniche… restano invariati).
// Il controller è una cornice sottile: pallini di progresso globali in alto,
// timer di durata totale, navigazione prev/next. Nessuna duplicazione di logica.
// ═════════════════════════════════════════════════════════════

const LK_FOCUS_TS = 'coachOS_focus_start';   // timestamp inizio allenamento (anti-crash iOS)
let   _focusTimerInt = null;

/** Elenco ordinato delle card-pagina attualmente nel pager. */
function _focusCards() {
    // Una "pagina" del pager = una card autonoma OPPURE un wrapper di gruppo superset
    // (che impila più esercizi in un'unica schermata-giro).
    const stage = document.getElementById('lv-exs');
    return stage ? Array.from(stage.querySelectorAll(':scope > .lv-card, :scope > .ax-group')) : [];
}

/** Indice della card attualmente visibile (snap orizzontale). */
function _focusCurIdx() {
    const stage = document.getElementById('lv-exs');
    if (!stage) return 0;
    const w = stage.clientWidth || 1;
    return Math.max(0, Math.round(stage.scrollLeft / w));
}

/** Una card è "completata" se ha set di lavoro e sono tutti .done (i warm-up 'W' non contano). */
function _focusCardDone(card) {
    const work = card.querySelectorAll('.dot:not(.warm)');
    return work.length > 0 && Array.from(work).every(d => d.classList.contains('done'));
}

const _focusFmt = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return h > 0
        ? `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
        : `${m}:${String(ss).padStart(2,'0')}`;
};

function _focusTick() {
    const ts = parseInt(localStorage.getItem(LK_FOCUS_TS));
    const el = document.getElementById('focus-timer');
    if (el && ts) el.textContent = _focusFmt(Date.now() - ts);
}

function _focusTimerStart() {
    let ts = parseInt(localStorage.getItem(LK_FOCUS_TS));
    if (!ts) { ts = Date.now(); localStorage.setItem(LK_FOCUS_TS, String(ts)); }
    _focusTick();
    if (_focusTimerInt) clearInterval(_focusTimerInt);
    _focusTimerInt = setInterval(_focusTick, 1000);
}

/** Ferma il tick. clear=true azzera anche il timestamp (fine allenamento). */
function _focusTimerStop(clear) {
    if (_focusTimerInt) { clearInterval(_focusTimerInt); _focusTimerInt = null; }
    _focusTick();                                   // congela l'ultimo valore
    if (clear) localStorage.removeItem(LK_FOCUS_TS);
}

/** Durata allenamento in minuti (per prefill del Post-Workout log). */
function _focusElapsedMin() {
    const ts = parseInt(localStorage.getItem(LK_FOCUS_TS));
    return ts ? Math.max(1, Math.round((Date.now() - ts) / 60000)) : 0;
}

/** Ridisegna pallini progresso + sottotitolo + label del bottone primario. */
export function updateFocusChrome() {
    const ovl = document.getElementById('focus-ovl');
    if (!ovl || !ovl.classList.contains('on')) return;

    const cards = _focusCards();
    const cur   = _focusCurIdx();

    const dotsWrap = document.getElementById('focus-dots');
    if (dotsWrap) {
        dotsWrap.innerHTML = cards.map((c, idx) =>
            `<span class="fdot${_focusCardDone(c) ? ' done' : ''}${idx === cur ? ' cur' : ''}"
                   onclick="focusGoTo(${idx})"></span>`
        ).join('');
    }

    const card = cards[cur];
    const sub  = document.getElementById('focus-sub');
    if (sub) sub.textContent = card
        ? `${card.dataset.phase || ''}  ·  Esercizio ${cur + 1}/${cards.length}`
        : '';

    const prim = document.getElementById('focus-primary');
    if (prim) {
        const isLast = cur >= cards.length - 1;
        prim.innerHTML = isLast
            ? '<span>✓</span> Fine Allenamento'
            : '<svg class="fnav-arw" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h16"/><path d="M13 5l7 7-7 7"/></svg>';
        prim.classList.toggle('is-final', isLast);   // ultimo = bottone testo più largo
    }
}

/** Scorre il pager alla card idx. */
export function focusGoTo(idx) {
    const stage = document.getElementById('lv-exs');
    const cards = _focusCards();
    if (!stage || !cards.length) return;
    idx = Math.max(0, Math.min(idx, cards.length - 1));
    stage.scrollTo({ left: idx * stage.clientWidth, behavior: 'smooth' });
    // aggiornamento ottimistico (lo scroll-listener riconferma a fine snap)
    setTimeout(updateFocusChrome, 60);
}

/** Avanti → ; sull'ultima card = Fine Allenamento. */
export function focusNext() {
    const cards = _focusCards();
    const cur   = _focusCurIdx();
    if (cur >= cards.length - 1) { exitFocus(); endWorkout(); }
    else focusGoTo(cur + 1);
}

/** Indietro ← ; sulla prima card = torna all'anteprima. */
export function focusBack() {
    const cur = _focusCurIdx();
    if (cur <= 0) exitFocus();
    else focusGoTo(cur - 1);
}

/**
 * Segnale "VIA" di fine countdown: beep secco (880Hz, ~180ms) + vibrazione corta.
 * Più leggero del triplo pattern di playTimerEndSound(): è un "la" di partenza, non un allarme.
 */
function _focusGoSound() {
    if ('vibrate' in navigator) navigator.vibrate(90);
    try {
        const ctx  = sharedAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.9, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.18);
    } catch (e) { /* audio non supportato: il countdown resta comunque visivo */ }
}

/**
 * Countdown d'avvio 3→2→1→VIA sul layer #focus-countdown, poi onDone().
 * Tap sul layer = salta ed esegue onDone() subito. Idempotente (doppi avvii ignorati).
 */
let _focusCdRunning = false;
function _focusCountdown(onDone) {
    const layer = document.getElementById('focus-countdown');
    const num   = document.getElementById('focus-cd-num');
    if (!layer || !num) { onDone && onDone(); return; }
    if (_focusCdRunning) return;
    _focusCdRunning = true;

    const steps = ['3', '2', '1', 'VIA'];
    let i = 0;
    let tid = null;

    const paint = () => {
        const v = steps[i];
        num.textContent = v;
        num.classList.toggle('go', v === 'VIA');
        // ri-triggera l'animazione pop ad ogni cambio
        num.style.animation = 'none';
        void num.offsetWidth;
        num.style.animation = '';
        if (v === 'VIA') _focusGoSound();
    };

    const finish = () => {
        if (!_focusCdRunning) return;
        _focusCdRunning = false;
        if (tid) clearTimeout(tid);
        layer.removeEventListener('pointerdown', skip);
        layer.setAttribute('aria-hidden', 'true');
        layer.hidden = true;
        onDone && onDone();
    };

    const skip = () => finish();

    const tick = () => {
        paint();
        if (i >= steps.length - 1) {           // mostrato "VIA"
            tid = setTimeout(finish, 480);
            return;
        }
        i++;
        tid = setTimeout(tick, 820);
    };

    layer.hidden = false;
    layer.setAttribute('aria-hidden', 'false');
    layer.addEventListener('pointerdown', skip, { once: true });
    tick();
}

/** Entra in Focus Mode: sposta #lv-exs nell'overlay, avvia timer, va alla prima card incompleta. */
export function startFocus() {
    const stage = document.getElementById('lv-exs');
    if (!stage) return;
    const cards = _focusCards();
    if (!cards.length) { toast('Nessun esercizio da allenare.'); return; }

    const ovl  = document.getElementById('focus-ovl');
    const host = document.getElementById('focus-stage');
    if (!ovl || !host) return;

    // Tap su "Inizia allenamento" = user gesture → sblocca l'audio (beep recupero su iOS).
    try { unlockAudio(); } catch (e) {}

    // Ricorda la posizione originale per il ripristino all'uscita
    if (!stage._focusHome) stage._focusHome = { parent: stage.parentNode, next: stage.nextSibling };
    host.appendChild(stage);

    ovl.classList.add('on');
    ovl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('focus-lock');

    // Scroll-listener (una volta) → riallinea la cornice a fine snap
    if (!stage._focusScrollBound) {
        stage.addEventListener('scroll', () => {
            if (stage._focusRaf) return;
            stage._focusRaf = requestAnimationFrame(() => { stage._focusRaf = null; updateFocusChrome(); });
        }, { passive: true });
        stage._focusScrollBound = true;
    }

    // Parti dalla prima card non ancora completata
    const list = _focusCards();
    let firstInc = 0;
    while (firstInc < list.length && _focusCardDone(list[firstInc])) firstInc++;
    if (firstInc >= list.length) firstInc = 0;

    requestAnimationFrame(() => {
        stage.scrollTo({ left: firstInc * stage.clientWidth });
        updateFocusChrome();
    });

    // Countdown d'avvio solo alla partenza VERA = nessuna serie di lavoro ancora completata
    // nell'intera sessione. Segnale robusto (NON si basa su coachOS_focus_start, che si azzera
    // solo con "Fine Allenamento" e resterebbe stantio dopo sessioni abbandonate → niente countdown).
    // Al rientro a metà allenamento (almeno un set fatto): nessun countdown, timer prosegue.
    const anyDone = list.some(c => c.querySelector('.dot.done:not(.warm)'));
    if (!anyDone) {
        // Fresh: azzera l'eventuale timestamp stantio così il timer totale riparte dal VIA
        // (sistema anche il "timer che riparte da ore prima" dopo una sessione non chiusa).
        localStorage.removeItem(LK_FOCUS_TS);
        _focusCountdown(() => _focusTimerStart());
    } else {
        _focusTimerStart();
    }
}

/** Esce da Focus Mode e ripristina #lv-exs nell'anteprima. Il timer resta attivo (ri-entry continua). */
export function exitFocus() {
    const ovl   = document.getElementById('focus-ovl');
    const stage = document.getElementById('lv-exs');
    if (ovl) { ovl.classList.remove('on'); ovl.setAttribute('aria-hidden', 'true'); }
    document.body.classList.remove('focus-lock');
    if (stage && stage._focusHome) {
        const { parent, next } = stage._focusHome;
        if (next && next.parentNode === parent) parent.insertBefore(stage, next);
        else parent.appendChild(stage);
    }
}
