/* ══════════════════════════════════════════════════════════════
   ELITE SPORTS SCIENCE — app.js  (ES Module)
   Nucleo applicativo: persistenza, navigazione, dashboard,
   atleti, storico, editor schede, feedback, esportazione.

   Dipendenze importate:
     state.js   → DB, appState, KEY, EXERCISE_LIBRARY, rpeDescs, starDescs
     utils.js   → uid, escHtml, toast, openMo, closeMo, athName, athById, updateCloudStatus
     auth.js    → (bootstrap in main.js)
     wellness.js → upW, renderInjuries
     workout.js → loadLive, updateLiveTotals
     analytics.js → renderAnalytics, calculateACWR, renderE1rmChart
   ══════════════════════════════════════════════════════════════ */

import { DB, appState, KEY, EXERCISE_LIBRARY, rpeDescs, starDescs } from './state.js';
import { uid, escHtml, toast, openMo, closeMo, athName, athById, updateCloudStatus } from './utils.js';

// Importazioni circolari risolte: questi moduli importano da state+utils,
// e app.js li chiama solo dentro funzioni (mai al top-level).
import { upW, renderInjuries } from './wellness.js';
import { loadLive, updateLiveTotals } from './workout.js';
import { renderAnalytics, calculateACWR, renderE1rmChart } from './analytics.js';


// ─────────────────────────────────────────────────────────────
// PERSISTENZA
// ─────────────────────────────────────────────────────────────
export async function saveDB() {
    updateCloudStatus('saving');
    clearTimeout(appState.saveDbTimeout);
    appState.saveDbTimeout = setTimeout(async () => {
        try {
            await localforage.setItem(KEY, DB);
            updateCloudStatus('local');
        } catch (e) {
            console.error('Errore salvataggio locale:', e);
        }
        const topbar = document.querySelector('.topbar');
        if (topbar) {
            topbar.dataset.saveMsg = 'Salvato ✓';
            setTimeout(() => delete topbar.dataset.saveMsg, 2000);
        }
    }, 500);
}

export async function seed() {
    DB.athletes = [{
        id: 'a1', name: 'Niccolò Trentin', level: 'Avanzato',
        goal: 'Performance Atletica', freq: 4, height: 182, weight: 78, bf: 11,
        anthropoHistory: [{ date: '2026-05-01', weight: 78, bf: 11 }],
        notes: 'Focus decelerazione servizio tennis.'
    }];
    DB.schedules['a1'] = {
        meso: 'Meso 1', phase: 'Accumulo',
        coachNote: 'Focus sul controllo della spalla',
        objective: 'Aumento del volume complessivo',
        sessions: [{
            id: 's1', name: 'Upper 1 (Forza Servizio)',
            exercises: [
                { name: 'Bench press bb', arm: 'Bi', wset: 2, set: 3, rep: 5, kg: 57.5, rir: 2, rest: "2'",  tut: '-', note: '' },
                { name: 'Lat machine',    arm: 'Bi', wset: 1, set: 3, rep: 8, kg: 52,   rir: 1, rest: "90''", tut: '-', note: '' }
            ]
        }]
    };
    await saveDB();
}


// ─────────────────────────────────────────────────────────────
// ARCHIVIO MESOCICLI
// ─────────────────────────────────────────────────────────────
async function archiveMesocycle(athId) {
    const sch = DB.schedules[athId];
    if (!sch || !sch.sessions || sch.sessions.length === 0) {
        toast('Nessuna scheda da archiviare.');
        return null;
    }

    const now      = new Date().toISOString();
    const snapshot = {
        athlete:    athId,
        meso:       sch.meso      || 'Meso senza nome',
        phase:      sch.phase     || '',
        duration:   sch.duration  || 4,
        coachNote:  sch.coachNote || '',
        objective:  sch.objective || '',
        archivedAt: now,
        sessions:   JSON.parse(JSON.stringify(sch.sessions))
    };

    if (!DB.mesocycles) DB.mesocycles = [];
    DB.mesocycles.unshift(snapshot);
    await saveDB();

    try {
        if (window.mySupabase) {
            const { data, error } = await window.mySupabase
                .from('mesocycles')
                .insert([{
                    athlete_id:  athId,
                    meso:        snapshot.meso,
                    phase:       snapshot.phase,
                    duration:    snapshot.duration,
                    coach_note:  snapshot.coachNote,
                    objective:   snapshot.objective,
                    archived_at: now,
                    sessions:    snapshot.sessions
                }])
                .select('id')
                .single();
            if (!error && data) snapshot.id = data.id;
            else if (error) console.error('Errore archivio cloud:', error);
        }
    } catch (e) {
        console.error('Errore archivio mesociclo:', e);
    }

    return snapshot;
}

export async function archiveAndNewMeso() {
    const athId = document.getElementById('ed-ath').value || appState.selAthId;
    const sch   = DB.schedules[athId];
    if (!sch) return;

    const mesoCorrente = sch.meso || 'Meso corrente';
    if (!confirm(
        `Archiviare "${mesoCorrente}" e iniziare un nuovo mesociclo?\n\n` +
        `La scheda attuale verrà conservata nello storico consultabile.`
    )) return;

    updateCloudStatus('saving');
    const snap = await archiveMesocycle(athId);
    if (!snap) return;

    const archiviati  = (DB.mesocycles || []).filter(m => m.athlete === athId).length;
    const nomeDefault = `Meso ${archiviati + 1}`;
    const newName     = prompt('Nome del nuovo mesociclo:', nomeDefault);
    if (!newName || !newName.trim()) { toast('Nome non valido. Operazione annullata.'); return; }

    const keepTemplate = confirm(
        'Vuoi usare le sessioni correnti come punto di partenza?\n\n' +
        '"OK" → mantieni la struttura delle sessioni (progressioni azzerata)\n' +
        '"Annulla" → parti da zero con una sessione vuota'
    );

    sch.meso = newName.trim(); sch.phase = 'Accumulo'; sch.duration = 4; sch.coachNote = ''; sch.objective = '';

    if (!keepTemplate) {
        sch.sessions = [{ id: uid(), name: 'Seduta A', exercises: [] }];
    } else {
        sch.sessions.forEach(s => { s.id = uid(); s.exercises.forEach(ex => { ex.progression = {}; }); });
    }

    appState.edSessId = sch.sessions[0].id;
    document.getElementById('ed-meso').value     = sch.meso;
    document.getElementById('ed-phase').value    = 'Accumulo';
    document.getElementById('ed-duration').value = '4';
    const cnEl = document.getElementById('ed-coachnote');
    const obEl = document.getElementById('ed-obj');
    if (cnEl) cnEl.value = ''; if (obEl) obEl.value = '';

    await saveSchedule(); renderEditor();
    toast(`"${mesoCorrente}" archiviato! Nuovo mesociclo "${sch.meso}" creato.`);
    updateCloudStatus('cloud');
}

export function openMesocycleArchive() {
    const athId   = document.getElementById('ed-ath').value || appState.selAthId;
    const ath     = athById(athId);
    const archive = (DB.mesocycles || []).filter(m => m.athlete === athId);

    const titleEl = document.getElementById('meso-archive-title');
    if (titleEl) titleEl.textContent = `Storico Mesocicli — ${ath ? ath.name : ''}`;

    const container = document.getElementById('meso-archive-list');
    if (!container) return;

    if (!archive.length) {
        container.innerHTML = `
            <div style="text-align:center; padding:30px; color:var(--muted);">
                <div style="font-size:32px; margin-bottom:10px;">📭</div>
                <div style="font-size:14px; font-weight:700; color:var(--text);">Nessun mesociclo archiviato</div>
                <div style="font-size:12px; margin-top:8px; line-height:1.6;">
                    Usa <strong style="color:var(--amber);">📦 Archivia & Nuovo Meso</strong>
                    per salvare la scheda corrente prima di cambiare programmazione.
                </div>
            </div>`;
        openMo('mo-meso-archive');
        return;
    }

    container.innerHTML = archive.map((m, idx) => {
        const dateStr   = m.archivedAt
            ? new Date(m.archivedAt).toLocaleDateString('it-IT', { day:'2-digit', month:'short', year:'numeric' })
            : '—';
        const sessCount = (m.sessions || []).length;
        const exCount   = (m.sessions || []).reduce((sum, s) => sum + (s.exercises || []).length, 0);

        const sessHtml = (m.sessions || []).map(s => {
            const exRows = (s.exercises || []).map(ex => {
                const progStr = ex.progression && Object.keys(ex.progression).length
                    ? Object.entries(ex.progression)
                        .sort(([a],[b]) => a.localeCompare(b, undefined, { numeric: true }))
                        .map(([w, v]) => `${w.toUpperCase()}: ${v.set}x${v.rep}@${v.kg}kg`)
                        .join(' · ')
                    : null;
                return `<div style="padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.04);">
                    <span style="color:var(--text); font-weight:600; font-size:12px;">${escHtml(ex.name)}</span>
                    <span style="color:var(--muted); font-size:11px; margin-left:8px;">
                        ${ex.set}x${ex.rep} @ ${ex.kg}kg${ex.rir && ex.rir !== '—' ? ' · RIR ' + ex.rir : ''}
                    </span>
                    ${progStr ? `<div style="font-size:10px; color:var(--muted); margin-top:3px; opacity:0.7;">${progStr}</div>` : ''}
                </div>`;
            }).join('');
            return `<div style="margin-bottom:14px;">
                <div style="font-size:11px; font-weight:800; color:var(--teal); text-transform:uppercase;
                            letter-spacing:0.5px; margin-bottom:8px; padding-bottom:4px;
                            border-bottom:1px solid rgba(16,185,129,0.2);">${s.name}</div>
                ${exRows || '<div style="font-size:11px; color:var(--muted); font-style:italic; padding:6px 0;">Nessun esercizio</div>'}
            </div>`;
        }).join('');

        const phaseColor = {
            'Accumulo': 'var(--teal)', 'Intensificazione': 'var(--amber)',
            'Picco': 'var(--coral)', 'Scarico': 'var(--blue)'
        }[m.phase] || 'var(--muted)';

        return `<div style="background:var(--s1); border:1px solid var(--border); border-radius:12px; margin-bottom:10px; overflow:hidden;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 16px;
                        background:var(--s2); cursor:pointer; user-select:none;"
                 onclick="const b=document.getElementById('meso-body-${idx}'); b.style.display = b.style.display==='none'?'block':'none';">
                <div>
                    <div style="font-weight:800; font-size:15px; color:var(--text);">${m.meso}</div>
                    <div style="font-size:11px; color:var(--muted); margin-top:3px;">
                        <span style="color:${phaseColor}; font-weight:700;">${m.phase || '—'}</span>
                        · ${m.duration || 4} sett. · ${sessCount} sessioni · ${exCount} esercizi
                    </div>
                </div>
                <div style="text-align:right; flex-shrink:0; margin-left:12px;">
                    <div style="font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px;">Archiviato il</div>
                    <div style="font-size:12px; font-weight:700; color:var(--amber);">${dateStr}</div>
                    <div style="font-size:14px; color:var(--muted); margin-top:4px;">▾</div>
                </div>
            </div>
            <div id="meso-body-${idx}" style="display:none; padding:16px;">
                ${m.coachNote ? `<div style="margin-bottom:12px; font-size:12px; padding:10px; border-radius:8px;
                    background:rgba(16,185,129,0.05); border-left:3px solid var(--teal); color:var(--muted);">
                    <strong style="color:var(--teal);">Note Coach:</strong> ${m.coachNote}</div>` : ''}
                ${m.objective ? `<div style="margin-bottom:12px; font-size:12px; color:var(--muted);">
                    <strong style="color:var(--text);">Obiettivo:</strong> ${m.objective}</div>` : ''}
                ${sessHtml}
            </div>
        </div>`;
    }).join('');

    openMo('mo-meso-archive');
}


