/* ══════════════════════════════════════════════════════════════
   ELITE SPORTS SCIENCE — wellness.js
   Responsabilità:
     1. Parametri soggettivi Hooper (setW, upW, mkPips)
     2. Motore fisiologico ciclo mestruale (date-based)
     3. Calcolo Readiness ibrido: Hooper Index + HRV baseline
     4. Penalità da infortuni, CNS e ore di sonno
     5. Sincronizzazione Cloud (saveWellnessCloud → Supabase)
     6. Body Map Infortuni con scala VAS
        (openInjuryMo, saveInjury, resolveInjury, renderInjuries)
     7. CNS Finger Tap Test neurologico
        (startCnsTest, registerCnsTap, endCnsTest, evaluateCnsTest)
     8. Sblocco sessione (confermaWellnessLive)

   Dipendenze globali (definite in app.js / auth.js):
     DB, selAthId, uid(), saveDB(), athById(),
     toast(), updateCloudStatus(), renderDashboard(), go()
   ══════════════════════════════════════════════════════════════ */

'use strict';

// ─────────────────────────────────────────────────────────────
// 1. mkPips(id, val, color)
//    Aggiorna la barra di indicatori visivi (pip dots) sotto
//    ciascun parametro soggettivo del Wellness Check-in.
// ─────────────────────────────────────────────────────────────
function mkPips(id, val, color) {
    const wrap = document.getElementById('wp-' + id);
    if (!wrap) return;
    wrap.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        const p = document.createElement('div');
        p.className = 'pip';
        if (i < val) p.style.background = color;
        wrap.appendChild(p);
    }
}


// ─────────────────────────────────────────────────────────────
// 2. setW(metric, val, logicType)
//    Gestione haptic delle pill di input soggettivo.
//    Colora la pill in base alla logica semantica del parametro:
//      'good-high' → verde se alto (es. sonno, motivazione)
//      'good-low'  → verde se basso (es. stress, dolore)
//    Lancia vibrazione tattile e ricalcola upW().
// ─────────────────────────────────────────────────────────────
function setW(metric, val, logicType) {
    // 1. Aggiorna il valore nell'input nascosto
    document.getElementById('w-' + metric).value = val;

    // 2. Rimuove lo stato attivo da tutti i bottoni della riga
    document.querySelectorAll('#pg-' + metric + ' .w-pill').forEach(b => {
        b.classList.remove('active-t', 'active-a', 'active-c');
    });

    // 3. Logica colori semantici (Verde / Giallo / Rosso)
    let colorClass = 'active-a'; // Giallo neutro di default

    if (logicType === 'good-high') {
        // Parametri dove alto = positivo (sonno, motivazione)
        if (val >= 4) colorClass = 'active-t'; // Verde
        if (val <= 2) colorClass = 'active-c'; // Rosso
    } else if (logicType === 'good-low') {
        // Parametri dove basso = positivo (stress, soreness)
        if (val <= 2) colorClass = 'active-t'; // Verde
        if (val >= 4) colorClass = 'active-c'; // Rosso
    }

    // 4. Accende la pill selezionata con il colore corretto
    const btn = document.getElementById(`btn-${metric}-${val}`);
    if (btn) btn.classList.add(colorClass);

    // 5. Feedback tattile (solo mobile)
    if (navigator.vibrate) navigator.vibrate(40);

    // 6. Ricalcola Readiness e sincronizza sul Cloud
    upW();
}


