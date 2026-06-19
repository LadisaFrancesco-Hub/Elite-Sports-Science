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
import { uid, escHtml, toast, openMo, closeMo, athName, athById, updateCloudStatus } from './utils.js';


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

    // ── Rigenerazione dinamica del menu sessioni ─────────────
    // Mostra SOLO le sessioni del mesociclo attivo (sch.sessions
    // corrisponde sempre allo stato corrente di DB.schedules).
    sch.sessions.forEach(s => {
        select.innerHTML += `<option value="${escHtml(s.id)}">${escHtml(s.name)}</option>`;
    });

    if (ultimaSessioneSelezionata && [...select.options].some(o => o.value === ultimaSessioneSelezionata)) {
        select.value = ultimaSessioneSelezionata;
    } else if (sch.sessions.length > 0) {
        select.value = sch.sessions[0].id;
    }

    let sessId = select.value;
    if (!sessId && sch.sessions.length > 0) { sessId = sch.sessions[0].id; select.value = sessId; }

    const curSess     = sch.sessions.find(x => x.id === sessId) || sch.sessions[0];
    const sessionName = curSess ? curSess.name : '';
    const exs         = curSess ? curSess.exercises : [];

    // ── Auto-selezione intelligente della settimana ──────────
    if (selectWeek) {
        const weeksCount       = sch.duration || 4;
        const isSessionChanged = (select.dataset.lastSess !== sessId);
        select.dataset.lastSess = sessId;

        let targetWeekToSet = selectWeek.value || '1';

        if (isSessionChanged) {
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

    // ── Inizializzazione stato pallini ───────────────────────
    liveState = {};
    exs.forEach((_, i) => { liveState[i] = { wDone: new Set(), lDone: new Set() }; });

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
            const fc = mods.warningType === 'critical' ? '#ef4444' : '#fbbf24';
            sessionBanner = `<div style="background:${bc};border:1px solid ${fc};color:${fc};
                padding:12px 14px;border-radius:10px;margin-bottom:12px;font-size:11px;font-weight:800;
                letter-spacing:0.3px;">🤖 AUTOREGOLAZIONE ATTIVA
                <div style="font-weight:500;margin-top:6px;line-height:1.8;font-size:11px;">
                    ${mods.messages.join('<br>')}
                </div></div>`;
        }
        wrap.innerHTML = sessionBanner + `<div style="font-size:11px; color:var(--muted); text-align:center; margin-bottom:15px;
                               background:var(--s2); padding:8px; border-radius:8px; border:1px solid var(--border);">
            💡 <strong style="color:var(--teal)">Tip:</strong>
            Fai <strong>Tap</strong> sul pallino per completare, oppure
            <strong>Tieni premuto</strong> per modificare Rep/Kg reali.
          </div>`;
    }

    const currentWeek = document.getElementById('lv-week').value || '1';

    // ── Mappa colori per tipo di esercizio ───────────────────
    const typeColors = {
        'normal':         'var(--teal)',
        'max effort':     'var(--coral)',
        'dynamic effort': 'var(--blue)',
        'repetition':     'var(--teal)',
        'superset':       'var(--purple)',
        'tempo':          '#fbbf24',
        'amrap':          'var(--blue)',
        'hiit':           '#fbbf24',
        'jump set':       '#ff7a55'
    };

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
        { id: 'warmup',   label: '🔥 FASE 1: WARM-UP & ATTIVAZIONE',         color: '#A78BFA' },
        { id: 'centrale', label: '🏋️‍♂️ FASE 2: PARTE CENTRALE / PERFORMANCE', color: '#10B981' },
        { id: 'cooldown', label: '🧊 FASE 3: COOL-DOWN & RECUPERO',            color: '#3B82F6' }
    ];

    fasiAtleta.forEach(fase => {
        // Filtra gli esercizi di questa fase, mantenendo l'indice originale
        const itemsFase = exs
            .map((ex, originalIndex) => ({ ex, originalIndex }))
            .filter(item => (item.ex.section || 'centrale') === fase.id);

        if (itemsFase.length === 0) return;

        // Intestazione di fase
        const headerDiv = document.createElement('div');
        headerDiv.style.cssText = `width:100%; padding:8px 0; margin:15px 0 10px 0;
            border-bottom:1px solid rgba(255,255,255,0.05);
            color:${fase.color}; font-size:11px; font-weight:800;
            letter-spacing:0.5px; text-transform:uppercase;`;
        headerDiv.textContent = fase.label;
        if (wrap) wrap.appendChild(headerDiv);

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
                if (wrap) wrap.appendChild(circDiv);
                return;
            }

            // Progressione settimanale
            let targetSet = ex.set;
            let targetRep = ex.rep;
            let targetKg  = ex.kg;
            if (ex.progression && ex.progression[`w${currentWeek}`]) {
                const pW  = ex.progression[`w${currentWeek}`];
                targetSet = pW.set;
                targetRep = pW.rep;
                targetKg  = pW.kg;
            }

            // ── Tipo esercizio e colore bordo ─────────────────
            const currentType = (ex.type || 'normal').toLowerCase();
            const borderColor = typeColors[currentType] || 'var(--teal)';

            // ── Autoregolazione (Readiness + CNS + Ciclo) ─────
            let numKg       = parseFloat(targetKg) || 0;
            const isVBT     = (typeof targetKg === 'string' && targetKg.toLowerCase().includes('m/s'))
                               || (numKg > 0 && numKg <= 2.5);
            const isHighCns = ['max effort', 'dynamic effort'].includes(currentType);

            let actualKg     = numKg;
            let actualSet    = targetSet;
            let autoRegBadge = '';

            if (!isVBT && numKg > 0 && mods.kgMultiplier < 1.0) {
                actualKg = Math.round((numKg * mods.kgMultiplier) / 2.5) * 2.5;
                const pct = Math.round((1 - mods.kgMultiplier) * 100);
                const fc  = mods.warningType === 'critical' ? '#ef4444' : '#fbbf24';
                const bg  = mods.warningType === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)';
                autoRegBadge = `<div style="background:${bg};color:${fc};border:1px solid ${fc};font-size:10px;padding:4px 8px;border-radius:6px;margin-top:8px;font-weight:700;display:inline-block;">🤖 Carico autoregolato: <span style="text-decoration:line-through;opacity:0.6;">${numKg}kg</span> → <strong>${actualKg}kg</strong> (-${pct}%)</div>`;
            }

            if (isHighCns && mods.setModifier < 0 && targetSet > 1) {
                actualSet = Math.max(1, targetSet + mods.setModifier);
                autoRegBadge += `<div style="background:rgba(245,158,11,0.1);color:#fbbf24;border:1px solid #fbbf24;font-size:10px;padding:4px 8px;border-radius:6px;margin-top:4px;font-weight:700;display:inline-block;">🧠 SNC: set ridotti ${targetSet} → <strong>${actualSet}</strong></div>`;
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
            let cardMargin    = '12px';
            let cardBorderTop = '1px solid #1A2235';
            let linkBadge     = '';

            const groupLabel = `${currentType.toUpperCase()}${_liveGLetter(ex.groupId)}`;

            if (linkedToNext && !linkedToPrev) {
                cardRadius = '12px 12px 0 0'; cardMargin = '0';
                linkBadge  = `<div style="position:absolute; bottom:-10px; left:16px; background:${borderColor};
                    color:#fff; font-size:9px; font-weight:800; padding:2px 8px; border-radius:10px;
                    z-index:10; letter-spacing:0.5px; text-transform:uppercase; box-shadow:0 2px 4px rgba(0,0,0,0.5);">
                    🔗 ${groupLabel}</div>`;
            } else if (linkedToPrev && linkedToNext) {
                cardRadius = '0'; cardMargin = '0'; cardBorderTop = '1px dashed rgba(255,255,255,0.1)';
                linkBadge  = `<div style="position:absolute; bottom:-10px; left:16px; background:${borderColor};
                    color:#fff; font-size:9px; font-weight:800; padding:2px 8px; border-radius:10px;
                    z-index:10; letter-spacing:0.5px; text-transform:uppercase; box-shadow:0 2px 4px rgba(0,0,0,0.5);">
                    🔗 ${groupLabel}</div>`;
            } else if (linkedToPrev && !linkedToNext) {
                cardRadius = '0 0 12px 12px'; cardMargin = '12px'; cardBorderTop = '1px dashed rgba(255,255,255,0.1)';
            }

            // ── Generazione pallini ───────────────────────────
            let dots = '';
            for (let w = 0; w < ex.wset; w++) {
                dots += `<div class="dot warm" id="wd-${i}-${w}">W</div>`;
            }
            for (let l = 0; l < actualSet; l++) {
                const logKey = `${sessId}-w${currentWeek}-${i}-${l}`;
                let label  = l + 1;
                let isMod  = 'class="dot"';
                if (window.realLog && window.realLog[logKey]) {
                    label = window.realLog[logKey].rep;
                    isMod = `class="dot done" style="background:var(--purple); border-color:var(--purple); color:#fff;"`;
                }
                dots += `<div ${isMod} id="ld-${i}-${l}">${label}</div>`;
            }

            // ── Label braccio dominante ───────────────────────
            const armLabel = (ex.arm && ex.arm !== 'Bi')
                ? `<span style="color:var(--blue);font-weight:800">[${ex.arm}]</span> `
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
                ? `<a href="${ex.ytUrl}" target="_blank" style="display:inline-flex; align-items:center;
                    background-color:#1e3a5f; border:none; border-radius:6px; padding:4px 8px;
                    text-decoration:none; flex-shrink:0;">
                    <span style="color:#3B82F6; font-size:11px; font-weight:700;">▶ Video</span></a>`
                : '';

            // ── Composizione display carico (usa actualKg post-autoregolazione) ─
            let renderTargetLoad = isVBT
                ? (String(targetKg).includes('m/s') ? targetKg : targetKg + ' m/s')
                : actualKg + 'kg';

            // ── Ramping warm-up automatico ────────────────────
            let rampingHtml = '';
            if (ex.wset > 0 && actualKg > 0 && !isVBT) {
                let warmUps = [];
                for (let w = 1; w <= ex.wset; w++) {
                    let perc = ex.wset === 1 ? 0.75
                             : ex.wset === 2 ? (w === 1 ? 0.60 : 0.85)
                             : (w === 1 ? 0.50 : w === 2 ? 0.70 : 0.85);
                    let wKg = Math.round((actualKg * perc) / 2.5) * 2.5;
                    warmUps.push(wKg + 'kg');
                }
                rampingHtml = `<div style="width:100%; font-size:11px; color:var(--muted); margin-top:12px;
                    font-weight:500; background:rgba(255,255,255,0.02); padding:8px 12px; border-radius:8px;
                    border:1px dashed rgba(255,255,255,0.05); letter-spacing:0.3px;">
                    🔥 Ramping: <span style="color:var(--teal); font-weight:700;">
                    ${warmUps.join(' <span style="color:#4B5563; font-weight:400; margin:0 4px;">➔</span> ')}
                    </span></div>`;
            }

            // ── Badge RIR e TUT ───────────────────────────────
            let rirLabel = (ex.rir && ex.rir !== '—' && ex.rir !== '')
                ? `<span style="color:#6B7280; margin:0 4px;">•</span>
                   <span style="color:#A78BFA; font-weight:800;">RIR ${ex.rir}</span>`
                : '';
            let tutLabel = (ex.tut && ex.tut !== '-' && ex.tut !== '')
                ? `<span style="color:#6B7280; margin:0 4px;">•</span>
                   <span style="color:#F59E0B; font-weight:800;">TUT ${ex.tut}</span>`
                : '';

            // ── Timer REST o etichetta NO REST ────────────────
            let restTimerHtml = '';
            if (!linkedToNext) {
                restTimerHtml = `
                <div class="timer-container" id="timer-container-${i}"
                     style="display:flex; align-items:center; gap:8px; background-color:#161E2E;
                            border:1px solid #1A2235; border-radius:8px; padding:4px 10px; margin-top:0;">
                  <span style="font-size:10px; color:#10B981; font-weight:800; margin-right:4px;">REST</span>
                  <span class="timer-display" id="timer-display-${i}"
                        style="color:#E2DDD4; font-size:12px; font-weight:600; font-variant-numeric:tabular-nums;">
                    ${formatTime(totalSeconds)}
                  </span>
                  <button class="timer-btn" id="timer-btn-${i}"
                          onClick="startTimer(${i}, ${totalSeconds})"
                          style="background-color:#00E5A8; color:#090D13; border:none; border-radius:6px;
                                 padding:4px 10px; font-size:11px; font-weight:700; cursor:pointer;">
                    START
                  </button>
                </div>`;
            } else {
                restTimerHtml = `
                <div style="display:flex; align-items:center; gap:6px;
                            background-color:rgba(139,92,246,0.15);
                            border:1px solid rgba(139,92,246,0.4);
                            border-radius:8px; padding:4px 10px; margin-top:0;">
                  <span style="font-size:10px; color:#A78BFA; font-weight:800; letter-spacing:0.5px;">
                    ⏭ NO REST (VAI AL PROSSIMO)
                  </span>
                </div>`;
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
                    injBadgeHtml = `<div style="background:rgba(239,68,68,0.15);border:1px solid #ef4444;
                        color:#f87171;padding:8px 12px;border-radius:8px;margin-top:8px;
                        font-size:12px;font-weight:700;letter-spacing:0.2px;">
                        ⚠️ ATTENZIONE: Zona infortunata (VAS ${activeInj.vas}) — Tessuto: ${escHtml(activeInj.tissue || activeInj.type)}. Modula il carico.
                    </div>`;
                }
            }

            // ── Assemblaggio card esercizio ───────────────────
            const div = document.createElement('div');
            div.style.cssText = 'width:100%; position:relative;';
            div.innerHTML = `
              <div style="position:relative; background-color:#0F1520; border:1px solid #1A2235;
                          border-top:${cardBorderTop}; border-left:4px solid ${borderColor} !important;
                          border-radius:${cardRadius}; padding:16px; margin-bottom:${cardMargin};
                          width:100%; box-shadow:0 4px 12px rgba(0,0,0,0.15);">
                ${linkBadge}

                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                  <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span style="font-weight:700; font-size:16px; color:#E2DDD4; flex:1 1 auto;
                                 word-wrap:break-word; min-width:0; padding-right:8px;">${escHtml(ex.name)}</span>
                    ${videoBadge}
                  </div>
                  <span style="position:absolute; top:16px; right:16px; color:#00E5A8;
                               font-weight:700; font-size:15px;" id="lvol-${i}">0 kg</span>
                </div>

                <p style="color:#9CA3AF; font-size:13px; font-weight:500; margin:0; letter-spacing:0.3px;">
                  ${armLabel}${actualSet}x${targetRep}
                  <span style="color:#6B7280; margin:0 4px;">•</span>
                  <span style="color:${autoRegBadge ? 'var(--amber)' : '#E2DDD4'}; font-weight:700;">
                    ${renderTargetLoad}
                  </span>
                  ${rirLabel}${tutLabel}
                </p>
                ${autoRegBadge}
                ${injBadgeHtml}

                <div style="margin-bottom:16px;"></div>

                <div style="display:flex; justify-content:space-between; align-items:center;
                            gap:12px; margin-bottom:16px; flex-wrap:wrap;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span style="color:#FFB800; font-size:12px; font-weight:500; white-space:nowrap;">
                      Prossimo Carico:
                    </span>
                    <input type="text" id="next-load-${i}"
                           value="${escHtml(valoreNotaPrecedente)}"
                           oninput="window.carichiFuturi['${notaChiave}'] = this.value"
                           onchange="saveLiveNextLoad(${i}, this.value)"
                           style="background-color:#1E2840; border:1px solid #1A2235; border-radius:6px;
                                  padding:4px 8px; width:110px; color:#E2DDD4; font-size:12px; outline:none;"
                           placeholder="Es: +2.5kg o 65k">
                  </div>
                  <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
                    ${restTimerHtml}
                  </div>
                </div>

                ${ex.note
                    ? `<div style="margin-bottom:16px;">
                         <p style="color:#A78BFA; font-size:12px; font-weight:600; margin:0 0 4px 0;">CUE Tecnici:</p>
                         <div style="color:#A78BFA; font-size:11px; padding-left:4px; line-height:1.4;">${escHtml(ex.note)}</div>
                       </div>`
                    : ''}

                <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:8px; width:100%;">${dots}</div>
                ${rampingHtml}
              </div>`;

            if (wrap) wrap.appendChild(div);
        });
    });

    // ── Crash recovery: ripristina i pallini dal localStorage ──
    try {
        const cachePallini = JSON.parse(localStorage.getItem('coachOS_live_dots'));
        if (cachePallini && Array.isArray(cachePallini)) {
            cachePallini.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('done');
            });
            setTimeout(() => updateLiveTotals(window.getEdExercises()), 100);
        }
    } catch (e) { /* Silenzioso: primo avvio senza cache */ }

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
                    btn.style.color        = '#000';
                    btn.style.borderColor  = 'var(--teal)';
                }
                btn.addEventListener('click', function () {
                    filterDiv.querySelectorAll('button').forEach(b => {
                        b.style.background  = 'var(--s2)';
                        b.style.color       = 'var(--muted)';
                        b.style.borderColor = 'var(--border)';
                    });
                    this.style.background  = 'var(--teal)';
                    this.style.color       = '#000';
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
                let sRep = parseInt(targetRep)   || 0;
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
            }
        }

        if (count < maxSet) tuttiiSetCompletati = false;

        vol  += exVol;
        sets += count;

        const lvolEl = document.getElementById('lvol-' + i);
        if (lvolEl) lvolEl.textContent = Math.round(exVol) + ' kg';
    });

    // ── Auto-save anti-crash iOS ─────────────────────────────
    let palliniSalvati = [];
    document.querySelectorAll('.dot.done').forEach(d => palliniSalvati.push(d.id));
    localStorage.setItem('coachOS_live_dots', JSON.stringify(palliniSalvati));
    localStorage.setItem('coachOS_real_log',  JSON.stringify(window.realLog || {}));

    // ── Aggiornamento KPI nella UI ───────────────────────────
    document.getElementById('lv-vol').textContent  = Math.round(vol).toLocaleString('it-IT') + ' kg';
    document.getElementById('lv-e1rm').textContent = Math.round(maxE1rm) + ' kg';
    if (document.getElementById('lv-edom'))  document.getElementById('lv-edom').textContent  = Math.round(e1rmDom)  + ' kg';
    if (document.getElementById('lv-endom')) document.getElementById('lv-endom').textContent = Math.round(e1rmNDom) + ' kg';

    // Esposizione globale per analytics e wellness
    window.liveE1rmDom  = Math.round(e1rmDom);
    window.liveE1rmNDom = Math.round(e1rmNDom);
    window.liveMaxE1rm  = Math.round(maxE1rm);

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
                sRPE:             0,
                rpe:              8,
                qual:             4,
                doms:             '',
                flag:             'In Corso',
                notes:            'Aggiornamento istantaneo automatico',
                reply:            ''
            });
        }

        window.saveDB();
        if (typeof renderAnalytics  === 'function') window.renderAnalytics();
        if (typeof renderDashboard  === 'function') window.renderDashboard();

        // Proposta redirect Post-Workout (con leggero delay per iOS)
        setTimeout(function () {
            if (confirm('🎯 Sessione completata! Ottimo lavoro. Ti va di compilare il feedback Post-Workout ora?')) {
                window.go('feedback');
                const pwType = document.getElementById('pw-type');
                const lvSess = document.getElementById('lv-sess');
                if (pwType && lvSess && lvSess.options.length > 0 && lvSess.selectedIndex >= 0) {
                    const sessText = lvSess.options[lvSess.selectedIndex].text;
                    pwType.value   = sessText.includes('Campo') ? 'Campo' : 'Palestra';
                }
            }
        }, 800);
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
                toggleDot(dot);
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

        // Cancella il log reale per questo set
        if (dot.id.startsWith('ld-')) {
            const parts       = dot.id.split('-');
            dot.textContent   = parseInt(parts[2]) + 1; // Ripristina il numero originale

            const activeSessId  = document.getElementById('lv-sess').value;
            const currentWeek   = document.getElementById('lv-week').value || '1';
            const logKey        = `${activeSessId}-w${currentWeek}-${parts[1]}-${parts[2]}`;
            if (window.realLog && window.realLog[logKey]) delete window.realLog[logKey];
        }
    } else {
        // Completato: haptic feedback
        if (navigator.vibrate) navigator.vibrate(40);
    }

    // Micro-delay necessario per far aggiornare la UI grafica prima del calcolo su iOS
    setTimeout(() => updateLiveTotals(window.getEdExercises()), 10);
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
    document.getElementById('rl-target').textContent  = `Target Originale: ${targetRep} rep @ ${targetKg} ${String(targetKg).includes('m/s') ? '' : 'kg'}`;

    const logKey   = `${activeSessId}-w${w}-${exIndex}-${setIndex}`;
    let actualRep  = parseInt(targetRep)  || 0;
    let actualKg   = parseFloat(targetKg) || 0;

    // Pre-compila con i valori già inseriti dall'atleta (se presenti)
    if (window.realLog && window.realLog[logKey]) {
        actualRep = window.realLog[logKey].rep;
        actualKg  = window.realLog[logKey].kg;
    }

    document.getElementById('rl-rep').value   = actualRep;
    document.getElementById('rl-kg').value    = actualKg;
    document.getElementById('rl-ex-i').value  = exIndex;
    document.getElementById('rl-set-l').value = setIndex;

    openMo('mo-reallog');
    if (navigator.vibrate) navigator.vibrate(20);
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

    // Aggiorna visivamente il pallino → Viola Elite con numero reps
    const dot = document.getElementById(`ld-${exI}-${setL}`);
    if (dot) {
        dot.classList.add('done');
        dot.style.background  = 'var(--purple)';
        dot.style.borderColor = 'var(--purple)';
        dot.style.color       = '#fff';
        dot.textContent       = rep;
    }

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

    // Sincronizzazione cloud (fire-and-forget) — aggiorna SOLO exercises.
    // Un upsert completo riscriveva anche il campo meso con il valore
    // presente in memoria, che poteva essere errato se loadDB aveva caricato
    // un meso stantio. Aggiornare solo exercises spezza il loop di corruzione.
    if (window.mySupabase) {
        window.mySupabase
            .from('schedules')
            .update({ exercises: curSess.exercises })
            .eq('id', curSess.id);
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
        document.getElementById(`timer-btn-${exerciseId}`).textContent     = 'START';
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
            btn.textContent     = 'START';
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
 * Costruisce il div completo del blocco circuito per la sessione live.
 */
export function _buildCircuitCard(ex, i) {
    const meta    = ex.circuitMeta    || { workTime: 40, restBetweenEx: 20, restBetweenRounds: 120, rounds: 3 };
    const circExs = ex.circuitExercises || [];

    const exListHtml = circExs.map((ce, idx) => {
        // Controllo se esiste il link video e genero il badge
        const videoBadge = (ce.video && ce.video.trim() !== '') 
            ? `<a href="${ce.video}" target="_blank" style="display:inline-flex; align-items:center; background-color:#1e3a5f; border-radius:5px; padding:3px 6px; text-decoration:none; flex-shrink:0; margin-left:4px;">
                 <span style="color:#3B82F6; font-size:10px; font-weight:700;">▶ Video</span>
               </a>` 
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

    // Nuova esecuzione
    window.circuitStates[circuitIdx] = {
        running: true,
        phase:   'work',
        round:   1,
        exIdx:   0,
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

/**
 * _resetCircuitUI(circuitIdx, ex)
 * Riporta la card del circuito allo stato idle.
 */
export function _resetCircuitUI(circuitIdx, ex) {
    const meta    = ex.circuitMeta    || {};
    const circExs = ex.circuitExercises || [];

    const box     = document.getElementById(`circ-timer-box-${circuitIdx}`);
    const phaseEl = document.getElementById(`circ-phase-${circuitIdx}`);
    const dispEl  = document.getElementById(`circ-display-${circuitIdx}`);
    const exNameEl= document.getElementById(`circ-exname-${circuitIdx}`);
    const progEl  = document.getElementById(`circ-progress-${circuitIdx}`);
    const btn     = document.getElementById(`circ-btn-${circuitIdx}`);

    if (box)     box.classList.remove('circuit-running');
    if (phaseEl) { phaseEl.textContent = 'Pronto'; phaseEl.style.color = 'var(--amber)'; }
    if (dispEl)  { dispEl.textContent = formatTime(meta.workTime || 40); dispEl.style.color = 'var(--text)'; }
    if (exNameEl)exNameEl.textContent = circExs[0] ? circExs[0].name : '—';
    if (progEl)  progEl.textContent = `Giro 1/${meta.rounds || 3} · Esercizio 1/${circExs.length}`;
    if (btn)     { btn.textContent = '▶ START CIRCUITO'; btn.style.background = 'var(--amber)'; btn.style.color = '#000'; }

    circExs.forEach((_, idx) => {
        const el = document.getElementById(`circ-ex-item-${circuitIdx}-${idx}`);
        if (el) { el.style.color = 'var(--text)'; el.style.fontWeight = '600'; }
    });
}