// ─────────────────────────────────────────────────────────────
// NAVIGAZIONE
// ─────────────────────────────────────────────────────────────
export function go(id, btn) {
    if (window.userRole === 'ATLETA') {
        const allowed = ['wellness', 'sessione', 'feedback', 'coach-reply', 'analytics'];
        if (!allowed.includes(id)) return;
    }

    document.querySelectorAll('.panel').forEach(p => p.classList.remove('on'));
    document.getElementById('p-' + id).classList.add('on');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('on'));
    if (btn) btn.classList.add('on');
    appState.curPanel = id;

    const renders = {
        dashboard:      renderDashboard,
        athletes:       renderAthletes,
        storico:        renderStorico,
        editor:         renderEditor,
        wellness:       () => upW(),
        sessione:       loadLive,
        'coach-reply':  renderCoachReply,
        analytics:      renderAnalytics,
        progressione:   renderProg
    };
    if (renders[id]) renders[id]();

    document.querySelectorAll('.bb-item').forEach(b => b.classList.remove('on'));
    const activeBb = document.querySelector(`.bb-item[onclick*="'${id}'"]`);
    if (activeBb) activeBb.classList.add('on');
}

export function toggleMobileMenu() {
    document.querySelector('.sidebar').classList.toggle('open');
}

document.addEventListener('click', e => {
    const sidebar = document.querySelector('.sidebar');
    const toggle  = document.querySelector('.menu-toggle');
    if (sidebar && sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggle) {
        sidebar.classList.remove('open');
    }
});


// ─────────────────────────────────────────────────────────────
// SELETTORI
// ─────────────────────────────────────────────────────────────
export function populateSelects() {
    const ids = ['g-ath', 'ms-ath', 'ed-ath', 'exp-ath', 'sf-ath'];
    ids.forEach(sid => {
        const el = document.getElementById(sid);
        if (!el) return;
        const prev = el.value;
        el.innerHTML = sid === 'sf-ath' ? '<option value="">Tutti</option>' : '';
        DB.athletes.forEach(a => {
            const o = document.createElement('option');
            o.value = a.id; o.textContent = a.name;
            el.appendChild(o);
        });
        if (prev && [...el.options].find(o => o.value === prev)) el.value = prev;
    });
    if (!appState.selAthId && DB.athletes.length) appState.selAthId = DB.athletes[0].id;
    const ga = document.getElementById('g-ath');
    if (ga) ga.value = appState.selAthId;

    document.getElementById('nb-ath').textContent = DB.athletes.length;
    document.getElementById('nb-sto').textContent = DB.sessions.length;
    updateModalSessions();
}

export function onAthChange() {
    appState.selAthId = document.getElementById('g-ath').value;
    const edAth = document.getElementById('ed-ath');
    if (edAth) {
        edAth.value = appState.selAthId;
        const sch = DB.schedules[appState.selAthId];
        appState.edSessId = (sch && sch.sessions && sch.sessions.length > 0) ? sch.sessions[0].id : '';
    }
    go(appState.curPanel, document.querySelector('.nav-btn.on'));
}

export function updateModalSessions() {
    const athId = document.getElementById('ms-ath').value || appState.selAthId;
    const el = document.getElementById('ms-sess');
    if (!el) return;
    el.innerHTML = '';
    const sch = DB.schedules[athId];
    if (sch && sch.sessions) {
        sch.sessions.forEach(s => { el.innerHTML += `<option value="${escHtml(s.name)}">${escHtml(s.name)}</option>`; });
    }
}


// ─────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────
export function renderDashboard() {
    const sess = appState.selAthId ? DB.sessions.filter(s => s.athlete === appState.selAthId) : [];
    const ath  = appState.selAthId ? athById(appState.selAthId) : null;
    document.getElementById('dh-title').textContent = ath ? ath.name : 'Seleziona un Atleta';
    if (!ath) return;

    const acwrData = appState.selAthId ? calculateACWR(appState.selAthId) : null;
    document.getElementById('dh-sub').textContent = `${ath.level} · ${ath.goal}`;

    let alertCaricoHTML = '';
    if (acwrData && acwrData.field && acwrData.field.value !== null && acwrData.field.value !== 'N/A') {
        const v = parseFloat(acwrData.field.value);
        if (v > 1.5) {
            alertCaricoHTML = `<div style="background:rgba(239,68,68,.15);border:1px solid #ef4444;color:#f87171;padding:12px;border-radius:8px;margin-bottom:20px;font-size:13px;">⚠️ <strong>Allerta Picco di Carico Specifico (ACWR Campo: ${v}):</strong> L'atleta è nella "Danger Zone". Scaricare il lavoro tecnico/tattico in campo!</div>`;
        } else if (v >= 0.8) {
            alertCaricoHTML = `<div style="background:rgba(16,185,129,.15);border:1px solid #10b981;color:#34d399;padding:12px;border-radius:8px;margin-bottom:20px;font-size:13px;">✅ <strong>Carico Specifico Ottimale (ACWR Campo: ${v}):</strong> "Sweet Spot" sicuro.</div>`;
        } else {
            alertCaricoHTML = `<div style="background:rgba(245,158,11,.15);border:1px solid #f59e0b;color:#fbbf24;padding:12px;border-radius:8px;margin-bottom:20px;font-size:13px;">📉 <strong>Sotto-allenamento / Deallenamento in campo (ACWR Campo: ${v}).</strong></div>`;
        }
    }

    const emergenze = DB.athletes.filter(a => getAthleteRiskScore(a.id) > 0);
    let triageHTML = '';
    if (emergenze.length > 0) {
        triageHTML = `<div style="background:rgba(239,68,68,.05);border:1px solid #ef4444;padding:15px;border-radius:12px;margin-bottom:20px;">
            <div style="color:#ef4444;font-weight:800;margin-bottom:10px;font-size:14px;text-transform:uppercase;">🚨 Triage: Atleti a Rischio</div>
            ${emergenze.map(a => `
                <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(239,68,68,.2);">
                    <span style="color:var(--text);font-weight:600;">${escHtml(a.name)}</span>
                    <span style="color:#ef4444;font-size:12px;font-weight:700;">Rischio: ${getAthleteRiskScore(a.id)}</span>
                </div>`).join('')}
        </div>`;
    }

    const alertsDiv = document.getElementById('dh-alerts');
    if (alertsDiv) alertsDiv.innerHTML = triageHTML + alertCaricoHTML;

    const n      = sess.length;
    const avgRpe = n ? (sess.reduce((a, s) => a + s.rpe, 0) / n).toFixed(1) : '-';
    document.getElementById('dh-kpis').innerHTML = `
        <div class="kpi"><div class="kpi-l">Sessioni totali</div><div class="kpi-v">${n}</div></div>
        <div class="kpi"><div class="kpi-l">RPE medio</div><div class="kpi-v">${avgRpe}</div></div>
        <div class="kpi"><div class="kpi-l">ACWR Gym (Meccanico)</div>
            <div class="kpi-v" style="color:${acwrData ? acwrData.gym.color : 'inherit'}">${acwrData ? acwrData.gym.value : '-'}</div>
            <div class="kpi-s">${acwrData ? acwrData.gym.text : ''}</div></div>
        <div class="kpi"><div class="kpi-l">ACWR Campo (Specifico)</div>
            <div class="kpi-v" style="color:${acwrData ? acwrData.field.color : 'inherit'}">${acwrData ? acwrData.field.value : '-'}</div>
            <div class="kpi-s">${acwrData ? acwrData.field.text : ''}</div></div>`;

    const last8 = sess.slice(-8);
    const maxV  = Math.max(...last8.map(s => s.vol), 1);
    const bc    = document.getElementById('dh-bc');
    bc.innerHTML = '';
    last8.forEach(s => {
        const h   = Math.round(s.vol / maxV * 85);
        const col = document.createElement('div');
        col.className = 'bc-col';
        col.innerHTML = `<div class="bc-val">${(s.vol / 1000).toFixed(1)}k</div>
                         <div class="bc-bar" style="height:${h}px;background:var(--teal)"></div>
                         <div class="bc-lbl">${s.date.slice(5)}</div>`;
        bc.appendChild(col);
    });
}

export function getAthleteRiskScore(athId) {
    let score = 0;
    const sess = DB.sessions.filter(s => s.athlete === athId);
    const acwr = calculateACWR(athId);

    const lastUniSess = [...sess].reverse().find(s => s.e1rmDom > 0 && s.e1rmNDom > 0);
    if (lastUniSess) {
        const deficit = (Math.abs(lastUniSess.e1rmDom - lastUniSess.e1rmNDom) / Math.max(lastUniSess.e1rmDom, lastUniSess.e1rmNDom)) * 100;
        if (deficit > 15) score += 50;
    }

    if (acwr.field.value !== 'N/A' && parseFloat(acwr.field.value) > 1.5) score += 40;
    if (DB.wellness.sore === 5)           score += 30;
    if (DB.wellness.sleep === 1)          score += 20;
    if (DB.wellness.readinessScore < 50)  score += 20;

    if (!DB.injuries) DB.injuries = [];
    DB.injuries.filter(x => x.athlete === athId && x.status === 'Attivo').forEach(inj => {
        if (inj.vas >= 7) score += 60;
        else if (inj.vas >= 4) score += 20;
    });

    return score;
}