// ─────────────────────────────────────────────────────────────
// 3. upW()
//    Motore principale Wellness / Readiness.
//    Esegue in sequenza:
//      a) Recupero antropometrico da storico
//      b) Calcolo fase del ciclo mestruale (date-based)
//      c) Aggiornamento descrizioni soggettive e pip dots
//      d) Hooper Index → score base
//      e) Fusione ibrida con HRV acuto/cronico (60/40)
//      f) Penalità: infortuni VAS, ciclo, CNS Tap, ore sonno
//      g) Aggiornamento ring SVG + etichette stato
//      h) Iniezione messaggio coach con contesto fisiologico
//      i) Persistenza in DB.wellness + saveWellnessCloud()
// ─────────────────────────────────────────────────────────────
function upW() {
    const ath = athById(selAthId);

    // ── a) Lettura parametri soggettivi Hooper ───────────────
    const sl = +document.getElementById('w-sleep').value;
    const st = +document.getElementById('w-stress').value;
    const so = +document.getElementById('w-sore').value;
    const mo = +document.getElementById('w-motiv').value;

    // ── Recupero automatico ultimo peso/BF dallo storico antropometrico ──
    const weightInput = document.getElementById('w-weight');
    const bfInput     = document.getElementById('w-bf');
    if (ath && ath.anthropoHistory && ath.anthropoHistory.length > 0) {
        const lastAntropo = ath.anthropoHistory[ath.anthropoHistory.length - 1];
        if (weightInput && !weightInput.value) weightInput.value = lastAntropo.weight || '';
        if (bfInput     && !bfInput.value)     bfInput.value     = lastAntropo.bf    || '';
    }

    // ── b) MOTORE FISIOLOGICO CICLO MESTRUALE (date-based) ───
    const cycleStartInput = document.getElementById('w-cycle-start');
    let cycleDay = 0;
    let cycle    = 'N/A';
    let cycleMsg = '';

    // Memoria automatica: sincronizza la data con il profilo atleta
    if (cycleStartInput) {
        if (cycleStartInput.value) {
            // L'atleta ha cambiato la data → salviamo nel profilo
            if (ath && ath.lastCycleStart !== cycleStartInput.value) {
                ath.lastCycleStart = cycleStartInput.value;
                saveDB();
            }
        } else if (ath && ath.lastCycleStart) {
            // Campo vuoto ma c'è una data in memoria → la ripristiniamo
            cycleStartInput.value = ath.lastCycleStart;
        }
    }

    // Calcolo matematico dei giorni dal primo giorno del ciclo
    if (cycleStartInput && cycleStartInput.value) {
        const startDate = new Date(cycleStartInput.value);
        const today     = new Date();
        startDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        const diffTime = today - startDate;
        if (diffTime >= 0) {
            cycleDay = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
        }
    }

    // Classificazione fisiologica della fase
    if (cycleDay > 0) {
        if      (cycleDay > 40)  { cycle = 'Ritardo/Irregolare'; cycleMsg = '🟣 Ciclo oltre i 40 giorni. Controlla il calendario.'; }
        else if (cycleDay <= 5)  { cycle = 'Mestruazioni';        cycleMsg = '🩸 Infiammazione sistemica. Modula il volume.'; }
        else if (cycleDay <= 13) { cycle = 'Fase Follicolare';    cycleMsg = '⚡ Picco estrogenico! Tolleranza al carico neurale ai massimi livelli.'; }
        else if (cycleDay <= 15) { cycle = 'Fase Ovulatoria';     cycleMsg = '⚠️ Picco Relaxina: WARM-UP articolare imperativo!'; }
        else                     { cycle = 'Fase Luteale';         cycleMsg = '🔥 Shift metabolico (Progesterone). Cura l\'idratazione.'; }
    }

    // Aggiorna il badge visivo del ciclo nel pannello Wellness
    const cycleBadge = document.getElementById('w-cycle-badge');
    if (cycleBadge) {
        cycleBadge.textContent = cycleDay > 0 ? `Giorno ${cycleDay}` : 'N/A';
        if      (cycle === 'Mestruazioni' || cycle === 'Fase Ovulatoria') cycleBadge.style.color = 'var(--coral)';
        else if (cycle === 'Fase Follicolare')                            cycleBadge.style.color = 'var(--teal)';
        else if (cycle === 'Fase Luteale')                                cycleBadge.style.color = 'var(--amber)';
        else                                                               cycleBadge.style.color = 'var(--muted)';
    }

    // ── c) Tabelle descrittive e pip dots ────────────────────
    const tSl = ['', 'Pessimo / Insonnia', 'Agitato', 'Nella media', 'Buono', 'Rigenerante'];
    const tSt = ['', 'Rilassato', 'Lieve', 'Moderato', 'Alto', 'Estremo'];
    const tSo = ['', 'Nessun dolore', 'Lieve fastidio', 'Gestibile', 'Acuti', 'Limitanti'];
    const tMo = ['', 'Assente', 'Bassa', 'Normale', 'Alta', 'Focus Totale'];
    const cG  = ['', 'var(--coral)', 'var(--amber)', 'var(--amber)', 'var(--teal)', 'var(--teal)'];  // good-high
    const cB  = ['', 'var(--teal)',  'var(--teal)',  'var(--amber)', 'var(--coral)', 'var(--coral)']; // good-low

    // Descrizioni testuali
    if (document.getElementById('wd-sl')) { document.getElementById('wd-sl').textContent = tSl[sl]; document.getElementById('wd-sl').style.color = cG[sl]; }
    if (document.getElementById('wd-st')) { document.getElementById('wd-st').textContent = tSt[st]; document.getElementById('wd-st').style.color = cB[st]; }
    if (document.getElementById('wd-so')) { document.getElementById('wd-so').textContent = tSo[so]; document.getElementById('wd-so').style.color = cB[so]; }
    if (document.getElementById('wd-mo')) { document.getElementById('wd-mo').textContent = tMo[mo]; document.getElementById('wd-mo').style.color = cG[mo]; }

    // Contatori numerici
    if (document.getElementById('wv-sl')) { document.getElementById('wv-sl').textContent = sl; document.getElementById('wv-sl').style.color = cG[sl]; }
    if (document.getElementById('wv-st')) { document.getElementById('wv-st').textContent = st; document.getElementById('wv-st').style.color = cB[st]; }
    if (document.getElementById('wv-so')) { document.getElementById('wv-so').textContent = so; document.getElementById('wv-so').style.color = cB[so]; }
    if (document.getElementById('wv-mo')) { document.getElementById('wv-mo').textContent = mo; document.getElementById('wv-mo').style.color = cG[mo]; }

    // Pip dots
    mkPips('sl', sl, cG[sl]);
    mkPips('st', st, cB[st]);
    mkPips('so', so, cB[so]);
    mkPips('mo', mo, cG[mo]);

    // ── d) HOOPER INDEX — Score base soggettivo ───────────────
    // Formula: (Sonno + Motivazione + (6-Stress) + (6-Soreness)) / 16 * 100
    let hooperScore = ((sl + mo + (6 - st) + (6 - so)) / 16) * 100;
    let score = Math.round(hooperScore);

    // ── e) FUSIONE IBRIDA CON HRV (Acuto/Cronico Rolling Baseline) ──
    //    60% dato oggettivo (sensore HRV) + 40% dato soggettivo (Hooper)
    const hrvInputEl = document.getElementById('w-hrv');
    const hrvRaw     = hrvInputEl ? hrvInputEl.value : null;

    if (hrvRaw && !isNaN(hrvRaw) && hrvRaw > 0) {
        const currentHRV = parseFloat(hrvRaw);
        const today      = new Date();
        const pastSess   = DB.sessions.filter(s => s.athlete === selAthId && s.hrv > 0);

        let chronicHRV = currentHRV; // Media ultimi 30 giorni
        let acuteHRV   = currentHRV; // Media ultimi  7 giorni

        if (pastSess.length > 0) {
            const msPerDay    = 1000 * 60 * 60 * 24;
            const chronicData = pastSess.filter(s => (today - new Date(s.date)) / msPerDay <= 30);
            const acuteData   = pastSess.filter(s => (today - new Date(s.date)) / msPerDay <= 7);

            if (chronicData.length > 0) {
                chronicHRV = chronicData.reduce((sum, s) => sum + s.hrv, 0) / chronicData.length;
            }
            if (acuteData.length > 0) {
                // Include il valore di oggi nella media acuta
                acuteHRV = (acuteData.reduce((sum, s) => sum + s.hrv, 0) + currentHRV) / (acuteData.length + 1);
            } else {
                acuteHRV = currentHRV;
            }
        }

        // Rapporto Acuto/Cronico normalizzato su 100
        let hrvScore = (acuteHRV / chronicHRV) * 100;
        if (hrvScore > 100) hrvScore = 100; // Cap per non sfalsare l'anello

        // Fusione pesata 60/40
        score = Math.round((hooperScore * 0.4) + (hrvScore * 0.6));
    }

    // ── f) PENALITÀ READINESS ─────────────────────────────────

    // f1. Penalità infortuni attivi (scala VAS)
    if (!DB.injuries) DB.injuries = [];
    const infortuniAttivi = DB.injuries.filter(x => x.athlete === selAthId && x.status === 'Attivo');
    let maxVas = 0;
    infortuniAttivi.forEach(i => { if (i.vas > maxVas) maxVas = i.vas; });

    if      (maxVas >= 8) score -= 30;
    else if (maxVas >= 5) score -= 15;

    // f2. Modulazione fisiologica del ciclo
    if      (cycle === 'Mestruazioni' || cycle === 'Fase Luteale') score -= 5; // Infiammazione / progesterone
    else if (cycle === 'Fase Follicolare')                          score += 5; // Picco estrogenico (boost anabolico)

    // f3. Modulazione SNC — CNS Finger Tap Test
    if (DB.wellness.cnsScore) {
        const athCns = athById(selAthId);
        if (athCns && athCns.cnsRecord > 0) {
            const dropPercent = ((athCns.cnsRecord - DB.wellness.cnsScore) / athCns.cnsRecord) * 100;
            if      (dropPercent >= 15)                             score -= 20; // Crollo grave (SNC soppresso)
            else if (dropPercent >= 10)                             score -= 10; // Affaticamento neurale
            else if (DB.wellness.cnsScore >= athCns.cnsRecord)     score +=  5; // Record → extra boost
        }
    }

    // f4. Modulazione ore di sonno (rischio infortuni)
    const sleepHoursInput = document.getElementById('w-sleep-hours');
    if (sleepHoursInput && sleepHoursInput.value) {
        const sleepHours = parseFloat(sleepHoursInput.value);
        if      (sleepHours < 5)   score -= 15; // Grave carenza
        else if (sleepHours < 6.5) score -=  8; // Sotto soglia minima élite
        else if (sleepHours >= 8)  score +=  5; // Recupero eccellente
    }

    // f5. Clamp finale [0, 100]
    score = Math.max(0, Math.min(100, score));

    // ── g) AGGIORNAMENTO RING SVG ─────────────────────────────
    const circ  = 2 * Math.PI * 46;
    const color = score >= 75 ? 'var(--teal)' : score >= 50 ? 'var(--amber)' : 'var(--coral)';
    const rf    = document.getElementById('ring-f');

    if (rf) {
        rf.style.strokeDashoffset = circ - (circ * score / 100);
        rf.style.stroke           = color;
    }
    if (document.getElementById('ring-n')) {
        document.getElementById('ring-n').textContent = score;
        document.getElementById('ring-n').style.color = color;
    }

    // ── Etichette stato Readiness ─────────────────────────────
    const vi = score < 50 ? 0 : score < 75 ? 1 : 2;
    const vs = [
        { v: 'Recupero Attivo', r: 'Parametri compromessi.', c: 'var(--coral)' },
        { v: 'Caution',         r: 'Stato instabile.',       c: 'var(--amber)' },
        { v: 'Pronto',          r: 'Omeostasi ottimale.',    c: 'var(--teal)'  }
    ];

    if (document.getElementById('r-verd')) {
        document.getElementById('r-verd').textContent = vs[vi].v;
        document.getElementById('r-verd').style.color = vs[vi].c;
    }
    if (document.getElementById('r-rec')) {
        document.getElementById('r-rec').textContent = vs[vi].r;
    }

    // ── h) MESSAGGIO COACH — con contesto fisiologico ciclo ───
    const coachMsgs = ['Riduci l\'intensità.', 'Attenzione ai fondamentali.', 'Spingi al massimo.'];

    if (document.getElementById('w-coach-msg')) {
        let finalMsg = coachMsgs[vi];

        // Inietta il contesto fisiologico del ciclo mestruale se disponibile
        if (cycle !== 'N/A' && cycleMsg !== '') {
            finalMsg += `<br><br>` +
                `<span style="color:var(--purple); font-weight:800; font-size:11px; text-transform:uppercase; letter-spacing:1px;">` +
                `Stato Fisiologico: ${cycle}</span><br>` +
                `<span style="color:var(--text); font-size:13px;">${cycleMsg}</span>`;
        }

        document.getElementById('w-coach-msg').innerHTML = finalMsg;
    }

    // ── i) PERSISTENZA DB + CLOUD ─────────────────────────────
    DB.wellness = {
        sleep:          sl,
        sleepHours:     parseFloat((sleepHoursInput && sleepHoursInput.value) ? sleepHoursInput.value : 0),
        stress:         st,
        sore:           so,
        motiv:          mo,
        cycle:          cycle,
        weight:         weightInput ? weightInput.value : '',
        bf:             bfInput     ? bfInput.value     : '',
        readinessScore: score,
        cnsScore:       cnsTaps     // Valore corrente del Tap Test
    };

    saveWellnessCloud();
}