// ─────────────────────────────────────────────────────────────
// ATLETI
// ─────────────────────────────────────────────────────────────
export function renderAthletes() {
    const grid = document.getElementById('ath-grid');
    grid.innerHTML = '';
    const sorted = [...DB.athletes].sort((a, b) => getAthleteRiskScore(b.id) - getAthleteRiskScore(a.id));

    sorted.forEach(a => {
        const riskScore   = getAthleteRiskScore(a.id);
        const borderStyle = riskScore >= 50 ? '3px solid var(--coral)' : riskScore >= 20 ? '2px solid var(--amber)' : '1px solid var(--border)';
        const sc   = DB.sessions.filter(s => s.athlete === a.id).length;
        const init = a.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

        const div = document.createElement('div');
        div.className = 'ac' + (a.id === appState.selAthId ? ' sel' : '');
        div.style.border = borderStyle;
        div.onclick = () => { appState.selAthId = a.id; renderAthletes(); renderDashboard(); renderStorico(); };
        div.innerHTML = `
            <div class="ac-av">${init}</div>
            <div class="ac-n">${escHtml(a.name)} ${riskScore > 0 ? '⚠️' : ''}</div>
            <div class="ac-m">${escHtml(a.level)} · ${escHtml(a.goal)}</div>
            <div class="ac-st">
                <div class="ac-stat"><div class="ac-sv">${sc}</div><div class="ac-sl">Sess.</div></div>
                <div class="ac-stat"><div class="ac-sv">${riskScore > 0 ? 'ALTO' : 'OK'}</div><div class="ac-sl">Stato</div></div>
            </div>`;
        grid.appendChild(div);
    });
}

export async function addAthlete() {
    const name  = document.getElementById('ma-name').value.trim();
    const email = document.getElementById('ma-email').value.trim();
    if (!name)                          { toast('Inserisci il nome');         return; }
    if (!email || !email.includes('@')) { toast("Inserisci un'email valida"); return; }

    const w  = parseFloat(document.getElementById('ma-w').value)  || 0;
    const bf = parseFloat(document.getElementById('ma-bf').value) || 0;

    const primoNome      = name.split(' ')[0].toUpperCase();
    const codiceGenerato = primoNome + Math.floor(1000 + Math.random() * 9000);
    const nuovoId        = uid();

    const btn = document.getElementById('ma-save-btn');
    btn.textContent = 'Aggiunta...'; btn.disabled = true;

    const a = {
        id: nuovoId, name, email,
        level:   document.getElementById('ma-lvl').value,
        goal:    document.getElementById('ma-goal').value,
        freq:    +document.getElementById('ma-freq').value,
        height:  parseInt(document.getElementById('ma-h').value) || 0,
        weight: w, bf,
        codice_accesso: codiceGenerato,
        anthropoHistory: [{ date: new Date().toISOString().slice(0, 10), weight: w, bf }],
        notes: document.getElementById('ma-notes').value
    };

    try {
        if (window.mySupabase) {
            const { error } = await window.mySupabase.from('atleti').insert([{
                id: a.id, name: a.name, email: a.email,
                codice_accesso: codiceGenerato,
                level: a.level, goal: a.goal, freq: a.freq,
                height: a.height, weight: a.weight, bf: a.bf,
                notes: a.notes, anthropo_history: a.anthropoHistory
            }]);
            if (error) { toast('Errore: ' + error.message); btn.textContent = 'Aggiungi'; btn.disabled = false; return; }
        }
    } catch (e) {
        toast('Supabase non disponibile: ' + e.message); btn.textContent = 'Aggiungi'; btn.disabled = false; return;
    }

    DB.schedules[a.id] = {
        meso: 'Meso 1', phase: 'Accumulo', coachNote: '', objective: '',
        sessions: [{ id: uid(), name: 'Seduta A', exercises: [] }]
    };
    DB.athletes.push(a);
    appState.selAthId = a.id;
    appState.edSessId = DB.schedules[a.id].sessions[0].id;
    await saveDB();
    populateSelects();
    const edAth = document.getElementById('ed-ath');
    if (edAth) edAth.value = a.id;
    renderAthletes(); closeMo('mo-ath');
    btn.textContent = 'Aggiungi'; btn.disabled = false;

    alert(`Atleta aggiunto!\n\nNome: ${name}\nEmail: ${email}\nCodice di accesso: ${codiceGenerato}\n\nAl primo accesso l'atleta inserisce il codice, poi imposta\nemail e password definitivi. Comunicagli il codice.`);
}

export function openNewAthleteModal() {
    ['ma-name','ma-email','ma-h','ma-w','ma-bf','ma-notes'].forEach(id => { document.getElementById(id).value = ''; });
    const btn = document.getElementById('ma-save-btn');
    btn.textContent = 'Aggiungi'; btn.onclick = addAthlete;
    openMo('mo-ath');
}

export function openEditAthleteModal() {
    const a = athById(appState.selAthId);
    if (!a) { toast('Seleziona prima un atleta dal roster'); return; }
    document.getElementById('ma-name').value  = a.name   || '';
    document.getElementById('ma-lvl').value   = a.level  || 'Intermedio avanzato';
    document.getElementById('ma-goal').value  = a.goal   || 'Performance Atletica';
    document.getElementById('ma-freq').value  = a.freq   || 4;
    document.getElementById('ma-h').value     = a.height || '';
    document.getElementById('ma-w').value     = a.weight || '';
    document.getElementById('ma-bf').value    = a.bf     || '';
    document.getElementById('ma-notes').value = a.notes  || '';
    const btn = document.getElementById('ma-save-btn');
    btn.textContent = 'Salva Modifiche'; btn.onclick = saveAthleteEdits;
    openMo('mo-ath');
}

async function saveAthleteEdits() {
    const a = athById(appState.selAthId);
    if (!a) return;
    const name = document.getElementById('ma-name').value.trim();
    if (!name) { toast('Inserisci il nome'); return; }

    a.name   = name;
    a.level  = document.getElementById('ma-lvl').value;
    a.goal   = document.getElementById('ma-goal').value;
    a.freq   = +document.getElementById('ma-freq').value;
    a.height = parseInt(document.getElementById('ma-h').value)    || 0;
    a.weight = parseFloat(document.getElementById('ma-w').value)  || 0;
    a.bf     = parseFloat(document.getElementById('ma-bf').value) || 0;
    a.notes  = document.getElementById('ma-notes').value;

    try {
        if (window.mySupabase) await window.mySupabase.from('atleti').update({
            name: a.name, level: a.level, goal: a.goal, freq: a.freq,
            height: a.height, weight: a.weight, bf: a.bf, notes: a.notes, anthropo_history: a.anthropoHistory
        }).eq('id', a.id);
    } catch (e) { console.error('Errore sync Supabase:', e); }

    await saveDB(); populateSelects(); renderAthletes(); renderDashboard(); closeMo('mo-ath');
    toast('Dati atleta aggiornati! ✓');
}

export function deleteSelectedAthlete() {
    const modal = document.getElementById('custom-confirm-modal');
    if (!modal) { if (confirm("Eliminare completamente l'atleta?")) eseguiCancellazioneRealeAtleta(); return; }
    modal.style.display = 'flex';
    document.getElementById('confirm-cancel-btn').onclick = () => { modal.style.display = 'none'; };
    document.getElementById('confirm-delete-btn').onclick = () => { modal.style.display = 'none'; eseguiCancellazioneRealeAtleta(); };
}

async function eseguiCancellazioneRealeAtleta() {
    const id = appState.selAthId;
    DB.athletes   = DB.athletes.filter(x => x.id !== id);
    DB.mesocycles = (DB.mesocycles || []).filter(m => m.athlete !== id);
    delete DB.schedules[id];
    appState.selAthId = DB.athletes.length ? DB.athletes[0].id : '';
    await saveDB(); populateSelects(); renderAthletes(); renderDashboard();
    try {
        if (window.mySupabase) {
            await window.mySupabase.from('atleti').delete().eq('id', id);
            await window.mySupabase.from('schedules').delete().eq('athlete_id', id);
        }
    } catch (e) { console.error('Errore eliminazione cloud:', e); }
    toast('Atleta eliminato definitivamente dal Cloud.');
}


// ─────────────────────────────────────────────────────────────
// STORICO SESSIONI
// ─────────────────────────────────────────────────────────────
export function renderCoachReply() {
    const list = document.getElementById('cr-list');
    if (!list) return;
    const sessions = [...DB.sessions]
        .filter(s => s.athlete === appState.selAthId && s.reply)
        .sort((a, b) => b.date.localeCompare(a.date));

    if (sessions.length === 0) {
        list.innerHTML = `<div style="text-align:center;color:var(--muted);padding:40px 20px;font-size:14px;">Nessun feedback del coach ancora disponibile.</div>`;
        return;
    }

    list.innerHTML = sessions.map(s => `
        <div class="card" style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <span class="tag tg">${s.session}</span>
                <span style="color:var(--muted);font-size:11px">${s.date}</span>
            </div>
            ${s.notes ? `<div style="font-size:11px;color:var(--muted);margin-bottom:8px;padding:6px 10px;background:var(--s1);border-radius:6px;"><span style="font-weight:600;color:var(--text)">La tua nota:</span> ${escHtml(s.notes.replace('NOTE: ',''))}</div>` : ''}
            <div style="font-size:13px;color:var(--purple);line-height:1.6;white-space:pre-wrap;padding:8px 10px;background:var(--s2);border-left:3px solid var(--purple);border-radius:0 6px 6px 0;">${escHtml(s.reply)}</div>
        </div>`).join('');
}