// ─────────────────────────────────────────────────────────────
// 4. saveWellnessCloud()
//    Sincronizza il pacchetto Wellness su Supabase (tabella
//    "wellness") con upsert basato su id = athlete_id + date.
//    Aggiorna la spia Cloud nella topbar.
//    Gestione blindata dei valori opzionali (NaN → 0).
// ─────────────────────────────────────────────────────────────
async function saveWellnessCloud() {
    if (!selAthId) return; // Protezione: atleta non ancora caricato

    // Lettura sicura HRV e RHR (default 0 se vuoti o NaN)
    const hrvVal = parseFloat(document.getElementById('w-hrv').value)  || 0;
    const rhrVal = parseInt(document.getElementById('w-rhr').value)    || 0;

    // Ricalcolo preciso della fase del ciclo (indipendente da upW)
    const cDayInput = document.getElementById('w-cycle-start');
    let cPhase = 'N/A';
    if (cDayInput && cDayInput.value) {
        const startDate = new Date(cDayInput.value);
        const today     = new Date();
        startDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        const diffTime = today - startDate;
        if (diffTime >= 0) {
            const d = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
            if      (d <= 5)  cPhase = 'Mestruazioni';
            else if (d <= 13) cPhase = 'Fase Follicolare';
            else if (d <= 15) cPhase = 'Fase Ovulatoria';
            else if (d <= 40) cPhase = 'Fase Luteale';
            else              cPhase = 'Irregolare';
        }
    }

    // Pacchetto dati per Supabase (colonne tabella "wellness")
    const wellnessData = {
        id:             'well_' + selAthId + '_' + new Date().toISOString().slice(0, 10),
        athlete_id:     selAthId,
        date:           new Date().toISOString().slice(0, 10),
        sleep:          parseInt(document.getElementById('w-sleep').value)        || 4,
        sleep_hours:    parseFloat(document.getElementById('w-sleep-hours').value) || 0,
        stress:         parseInt(document.getElementById('w-stress').value)       || 2,
        sore:           parseInt(document.getElementById('w-sore').value)         || 2,
        motiv:          parseInt(document.getElementById('w-motiv').value)        || 4,
        hrv:            hrvVal,
        rhr:            rhrVal,
        cycle_phase:    cPhase,
        readiness_score: parseInt(document.getElementById('ring-n').textContent)  || 80
    };

    try {
        if (window.mySupabase) {
            const { error } = await window.mySupabase.from('wellness').upsert([wellnessData]);
            if (error) throw error;
            if (typeof updateCloudStatus === 'function') updateCloudStatus('cloud');
        } else {
            // Supabase non disponibile: modalità offline
            if (typeof updateCloudStatus === 'function') updateCloudStatus('local');
        }
    } catch (err) {
        console.error('Errore salvataggio wellness atomico:', err);
        if (typeof updateCloudStatus === 'function') updateCloudStatus('error');
    }
}