export function renderStorico() {
    const fa = document.getElementById('sf-ath').value;
    const fs = document.getElementById('sf-sess').value;
    const fp = document.getElementById('sf-phase').value;
    const fq = (document.getElementById('sf-q').value || '').toLowerCase();

    const fSessSelect = document.getElementById('sf-sess');
    if (fSessSelect.options.length <= 1) {
        fSessSelect.innerHTML = '<option value="">Tutte le sessioni</option>';
        const addedNames = new Set();
        Object.values(DB.schedules).forEach(sc => {
            if (sc.sessions) sc.sessions.forEach(s => {
                if (!addedNames.has(s.name)) { addedNames.add(s.name); fSessSelect.innerHTML += `<option value="${escHtml(s.name)}">${escHtml(s.name)}</option>`; }
            });
        });
    }

    const rows = [...DB.sessions].reverse().filter(s => {
        if (fa && s.athlete !== fa) return false;
        if (fs && s.session !== fs) return false;
        if (fp && s.phase   !== fp) return false;
        if (fq && ![s.notes, s.doms, s.flag, s.reply, athName(s.athlete)].some(x => (x || '').toLowerCase().includes(fq))) return false;
        return true;
    });

    const tb = document.getElementById('sto-body'); tb.innerHTML = '';
    rows.forEach(sess => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color:var(--muted)">${sess.date}</td>
            <td><span class="tag tg">${sess.session}</span></td>
            <td style="font-weight:700">${escHtml(athName(sess.athlete))}</td>
            <td style="color:var(--muted)">W${sess.week || '—'}</td>
            <td><span class="tag tg" style="font-size:10px">${sess.phase || '—'}</span></td>
            <td style="color:var(--teal);font-weight:700">${sess.readiness || '—'}</td>
            <td>${(sess.vol || 0).toLocaleString('it-IT')}</td>
            <td style="color:var(--purple);font-weight:700">${sess.sRPE || '—'} UA</td>
            <td style="color:var(--amber);font-weight:700">${sess.rpe || '—'}</td>
            <td style="color:var(--blue);font-weight:700">${sess.maxE1rm || '—'} kg</td>
            <td style="color:var(--muted);font-size:11px">${escHtml(sess.doms || '—')}</td>
            <td>${sess.flag ? `<span class="tag tc">${escHtml(sess.flag)}</span>` : '—'}</td>
            <td>${sess.reply ? '✓' : '—'}</td>
            <td>
                <button class="btn btn-g btn-xs" onclick="editReply('${sess.id}')">✎</button>
                <button class="btn btn-d btn-xs" onclick="delSess('${sess.id}')">✕</button>
            </td>`;
        tb.appendChild(tr);
    });
    document.getElementById('sto-count').textContent = `${rows.length} sessioni`;
}

export function editReply(id) {
    const s = DB.sessions.find(x => x.id === id);
    if (!s) return;
    window._replySessionId = id;
    document.getElementById('mr-notes').textContent = s.notes || '—';
    document.getElementById('mr-reply').value = s.reply || '';
    openMo('mo-reply');
}

export async function saveReply() {
    const id = window._replySessionId;
    const s = DB.sessions.find(x => x.id === id);
    if (!s) return;
    const r = document.getElementById('mr-reply').value;
    s.reply = r;
    closeMo('mo-reply');
    await saveDB(); renderStorico();
    toast('Sincronizzazione risposta in corso...');
    try {
        if (window.mySupabase) {
            const { error } = await window.mySupabase.from('sessions').update({ reply: r }).eq('id', id);
            toast(error ? '⚠️ Errore di rete: salvata solo in locale.' : "Risposta inviata all'atleta! ✓");
        }
    } catch (e) { toast('⚠️ Errore di connessione.'); }
}

export async function delSess(id) {
    if (!confirm('Eliminare definitivamente questa sessione?')) return;
    DB.sessions = DB.sessions.filter(x => x.id !== id);
    await saveDB(); renderStorico(); renderAnalytics();
    try {
        if (window.mySupabase) {
            const { error } = await window.mySupabase.from('sessions').delete().eq('id', id);
            toast(error ? '⚠️ Cancellata solo in locale.' : 'Sessione eliminata dal Cloud! ✓');
        }
    } catch (e) { toast('⚠️ Errore di connessione.'); }
}

export async function saveSess() {
    const a   = document.getElementById('ms-ath').value  || appState.selAthId;
    const d   = document.getElementById('ms-date').value || new Date().toISOString().slice(0, 10);
    const sn  = document.getElementById('ms-sess').value || 'Sessione Generica';
    const w   = parseInt(document.getElementById('ms-week').value)  || 1;
    const ph  = document.getElementById('ms-phase').value           || 'Accumulo';
    const vol = parseInt(document.getElementById('ms-vol').value)   || 0;
    const rpe = parseFloat(document.getElementById('ms-rpe').value) || 8;

    const sessObj = {
        id: 'sess_' + uid(), athlete: a, date: d, session: sn, sessionType: 'Palestra',
        week: w, phase: ph,
        readiness: parseInt(document.getElementById('ms-r').value)   || 80,
        vol, sRPE: vol > 0 ? rpe * 60 : 0, rpe,
        qual:     parseInt(document.getElementById('ms-q').value)    || 3,
        hrv: 0,
        maxE1rm:  parseInt(document.getElementById('ms-int').value)  || 0,
        e1rmDom: 0, e1rmNDom: 0,
        doms:   document.getElementById('ms-doms').value  || '',
        flag:   document.getElementById('ms-flag').value  || '',
        notes:  document.getElementById('ms-notes').value || '',
        reply:  document.getElementById('ms-reply').value || ''
    };

    DB.sessions.push(sessObj);
    await saveDB(); renderStorico(); closeMo('mo-sess'); toast('Sessione salvata!');
    try {
        if (window.mySupabase) {
            const cloud = { ...sessObj, athlete_id: a, session_name: sn, session_type: 'Palestra', max_e1rm: sessObj.maxE1rm, e1rm_dom: 0, e1rm_ndom: 0 };
            await window.mySupabase.from('sessions').upsert([cloud]);
        }
    } catch (e) { console.error(e); }
}


// ─────────────────────────────────────────────────────────────
// EDITOR SCHEDE
// ─────────────────────────────────────────────────────────────
export function renderEditor() {
    const athId = document.getElementById('ed-ath').value || appState.selAthId;
    if (athId) document.getElementById('ed-ath').value = athId;
    const sch = DB.schedules[athId];
    if (!sch) return;

    document.getElementById('ed-meso').value      = sch.meso      || 'Meso 1';
    document.getElementById('ed-duration').value  = sch.duration  || 4;
    document.getElementById('ed-phase').value     = sch.phase     || 'Accumulo';
    document.getElementById('ed-coachnote').value = sch.coachNote || '';
    document.getElementById('ed-obj').value       = sch.objective || '';

    const tabsWrap = document.getElementById('ed-tabs');
    tabsWrap.innerHTML = '';
    if (!sch.sessions || sch.sessions.length === 0) sch.sessions = [{ id: uid(), name: 'Seduta A', exercises: [] }];
    if (!appState.edSessId || !sch.sessions.find(x => x.id === appState.edSessId)) {
        appState.edSessId = sch.sessions[0].id;
    }

    sch.sessions.forEach(s => {
        const b = document.createElement('button');
        b.className = 'sess-tab' + (s.id === appState.edSessId ? ' on' : '');
        b.textContent = s.name;
        b.onclick = () => { appState.edSessId = s.id; renderEditor(); };
        tabsWrap.appendChild(b);
    });

    const curSess = sch.sessions.find(x => x.id === appState.edSessId) || sch.sessions[0];
    if (curSess) {
        appState.edSessId = curSess.id;
        document.getElementById('ed-session-details-card').style.display = 'block';
        document.getElementById('ed-sess-name').value = curSess.name;
        document.getElementById('ed-sess-label').textContent = `Esercizi — ${curSess.name}`;
    }
    renderEdExercises();
}

export function loadEditorForAthlete() {
    const athId = document.getElementById('ed-ath').value;
    const sch   = DB.schedules[athId];
    appState.edSessId = (sch && sch.sessions && sch.sessions.length > 0) ? sch.sessions[0].id : '';
    renderEditor();
}

export function syncEdDuration(val) {
    const athId = document.getElementById('ed-ath').value || appState.selAthId;
    const sch   = DB.schedules[athId];
    if (!sch || !Number.isFinite(val) || val < 1) return;
    sch.duration = val; saveDB();
}

export function syncEdCoachNote(val) {
    const athId = document.getElementById('ed-ath').value || appState.selAthId;
    const sch   = DB.schedules[athId];
    if (!sch) return;
    sch.coachNote = val; saveDB();
}

export async function addNewSessionToSchedule() {
    const athId = document.getElementById('ed-ath').value || appState.selAthId;
    const sch   = DB.schedules[athId];
    if (!sch) return;
    const newSess = { id: uid(), name: `Nuova Seduta ${sch.sessions.length + 1}`, exercises: [] };
    sch.sessions.push(newSess);
    appState.edSessId = newSess.id;
    await saveDB(); renderEditor();
}

export function renameCurrentSession(newName) {
    const sch     = DB.schedules[document.getElementById('ed-ath').value || appState.selAthId];
    const curSess = sch.sessions.find(x => x.id === appState.edSessId);
    if (curSess) {
        curSess.name = newName || 'Senza nome';
        document.getElementById('ed-sess-label').textContent = `Esercizi — ${curSess.name}`;
        const tab = document.querySelector('.sess-tab.on');
        if (tab) tab.textContent = curSess.name;
    }
}

export async function deleteCurrentSession() {
    const athId = document.getElementById('ed-ath').value || appState.selAthId;
    const sch   = DB.schedules[athId];
    if (sch.sessions.length <= 1) { toast('Devi mantenere almeno una sessione.'); return; }
    if (!confirm('Eliminare la sessione?')) return;
    sch.sessions = sch.sessions.filter(x => x.id !== appState.edSessId);
    appState.edSessId = sch.sessions[0].id;
    await saveDB(); renderEditor();
}

export function getEdExercises() {
    const athId = document.getElementById('ed-ath').value || appState.selAthId;
    const sch   = DB.schedules[athId];
    if (!sch) return [];
    const curSess = sch.sessions.find(x => x.id === appState.edSessId);
    return curSess ? curSess.exercises : [];
}

export function renderEdExercises() {
    const exs  = getEdExercises();
    const wrap = document.getElementById('ed-exercises');
    wrap.innerHTML = '';

    let _dl = document.getElementById('exercises-pool');
    if (!_dl) { _dl = document.createElement('datalist'); _dl.id = 'exercises-pool'; document.body.appendChild(_dl); }
    _dl.innerHTML = EXERCISE_LIBRARY.map(ex => `<option value="${ex.name}"></option>`).join('');

    if (!exs.length) { wrap.innerHTML = '<div style="color:var(--muted);padding:14px;text-align:center">Nessun esercizio presente.</div>'; return; }

    const typeColors = { normal:'var(--teal)', 'max effort':'var(--coral)', 'dynamic effort':'var(--blue)', repetition:'var(--teal)', superset:'var(--purple)', tempo:'#fbbf24', amrap:'var(--blue)', hiit:'#fbbf24', 'jump set':'#ff7a55' };
    const sezioni = [
        { id:'warmup',   label:'🔥 WARM-UP & ATTIVAZIONE NEURALE / PREVENZIONE' },
        { id:'centrale', label:'🏋️‍♂️ PARTE CENTRALE (PERFORMANCE & CARICO FISSI)' },
        { id:'cooldown', label:'🧊 COOL-DOWN & DECONGESTIONAMENTO / MOBILITÀ' }
    ];

    const _edGroupIds = [];
    exs.forEach(e => {
        if ((e.type === 'superset' || e.type === 'jump set') && e.groupId && !_edGroupIds.includes(e.groupId)) _edGroupIds.push(e.groupId);
    });
    const _edGLetter = gid => { if (!gid) return '—'; const idx = _edGroupIds.indexOf(gid); return idx >= 0 ? String.fromCharCode(65 + idx) : '?'; };

    sezioni.forEach(sez => {
        const filteredExs = exs.map((ex, originalIndex) => ({ ex, originalIndex })).filter(item => (item.ex.section || 'centrale') === sez.id);
        if (!filteredExs.length) return;

        wrap.innerHTML += `<div style="margin:20px 0 10px 0;padding:6px 12px;background:rgba(255,255,255,.02);border-radius:6px;border-left:3px solid var(--muted);">
            <span style="font-size:11px;font-weight:800;letter-spacing:.05em;color:var(--text);opacity:.8;">${sez.label}</span></div>`;

        filteredExs.forEach(({ ex, originalIndex: i }) => {
            if (ex.type === 'circuit') {
                const meta    = ex.circuitMeta    || { workTime: 40, restBetweenEx: 20, restBetweenRounds: 120, rounds: 3 };
                const circExs = ex.circuitExercises || [];

                const circExsHtml = circExs.map((ce, exIdx) => `
                    <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;flex-wrap:wrap;">
                        <span style="color:var(--amber);font-weight:700;font-size:11px;min-width:18px;">${exIdx + 1}.</span>
                        <input type="text" value="${(ce.name || '').replace(/"/g, '&quot;')}" placeholder="Nome esercizio" style="flex:2;font-size:11px;min-width:120px;" oninput="updateCircuitEx(${i},${exIdx},'name',this.value)">
                        <input type="text" value="${(ce.video || '').replace(/"/g, '&quot;')}" placeholder="Link Video YT" style="flex:1.5;font-size:11px;min-width:90px;" oninput="updateCircuitEx(${i},${exIdx},'video',this.value)">
                        <input type="text" value="${(ce.note || '').replace(/"/g, '&quot;')}" placeholder="Note (opz.)" style="flex:1;font-size:11px;min-width:80px;" oninput="updateCircuitEx(${i},${exIdx},'note',this.value)">
                        <button onclick="removeCircuitEx(${i},${exIdx})" style="background:none;border:1px solid var(--coral-d);color:var(--coral);padding:3px 8px;border-radius:6px;font-size:10px;cursor:pointer;flex-shrink:0;">✕</button>
                    </div>`).join('');

                const circDiv = document.createElement('div');
                circDiv.innerHTML = `
                  <div style="background:rgba(251,191,36,0.05);border:2px solid rgba(251,191,36,0.28);border-radius:10px;padding:12px;margin-bottom:8px;position:relative;">
                    <div style="display:flex;gap:6px;margin-bottom:10px;align-items:center;flex-wrap:wrap;">
                      <div style="display:flex;flex-direction:column;gap:2px;flex-shrink:0;">
                        <button onclick="moveExercise(${i},-1)" ${i===0?'disabled':''} style="background:${i===0?'var(--s1)':'var(--s2)'};border:1px solid var(--border);border-radius:4px;color:${i===0?'var(--muted)':'var(--amber)'};font-size:11px;padding:2px 6px;cursor:${i===0?'default':'pointer'};line-height:1;opacity:${i===0?'0.35':'1'}">▲</button>
                        <button onclick="moveExercise(${i}, 1)" ${i===exs.length-1?'disabled':''} style="background:${i===exs.length-1?'var(--s1)':'var(--s2)'};border:1px solid var(--border);border-radius:4px;color:${i===exs.length-1?'var(--muted)':'var(--amber)'};font-size:11px;padding:2px 6px;cursor:${i===exs.length-1?'default':'pointer'};line-height:1;opacity:${i===exs.length-1?'0.35':'1'}">▼</button>
                      </div>
                      <input type="text" value="${escHtml(ex.name || 'Circuito a Tempo')}" placeholder="Nome circuito" style="flex:2;font-weight:700;color:var(--amber);" oninput="updateEx(${i},'name',this.value)">
                      <select style="width:120px;font-size:11px;padding:5px;border-radius:8px;background:var(--s1);color:var(--amber);font-weight:700;" onchange="updateEx(${i},'section',this.value);renderEdExercises();">
                        <option value="warmup" ${ex.section==='warmup'?'selected':''}>🔥 Warm-up</option>
                        <option value="centrale" ${!ex.section||ex.section==='centrale'?'selected':''}>🏋️‍♂️ Centrale</option>
                        <option value="cooldown" ${ex.section==='cooldown'?'selected':''}>🧊 Cool-down</option>
                      </select>
                      <span style="padding:3px 10px;background:rgba(251,191,36,0.15);color:var(--amber);border-radius:6px;font-size:10px;font-weight:800;letter-spacing:0.3px;flex-shrink:0;">⏱ CIRCUITO</span>
                      <button class="btn btn-d btn-xs" onclick="delExConfirm(${i})">✕</button>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px;padding:8px;background:rgba(0,0,0,0.2);border-radius:8px;border:1px dashed rgba(251,191,36,0.2);">
                      <div><span class="fl" style="color:var(--amber)!important;">LAVORO</span><input type="number" value="${meta.workTime}" placeholder="40" oninput="updateCircuitMeta(${i},'workTime',this.value)"><span style="font-size:9px;color:var(--muted);display:block;text-align:center;margin-top:2px;">secondi</span></div>
                      <div><span class="fl" style="color:var(--muted)!important;">REST ES.</span><input type="number" value="${meta.restBetweenEx}" placeholder="20" oninput="updateCircuitMeta(${i},'restBetweenEx',this.value)"><span style="font-size:9px;color:var(--muted);display:block;text-align:center;margin-top:2px;">secondi</span></div>
                      <div><span class="fl" style="color:var(--muted)!important;">REST GIRO</span><input type="number" value="${meta.restBetweenRounds}" placeholder="120" oninput="updateCircuitMeta(${i},'restBetweenRounds',this.value)"><span style="font-size:9px;color:var(--muted);display:block;text-align:center;margin-top:2px;">secondi</span></div>
                      <div><span class="fl" style="color:var(--teal)!important;">GIRI</span><input type="number" value="${meta.rounds}" placeholder="3" oninput="updateCircuitMeta(${i},'rounds',this.value)"><span style="font-size:9px;color:var(--muted);display:block;text-align:center;margin-top:2px;">round</span></div>
                    </div>
                    <div>
                      <span style="font-size:11px;font-weight:800;color:var(--amber);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:6px;">Esercizi del Circuito</span>
                      ${circExsHtml || '<div style="font-size:11px;color:var(--muted);font-style:italic;padding:4px 0;">Nessun esercizio.</div>'}
                      <button onclick="addCircuitEx(${i})" style="width:100%;padding:6px;margin-top:6px;background:rgba(251,191,36,0.08);border:1px dashed rgba(251,191,36,0.3);color:var(--amber);border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">+ Aggiungi Esercizio al Circuito</button>
                    </div>
                  </div>`;
                wrap.appendChild(circDiv);
                return;
            }

            const currentType = (ex.type || 'normal').toLowerCase();
            const borderColor = typeColors[currentType] || 'var(--teal)';

            let groupRowHtml = '';
            if (currentType === 'superset' || currentType === 'jump set') {
                const sameTypeGroupIds = _edGroupIds.filter(gid => exs.some(e => e.groupId === gid && (e.type || 'normal').toLowerCase() === currentType));
                const curLetterDisplay = _edGLetter(ex.groupId);
                const groupBtns = sameTypeGroupIds.map(gid => {
                    const letter = _edGLetter(gid); const isActive = ex.groupId === gid;
                    return `<button onclick="linkToGroup(${i},'${gid}')" style="padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;cursor:pointer;background:${isActive?'var(--purple)':'var(--s1)'};color:${isActive?'#fff':'var(--muted)'};border:1px solid ${isActive?'var(--purple)':'var(--border)'};">Gr. ${letter}</button>`;
                }).join('');
                groupRowHtml = `
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px;padding:5px 8px;background:rgba(139,92,246,0.06);border-radius:6px;border:1px dashed rgba(139,92,246,0.2);">
                    <span style="font-size:10px;font-weight:700;color:var(--purple);text-transform:uppercase;letter-spacing:0.5px;flex-shrink:0;">🔗 Gruppo</span>
                    <span style="font-size:11px;font-weight:800;padding:2px 8px;border-radius:4px;background:${ex.groupId?'var(--purple-d)':'var(--s1)'};color:${ex.groupId?'var(--purple)':'var(--muted)'};">${curLetterDisplay}</span>
                    ${groupBtns}
                    <button onclick="linkToGroup(${i}, uid())" style="padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;cursor:pointer;background:var(--s1);color:var(--teal);border:1px solid var(--teal);">+ Nuovo</button>
                  </div>`;
            }

            const div = document.createElement('div');
            div.style.cssText = `background:var(--s2);border-radius:8px;padding:10px 12px;margin-bottom:8px;border-left:4px solid ${borderColor} !important;`;
            div.innerHTML = `
              <div style="display:flex;gap:6px;margin-bottom:8px;align-items:center;flex-wrap:wrap;">
                <div style="display:flex;flex-direction:column;gap:2px;flex-shrink:0;">
                  <button onclick="moveExercise(${i},-1)" ${i===0?'disabled':''} style="background:${i===0?'var(--s1)':'var(--s2)'};border:1px solid var(--border);border-radius:4px;color:${i===0?'var(--muted)':'var(--teal)'};font-size:11px;padding:2px 6px;cursor:${i===0?'default':'pointer'};line-height:1;opacity:${i===0?'0.35':'1'}">▲</button>
                  <button onclick="moveExercise(${i}, 1)" ${i===exs.length-1?'disabled':''} style="background:${i===exs.length-1?'var(--s1)':'var(--s2)'};border:1px solid var(--border);border-radius:4px;color:${i===exs.length-1?'var(--muted)':'var(--teal)'};font-size:11px;padding:2px 6px;cursor:${i===exs.length-1?'default':'pointer'};line-height:1;opacity:${i===exs.length-1?'0.35':'1'}">▼</button>
                </div>
                <input type="text" value="${escHtml(ex.name)}" placeholder="Nome esercizio" style="flex:2;font-weight:700" list="exercises-pool" oninput="updateEx(${i},'name',this.value)" onchange="handleExNameChange(${i}, this.value)">
                <select style="width:120px;font-size:11px;padding:5px;border-radius:8px;background:var(--s1);color:var(--teal);font-weight:700;" onchange="updateEx(${i},'section',this.value);renderEdExercises();">
                  <option value="warmup" ${ex.section==='warmup'?'selected':''}>🔥 Warm-up</option>
                  <option value="centrale" ${!ex.section||ex.section==='centrale'?'selected':''}>🏋️‍♂️ Centrale</option>
                  <option value="cooldown" ${ex.section==='cooldown'?'selected':''}>🧊 Cool-down</option>
                </select>
                <select style="width:110px;font-size:11px;padding:5px;border-radius:8px;border:1px solid var(--border);background:var(--s1);color:var(--text)" onchange="updateEx(${i},'arm',this.value)">
                  <option value="Bi" ${!ex.arm||ex.arm==='Bi'?'selected':''}>Bilaterale</option>
                  <option value="Dom" ${ex.arm==='Dom'?'selected':''}>Dominante</option>
                  <option value="NDom" ${ex.arm==='NDom'?'selected':''}>Non-Dom</option>
                </select>
                <input type="url" value="${ex.ytUrl||''}" placeholder="Link Video" style="flex:1.5;font-size:11px" oninput="updateEx(${i},'ytUrl',this.value)">
                <button class="btn-prog" onclick="openProgressionModal(${i})">⚙️ Progressione</button>
                <button class="btn btn-d btn-xs" onclick="delExConfirm(${i})">✕</button>
              </div>
              <div style="display:grid;grid-template-columns:repeat(8,1fr);gap:4px">
                <div><span class="fl">W-SET</span><input type="number" value="${ex.wset||0}" oninput="updateEx(${i},'wset',+this.value)"></div>
                <div><span class="fl">SET</span>  <input type="number" value="${ex.set||3}" oninput="updateEx(${i},'set',+this.value)"></div>
                <div><span class="fl">REP</span>  <input type="text" value="${ex.rep||8}" oninput="updateEx(${i},'rep',this.value)"></div>
                <div><span class="fl">KG/m/s</span><input type="text" value="${ex.kg||0}" oninput="updateEx(${i},'kg',this.value)"></div>
                <div><span class="fl">RIR</span>
                  <select onchange="updateEx(${i},'rir',this.value)">
                    <option ${ex.rir==='0'?'selected':''}>0</option><option ${ex.rir==='1'?'selected':''}>1</option>
                    <option ${ex.rir==='2'?'selected':''}>2</option><option ${ex.rir==='3'?'selected':''}>3</option>
                    <option ${ex.rir==='—'?'selected':''}>—</option>
                  </select></div>
                <div><span class="fl">REST</span><input type="text" value="${ex.rest||"90''"}" oninput="updateEx(${i},'rest',this.value)"></div>
                <div><span class="fl">T.U.T.</span><input type="text" value="${ex.tut||'-'}" oninput="updateEx(${i},'tut',this.value)"></div>
                <div><span class="fl">ZONA</span>
                  <select onchange="updateEx(${i},'anatomicalZone',this.value)">
                    <option value="" ${!ex.anatomicalZone?'selected':''}>Nessuna</option>
                    <option value="Spalla_SX" ${ex.anatomicalZone==='Spalla_SX'?'selected':''}>Spalla SX</option>
                    <option value="Spalla_DX" ${ex.anatomicalZone==='Spalla_DX'?'selected':''}>Spalla DX</option>
                    <option value="Gomito_SX" ${ex.anatomicalZone==='Gomito_SX'?'selected':''}>Gomito SX</option>
                    <option value="Gomito_DX" ${ex.anatomicalZone==='Gomito_DX'?'selected':''}>Gomito DX</option>
                    <option value="Zona_Lombare" ${ex.anatomicalZone==='Zona_Lombare'?'selected':''}>Z. Lombare</option>
                    <option value="Ginocchio_SX" ${ex.anatomicalZone==='Ginocchio_SX'?'selected':''}>Ginocchio SX</option>
                    <option value="Ginocchio_DX" ${ex.anatomicalZone==='Ginocchio_DX'?'selected':''}>Ginocchio DX</option>
                    <option value="Caviglia_SX" ${ex.anatomicalZone==='Caviglia_SX'?'selected':''}>Caviglia SX</option>
                    <option value="Caviglia_DX" ${ex.anatomicalZone==='Caviglia_DX'?'selected':''}>Caviglia DX</option>
                  </select></div>
              </div>
              ${groupRowHtml}
              <input type="text" value="${ex.note||''}" placeholder="Note / CUE d'esecuzione" style="width:100%;font-size:11px;margin-top:6px;color:var(--purple)" oninput="updateEx(${i},'note',this.value)">`;
            wrap.appendChild(div);
        });
    });
    updatePredictiveACWR();
}

export function updateEx(i, field, val) { const exs = getEdExercises(); if (exs[i]) exs[i][field] = val; updatePredictiveACWR(); }

export function linkToGroup(exIdx, groupId) {
    const exs = getEdExercises();
    if (!exs[exIdx]) return;
    exs[exIdx].groupId = groupId; renderEdExercises();
}

export function addExType(type) {
    const defaults = {
        'max effort':     { set:3, rep:'3', rir:'0', rest:"180''", tut:'-' },
        'dynamic effort': { set:8, rep:'2', rir:'—', rest:"45''",  tut:'Max Velocità' },
        'repetition':     { set:3, rep:'10',rir:'1', rest:"90''",  tut:'-' },
        'tempo':          { set:3, rep:'6', rir:'2', rest:"90''",  tut:'4.0.X.0' }
    };
    const d = defaults[type] || { set:3, rep:'8', rir:'2', rest:"90''", tut:'-' };
    const newEx = { name:`Focus ${type.toUpperCase()}`, type, arm:'Bi', wset:1, set:d.set, rep:d.rep, kg:0, rir:d.rir, rest:d.rest, tut:d.tut, note:'', ytUrl:'', anatomicalZone:'' };
    if (type === 'superset' || type === 'jump set') newEx.groupId = uid();
    getEdExercises().push(newEx);
    renderEdExercises(); updatePredictiveACWR();
}

export function delExConfirm(i) { getEdExercises().splice(i, 1); renderEdExercises(); }

export async function handleExNameChange(exIdx, newName) {
    const sess = DB.schedules[appState.selAthId].sessions.find(s => s.id === appState.edSessId);
    if (!sess) return;
    sess.exercises[exIdx].name = newName;
    const match = EXERCISE_LIBRARY.find(e => e.name.trim().toLowerCase() === newName.trim().toLowerCase());
    sess.exercises[exIdx].trackE1rm = match ? match.trackE1rm : false;
    await saveDB();
}

export function moveExercise(i, dir) {
    const exs = getEdExercises(); const j = i + dir;
    if (j < 0 || j >= exs.length) return;
    [exs[i], exs[j]] = [exs[j], exs[i]]; renderEdExercises();
}

export function addCircuit() {
    getEdExercises().push({
        type: 'circuit', name: 'Circuito a Tempo', section: 'centrale',
        circuitMeta: { workTime: 40, restBetweenEx: 20, restBetweenRounds: 120, rounds: 3 },
        circuitExercises: [{ name: 'Esercizio 1', note: '' }, { name: 'Esercizio 2', note: '' }],
        arm: 'Bi', wset: 0, set: 0, rep: 0, kg: 0, rir: '—', rest: '0', tut: '-', note: '', anatomicalZone: ''
    });
    renderEdExercises();
}

export function addCircuitEx(circuitIdx) {
    const exs = getEdExercises();
    if (!exs[circuitIdx] || exs[circuitIdx].type !== 'circuit') return;
    exs[circuitIdx].circuitExercises.push({ name: 'Nuovo esercizio', note: '' }); renderEdExercises();
}

export function removeCircuitEx(circuitIdx, exIdx) {
    const exs = getEdExercises();
    if (!exs[circuitIdx] || !exs[circuitIdx].circuitExercises) return;
    exs[circuitIdx].circuitExercises.splice(exIdx, 1); renderEdExercises();
}

export function updateCircuitMeta(circuitIdx, field, val) {
    const exs = getEdExercises();
    if (!exs[circuitIdx] || !exs[circuitIdx].circuitMeta) return;
    exs[circuitIdx].circuitMeta[field] = +val;
}

export function updateCircuitEx(circuitIdx, exIdx, field, val) {
    const exs = getEdExercises();
    if (!exs[circuitIdx] || !exs[circuitIdx].circuitExercises || !exs[circuitIdx].circuitExercises[exIdx]) return;
    exs[circuitIdx].circuitExercises[exIdx][field] = val;
}

export function openProgressionModal(index) {
    appState.currentProgExIndex = index;
    const athId    = document.getElementById('ed-ath').value || appState.selAthId;
    const sch      = DB.schedules[athId];
    const maxWeeks = sch ? (sch.duration || 4) : 4;
    const ex       = getEdExercises()[index];
    if (!ex.progression) ex.progression = {};
    for (let w = 1; w <= maxWeeks; w++) {
        if (!ex.progression[`w${w}`]) ex.progression[`w${w}`] = { set: ex.set || 3, rep: ex.rep || 8, kg: ex.kg || 0 };
    }
    document.getElementById('prog-title').textContent = `Progressione: ${ex.name}`;
    const container = document.getElementById('prog-inputs-container');
    container.innerHTML = '';
    for (let w = 1; w <= maxWeeks; w++) {
        const p = ex.progression[`w${w}`];
        container.innerHTML += `
          <div style="background:var(--s2);border:1px solid var(--border);padding:10px;border-radius:8px;margin-bottom:6px;">
            <span style="font-size:11px;color:var(--teal);font-weight:700;display:block;margin-bottom:6px;">SETTIMANA ${w}</span>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
              <div><label class="fl">Set</label><input type="number" id="p-set-${w}" value="${p.set}"></div>
              <div><label class="fl">Rep</label><input type="text" id="p-rep-${w}" value="${p.rep}"></div>
              <div><label class="fl">Kg</label><input type="number" step=".5" id="p-kg-${w}" value="${p.kg}"></div>
            </div>
          </div>`;
    }
    openMo('mo-prog');
}

export async function saveProgressionData() {
    if (appState.currentProgExIndex === null) return;
    const athId    = document.getElementById('ed-ath').value || appState.selAthId;
    const maxWeeks = DB.schedules[athId] ? (DB.schedules[athId].duration || 4) : 4;
    const ex       = getEdExercises()[appState.currentProgExIndex];
    ex.progression = {};
    for (let w = 1; w <= maxWeeks; w++) {
        ex.progression[`w${w}`] = {
            set: parseInt(document.getElementById(`p-set-${w}`).value) || ex.set,
            rep: document.getElementById(`p-rep-${w}`).value           || ex.rep,
            kg:  parseFloat(document.getElementById(`p-kg-${w}`).value)|| ex.kg
        };
    }
    await saveDB(); renderEdExercises(); closeMo('mo-prog'); toast('Progressione salvata! ✓');
}

export function applySmartMicrocycle(type) {
    if (type === 'manual' || appState.currentProgExIndex === null) return;
    const athId    = document.getElementById('ed-ath').value || appState.selAthId;
    const sch      = DB.schedules[athId];
    const maxWeeks = sch ? (sch.duration || 4) : 4;
    const ex       = getEdExercises()[appState.currentProgExIndex];

    const baseSet    = parseInt(ex.set)  || 3;
    const baseRepNum = parseInt(ex.rep)  || 8;
    const baseRepStr = ex.rep            || '8';
    const baseKg     = parseFloat(ex.kg) || 0;

    for (let w = 1; w <= maxWeeks; w++) {
        let tSet = baseSet, tRep = baseRepStr, tKg = baseKg;

        if (type === 'hyper_block_dup') {
            if (w === 1)      { tSet = baseSet;       tRep = baseRepNum;       tKg = baseKg * 0.70; }
            else if (w === 2) { tSet = baseSet + 1;   tRep = baseRepNum;       tKg = baseKg * 0.75; }
            else if (w === 3) { tSet = baseSet + 2;   tRep = baseRepNum;       tKg = baseKg * 0.80; }
            else              { tSet = Math.max(1, baseSet - 1); tRep = Math.max(1, baseRepNum - 2); tKg = baseKg * 0.70; }
        } else if (type === 'hyper_stretch') {
            tSet = baseSet; tKg = baseKg * (0.70 + 0.025 * (w - 1));
            if (w === maxWeeks && maxWeeks > 2) { tSet = Math.max(1, baseSet - 1); tRep = baseRepNum; }
            else { tRep = baseRepNum + ' (+ 4/5 Parziali in Allungamento)'; }
        } else if (type === 'hyper_metabolic') {
            tSet = 1; tKg = baseKg * (0.65 + 0.02 * (w - 1));
            if (w === maxWeeks && maxWeeks > 2) { tSet = baseSet; tRep = baseRepNum; tKg = baseKg * 0.60; }
            else { const activation = Math.max(12, baseRepNum * 2); const cluster = Math.round(baseRepNum / 2) || 3; tRep = `${activation} + ${cluster} + ${cluster} + ${cluster} (15" rest)`; }
        } else if (type === 'block_period') {
            const pct = w / maxWeeks;
            if (pct <= 0.50)      { tSet = baseSet; tRep = Math.max(8, baseRepNum); tKg = baseKg * (0.65 + 0.04 * (w - 1)); }
            else if (pct <= 0.80) { tSet = baseSet; tRep = Math.max(3, baseRepNum - 3); const lW = w - Math.floor(maxWeeks * 0.50); tKg = baseKg * (0.80 + 0.03 * (lW - 1)); }
            else                  { tSet = Math.max(1, baseSet - 1); tRep = '2'; tKg = baseKg * 0.60; }
        } else if (type === 'double_prog')    { tRep = w < maxWeeks ? baseRepNum + (w - 1) : baseRepNum; if (w === maxWeeks) tKg = baseKg * 1.05; }
        else if (type === 'overreach')        { tSet = w < maxWeeks ? baseSet + (w - 1) : Math.max(1, baseSet - 1); }
        else if (type === 'lin_taper')        { if (w > 1) { tRep = Math.max(1, baseRepNum - (w-1)); tKg = baseKg * (1 + 0.05 * (w-1)); if (w === maxWeeks) tSet = Math.max(1, baseSet - 1); } }
        else if (type === 'step_load')        { tKg = baseKg * (1 + 0.05 * Math.floor((w - 1) / 2)); }
        else if (type === 'wave_contrast')    { if (w % 2 === 0) { tKg = baseKg * 0.80; tRep = baseRepStr; } else { tKg = baseKg * (1 + 0.05 * Math.floor(w / 2)); } }
        else if (type === 'french_contrast')  {
            const ts = Math.min(4, Math.max(3, baseSet)); const tr = Math.min(4, baseRepNum);
            if (w === 1)      { tSet = ts; tRep = tr;                    tKg = baseKg * 0.80; }
            else if (w === 2) { tSet = ts; tRep = Math.max(1, tr - 1);  tKg = baseKg * 0.85; }
            else if (w === 3) { tSet = Math.max(2, ts - 1); tRep = Math.max(1, tr - 2); tKg = baseKg * 0.90; }
            else              { tSet = 2;  tRep = 2;                     tKg = baseKg * 0.70; }
        } else if (type === 'cluster') { if (baseRepNum >= 4) { const m = Math.round(baseRepNum / 3) || 1; tRep = `${m}.${m}.${m}`; } if (w === maxWeeks && maxWeeks > 2) tKg = baseKg * 1.05; }
        else if (type === 'wave_load') { tSet = Math.max(3, baseSet); tRep = '3, 2, 1'; tKg = baseKg * (0.80 + 0.025 * (w - 1)); }
        else if (type === 'myo_reps') { tSet = 1; const act = baseRepNum * 2; const cl = Math.round(baseRepNum / 2) || 3; tRep = `${act} + ${cl} + ${cl} + ${cl}`; tKg = baseKg * (0.65 + 0.02 * (w - 1)); }
        else if (type === 'wup') {
            const ph = (w - 1) % 3;
            if (ph === 0) { tSet = Math.max(3, baseSet); tRep = 8; tKg = baseKg * 0.70; }
            else if (ph === 1) { tSet = Math.max(4, baseSet + 1); tRep = 3; tKg = baseKg * 0.88; }
            else { tSet = Math.max(5, baseSet + 2); tRep = 2; tKg = baseKg * 0.50; }
        } else if (type === 'triphasic') {
            tSet = baseSet;
            if (w === 1) tRep = baseRepNum + ' (Eccentrica 5s)';
            else if (w === 2) tRep = baseRepNum + ' (Isometria 3s al parallelo)';
            else if (w === 3) tRep = baseRepNum + ' (Super Esplosivo)';
            else tRep = baseRepNum;
            tKg = baseKg * (0.80 + 0.025 * (w - 1));
        }

        if (typeof tKg === 'number' && tKg > 0) tKg = Math.round(tKg / 2.5) * 2.5;
        const si = document.getElementById(`p-set-${w}`); if (si) si.value = tSet;
        const ri = document.getElementById(`p-rep-${w}`); if (ri) ri.value = tRep;
        const ki = document.getElementById(`p-kg-${w}`);  if (ki && tKg > 0) ki.value = tKg;
    }
    toast('🤖 Algoritmo Elite Applicato!');
    document.getElementById('smart-prog-select').value = 'manual';
}

export function updatePredictiveACWR() {
    const athId = document.getElementById('ed-ath').value || appState.selAthId;
    const badge = document.getElementById('ed-pred-acwr');
    if (!badge || !athId) return;

    const exs = getEdExercises();
    let projectedVol = 0;
    exs.forEach(ex => { projectedVol += (parseInt(ex.set)||0) * (parseInt(ex.rep)||0) * (parseFloat(ex.kg)||0); });

    if (projectedVol === 0) { badge.innerHTML = `<span style="font-size:10px;color:var(--muted)">In attesa di carico...</span>`; return; }

    const hist = DB.sessions.filter(x => x.athlete === athId).sort((a,b) => new Date(a.date) - new Date(b.date));
    if (hist.length < 6) { badge.innerHTML = `<span style="font-size:11px;color:var(--muted);border:1px solid var(--border);padding:4px 8px;border-radius:6px;">Vol. Proiettato: ${(projectedVol/1000).toFixed(1)}k (Storico insufficiente)</span>`; return; }

    const αA = 0.33, αC = 0.05;
    let ewmaA = hist[0].vol, ewmaC = hist[0].vol;
    hist.forEach((s, i) => { if (!i) return; ewmaA = αA * s.vol + (1-αA) * ewmaA; ewmaC = αC * s.vol + (1-αC) * ewmaC; });
    ewmaA = αA * projectedVol + (1-αA) * ewmaA;
    ewmaC = αC * projectedVol + (1-αC) * ewmaC;
    const ratio = ewmaA / ewmaC;

    let color='var(--teal)', text='Ottimale', bg='rgba(16,185,129,.15)';
    if (ratio > 1.5)      { color='var(--coral)'; text='DANGER ZONE: Riduci Carico'; bg='rgba(239,68,68,.15)'; }
    else if (ratio > 1.3) { color='var(--amber)'; text='Rischio Moderato';            bg='rgba(245,158,11,.15)'; }
    else if (ratio < 0.8) { color='var(--amber)'; text='Scarico / Sotto-allenamento'; bg='rgba(245,158,11,.15)'; }

    badge.innerHTML = `<div style="background:${bg};color:${color};border:1px solid ${color};padding:4px 8px;border-radius:6px;font-size:11px;font-weight:800;display:inline-block;">ACWR Stimato: ${ratio.toFixed(2)} (${text})</div>`;
}