// ─────────────────────────────────────────────────────────────
// 5. BODY MAP INFORTUNI — Mappa topografica SVG con scala VAS
// ─────────────────────────────────────────────────────────────

/**
 * openInjuryMo(zone)
 * Genera dinamicamente il modale di registrazione dolore
 * per la zona articolare selezionata sulla body map SVG.
 * Precompila con i valori dell'eventuale infortunio già attivo.
 */
function openInjuryMo(zone) {
    window.currentInjuryZone = zone;
    if (!DB.injuries) DB.injuries = [];

    const existing = DB.injuries.find(
        x => x.athlete === selAthId && x.zone === zone && x.status === 'Attivo'
    );

    const vas    = existing ? existing.vas    : 5;
    const tipo   = existing ? existing.type   : 'Acuto';
    const tissue = existing ? (existing.tissue || 'Muscolare') : 'Muscolare';

    const html = `
    <div class="mo show" id="mo-injury" style="z-index:99999;">
      <div class="mo-box">
        <div class="mo-t" style="color:var(--coral)">
          Dolore: ${zone.replace('_', ' ')}
          <button class="mo-x" onclick="document.getElementById('mo-injury').remove()">✕</button>
        </div>

        <div class="card" style="background:var(--s2); margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <label class="fl">Intensità Dolore (VAS 1-10)</label>
            <div style="font-family:var(--fh); font-size:22px; color:var(--coral); line-height:1;"
                 id="inj-vas-val">${vas}</div>
          </div>
          <input type="range" id="inj-vas" min="1" max="10" value="${vas}"
                 oninput="document.getElementById('inj-vas-val').textContent=this.value"
                 style="background:var(--coral-d);">
          <div style="display:flex; justify-content:space-between; font-size:9px; color:var(--muted); margin-top:4px;">
            <span>1 (Lieve)</span><span>10 (Invalidante)</span>
          </div>
        </div>

        <div class="fg" style="margin-bottom:12px;">
          <label class="fl">Tipologia Clinica</label>
          <select id="inj-type" style="border-color:var(--border);">
            <option value="Acuto"   ${tipo === 'Acuto'   ? 'selected' : ''}>Acuto (Fitta, Pungente, Improvviso)</option>
            <option value="Cronico" ${tipo === 'Cronico' ? 'selected' : ''}>Cronico (Sordo, Costante, da Usura)</option>
          </select>
        </div>

        <div class="fg" style="margin-bottom:20px;">
          <label class="fl">Tessuto Coinvolto</label>
          <select id="inj-tissue" style="border-color:var(--border);">
            <option value="Muscolare"          ${tissue === 'Muscolare'          ? 'selected' : ''}>Muscolare</option>
            <option value="Tendineo"           ${tissue === 'Tendineo'           ? 'selected' : ''}>Tendineo</option>
            <option value="Legamentoso"        ${tissue === 'Legamentoso'        ? 'selected' : ''}>Legamentoso</option>
            <option value="Osseo / Articolare" ${tissue === 'Osseo / Articolare' ? 'selected' : ''}>Osseo / Articolare</option>
          </select>
        </div>

        <div style="display:flex; gap:8px; justify-content:space-between;">
          ${existing
            ? `<button class="btn btn-g" onclick="resolveInjury('${zone}')" style="color:var(--teal)">✓ Segna Guarito</button>`
            : '<div></div>'
          }
          <button class="btn btn-p" style="background:var(--coral); color:#fff;" onclick="saveInjury()">
            Registra Dolore
          </button>
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
}

/**
 * saveInjury()
 * Salva il nuovo record infortunio nel DB (rimuovendo l'eventuale
 * precedente record attivo per la stessa zona), poi aggiorna
 * la UI e ricalcola la Readiness.
 */
function saveInjury() {
    const zone   = window.currentInjuryZone;
    const vas    = parseInt(document.getElementById('inj-vas').value);
    const type   = document.getElementById('inj-type').value;
    const tissue = document.getElementById('inj-tissue').value;

    // Rimuove il record attivo precedente per evitare duplicati
    DB.injuries = DB.injuries.filter(
        x => !(x.athlete === selAthId && x.zone === zone && x.status === 'Attivo')
    );

    // Inserisce il nuovo record
    DB.injuries.push({
        id:      uid(),
        athlete: selAthId,
        date:    new Date().toISOString().slice(0, 10),
        zone,
        vas,
        type,
        tissue,
        status:  'Attivo'
    });

    saveDB();
    document.getElementById('mo-injury').remove();
    renderInjuries();
    upW(); // Ricalcola la Readiness con la nuova penalità VAS

    if (typeof renderDashboard === 'function') renderDashboard(); // Aggiorna Triage Coach

    toast('Area mappata nel database clinico!');
}

/**
 * resolveInjury(zone)
 * Marca l'infortunio attivo della zona come "Risolto"
 * e aggiorna UI e Readiness.
 */
function resolveInjury(zone) {
    const inj = DB.injuries.find(
        x => x.athlete === selAthId && x.zone === zone && x.status === 'Attivo'
    );
    if (inj) inj.status = 'Risolto';

    saveDB();
    document.getElementById('mo-injury').remove();
    renderInjuries();
    upW();

    if (typeof renderDashboard === 'function') renderDashboard();
}

/**
 * renderInjuries()
 * Popola il pannello "active-injuries-list" con le card
 * degli infortuni attivi, incluso badge VAS colorato.
 */
function renderInjuries() {
    const wrap = document.getElementById('active-injuries-list');
    if (!wrap) return;
    if (!DB.injuries) DB.injuries = [];

    const act = DB.injuries.filter(x => x.athlete === selAthId && x.status === 'Attivo');

    if (!act.length) {
        wrap.innerHTML = `
            <div style="font-size:11px; color:var(--teal); text-align:center;
                        padding:10px; background:rgba(16, 185, 129, 0.1); border-radius:8px;">
              Nessun infortunio attivo registrato.
            </div>`;
        return;
    }

    wrap.innerHTML = act.map(i => `
        <div style="display:flex; justify-content:space-between; align-items:center;
                    background:rgba(239, 68, 68, 0.15); border:1px solid var(--coral);
                    padding:10px; border-radius:8px;">
          <div>
            <div style="color:var(--text); font-weight:800; font-size:12px;">
              📍 ${i.zone.replace('_', ' ')}
            </div>
            <div style="color:var(--coral); font-size:10px; text-transform:uppercase;">
              Tipo: ${i.type}
            </div>
          </div>
          <div style="background:var(--coral); color:#fff; font-family:var(--fh);
                      font-weight:800; font-size:16px; width:34px; height:34px;
                      display:flex; align-items:center; justify-content:center; border-radius:8px;">
            ${i.vas}
          </div>
        </div>
    `).join('');
}


// ─────────────────────────────────────────────────────────────
// 6. CNS FINGER TAP TEST — Test neurologico del Sistema Nervoso
//    Misura oggettivamente la stanchezza del SNC:
//    l'atleta tocca il pulsante il più velocemente possibile
//    per 10 secondi. Il risultato viene confrontato con il
//    suo Personal Best neurale (ath.cnsRecord).
// ─────────────────────────────────────────────────────────────

/** Stato del test — variabili condivise tra le funzioni */
let cnsTaps     = 0;
let cnsTimer    = 10.0;
let cnsInterval = null;

/**
 * startCnsTest()
 * Inizializza e avvia il countdown del Tap Test.
 * Nasconde il bottone START, mostra il bottone TAP.
 */
function startCnsTest() {
    cnsTaps  = 0;
    cnsTimer = 10.0;

    document.getElementById('cns-score-display').textContent    = '0';
    document.getElementById('cns-time-display').textContent     = 'Timer: 10.0s';
    document.getElementById('cns-time-display').style.color     = 'var(--amber)';
    document.getElementById('cns-start-btn').style.display      = 'none';
    document.getElementById('cns-tap-btn').style.display        = 'block';
    document.getElementById('cns-result-area').style.display    = 'none';

    cnsInterval = setInterval(() => {
        cnsTimer -= 0.1;
        if (cnsTimer <= 0) {
            cnsTimer = 0;
            endCnsTest();
        }
        document.getElementById('cns-time-display').textContent = `Timer: ${cnsTimer.toFixed(1)}s`;
    }, 100);
}

/**
 * registerCnsTap(e)
 * Registra ogni singolo tap dell'atleta con:
 *   - animazione scale di compressione del bottone
 *   - haptic feedback minimo (15ms — colpo secco)
 */
function registerCnsTap(e) {
    e.preventDefault(); // Blocca zoom / scroll accidentale sui tap veloci
    if (cnsTimer <= 0) return;

    cnsTaps++;
    document.getElementById('cns-score-display').textContent = cnsTaps;

    // Micro-animazione reattiva al tocco
    const btn = document.getElementById('cns-tap-btn');
    btn.style.transform = 'scale(0.96)';
    setTimeout(() => { btn.style.transform = 'scale(1)'; }, 40);

    // Haptic feedback istantaneo
    if (navigator.vibrate) navigator.vibrate(15);
}

/**
 * endCnsTest()
 * Ferma il countdown e aggiorna la UI al termine dei 10 secondi.
 * Chiama evaluateCnsTest() per il giudizio clinico.
 */
function endCnsTest() {
    clearInterval(cnsInterval);

    document.getElementById('cns-tap-btn').style.display       = 'none';
    document.getElementById('cns-start-btn').style.display     = 'block';
    document.getElementById('cns-start-btn').textContent       = '↻ RIPETI TEST';
    document.getElementById('cns-start-btn').style.background  = 'var(--s3)';
    document.getElementById('cns-time-display').style.color    = 'var(--muted)';
    document.getElementById('cns-time-display').textContent    = 'Test Completato';

    evaluateCnsTest();
}

/**
 * evaluateCnsTest()
 * Confronta il risultato con il Personal Best neurale (cnsRecord)
 * e classifica lo stato del SNC:
 *   - Nuovo Record   → boost di reattività neurale
 *   - Calo ≥ 10%     → allerta fatica neurale
 *   - Nella norma    → stato SNC accettabile
 * Aggiorna DB.wellness.cnsScore e ricalcola upW().
 */
function evaluateCnsTest() {
    const ath = athById(selAthId);
    if (!ath) return;
    if (!ath.cnsRecord) ath.cnsRecord = 0;

    const resArea = document.getElementById('cns-result-area');
    const feedback = document.getElementById('cns-feedback');
    const status   = document.getElementById('cns-status');
    resArea.style.display = 'block';

    // Aggiorna il dato nel wellness corrente
    DB.wellness.cnsScore = cnsTaps;

    if (cnsTaps > ath.cnsRecord) {
        // Nuovo Personal Best neurale
        ath.cnsRecord = cnsTaps;
        saveDB();
        feedback.innerHTML = `<span style="color:var(--teal);">🏆 NUOVO RECORD SNC! Reattività neurale eccellente.</span>`;
        status.innerHTML   = `<span style="color:var(--teal);">OTTIMO (${cnsTaps})</span>`;
    } else {
        const dropPercent = ((ath.cnsRecord - cnsTaps) / ath.cnsRecord) * 100;

        if (dropPercent >= 10) {
            // Affaticamento neurale rilevato
            feedback.innerHTML = `<span style="color:var(--coral);">⚠️ FATICA NEURALE: Calo del ${dropPercent.toFixed(1)}% rispetto al tuo picco (${ath.cnsRecord}). Riduci le alzate pesanti.</span>`;
            status.innerHTML   = `<span style="color:var(--coral);">FATICA (${cnsTaps})</span>`;
        } else {
            // Nella norma
            feedback.innerHTML = `<span style="color:var(--teal);">✅ Nella norma. Sei vicino al tuo picco (${ath.cnsRecord}).</span>`;
            status.innerHTML   = `<span style="color:var(--teal);">OK (${cnsTaps})</span>`;
        }
    }

    upW(); // Ricalcola la Readiness globale con il nuovo dato SNC
}


// ─────────────────────────────────────────────────────────────
// 7. confermaWellnessLive()
//    Sblocco della sessione live dopo la compilazione del
//    Wellness Check-in. Forza un ultimo salvataggio, emette
//    un doppio haptic di sblocco, e naviga alla Sessione.
// ─────────────────────────────────────────────────────────────
function confermaWellnessLive() {
    // Forza un ultimo salvataggio pulito di tutti i parametri
    saveWellnessCloud();

    // Doppio haptic feedback di sblocco (pattern ritmico)
    if (navigator.vibrate) navigator.vibrate([40, 40]);

    toast('💪 Stato Wellness salvato. Focus totale sulla prestazione!');

    // Naviga alla Sessione Live con un leggero ritardo per il toast
    setTimeout(() => {
        go('sessione');
    }, 400);
}


// ─────────────────────────────────────────────────────────────
// 8. computeSessionModifiers()
//    Calcola i modificatori di autoregolazione per la sessione
//    live sulla base di tre segnali fisiologici:
//      1. Readiness score  → riduce il carico (kg)
//      2. CNS Finger Tap   → riduce i set sugli esercizi ad
//                            alta domanda neurale (max/dynamic effort)
//      3. Fase del ciclo   → aggiusta carico e aggiunge note cliniche
//
//    Restituisce:
//      { kgMultiplier, setModifier, warningType, messages,
//        readiness, cnsDropPct, cycle }
//
//    Usata da loadLive() in workout.js.
// ─────────────────────────────────────────────────────────────
function computeSessionModifiers() {
    const readiness = (DB.wellness && DB.wellness.readinessScore !== undefined)
        ? DB.wellness.readinessScore : 80;
    const cnsScore  = (DB.wellness && DB.wellness.cnsScore) ? DB.wellness.cnsScore : 0;
    const cycle     = (DB.wellness && DB.wellness.cycle)    ? DB.wellness.cycle    : 'N/A';
    const ath       = athById(selAthId);
    const cnsRecord = (ath && ath.cnsRecord) ? ath.cnsRecord : 0;

    let kgMultiplier = 1.0;
    let setModifier  = 0;       // applicato solo a esercizi high-CNS
    let warningType  = 'none';  // 'none' | 'caution' | 'critical'
    const messages   = [];

    // 1. Readiness → moltiplicatore kg
    if (readiness < 50) {
        kgMultiplier = 0.90;
        warningType  = 'critical';
        messages.push(`Readiness ${readiness}% — Carico ridotto -10%`);
    } else if (readiness < 75) {
        kgMultiplier = 0.95;
        warningType  = 'caution';
        messages.push(`Readiness ${readiness}% — Carico ridotto -5%`);
    }

    // 2. CNS Tap Test → riduzione set esercizi neurali
    let cnsDropPct = 0;
    if (cnsRecord > 0 && cnsScore > 0) {
        cnsDropPct = ((cnsRecord - cnsScore) / cnsRecord) * 100;
        if (cnsDropPct >= 15) {
            setModifier = -1;
            if (warningType === 'none') warningType = 'caution';
            messages.push(`SNC affaticato (calo ${cnsDropPct.toFixed(0)}%) — -1 set su Max/Dynamic Effort`);
        } else if (cnsDropPct >= 10) {
            if (warningType === 'none') warningType = 'caution';
            messages.push(`SNC moderatamente affaticato (${cnsDropPct.toFixed(0)}%) — monitora le alzate pesanti`);
        }
    }

    // 3. Ciclo mestruale → carico e note cliniche
    if (cycle === 'Fase Ovulatoria') {
        if (warningType === 'none') warningType = 'caution';
        messages.push('⚠️ Picco Relaxina — warm-up articolare obbligatorio prima di ogni alzata pesante');
    } else if (cycle === 'Mestruazioni') {
        if (kgMultiplier === 1.0) kgMultiplier = 0.97; // riduzione lieve aggiuntiva
        if (warningType === 'none') warningType = 'caution';
        messages.push('🩸 Fase mestruale — carico ridotto -3%');
    } else if (cycle === 'Fase Follicolare') {
        messages.push('⚡ Fase follicolare — risposta anabolica ottimale, puoi spingere al massimo');
    }

    return { kgMultiplier, setModifier, warningType, messages, readiness, cnsDropPct, cycle };
}