export async function saveSchedule() {
    const athId = document.getElementById('ed-ath').value || appState.selAthId;
    const sch   = DB.schedules[athId];
    if (!sch) return;

    sch.meso      = document.getElementById('ed-meso').value;
    sch.duration  = parseInt(document.getElementById('ed-duration').value) || sch.duration || 4;
    sch.phase     = document.getElementById('ed-phase').value;
    sch.coachNote = document.getElementById('ed-coachnote').value;
    sch.objective = document.getElementById('ed-obj').value;

    try {
        if (window.mySupabase && sch.sessions) {
            const { error: delErr } = await window.mySupabase.from('schedules').delete().eq('athlete_id', athId);
            if (delErr) throw delErr;
            for (const s of sch.sessions) {
                const { error } = await window.mySupabase.from('schedules').insert([{
                    id: s.id, athlete_id: athId, session_name: s.name,
                    meso: sch.meso, duration: sch.duration, phase: sch.phase,
                    coach_note: sch.coachNote, objective: sch.objective, exercises: s.exercises
                }]);
                if (error) throw error;
            }
            toast('Schede sincronizzate sul Cloud! ✓');
        }
    } catch (err) { console.error('Errore salvataggio schede:', err); }
    await saveDB();
}

export async function updatePhaseStyle(phase) {
    const athId = document.getElementById('ed-ath').value;
    const sch   = DB.schedules[athId];
    if (!sch) return;
    sch.phase = phase;
    if (phase === 'Scarico') {
        sch.sessions.forEach(s => s.exercises.forEach(ex => { ex.set = Math.max(1, Math.round(ex.set * 0.7)); }));
        toast('🟦 Fase Scarico: Volume ridotto e salvato sul Cloud!');
    }
    await saveDB(); renderEdExercises(); await saveSchedule();
}


// ─────────────────────────────────────────────────────────────
// POST-WORKOUT FEEDBACK
// ─────────────────────────────────────────────────────────────
export function calcSrpe() {
    const d = parseInt(document.getElementById('pw-dur').value) || 0;
    document.getElementById('pw-srpe-val').textContent = (d * (appState.pwRpe || 0)) + ' UA';
}

export function initFB() {
    const rw = document.getElementById('pw-rpe');
    if (!rw) return;
    rw.innerHTML = '';
    [6,7,8,9,10].forEach(v => {
        const b = document.createElement('button'); b.className = 'rpe-b'; b.textContent = v;
        b.onclick = () => {
            appState.pwRpe = v;
            document.querySelectorAll('.rpe-b').forEach(x => x.className = 'rpe-b');
            b.classList.add(v <= 7 ? 'ag' : v <= 8 ? 'aa' : 'ac');
            document.getElementById('pw-rpe-d').textContent = rpeDescs[v];
            calcSrpe();
        };
        rw.appendChild(b);
    });

    const sw = document.getElementById('pw-stars');
    if (!sw) return;
    sw.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const s = document.createElement('span'); s.className = 'star'; s.textContent = '★'; s.dataset.v = i;
        s.onclick = () => {
            appState.pwStars = i;
            document.querySelectorAll('#pw-stars .star').forEach(x => x.classList.toggle('on', +x.dataset.v <= i));
            document.getElementById('pw-star-d').textContent = starDescs[i];
        };
        sw.appendChild(s);
    }

    const mg = document.getElementById('pw-musc'); mg.innerHTML = '';
    ['Petto','Dorso','Spalle','Core','Quadricipiti','Femorali'].forEach(m => {
        const p = document.createElement('span'); p.className = 'pill'; p.textContent = m;
        p.onclick = () => p.classList.toggle('on-t'); mg.appendChild(p);
    });
    const fg = document.getElementById('pw-flags'); fg.innerHTML = '';
    ['Dolore o fastidio','Carico troppo alto','Variazioni'].forEach(f => {
        const p = document.createElement('span'); p.className = 'pill'; p.textContent = f;
        p.onclick = () => p.classList.toggle('on-a'); fg.appendChild(p);
    });

    document.getElementById('pw-dur').value = '';
    document.getElementById('pw-srpe-val').textContent = '0 UA';
}

export async function submitFB() {
    if (!appState.pwRpe) { toast('Seleziona RPE'); return; }

    const selectLiveSess = document.getElementById('lv-sess');
    const activeSessId   = selectLiveSess ? selectLiveSess.value : null;
    const sessionName    = selectLiveSess && selectLiveSess.options[selectLiveSess.selectedIndex]
        ? selectLiveSess.options[selectLiveSess.selectedIndex].text : 'Allenamento';

    const vol            = parseInt(document.getElementById('lv-vol').textContent.replace(/\./g,'')) || 0;
    const dur            = parseInt(document.getElementById('pw-dur').value) || 0;
    const sRPE           = dur * appState.pwRpe;
    const currentWeekNum = parseInt((document.getElementById('lv-week') || {}).value) || 1;
    const nextWeekNum    = currentWeekNum + 1;
    const sessType       = document.getElementById('pw-type') ? document.getElementById('pw-type').value : 'Palestra';
    const hrvVal         = document.getElementById('w-hrv') ? parseFloat(document.getElementById('w-hrv').value) || 0 : 0;
    const maxWeeks       = DB.schedules[appState.selAthId] ? (DB.schedules[appState.selAthId].duration || 4) : 4;

    const ath = athById(appState.selAthId);
    if (ath && DB.wellness.weight) {
        if (!ath.anthropoHistory) ath.anthropoHistory = [];
        ath.anthropoHistory.push({ date: new Date().toISOString().slice(0,10), weight: parseFloat(DB.wellness.weight), bf: parseFloat(DB.wellness.bf) || 0 });
    }

    if (activeSessId && window.carichiFuturi && nextWeekNum <= maxWeeks) {
        const sch = DB.schedules[appState.selAthId];
        if (sch && sch.sessions) {
            const curSess = sch.sessions.find(x => x.id === activeSessId);
            if (curSess && curSess.exercises) {
                let modified = false;
                curSess.exercises.forEach((ex, i) => {
                    const val = window.carichiFuturi[`${activeSessId}-${i}`];
                    if (!val || !val.trim()) return;
                    modified = true;
                    if (!ex.progression) { ex.progression = {}; for (let w=1;w<=maxWeeks;w++) ex.progression[`w${w}`]={set:ex.set,rep:ex.rep,kg:ex.kg}; }
                    let cur = ex.progression[`w${currentWeekNum}`] ? parseFloat(ex.progression[`w${currentWeekNum}`].kg)||0 : parseFloat(ex.kg)||0;
                    const inp = val.trim().replace(',','.').toLowerCase();
                    let nk = cur;
                    if (inp.startsWith('+')) nk = cur + (parseFloat(inp.slice(1))||0);
                    else if (inp.startsWith('-')) nk = Math.max(0, cur - (parseFloat(inp.slice(1))||0));
                    else { const dv = parseFloat(inp.replace(/[^0-9.]/g,'')); if (!isNaN(dv)) nk = dv; }
                    if (!ex.progression[`w${nextWeekNum}`]) ex.progression[`w${nextWeekNum}`]={set:ex.set,rep:ex.rep,kg:ex.kg};
                    ex.progression[`w${nextWeekNum}`].kg = Math.round(nk / 2.5) * 2.5;
                });
                if (modified && window.mySupabase) {
                    window.mySupabase.from('schedules').update({ exercises: curSess.exercises }).eq('id', curSess.id);
                }
            }
        }
    }

    window.carichiFuturi = {};
    localStorage.removeItem('coachOS_live_dots');

    const today       = new Date().toISOString().slice(0,10);
    const cleanDOMS   = [...document.querySelectorAll('#pw-musc .on-t')].map(x => x.textContent).join(' · ');
    const cleanFlags  = [...document.querySelectorAll('#pw-flags .on-a')].map(x => x.textContent).join(',');
    const cleanNotes  = 'NOTE: ' + document.getElementById('pw-notes').value;
    const generatedId = DB.sessions.find(s => s.athlete===appState.selAthId && s.session===sessionName && s.date===today)?.id || ('sess_'+uid());

    DB.sessions = DB.sessions.filter(s => !(s.athlete===appState.selAthId && s.session===sessionName && s.date===today));

    const sessObj = {
        id: generatedId, athlete: appState.selAthId, date: today,
        session: sessType==='Campo' ? 'Allenamento Campo' : sessionName, sessionType: sessType,
        week: currentWeekNum, phase: DB.schedules[appState.selAthId] ? DB.schedules[appState.selAthId].phase : 'Accumulo',
        readiness: document.getElementById('ring-n') ? parseInt(document.getElementById('ring-n').textContent) : 80,
        vol: sessType==='Campo' ? 0 : vol, sRPE, rpe: appState.pwRpe, qual: appState.pwStars, hrv: hrvVal,
        maxE1rm:  sessType==='Campo' ? 0 : (window.liveMaxE1rm||0),
        e1rmDom:  sessType==='Campo' ? 0 : (window.liveE1rmDom||0),
        e1rmNDom: sessType==='Campo' ? 0 : (window.liveE1rmNDom||0),
        doms: cleanDOMS, flag: cleanFlags, notes: cleanNotes, reply: ''
    };
    DB.sessions.push(sessObj);
    await saveDB();

    try {
        if (window.mySupabase) {
            const { error } = await window.mySupabase.from('sessions').upsert([{
                id: generatedId, athlete_id: appState.selAthId, date: today,
                session_name: sessObj.session, session_type: sessType,
                week: currentWeekNum, phase: sessObj.phase, readiness: sessObj.readiness,
                vol: sessObj.vol, srpe: sRPE, rpe: appState.pwRpe, qual: appState.pwStars, hrv: hrvVal,
                max_e1rm: sessObj.maxE1rm, e1rm_dom: sessObj.e1rmDom, e1rm_ndom: sessObj.e1rmNDom,
                doms: cleanDOMS, flag: cleanFlags, notes: cleanNotes, reply: ''
            }]);
            if (error) { alert('⚠️ Sync Cloud fallita. Dati salvati in locale.'); }
            else {
                if (ath) await window.mySupabase.from('atleti').update({ anthropo_history: ath.anthropoHistory }).eq('id', appState.selAthId);
                toast('Allenamento registrato e sincronizzato nel Cloud! ✓');
                window.realLog = {};
            }
        } else { window.realLog = {}; }
    } catch (err) { console.error(err); }

    initFB(); loadLive(); renderDashboard();
    window.liveE1rmDom = 0; window.liveE1rmNDom = 0; window.liveMaxE1rm = 0;
    appState.pwRpe = 0; appState.pwStars = 0;
    ['pw-notes','pw-vars'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    document.querySelectorAll('.rpe-b').forEach(b => b.className = 'rpe-b');
    document.querySelectorAll('#pw-stars .star').forEach(s => s.classList.remove('on'));
    document.getElementById('pw-rpe-d').textContent  = 'Seleziona';
    document.getElementById('pw-star-d').textContent = 'Quanto sei soddisfatto?';
    document.getElementById('pw-dur').value = '';
    document.getElementById('pw-srpe-val').textContent = '0 UA';
}


// ─────────────────────────────────────────────────────────────
// ESPORTAZIONE
// ─────────────────────────────────────────────────────────────
export function updateExpInfo() {
    const athId = document.getElementById('exp-ath').value || appState.selAthId;
    const ath   = athById(athId);
    const sc    = DB.sessions.filter(x => x.athlete === athId).length;
    document.getElementById('exp-info').innerHTML = ath ? `<strong>Atleta: ${escHtml(ath.name)}</strong><br>Sedute: ${sc}` : '';
}

export function doExport() {
    try {
        const a = DB.athletes.find(x => x.id === appState.selAthId);
        if (!a) { toast('Nessun atleta selezionato.'); return; }
        const data = { atleta: a, schedules: DB.schedules[appState.selAthId] || null, history: DB.sessions.filter(h => h.athlete === appState.selAthId) };
        const url  = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
        const link = document.createElement('a');
        link.setAttribute('href', url); link.setAttribute('download', `Scheda_${a.name.replace(/\s+/g,'_')}.json`);
        document.body.appendChild(link); link.click(); link.remove();
        toast('Scheda Atleta Esportata! ✓'); closeMo('mo-exp');
    } catch (err) { console.error(err); toast('Errore durante la generazione.'); }
}

export function exportJSON() {
    const b = new Blob([JSON.stringify(DB, null, 2)], { type:'application/json' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a'); a.href = u; a.download = 'coachOS_backup.json'; a.click();
    URL.revokeObjectURL(u); toast('Backup Esportato! ✓');
}

export async function confirmReset() { if (confirm('Eliminare tutto?')) { await localforage.removeItem(KEY); location.reload(); } }


// ─────────────────────────────────────────────────────────────
// PROGRESSIONE
// ─────────────────────────────────────────────────────────────
export function renderProg() {
    const select = document.getElementById('pr-sess');
    if (select.options.length === 0) {
        select.innerHTML = '';
        const sch = DB.schedules[appState.selAthId];
        if (sch && sch.sessions) sch.sessions.forEach(s => { select.innerHTML += `<option value="${escHtml(s.name)}">${escHtml(s.name)}</option>`; });
    }
    const sn   = select.value;
    const sess = DB.sessions.filter(s => s.athlete === appState.selAthId && s.session === sn).sort((a,b) => a.week - b.week);
    const wrap = document.getElementById('pr-bars'); wrap.innerHTML = '';
    if (!sess.length) { wrap.innerHTML = '<div>Nessun dato.</div>'; return; }
    const maxV = Math.max(...sess.map(s => s.vol), 1);
    sess.forEach((s, i) => {
        const prev = i > 0 ? sess[i-1] : null;
        const d    = prev ? ((s.vol - prev.vol) / prev.vol * 100) : null;
        const ds   = d === null ? '—' : (d >= 0 ? '+' : '') + d.toFixed(1) + '%';
        const div  = document.createElement('div'); div.className = 'pb-row';
        div.innerHTML = `<div class="pb-week">W${s.week}</div><div class="pb-phase">${escHtml(s.phase)}</div>
            <div class="pb-track"><div class="pb-fill" style="width:${Math.round(s.vol/maxV*100)}%;background:var(--teal)"></div></div>
            <div class="pb-vol">${(s.vol/1000).toFixed(2)} t</div><div class="pb-d">${ds}</div>`;
        wrap.appendChild(div);
    });
}
