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
import { upW, renderInjuries, renderQuickWellness } from './wellness.js';
import { loadLive, updateLiveTotals } from './workout.js';
import { renderAnalytics, calculateACWR, renderE1rmChart, renderAthProgressi, renderBodyComp } from './analytics.js';
import { subscribePush } from './auth.js';

// ─────────────────────────────────────────────────────────────
// MODAL HELPERS — showConfirm, copyCodiceAtleta
// ─────────────────────────────────────────────────────────────
export function showConfirm(msg, callback, btnLabel = 'Elimina') {
    window._confirmCallback = callback;
    const msgEl = document.getElementById('mo-confirm-msg');
    const okBtn = document.getElementById('mo-confirm-ok');
    if (msgEl) msgEl.textContent = msg;
    if (okBtn) okBtn.textContent = btnLabel;
    openMo('mo-confirm');
}
window._confirmOk = function () {
    closeMo('mo-confirm');
    if (typeof window._confirmCallback === 'function') window._confirmCallback();
    window._confirmCallback = null;
};

export function copyCodiceAtleta() {
    const code = (document.getElementById('mac-code') || {}).textContent || '';
    navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('mac-copy-btn');
        if (btn) { btn.textContent = '✓ Copiato!'; setTimeout(() => { btn.textContent = 'Copia codice'; }, 2000); }
    }).catch(() => toast('Copia non supportata su questo browser'));
}

// ─────────────────────────────────────────────────────────────
// PUSH — test manuale dalla sidebar coach
// ─────────────────────────────────────────────────────────────
export async function testPushNotification() {
    if (!window.mySupabase) { toast('❌ Supabase non connesso'); return; }
    toast('📡 Invio test push...');
    try {
        const { data, error } = await window.mySupabase.functions.invoke('send-push', {
            body: { target_type: 'coach', target_id: null, title: '🔔 Test Push', body: 'Il sistema notifiche funziona!' }
        });
        if (error) {
            console.error('[Push test] Errore invoke:', error);
            toast('❌ Invoke error: ' + (error.message || JSON.stringify(error)));
            return;
        }
        console.log('[Push test] Risposta:', JSON.stringify(data, null, 2));
        if (data?.ok) {
            toast(`✅ Push inviata a ${data.sent} device — controlla le notifiche!`);
        } else if (data?.reason === 'no_subscriptions') {
            toast('⚠️ Nessuna subscription trovata — clicca "Attiva notifiche" prima');
        } else {
            const detail = data?.failureReasons?.[0] || data?.error || JSON.stringify(data);
            toast('❌ ' + detail.slice(0, 80));
        }
    } catch (e) {
        console.error('[Push test] Eccezione:', e);
        toast('❌ Eccezione: ' + e.message);
    }
}

export async function activatePushCoach() {
    const userId = window.mySupabase
        ? (await window.mySupabase.auth.getUser()).data?.user?.id
        : null;
    if (!userId) { toast('❌ Sessione non trovata — riloggati'); return; }
    await subscribePush(userId, 'coach', null, true);
}


// ─────────────────────────────────────────────────────────────
// PUSH — helper per inviare notifiche via Edge Function
//   targetType → 'coach' | 'athlete'
//   targetId   → athlete_id (solo per 'athlete'), null per coach
// ─────────────────────────────────────────────────────────────
async function _sendPushNotification(targetType, targetId, title, body, panel = '') {
    if (!window.mySupabase) return;
    try {
        await window.mySupabase.functions.invoke('send-push', {
            body: { target_type: targetType, target_id: targetId, title, body, panel }
        });
    } catch (e) {
        console.warn('[Push] Notifica non inviata:', e);
    }
}


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

export function archiveAndNewMeso() {
    const athId = document.getElementById('ed-ath').value || appState.selAthId;
    const sch   = DB.schedules[athId];
    if (!sch) return;

    const mesoCorrente = sch.meso || 'Meso corrente';
    const archiviati   = (DB.mesocycles || []).filter(m => m.athlete === athId).length;
    const nomeDefault  = `Meso ${archiviati + 1}`;

    document.getElementById('mma-info').textContent =
        `Archiviare "${mesoCorrente}" e iniziare un nuovo mesociclo? La scheda attuale verrà conservata nello storico.`;
    document.getElementById('mma-name').value   = nomeDefault;
    document.getElementById('mma-keep').checked = true;
    window._mesoArchAthId        = athId;
    window._mesoArchNomeCorrente = mesoCorrente;
    openMo('mo-meso-arch');
}

export async function confirmMesoArchive() {
    const athId = window._mesoArchAthId;
    if (!athId) return;
    const sch = DB.schedules[athId];
    if (!sch) { closeMo('mo-meso-arch'); return; }

    const newName = (document.getElementById('mma-name').value || '').trim();
    if (!newName) { toast('Nome non valido.'); return; }
    const keepTemplate = document.getElementById('mma-keep').checked;
    const mesoCorrente = window._mesoArchNomeCorrente || sch.meso;

    closeMo('mo-meso-arch');
    updateCloudStatus('saving');
    const snap = await archiveMesocycle(athId);
    if (!snap) return;

    sch.meso = newName; sch.phase = 'Accumulo'; sch.duration = 4; sch.coachNote = ''; sch.objective = '';

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
                            border-bottom:1px solid rgba(249,115,22,0.2);">${s.name}</div>
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
                    background:rgba(249,115,22,0.05); border-left:3px solid var(--teal); color:var(--muted);">
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
        const allowed = ['ath-home', 'ath-week', 'ath-summary', 'wellness', 'sessione', 'feedback', 'coach-reply', 'ath-progressi', 'ath-storico'];
        if (!allowed.includes(id)) return;
        // sync bottom bar active state
        const bbMap = { 'ath-home':'bb-oggi', 'ath-week':'bb-week', 'ath-summary':'bb-sess', sessione:'bb-sess', wellness:'bb-well', feedback:'bb-sess', 'ath-progressi':'bb-prog', 'ath-storico':'bb-prog', 'coach-reply':'bb-coach' };
        document.querySelectorAll('.bb-item').forEach(b => b.classList.remove('on'));
        const activeId = bbMap[id];
        if (activeId) document.getElementById(activeId)?.classList.add('on');
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
        sessione:       () => { renderWeekWidget(); loadLive(); },
        'coach-reply':    () => { renderCoachReply(); renderAthleteChat(); },
        analytics:        renderAnalytics,
        progressione:     renderProg,
        calcolatori:      () => {},
        'ath-home':       renderAthHome,
        'ath-week':       renderAthWeek,
        'ath-summary':    () => {},
        'ath-progressi':  renderAthProgressi,
        'ath-storico':    renderAthStorico,
        'calendario':     renderCalendario,
        'messaggi':       renderMessaggi,
        'macro':          renderMacro
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


function updateReplyBadge() {
    const unanswered = DB.sessions.filter(s => s.notes && s.notes.trim() && (!s.reply || !s.reply.trim())).length;
    const el = document.getElementById('nb-reply');
    if (!el) return;
    el.textContent = unanswered;
    el.style.display = unanswered > 0 ? '' : 'none';
}

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
    updateReplyBadge();
    updateMsgBadge();
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
// WEEK WIDGET — vista settimanale per l'atleta (panel sessione)
// ─────────────────────────────────────────────────────────────
export function renderWeekWidget() {
    const el = document.getElementById('week-widget');
    if (!el) return;

    const athId = window.mioIdLoggato || appState.selAthId;
    const ath   = athById(athId);
    if (!ath) { el.innerHTML = ''; return; }

    const today    = new Date();
    const monday   = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const mondayStr = monday.toISOString().slice(0, 10);
    const todayStr  = today.toISOString().slice(0, 10);

    const thisWeek = DB.sessions
        .filter(s => s.athlete === athId && s.date >= mondayStr)
        .sort((a, b) => a.date.localeCompare(b.date));

    const freq  = ath.freq || 4;
    const days  = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

    const dots = days.map((d, i) => {
        const date    = new Date(monday);
        date.setDate(monday.getDate() + i);
        const dateStr = date.toISOString().slice(0, 10);
        const isToday  = dateStr === todayStr;
        const isFuture = dateStr > todayStr;
        const sess     = thisWeek.find(s => s.date === dateStr);

        const bg     = sess ? 'var(--teal)' : isToday ? 'rgba(249,115,22,0.15)' : 'var(--s1)';
        const border = sess ? 'var(--teal)' : isToday ? 'var(--teal)' : 'var(--border)';
        const color  = sess ? '#000' : isToday ? 'var(--teal)' : isFuture ? 'var(--border)' : 'var(--muted)';
        const symbol = sess ? '✓' : isToday ? '●' : '·';
        const label  = sess ? `<div style="font-size:8px;color:var(--teal);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:36px">${escHtml(sess.session.replace('Seduta ', ''))}</div>` : '<div style="height:12px"></div>';

        return `<div style="flex:1;text-align:center;min-width:0">
            <div style="font-size:9px;margin-bottom:4px;font-weight:${isToday ? '800' : '400'};color:${isToday ? 'var(--teal)' : 'var(--muted)'}">${d}</div>
            <div style="width:32px;height:32px;border-radius:50%;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:${sess ? '14px' : '11px'};background:${bg};border:2px solid ${border};color:${color};font-weight:800">${symbol}</div>
            ${label}
        </div>`;
    }).join('');

    el.innerHTML = `
        <div class="card" style="padding:12px 8px !important">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <div style="font-size:12px;font-weight:700;color:var(--text)">Questa settimana</div>
                <div style="font-size:11px;color:${thisWeek.length >= freq ? 'var(--teal)' : 'var(--muted)'}">
                    ${thisWeek.length}/${freq} sessioni
                </div>
            </div>
            <div style="display:flex;gap:4px;align-items:flex-start">${dots}</div>
        </div>`;
}

// ─────────────────────────────────────────────────────────────
// SUGGERIMENTO SCARICO — analisi carico per il coach
// ─────────────────────────────────────────────────────────────
function _getScaricoSuggestion(athId) {
    if (!athId) return '';
    const sess = [...DB.sessions]
        .filter(s => s.athlete === athId)
        .sort((a, b) => a.date.localeCompare(b.date));
    if (sess.length < 4) return '';

    const last4 = sess.slice(-4);
    const last3 = sess.slice(-3);

    // Check 1: RPE ≥ 8 nelle ultime 3 sessioni consecutive
    const highRpeStreak = last3.every(s => (s.rpe || 0) >= 8);
    const avgRpe3 = (last3.reduce((sum, s) => sum + (s.rpe || 0), 0) / 3).toFixed(1);

    // Check 2: sRPE cumulato ultime 4 sessioni > 1800 UA (soglia overreaching)
    const totalSrpe4  = last4.reduce((sum, s) => sum + (s.sRPE || 0), 0);
    const highSrpe    = totalSrpe4 > 1800;

    // Check 3: nessuna fase di scarico nell'ultima settimana
    const today    = new Date().toISOString().slice(0, 10);
    const weekAgo  = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const recentScarico = sess.some(s => s.date >= weekAgo && (s.phase || '') === 'Scarico');

    if ((!highRpeStreak && !highSrpe) || recentScarico) return '';

    const reason = highRpeStreak
        ? `RPE medio <strong>${avgRpe3}</strong> nelle ultime 3 sessioni`
        : `sRPE accumulato <strong>${totalSrpe4.toLocaleString('it-IT')} UA</strong> nelle ultime 4 sessioni`;

    return `<div style="background:rgba(245,158,11,.08);border:1px solid #f59e0b;color:#fbbf24;padding:12px;border-radius:8px;margin-bottom:12px;font-size:13px;line-height:1.5;">
        💤 <strong>Suggerimento Scarico:</strong> ${reason}.
        Considera una settimana di scarico — volume −30/40%, intensità invariata.
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// WELLNESS BADGE + REMINDER NOTIFICATIONS
// ─────────────────────────────────────────────────────────────

window._updateWellnessBadge = function() {
    const today  = new Date().toISOString().slice(0, 10);
    const done   = localStorage.getItem(`qw_done_${appState.selAthId}`) === today;
    const badge  = document.getElementById('bb-well-badge');
    if (badge) badge.style.display = done ? 'none' : 'block';
};

export async function sendWellnessReminders() {
    if (!window.mySupabase) { toast('⚠️ Connessione Supabase necessaria'); return; }

    const today = new Date().toISOString().slice(0, 10);
    const statusEl = document.getElementById('wellness-reminder-status');

    // Atleti con wellness già inviato oggi
    const { data: doneRows } = await window.mySupabase
        .from('wellness').select('athlete_id').eq('date', today);
    const doneIds = new Set((doneRows || []).map(r => r.athlete_id));

    const pending = DB.athletes.filter(a => !doneIds.has(a.id));

    if (pending.length === 0) {
        toast('✅ Tutti gli atleti hanno già fatto il check-in oggi!');
        if (statusEl) statusEl.textContent = 'Tutti completati ✓';
        return;
    }

    let sent = 0;
    for (const ath of pending) {
        await _sendPushNotification(
            'athlete', ath.id,
            '🌅 Reminder Wellness',
            `${ath.name.split(' ')[0]}, il coach aspetta il tuo check-in di oggi!`,
            'wellness'
        );
        sent++;
    }

    const todayKey = `coachOS_wellness_reminder_${today}`;
    localStorage.setItem(todayKey, 'sent');
    toast(`📨 Reminder inviato a ${sent} atleti`);
    if (statusEl) statusEl.textContent = `Inviato a ${sent} atleti oggi ✓`;
}

export function renderDashboard() {
    const sess = appState.selAthId ? DB.sessions.filter(s => s.athlete === appState.selAthId) : [];
    const ath  = appState.selAthId ? athById(appState.selAthId) : null;
    document.getElementById('dh-title').textContent = ath ? ath.name : 'Seleziona un Atleta';

    // Auto-invio reminder wellness: una volta al giorno, finestra 6-11am
    const _now     = new Date();
    const _todayK  = _now.toISOString().slice(0, 10);
    const _hour    = _now.getHours();
    const _sentKey = `coachOS_wellness_reminder_${_todayK}`;
    if (_hour >= 6 && _hour < 11 && !localStorage.getItem(_sentKey) && DB.athletes.length > 0) {
        localStorage.setItem(_sentKey, 'pending'); // evita doppio trigger
        setTimeout(() => sendWellnessReminders(), 3000); // delay 3s per non bloccare il render
    }

    // Aggiorna stato bottone reminder nel dashboard
    const statusEl = document.getElementById('wellness-reminder-status');
    if (statusEl && localStorage.getItem(_sentKey) === 'sent') {
        statusEl.textContent = 'Inviato oggi ✓';
    }

    // Atleti inattivi — calcolato sempre, indipendente dall'atleta selezionato
    const _today = new Date(); _today.setHours(0, 0, 0, 0);
    const _inattivi = DB.athletes.map(a => {
        const sa = DB.sessions.filter(s => s.athlete === a.id);
        if (!sa.length) return null;
        const last = sa.reduce((mx, s) => s.date > mx ? s.date : mx, sa[0].date);
        const days = Math.floor((_today - new Date(last)) / 86400000);
        return days > 5 ? { name: a.name, days } : null;
    }).filter(Boolean).sort((a, b) => b.days - a.days);
    const _inattiviDiv = document.getElementById('dh-inattivi');
    if (_inattiviDiv) {
        if (_inattivi.length) {
            _inattiviDiv.style.display = '';
            _inattiviDiv.innerHTML = `<div class="card-t" style="margin-bottom:10px">⏸ Atleti Inattivi (&gt;5 giorni)</div>` +
                _inattivi.map(x => `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);">
                    <span style="color:var(--text);font-weight:600">${escHtml(x.name)}</span>
                    <span style="color:var(--amber);font-size:12px;font-weight:700">${x.days} giorni fa</span>
                </div>`).join('');
        } else {
            _inattiviDiv.style.display = 'none';
        }
    }

    if (!ath) return;

    const acwrData = appState.selAthId ? calculateACWR(appState.selAthId) : null;
    document.getElementById('dh-sub').textContent = [ath.level, ath.goal].filter(Boolean).join(' · ');

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

    const scaricoHTML = _getScaricoSuggestion(appState.selAthId);
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
    if (alertsDiv) {
        const combined = triageHTML + scaricoHTML + alertCaricoHTML;
        alertsDiv.innerHTML = combined || '<div style="color:var(--muted);font-size:12px;text-align:center;padding:16px 0;">Nessun alert attivo</div>';
    }

    const n      = sess.length;
    const avgRpe = n ? (sess.reduce((a, s) => a + s.rpe, 0) / n).toFixed(1) : '-';
    document.getElementById('dh-kpis').innerHTML = `
        <div class="kpi"><div class="kpi-l">Sessioni totali</div><div class="kpi-v">${n}</div></div>
        <div class="kpi"><div class="kpi-l">RPE medio</div><div class="kpi-v">${avgRpe}</div></div>
        <div class="kpi"><div class="kpi-l">ACWR Gym (Meccanico)</div>
            <div class="kpi-v" style="color:${acwrData ? acwrData.gym.color : 'var(--muted)'}">${acwrData ? (acwrData.gym.value ?? '—') : '—'}</div>
            <div class="kpi-s">${acwrData ? acwrData.gym.text : ''}</div></div>
        <div class="kpi"><div class="kpi-l">ACWR Campo (Specifico)</div>
            <div class="kpi-v" style="color:${acwrData ? acwrData.field.color : 'var(--muted)'}">${acwrData ? (acwrData.field.value ?? '—') : '—'}</div>
            <div class="kpi-s">${acwrData ? acwrData.field.text : ''}</div></div>`;

    const last8 = sess.slice(-8);
    const bc    = document.getElementById('dh-bc');
    bc.innerHTML = '';
    if (!last8.length) {
        bc.innerHTML = '<div style="width:100%;text-align:center;color:var(--muted);font-size:12px;padding:24px 0;">Nessuna sessione registrata</div>';
    } else {
        const totalVol = last8.reduce((s, x) => s + (x.vol || 0), 0);
        if (totalVol === 0) {
            bc.innerHTML = '<div style="width:100%;text-align:center;color:var(--muted);font-size:12px;padding:24px 0;">Volume non registrato per queste sessioni</div>';
        } else {
            const maxV = Math.max(...last8.map(s => s.vol), 1);
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
    }

    _renderComplianceCard();
}

function _renderComplianceCard() {
    const container = document.getElementById('dh-compliance');
    if (!container) return;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weeks = Array.from({ length: 4 }, (_, i) => {
        const mon = new Date(today);
        mon.setDate(today.getDate() - ((today.getDay() + 6) % 7) - (3 - i) * 7);
        return mon;
    });

    const athletes = DB.athletes;
    if (!athletes.length) { container.innerHTML = ''; return; }

    // Settimana corrente: lunedì → domenica
    const curMon = new Date(today);
    curMon.setDate(today.getDate() - ((today.getDay()+6)%7));
    const curDays = Array.from({length:7}, (_,i) => {
        const d = new Date(curMon); d.setDate(curMon.getDate()+i);
        return d.toISOString().slice(0,10);
    });
    const dayLabels = ['L','M','M','G','V','S','D'];

    const rows = athletes.map(ath => {
        const freq = ath.freq || 3;
        // Dots settimana corrente
        const curDots = curDays.map(dk => ({
            dk,
            done: DB.sessions.some(s => s.athlete === ath.id && s.date === dk),
            future: dk > today.toISOString().slice(0,10)
        }));
        // Compliance 4 settimane
        const weekData = weeks.map(mon => {
            const monStr = mon.toISOString().slice(0,10);
            const sunDate = new Date(mon); sunDate.setDate(mon.getDate()+6);
            const sunStr = sunDate.toISOString().slice(0,10);
            const count = DB.sessions.filter(s => s.athlete === ath.id && s.date >= monStr && s.date <= sunStr).length;
            return Math.min(100, Math.round(count/freq*100));
        });
        const avgPct = Math.round(weekData.reduce((s,p) => s+p, 0)/4);
        const curCount = curDots.filter(d => d.done).length;
        return { ath, curDots, curCount, avgPct };
    }).sort((a,b) => a.avgPct - b.avgPct); // peggiori compliance prima

    const html = rows.map(({ ath, curDots, curCount, avgPct }) => {
        const avgCol = avgPct >= 90 ? 'var(--teal)' : avgPct >= 65 ? 'var(--amber)' : avgPct > 0 ? 'var(--coral)' : 'var(--muted)';
        const dots = curDots.map((d,i) => {
            const bg = d.done ? 'var(--teal)' : d.future ? 'var(--s2)' : 'var(--border)';
            const border = d.future ? '1px dashed var(--border)' : 'none';
            return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1">
                <div style="width:14px;height:14px;border-radius:50%;background:${bg};border:${border}"></div>
                <div style="font-size:8px;color:var(--muted)">${dayLabels[i]}</div>
            </div>`;
        }).join('');
        return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="flex:0 0 72px;font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(ath.name.split(' ')[0])}</div>
            <div style="display:flex;gap:2px;flex:1;align-items:center">${dots}</div>
            <div style="flex:0 0 22px;text-align:center;font-size:11px;color:var(--muted)">${curCount}/${ath.freq||3}</div>
            <div style="flex:0 0 36px;text-align:right;font-size:13px;font-weight:800;color:${avgCol}">${avgPct}%</div>
        </div>`;
    }).join('');

    const headerDots = dayLabels.map(l => `<div style="flex:1;text-align:center;font-size:9px;color:var(--muted);font-weight:700">${l}</div>`).join('');

    container.innerHTML = `
        <div class="card-t" style="display:flex;justify-content:space-between">
            <span>Compliance — Settimana corrente</span>
            <span style="color:var(--muted);font-weight:400">4W avg</span>
        </div>
        <div style="display:flex;gap:10px;padding:4px 0 6px;border-bottom:1px solid var(--border)">
            <div style="flex:0 0 72px"></div>
            <div style="display:flex;flex:1;gap:2px">${headerDots}</div>
            <div style="flex:0 0 22px"></div>
            <div style="flex:0 0 36px"></div>
        </div>
        ${html || '<div style="color:var(--muted);font-size:12px;text-align:center;padding:20px">Nessun dato.</div>'}
    `;
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

    const aw = DB.wellnessByAthlete?.[athId] || {};
    if (aw.sore === 5)                        score += 30;
    if (aw.sleep === 1)                       score += 20;
    if (aw.readinessScore !== undefined && aw.readinessScore < 50) score += 20;

    if (!DB.injuries) DB.injuries = [];
    DB.injuries.filter(x => x.athlete === athId && x.status === 'Attivo').forEach(inj => {
        if (inj.vas >= 7) score += 60;
        else if (inj.vas >= 4) score += 20;
    });

    return score;
}


// ─────────────────────────────────────────────────────────────
// CALENDARIO SETTIMANALE COACH
// ─────────────────────────────────────────────────────────────
export function calPrev()  { appState.calWeekOffset--; renderCalendario(); }
export function calNext()  { appState.calWeekOffset++; renderCalendario(); }
export function calToday() { appState.calWeekOffset = 0; renderCalendario(); }

export function renderCalendario() {
    const table = document.getElementById('cal-table');
    const rangeEl = document.getElementById('cal-range');
    if (!table) return;

    // Calcola lunedì della settimana con offset
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const mon = new Date(today);
    mon.setDate(today.getDate() - ((today.getDay() + 6) % 7) + appState.calWeekOffset * 7);

    // Aggiorna bottone Oggi
    const todayBtn = document.getElementById('cal-today-btn');
    if (todayBtn) todayBtn.style.opacity = appState.calWeekOffset === 0 ? '0.35' : '1';

    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(mon); d.setDate(mon.getDate() + i);
        return d;
    });
    const dayKeys = days.map(d => d.toISOString().slice(0, 10));
    const dayLabels = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

    rangeEl.textContent = `${dayKeys[0]} — ${dayKeys[6]}`;

    // Indice sessioni per (athlete, date)
    const idx = {};
    DB.sessions.forEach(s => {
        const k = s.athlete + '|' + s.date;
        if (!idx[k]) idx[k] = [];
        idx[k].push(s);
    });

    // Header
    let html = '<thead><tr><th style="padding:6px 8px;text-align:left;color:var(--muted);font-size:11px;border-bottom:1px solid var(--border)">Atleta</th>';
    dayLabels.forEach((lbl, i) => {
        const isToday = dayKeys[i] === today.toISOString().slice(0, 10);
        html += `<th style="padding:6px 4px;text-align:center;font-size:11px;color:${isToday ? 'var(--teal)' : 'var(--muted)'};border-bottom:1px solid var(--border)">${lbl}<br><span style="font-size:9px;font-weight:400">${dayKeys[i].slice(5)}</span></th>`;
    });
    html += '</tr></thead><tbody>';

    DB.athletes.forEach(a => {
        const shortName = a.name.split(' ')[0];
        html += `<tr><td style="padding:6px 8px;font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;border-bottom:1px solid var(--border)">${escHtml(shortName)}</td>`;
        dayKeys.forEach(dk => {
            const sess = idx[a.id + '|' + dk] || [];
            const isToday = dk === today.toISOString().slice(0, 10);
            let cell = '';
            if (sess.length) {
                const titles = sess.map(s => escHtml(s.session)).join(', ');
                cell = `<span title="${titles}" onclick="appState.selAthId='${a.id}';go('storico',document.querySelector('.nav-btn[onclick*=\\'storico\\']'))" style="cursor:pointer;display:inline-block;width:14px;height:14px;border-radius:50%;background:var(--teal);vertical-align:middle"></span>`;
            } else {
                cell = `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:var(--border);vertical-align:middle"></span>`;
            }
            html += `<td style="padding:6px 4px;text-align:center;border-bottom:1px solid var(--border);${isToday ? 'background:rgba(249,115,22,.05)' : ''}">${cell}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody>';
    table.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────
// ATLETI
// ─────────────────────────────────────────────────────────────
const _ATH_PALETTE = [
    { bg:'rgba(249,115,22,.18)',  border:'#f97316', text:'#f97316' },
    { bg:'rgba(245,158,11,.18)',  border:'#f59e0b', text:'#f59e0b' },
    { bg:'rgba(139,92,246,.18)', border:'#8b5cf6', text:'#8b5cf6' },
    { bg:'rgba(59,130,246,.18)', border:'#3b82f6', text:'#3b82f6' },
    { bg:'rgba(236,72,153,.18)', border:'#ec4899', text:'#ec4899' },
    { bg:'rgba(20,184,166,.18)', border:'#14b8a6', text:'#14b8a6' },
];
function _athColor(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
    return _ATH_PALETTE[h % _ATH_PALETTE.length];
}

export function renderAthletes() {
    const grid = document.getElementById('ath-grid');
    grid.innerHTML = '';
    const sorted = [...DB.athletes].sort((a, b) => getAthleteRiskScore(b.id) - getAthleteRiskScore(a.id));

    sorted.forEach(a => {
        const riskScore   = getAthleteRiskScore(a.id);
        const borderStyle = riskScore >= 50 ? '3px solid var(--coral)' : riskScore >= 20 ? '2px solid var(--amber)' : '1px solid var(--border)';
        const sc   = DB.sessions.filter(s => s.athlete === a.id).length;
        const init = a.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
        const col  = _athColor(a.id);

        const div = document.createElement('div');
        div.className = 'ac' + (a.id === appState.selAthId ? ' sel' : '');
        div.style.border = borderStyle;
        div.onclick = () => { appState.selAthId = a.id; renderAthletes(); renderDashboard(); renderStorico(); };
        div.innerHTML = `
            <div class="ac-av" style="background:${col.bg};border-color:${col.border};color:${col.text}">${init}</div>
            <div class="ac-n">${escHtml(a.name)} ${riskScore > 0 ? '⚠️' : ''}</div>
            <div class="ac-m">${[a.level, a.goal].filter(Boolean).map(escHtml).join(' · ')}</div>
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

    const defaultSessId = uid();
    DB.schedules[a.id] = {
        meso: 'Meso 1', phase: 'Accumulo', coachNote: '', objective: '',
        sessions: [{ id: defaultSessId, name: 'Seduta A', exercises: [] }]
    };
    DB.athletes.push(a);
    appState.selAthId = a.id;
    appState.edSessId = defaultSessId;

    // Persisti la scheda default su Supabase subito
    try {
        if (window.mySupabase) {
            await window.mySupabase.from('schedules').insert([{
                id: defaultSessId, athlete_id: a.id, session_name: 'Seduta A',
                meso: 'Meso 1', duration: 4, phase: 'Accumulo',
                coach_note: '', objective: '', exercises: []
            }]);
        }
    } catch (e) { console.warn('Schedule default non salvata su cloud:', e); }

    await saveDB();
    populateSelects();
    const edAth = document.getElementById('ed-ath');
    if (edAth) edAth.value = a.id;
    renderAthletes(); closeMo('mo-ath');
    btn.textContent = 'Aggiungi'; btn.disabled = false;

    document.getElementById('mac-info').innerHTML = `<strong>${escHtml(name)}</strong> &middot; ${escHtml(email)}`;
    document.getElementById('mac-code').textContent = codiceGenerato;
    const _cpBtn = document.getElementById('mac-copy-btn');
    if (_cpBtn) _cpBtn.textContent = 'Copia codice';
    openMo('mo-ath-code');
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
    showConfirm(
        "Eliminare completamente l'atleta? Tutti i dati, i mesocicli e lo storico verranno cancellati per sempre.",
        eseguiCancellazioneRealeAtleta
    );
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

    list.innerHTML = sessions.map(s => {
        const p = s.plannedRpe ?? null;
        const a = s.rpe || null;
        const delta = (p && a) ? (a - p) : null;
        const absDelta = delta !== null ? Math.abs(delta) : null;
        const col = absDelta === null ? 'var(--muted)' : absDelta <= 1 ? 'var(--teal)' : absDelta <= 2 ? 'var(--amber)' : 'var(--coral)';
        const rpeHtml = (p || a) ? `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:6px 10px;
                        background:var(--s1);border-radius:6px;font-size:12px;">
                <span style="color:var(--muted);font-weight:600;">RPE:</span>
                ${p ? `<span style="color:var(--muted)">Prog. <strong style="color:var(--text)">${p}</strong></span>` : ''}
                ${p && a ? `<span style="color:var(--border)">→</span>` : ''}
                ${a ? `<span style="color:var(--muted)">Perc. <strong style="color:${col}">${a}</strong></span>` : ''}
                ${delta !== null ? `<span style="color:${col};font-size:11px;font-weight:700;">(${delta > 0 ? '+' : ''}${delta.toFixed(1)})</span>` : ''}
            </div>` : '';
        return `
        <div class="card" style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <span class="tag tg">${escHtml(s.session)}</span>
                <span style="color:var(--muted);font-size:11px">${s.date}</span>
            </div>
            ${s.flag ? `<span style="background:rgba(239,68,68,.12);color:var(--coral);font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;display:inline-block;margin-bottom:8px">${escHtml(s.flag)}</span>` : ''}
            ${rpeHtml}
            ${s.notes ? `<div style="font-size:12px;color:var(--muted);margin-bottom:8px;padding:6px 10px;background:var(--s1);border-radius:6px;"><span style="font-weight:600;color:var(--text)">La mia nota:</span> ${escHtml(s.notes.replace('NOTE: ',''))}</div>` : ''}
            <div style="font-size:13px;color:var(--purple);line-height:1.6;white-space:pre-wrap;padding:8px 10px;background:var(--s2);border-left:3px solid var(--purple);border-radius:0 6px 6px 0;margin-bottom:10px">${escHtml(s.reply)}</div>
            <button onclick="document.getElementById('athlete-chat-input')?.focus()" style="width:100%;padding:8px;background:var(--s1);border:1px solid var(--border);border-radius:8px;color:var(--teal);font-size:12px;font-weight:700;cursor:pointer">
                💬 Rispondi al coach →
            </button>
        </div>`;
    }).join('');
}

export function renderAthWeek() {
    const el = document.getElementById('ath-week-content');
    if (!el) return;

    const athId     = window.mioIdLoggato || appState.selAthId;
    const today     = new Date(); today.setHours(0,0,0,0);
    const todayKey  = today.toISOString().slice(0,10);
    const dayNames  = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
    const mon = new Date(today);
    mon.setDate(today.getDate() - ((today.getDay()+6)%7));

    const days = Array.from({length:7}, (_,i) => {
        const d = new Date(mon); d.setDate(mon.getDate()+i);
        return d;
    });

    const sch           = DB.schedules[athId];
    const sessions      = sch?.sessions || [];
    const scheduledDays = sch?.scheduledDays || null;

    // sessioni registrate questa settimana
    const weekSessions = DB.sessions.filter(s => {
        const sd = new Date(s.date); sd.setHours(0,0,0,0);
        return sd >= mon && sd <= days[6];
    });

    const weekCount  = weekSessions.length;
    const targetFreq = athById(athId)?.freq || 3;
    const pct        = Math.min(100, Math.round(weekCount/targetFreq*100));
    const pctColor   = pct >= 100 ? 'var(--teal)' : pct >= 60 ? 'var(--amber)' : 'var(--coral)';

    // mappa data → sessioni fatte
    const doneByDate = {};
    weekSessions.forEach(s => {
        if (!doneByDate[s.date]) doneByDate[s.date] = [];
        doneByDate[s.date].push(s);
    });

    // Ritorna la sessione suggerita per un giorno della settimana
    const getSuggestedSess = (dayOfWeek) => {
        if (!sessions.length) return null;
        if (scheduledDays && scheduledDays.length > 0) {
            const idx = scheduledDays.indexOf(dayOfWeek);
            return idx >= 0 ? sessions[idx % sessions.length] : null;
        }
        // fallback: distribuisci le sessioni sui giorni lavorativi (Lun-Ven)
        return null;
    };

    const dayCards = days.map(d => {
        const dk        = d.toISOString().slice(0,10);
        const isToday   = dk === todayKey;
        const isPast    = d < today;
        const done      = doneByDate[dk] || [];
        const dayNum    = d.getDate();
        const dayName   = dayNames[d.getDay()];
        const dayOfWeek = d.getDay();
        const isScheduled = scheduledDays ? scheduledDays.includes(dayOfWeek) : false;
        const sug       = isScheduled ? getSuggestedSess(dayOfWeek) : null;

        let content = '';
        if (done.length) {
            content = done.map(s => {
                const p      = s.plannedRpe ?? null;
                const rpeCol = p && s.rpe ? (Math.abs(s.rpe-p) <= 1 ? 'var(--teal)' : Math.abs(s.rpe-p) <= 2 ? 'var(--amber)' : 'var(--coral)') : 'var(--teal)';
                return `
                <div style="margin-top:6px;padding:6px 8px;background:rgba(20,184,166,.1);border-left:3px solid var(--teal);border-radius:0 6px 6px 0">
                    <div style="font-size:11px;font-weight:700;color:var(--teal)">${escHtml(s.session)}</div>
                    <div style="font-size:10px;color:var(--muted)">RPE <strong style="color:${rpeCol}">${s.rpe}</strong>${p ? ` (prog. ${p})` : ''} · ${s.vol ? (s.vol/1000).toFixed(1)+'t' : '—'}</div>
                </div>`;
            }).join('');
        } else if (isScheduled && sug) {
            content = `
            <div style="margin-top:6px;padding:6px 8px;background:${isToday ? 'rgba(20,184,166,.1)' : 'var(--s2)'};border-left:3px solid ${isToday ? 'var(--teal)' : 'var(--amber)'};border-radius:0 6px 6px 0">
                <div style="font-size:11px;font-weight:600;color:${isToday ? 'var(--teal)' : 'var(--amber)'}">📋 ${escHtml(sug.name)}</div>
                ${sug.exercises?.length ? `<div style="font-size:10px;color:var(--muted)">${sug.exercises.length} esercizi</div>` : ''}
            </div>
            ${isToday ? `<button onclick="go('sessione')" style="margin-top:8px;width:100%;padding:8px;background:var(--teal);border:none;border-radius:8px;color:#fff;font-weight:700;font-size:11px;cursor:pointer">Vai all'allenamento →</button>` : ''}`;
        } else if (!scheduledDays && !isPast && sessions.length) {
            // fallback legacy: stima rotazione
            const nextIdx = weekCount % sessions.length;
            content = `<div style="margin-top:6px;font-size:11px;color:var(--muted);font-style:italic">${escHtml(sessions[nextIdx]?.name || 'Riposo')}</div>`;
        } else {
            content = `<div style="margin-top:6px;font-size:11px;color:var(--border)">— Riposo</div>`;
        }

        return `<div style="padding:12px;background:${isToday ? 'rgba(249,115,22,.06)' : 'var(--s1)'};border:1px solid ${isToday ? 'var(--teal)' : 'var(--border)'};border-radius:12px">
            <div style="display:flex;align-items:center;justify-content:space-between">
                <div style="font-size:11px;font-weight:700;color:${isToday ? 'var(--teal)' : 'var(--muted)'}">
                    ${dayName}${isToday ? ' · Oggi' : ''}
                </div>
                <div style="font-size:16px;font-weight:800;color:${done.length ? 'var(--teal)' : isToday ? 'var(--text)' : 'var(--muted)'}">${dayNum}</div>
            </div>
            ${done.length ? `<span style="font-size:9px;font-weight:800;color:var(--teal)">✓ COMPLETATO</span>` : ''}
            ${content}
        </div>`;
    }).join('');

    // Barra 7-dot
    const dotBar = `<div style="display:flex;gap:4px;justify-content:center;margin-bottom:12px">
        ${days.map(d => {
            const dk    = d.toISOString().slice(0,10);
            const done  = !!(doneByDate[dk]?.length);
            const sched = scheduledDays ? scheduledDays.includes(d.getDay()) : false;
            const color = done ? 'var(--teal)' : sched ? 'var(--amber)' : 'var(--s2)';
            const isT   = dk === todayKey;
            return `<div style="flex:1;height:${isT ? 8 : 5}px;border-radius:3px;background:${color};${isT ? 'border:1px solid var(--teal)' : ''};transition:all .3s"></div>`;
        }).join('')}
    </div>`;

    el.innerHTML = `
    <div style="padding-bottom:100px">
      <div style="margin-bottom:16px">
        <div style="font-size:28px;font-weight:800;color:var(--text);letter-spacing:-0.5px">La mia settimana</div>
        <div style="font-size:13px;color:var(--muted);margin-top:2px">
            ${mon.toLocaleDateString('it-IT',{day:'numeric',month:'long'})} — ${days[6].toLocaleDateString('it-IT',{day:'numeric',month:'long'})}
        </div>
      </div>

      ${dotBar}

      <div class="card" style="margin-bottom:16px;border:1px solid var(--border)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div style="font-size:13px;font-weight:700;color:var(--text)">Compliance settimana</div>
          <div style="font-size:16px;font-weight:800;color:${pctColor}">${weekCount}/${targetFreq}</div>
        </div>
        <div style="background:var(--s2);border-radius:4px;height:6px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${pctColor};border-radius:4px;transition:width .5s"></div>
        </div>
        <div style="font-size:10px;color:var(--muted);margin-top:8px;display:flex;gap:10px">
          <span><span style="display:inline-block;width:8px;height:8px;background:var(--teal);border-radius:2px;margin-right:3px"></span>Completato</span>
          <span><span style="display:inline-block;width:8px;height:8px;background:var(--amber);border-radius:2px;margin-right:3px"></span>Programmato</span>
          <span><span style="display:inline-block;width:8px;height:8px;background:var(--s2);border:1px solid var(--border);border-radius:2px;margin-right:3px"></span>Riposo</span>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px">${dayCards}</div>
    </div>`;
}

export function showAthSummary(sessObj) {
    const el = document.getElementById('ath-summary-content');
    if (!el) return;

    const athId  = window.mioIdLoggato || appState.selAthId;
    const sch    = DB.schedules[athId];
    const schSessions = sch?.sessions || [];

    // Sessione precedente dello stesso tipo
    const prevSess = [...DB.sessions]
        .filter(s => s.session === sessObj.session && s.id !== sessObj.id)
        .sort((a,b) => b.date.localeCompare(a.date))[0];

    const volDiff  = prevSess ? sessObj.vol - prevSess.vol : null;
    const volPct   = prevSess && prevSess.vol ? Math.round(volDiff / prevSess.vol * 100) : null;
    const volColor = volDiff === null ? 'var(--muted)' : volDiff >= 0 ? 'var(--teal)' : 'var(--coral)';
    const volSign  = volDiff !== null ? (volDiff >= 0 ? '+' : '') : '';
    const rpeDiff  = prevSess ? sessObj.rpe - prevSess.rpe : null;
    const rpeColor = rpeDiff === null ? 'var(--muted)' : Math.abs(rpeDiff) <= 1 ? 'var(--teal)' : rpeDiff > 0 ? 'var(--coral)' : 'var(--amber)';

    const isPR        = sessObj.maxE1rm > 0 && (!prevSess || sessObj.maxE1rm > (prevSess.maxE1rm || 0));
    const allVols     = DB.sessions.map(s => s.vol || 0);
    const isVolRecord = volDiff !== null && volDiff > 0 && sessObj.vol >= Math.max(...allVols);

    // Hero state
    let heroBg, heroEmoji, heroTitle;
    if (isPR) {
        heroBg    = 'background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.4);animation:pulse-border 1.5s ease infinite';
        heroEmoji = '🏆';
        heroTitle = 'Personal Record!';
    } else if (isVolRecord) {
        heroBg    = 'background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.3)';
        heroEmoji = '📈';
        heroTitle = 'Volume Record!';
    } else {
        heroBg    = 'background:rgba(20,184,166,.1);border:1px solid rgba(20,184,166,.3)';
        heroEmoji = '💪';
        heroTitle = 'Sessione completata!';
    }

    // Set loggati dal realLog
    const rl         = JSON.parse(localStorage.getItem('coachOS_real_log') || '{}');
    const sessId     = document.getElementById('lv-sess')?.value || '';
    const weekVal    = document.getElementById('lv-week')?.value || '1';
    const loggedSets = sessId ? Object.keys(rl).filter(k => k.startsWith(`${sessId}-w${weekVal}`)).length : 0;

    // Prossima sessione suggerita
    const curIdx  = schSessions.findIndex(s => s.name === sessObj.session);
    const nextSess = schSessions[(curIdx + 1) % schSessions.length] || schSessions[0];

    el.innerHTML = `
    <div style="padding:20px;padding-bottom:100px">
      <!-- Hero animato -->
      <div style="text-align:center;padding:28px 20px;border-radius:16px;margin-bottom:24px;${heroBg}">
        <div style="font-size:56px;margin-bottom:8px">${heroEmoji}</div>
        <div style="font-size:26px;font-weight:800;color:var(--text);margin-bottom:4px">${heroTitle}</div>
        <div style="font-size:14px;color:var(--muted)">${escHtml(sessObj.session)}</div>
      </div>

      <!-- Stats grid -->
      <div class="g4" style="margin-bottom:20px">
        <div class="kpi">
            <div class="kpi-l">Volume</div>
            <div class="kpi-v" style="color:var(--teal)">${(sessObj.vol/1000).toFixed(1)}t</div>
            ${volDiff !== null ? `<div style="font-size:10px;color:${volColor}">${volSign}${(Math.abs(volDiff)/1000).toFixed(1)}t${volPct !== null ? ` (${volSign}${volPct}%)` : ''}</div>` : ''}
        </div>
        <div class="kpi">
            <div class="kpi-l">RPE</div>
            <div class="kpi-v" style="color:${sessObj.rpe >= 9 ? 'var(--coral)' : sessObj.rpe >= 7 ? 'var(--amber)' : 'var(--teal)'}">${sessObj.rpe}</div>
            ${rpeDiff !== null ? `<div style="font-size:10px;color:${rpeColor}">${rpeDiff >= 0 ? '+' : ''}${rpeDiff} vs prec.</div>` : ''}
        </div>
        <div class="kpi">
            <div class="kpi-l">e1RM Max</div>
            <div class="kpi-v" style="color:var(--amber)">${sessObj.maxE1rm > 0 ? sessObj.maxE1rm+'kg' : '—'}</div>
        </div>
        <div class="kpi">
            <div class="kpi-l">Set loggati</div>
            <div class="kpi-v">${loggedSets > 0 ? loggedSets : sessObj.dur || '—'}${loggedSets === 0 && sessObj.dur ? 'min' : ''}</div>
        </div>
      </div>

      ${prevSess ? `
      <!-- Confronto narrativo -->
      <div class="card" style="margin-bottom:20px;border:1px solid var(--border)">
        <div class="card-t">Rispetto all'ultima ${escHtml(sessObj.session)}</div>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:13px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="color:var(--muted)">Volume</span>
            <span><span style="color:var(--muted)">${(prevSess.vol/1000).toFixed(1)}t</span> → <strong style="color:${volColor}">${(sessObj.vol/1000).toFixed(1)}t</strong>${volPct !== null ? ` <span style="font-size:11px;color:${volColor}">(${volSign}${volPct}%)</span>` : ''}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="color:var(--muted)">RPE</span>
            <span><span style="color:var(--muted)">${prevSess.rpe}</span> → <strong style="color:${rpeColor}">${sessObj.rpe}</strong>${rpeDiff !== null ? ` <span style="font-size:11px;color:${rpeColor}">(${rpeDiff>=0?'+':''}${rpeDiff})</span>` : ''}</span>
          </div>
          ${sessObj.maxE1rm > 0 && prevSess.maxE1rm > 0 ? `
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="color:var(--muted)">e1RM</span>
            <span><span style="color:var(--muted)">${prevSess.maxE1rm}kg</span> → <strong style="color:${sessObj.maxE1rm >= prevSess.maxE1rm ? 'var(--teal)' : 'var(--coral)'}">${sessObj.maxE1rm}kg</strong></span>
          </div>` : ''}
        </div>
      </div>` : ''}

      ${isPR && sessObj.maxE1rm > 0 ? `
      <div style="background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);border-radius:12px;padding:16px 20px;margin-bottom:20px;text-align:center">
          <div style="font-size:11px;font-weight:800;color:var(--amber);letter-spacing:.1em">🏆 NUOVO PERSONAL RECORD</div>
          <div style="font-size:28px;font-weight:900;color:var(--text);margin-top:4px">${sessObj.maxE1rm} kg e1RM</div>
      </div>` : ''}

      ${nextSess ? `
      <div class="card" style="margin-bottom:20px;border:1px solid var(--border)">
        <div class="card-t">Prossimo allenamento</div>
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">${escHtml(nextSess.name)}</div>
        <div style="font-size:12px;color:var(--muted)">Ricorda di compilare il feedback prima di chiudere l'app.</div>
      </div>` : ''}

      <button onclick="go('feedback')" style="width:100%;padding:14px;background:var(--teal);border:none;border-radius:10px;color:#fff;font-weight:800;font-size:15px;cursor:pointer;margin-bottom:10px">
          Compila feedback post-workout →
      </button>
      <button onclick="go('ath-home')" style="width:100%;padding:12px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--muted);font-size:13px;cursor:pointer">
          Torna alla home
      </button>
    </div>`;

    go('ath-summary');
}

export function renderAthHome() {
    const el = document.getElementById('ath-home-content');
    if (!el) return;

    const athId = window.mioIdLoggato || appState.selAthId;
    const ath   = athById(athId);

    // ── Onboarding primo accesso ─────────────────────────────
    const isFirstTime = DB.sessions.length === 0 && !localStorage.getItem('coachos_onboard_done');
    if (isFirstTime) {
        const sch0 = DB.schedules[athId];
        el.innerHTML = `
        <div style="padding:24px 20px;padding-bottom:100px">
          <div style="text-align:center;margin-bottom:28px">
            <div style="font-size:56px;margin-bottom:12px">👋</div>
            <div style="font-size:24px;font-weight:800;color:var(--text);margin-bottom:8px">Benvenuto, ${escHtml(ath?.name?.split(' ')[0] || 'Atleta')}!</div>
            <div style="font-size:13px;color:var(--muted);line-height:1.6">Ecco come funziona la tua app</div>
          </div>
          <div class="card" style="margin-bottom:20px;border:1px solid var(--border)">
            <div style="display:flex;flex-direction:column;gap:14px">
              ${[['⊙','Oggi','Dashboard: sessione del giorno, wellness e progressi'],
                 ['📅','Settimana','Vista settimanale — cosa hai fatto e cosa ti aspetta'],
                 ['▶','Sessione','Allenati — traccia set, rep e kg in tempo reale'],
                 ['📈','Progressi','Grafici, record e trend mensili del tuo miglioramento'],
                 ['♡','Wellness','Check-in giornaliero — sonno, stress, soreness'],
                 ['💬','Coach','Feedback e messaggi diretti con il tuo coach']]
                .map(([ic,t,d]) => `<div style="display:flex;gap:14px;align-items:flex-start">
                  <div style="font-size:20px;flex-shrink:0;width:28px;text-align:center">${ic}</div>
                  <div><div style="font-size:13px;font-weight:700;color:var(--text)">${t}</div><div style="font-size:12px;color:var(--muted)">${d}</div></div>
                </div>`).join('')}
            </div>
          </div>
          ${sch0?.sessions?.length ? `
          <button onclick="go('sessione')" style="width:100%;padding:16px;background:var(--teal);border:none;border-radius:12px;color:#fff;font-weight:800;font-size:16px;cursor:pointer;margin-bottom:10px">
            Inizia il tuo primo allenamento →
          </button>` : `
          <div class="card" style="text-align:center;border:1px solid var(--border);margin-bottom:16px;padding:20px">
            <div style="font-size:28px;margin-bottom:8px">⏳</div>
            <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">Il coach sta preparando la tua scheda</div>
            <div style="font-size:12px;color:var(--muted)">Riceverai una notifica non appena sarà pronta.</div>
          </div>`}
          <button onclick="dismissOnboarding()" style="width:100%;padding:14px;background:var(--s1);border:1px solid var(--border);border-radius:12px;color:var(--muted);font-size:14px;cursor:pointer">
            Ho capito, vai alla home →
          </button>
        </div>`;
        return;
    }

    const today    = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const dayNames = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
    const months   = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
    const dateStr  = `${dayNames[today.getDay()]} ${today.getDate()} ${months[today.getMonth()]}`;
    const hour     = today.getHours();
    const greeting = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';

    // ── SEZIONE A: Wellness ──────────────────────────────────
    const welldone  = localStorage.getItem(`qw_done_${athId}`) === todayKey;
    const readiness = DB.wellness?.readinessScore ?? null;
    const readColor = readiness >= 75 ? 'var(--teal)' : readiness >= 50 ? 'var(--amber)' : 'var(--coral)';
    const readLabel = readiness >= 75 ? 'Pronto' : readiness >= 50 ? 'Moderato' : 'Affaticato';

    // ── SEZIONE B: Sessione ──────────────────────────────────
    const mon = new Date(today); mon.setDate(today.getDate() - ((today.getDay()+6)%7)); mon.setHours(0,0,0,0);
    const weekSess = DB.sessions.filter(s => { const d = new Date(s.date); d.setHours(0,0,0,0); return d >= mon; });
    const sch      = DB.schedules[athId];
    const sessions = sch?.sessions || [];
    const nextSess = sessions[0];
    const sessHoje = nextSess ? DB.sessions.find(s => s.date === todayKey && s.session === nextSess.name) : null;

    let phaseStr = '', estMin = 0;
    if (nextSess?.exercises?.length) {
        const exs = nextSess.exercises;
        const bp  = exs.reduce((acc, ex) => { const s = ex.section || 'centrale'; acc[s] = (acc[s]||0)+1; return acc; }, {});
        const pts = [];
        if (bp.warmup)   pts.push(`${bp.warmup} w-up`);
        if (bp.centrale) pts.push(`${bp.centrale} centr.`);
        if (bp.cooldown) pts.push(`${bp.cooldown} cool`);
        phaseStr = pts.join(' · ');
        estMin = Math.round(exs.filter(ex => ex.section !== 'warmup')
            .reduce((t, ex) => t + (parseInt(ex.rest)||120) * (parseInt(ex.set)||3) / 60, 0));
    }

    // ── SEZIONE C: Momento motivazionale ─────────────────────
    const allSessSort = [...DB.sessions].sort((a,b) => b.date.localeCompare(a.date));
    let streak = 0;
    if (allSessSort.length) {
        const last = new Date(allSessSort[0].date); last.setHours(0,0,0,0);
        if (Math.floor((today - last) / 86400000) <= 1) {
            streak = 1;
            for (let i=1; i<allSessSort.length; i++) {
                const prev = new Date(allSessSort[i].date); prev.setHours(0,0,0,0);
                const cur  = new Date(allSessSort[i-1].date); cur.setHours(0,0,0,0);
                if (Math.floor((cur-prev)/86400000) <= 2) streak++; else break;
            }
        }
    }

    let motivHtml = '';
    const recentPR = allSessSort.slice(0,10).find(s => {
        const prev = DB.sessions.filter(p => p.session===s.session && p.date < s.date)[0];
        return s.maxE1rm > 0 && (!prev || s.maxE1rm > (prev.maxE1rm||0));
    });
    if (recentPR && Math.floor((today - new Date(recentPR.date)) / 86400000) < 7) {
        const dAgo = Math.floor((today - new Date(recentPR.date)) / 86400000);
        motivHtml = `<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:10px;margin-bottom:14px">
            <span style="font-size:20px">🏆</span>
            <div style="font-size:13px;color:var(--text)"><strong style="color:var(--amber)">${recentPR.maxE1rm} kg e1RM</strong> — ${dAgo === 0 ? 'oggi' : dAgo === 1 ? 'ieri' : dAgo+'gg fa'} su ${escHtml(recentPR.session)}</div>
        </div>`;
    } else if (streak >= 3) {
        motivHtml = `<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.3);border-radius:10px;margin-bottom:14px">
            <span style="font-size:20px">🔥</span>
            <div style="font-size:13px;color:var(--text)"><strong style="color:var(--teal)">${streak} sessioni</strong> consecutive — continua così!</div>
        </div>`;
    } else {
        const thisMo = todayKey.slice(0,7);
        const moSess = DB.sessions.filter(s => s.date.startsWith(thisMo) && s.maxE1rm > 0);
        const prevSess2 = DB.sessions.filter(s => !s.date.startsWith(thisMo) && s.maxE1rm > 0);
        if (moSess.length && prevSess2.length) {
            const bestThis = Math.max(...moSess.map(s => s.maxE1rm));
            const bestPrev = Math.max(...prevSess2.map(s => s.maxE1rm));
            if (bestThis > bestPrev) {
                motivHtml = `<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.25);border-radius:10px;margin-bottom:14px">
                    <span style="font-size:20px">📈</span>
                    <div style="font-size:13px;color:var(--text)">Il tuo massimale è cresciuto di <strong style="color:var(--blue)">+${bestThis-bestPrev} kg</strong> questo mese</div>
                </div>`;
            }
        }
        if (!motivHtml) {
            const quotes = ['La consistenza batte sempre il talento.','Ogni rep ti avvicina alla versione migliore di te.','Il progresso è fatto di piccoli passi quotidiani.','Non esistono scorciatoie — solo lavoro e metodo.','Chi si ferma è perduto. Buon allenamento!'];
            motivHtml = `<div style="padding:12px 14px;background:var(--s1);border:1px solid var(--border);border-radius:10px;margin-bottom:14px;font-size:13px;color:var(--muted);font-style:italic">"${quotes[today.getDate() % quotes.length]}"</div>`;
        }
    }

    // ── SEZIONE D: Stats + sparkline ─────────────────────────
    const last8 = [...DB.sessions].slice(-8);
    const sparkline = (vals, color) => {
        const maxV = Math.max(...vals, 1);
        return `<div style="display:flex;gap:2px;align-items:flex-end;height:20px;margin-top:4px">
            ${vals.map(v => `<div style="flex:1;min-width:4px;height:${Math.max(2,Math.round(v/maxV*20))}px;background:${color};border-radius:2px;opacity:.75"></div>`).join('')}
        </div>`;
    };
    const rpeVals = last8.map(s => s.rpe || 0);
    const volVals = last8.map(s => Math.round((s.vol||0)/1000));
    const avgRpe  = DB.sessions.length ? (DB.sessions.reduce((a,s)=>a+(s.rpe||0),0)/DB.sessions.length).toFixed(1) : '—';

    // ── SEZIONE E: Reply non letta ────────────────────────────
    const unreadReply = DB.sessions.find(s => s.reply && !s.replyRead);
    const msgs        = DB.messages?.[athId] || [];
    const coachMsgs   = msgs.filter(m => m.from_type === 'coach').sort((a,b) => new Date(b.created_at)-new Date(a.created_at));
    const lastMsg     = coachMsgs[0];
    const unreadCount = coachMsgs.filter(m => !m.read_at).length;

    _updateWellnessBadge();

    el.innerHTML = `
    <div style="padding-bottom:100px">

      <!-- SEZIONE A: Wellness ring / banner -->
      ${!welldone ? `
      <div onclick="go('wellness')" style="cursor:pointer;margin-bottom:18px;padding:14px 16px;
           background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.4);border-radius:12px;
           display:flex;align-items:center;gap:12px;animation:pulse-border 2s ease infinite;">
        <div style="font-size:28px;flex-shrink:0">🌅</div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:800;color:#f87171;margin-bottom:2px;">Check-in wellness mancante</div>
          <div style="font-size:12px;color:var(--muted);">${hour < 11 ? 'Fallo prima di allenarti — ti aiuta a regolare il carico.' : 'Il tuo coach non vede il tuo stato. Ci vogliono 30 secondi.'}</div>
        </div>
        <div style="background:#ef4444;color:#fff;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:800;flex-shrink:0;">Fai ora →</div>
      </div>` : readiness !== null ? `
      <div onclick="go('wellness')" style="cursor:pointer;margin-bottom:18px;padding:16px;background:var(--s1);border:1px solid var(--border);border-radius:12px;display:flex;align-items:center;gap:16px">
        <div style="width:72px;height:72px;border-radius:50%;border:3px solid ${readColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 0 0 6px ${readiness>=75?'rgba(20,184,166,.1)':'rgba(245,158,11,.1)'}">
          <span style="font-size:22px;font-weight:900;color:${readColor}">${readiness}</span>
        </div>
        <div style="flex:1">
          <div style="font-size:18px;font-weight:800;color:${readColor};margin-bottom:2px">${readLabel}</div>
          <div style="font-size:12px;color:var(--muted)">Readiness · check-in completato ✓</div>
        </div>
      </div>` : ''}

      <!-- Greeting -->
      <div style="margin-bottom:20px">
        <div style="font-size:12px;color:var(--muted);margin-bottom:4px">${dateStr}</div>
        <div style="font-size:24px;font-weight:800;color:var(--text);letter-spacing:-0.5px">${greeting}, <span style="color:var(--teal)">${escHtml(ath?.name?.split(' ')[0] || 'Atleta')}</span></div>
      </div>

      <!-- SEZIONE B: Il tuo allenamento -->
      <div class="card" style="margin-bottom:14px;border:1px solid var(--border)">
        <div class="card-t">Il tuo allenamento</div>
        ${nextSess ? (sessHoje ? `
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="width:38px;height:38px;background:rgba(20,184,166,.15);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">✓</div>
            <div>
              <div style="font-size:16px;font-weight:800;color:var(--teal)">${escHtml(nextSess.name)}</div>
              <div style="font-size:12px;color:var(--muted)">Completata oggi · RPE ${sessHoje.rpe||'—'}</div>
            </div>
          </div>
          <button onclick="go('sessione')" style="width:100%;padding:10px;background:var(--s1);border:1px solid var(--border);border-radius:8px;color:var(--muted);font-size:13px;cursor:pointer">Ri-apri sessione →</button>
        ` : `
          <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:6px">${escHtml(nextSess.name)}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
            ${phaseStr ? `<span style="font-size:11px;color:var(--muted)">${phaseStr}</span>` : ''}
            ${estMin > 0 ? `<span style="font-size:11px;color:var(--muted)">· ~${estMin} min</span>` : ''}
            ${sch?.phase ? `<span style="background:rgba(20,184,166,.12);color:var(--teal);font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px">${escHtml(sch.phase)}</span>` : ''}
          </div>
          <button onclick="go('sessione')" style="width:100%;padding:14px;background:var(--teal);border:none;border-radius:10px;color:#fff;font-weight:800;font-size:15px;cursor:pointer;letter-spacing:0.3px;">
            Inizia allenamento →
          </button>
        `) : `
          <div style="color:var(--muted);font-size:13px;text-align:center;padding:20px 0">Nessuna scheda assegnata.<br>Contatta il tuo coach.</div>
        `}
      </div>

      <!-- SEZIONE C: Momento motivazionale -->
      ${motivHtml}

      <!-- SEZIONE D: Stats con sparkline -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div class="kpi"><div class="kpi-l">Sessioni tot.</div><div class="kpi-v">${DB.sessions.length}</div></div>
        <div class="kpi"><div class="kpi-l">Questa sett.</div><div class="kpi-v" style="color:var(--teal)">${weekSess.length}</div></div>
        ${last8.length >= 3 ? `
        <div class="kpi">
          <div class="kpi-l">RPE (ult. ${last8.length})</div>
          <div class="kpi-v" style="font-size:16px">${avgRpe}</div>
          ${sparkline(rpeVals, 'var(--amber)')}
        </div>
        <div class="kpi">
          <div class="kpi-l">Volume (ult. ${last8.length})</div>
          <div class="kpi-v" style="font-size:16px">${streak > 0 ? streak+'🔥' : '—'}</div>
          ${sparkline(volVals, 'var(--teal)')}
        </div>` : `
        <div class="kpi"><div class="kpi-l">Streak</div><div class="kpi-v" style="color:var(--amber)">${streak}🔥</div></div>
        <div class="kpi"><div class="kpi-l">RPE medio</div><div class="kpi-v">${avgRpe}</div></div>`}
      </div>

      <!-- SEZIONE E: Reply non letta + Messaggio coach -->
      ${unreadReply ? `
      <div onclick="go('coach-reply')" style="cursor:pointer;margin-bottom:14px;padding:14px 16px;
           background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.35);border-radius:12px;
           display:flex;align-items:center;gap:12px">
        <div style="font-size:22px;flex-shrink:0">💬</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:800;color:var(--text)">Il coach ha risposto</div>
          <div style="font-size:12px;color:var(--muted)">alla sessione del ${unreadReply.date} →</div>
        </div>
        <div style="background:var(--purple);color:#fff;border-radius:8px;padding:6px 10px;font-size:11px;font-weight:800;flex-shrink:0">Leggi</div>
      </div>` : ''}

      ${nextSess ? `
      <div style="margin-bottom:14px">
        <button onclick="exportProgramPDF()" style="width:100%;padding:12px;background:var(--s1);border:1px solid var(--border);border-radius:10px;color:var(--teal);font-weight:700;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
          <span>📄</span> Scarica scheda PDF
        </button>
      </div>` : ''}

      <div class="card" style="border:1px solid var(--border);cursor:pointer" onclick="go('coach-reply')">
        <div class="card-t" style="display:flex;justify-content:space-between;align-items:center">
          <span>Messaggi Coach</span>
          ${unreadCount ? `<span style="background:var(--coral);color:#fff;font-size:9px;font-weight:800;border-radius:999px;padding:2px 7px">${unreadCount} nuovi</span>` : ''}
        </div>
        ${lastMsg ? `
          <div style="font-size:13px;color:var(--text);line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">"${escHtml(lastMsg.content)}"</div>
          <div style="font-size:11px;color:var(--muted);margin-top:6px">${new Date(lastMsg.created_at).toLocaleDateString('it-IT')}</div>
        ` : `<div style="font-size:13px;color:var(--muted)">Nessun messaggio dal coach</div>`}
      </div>

    </div>`;
}

export function dismissOnboarding() {
    localStorage.setItem('coachos_onboard_done', '1');
    renderAthHome();
}

export function renderAthStorico() {
    const list = document.getElementById('ath-sto-list');
    if (!list) return;

    const allSessions = [...DB.sessions].sort((a, b) => b.date.localeCompare(a.date));
    const filterEl    = document.getElementById('sto-filter');
    const filterVal   = filterEl ? filterEl.value : '';
    const filtered    = filterVal ? allSessions.filter(s => s.session === filterVal) : allSessions;

    const PAGE_SIZE = 10;
    if (typeof window._stoPage === 'undefined') window._stoPage = 0;
    const visible = filtered.slice(0, (window._stoPage + 1) * PAGE_SIZE);
    const hasMore = filtered.length > visible.length;

    if (!allSessions.length) {
        list.innerHTML = `<div style="text-align:center;color:var(--muted);padding:40px 20px;font-size:14px;">Nessuna sessione registrata.</div>`;
        return;
    }

    const sessNames = [...new Set(allSessions.map(s => s.session).filter(Boolean))];
    const typeEmoji = { 'Palestra':'🏋️', 'Campo':'⚽', 'Corsa':'🏃', 'Sprint':'⚡', 'Condizionamento':'🔥' };
    const maxVol    = Math.max(...allSessions.map(s => s.vol || 0), 1);

    list.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">
      <select id="sto-filter" onchange="window._stoPage=0;renderAthStorico()" style="flex:1;padding:8px 10px;background:var(--s2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:12px">
        <option value="">Tutte le sessioni</option>
        ${sessNames.map(n => `<option value="${escHtml(n)}" ${filterVal===n?'selected':''}>${escHtml(n)}</option>`).join('')}
      </select>
      <span style="font-size:11px;color:var(--muted);white-space:nowrap">${filtered.length} sess.</span>
    </div>
    ${visible.map(s => {
        const emoji = typeEmoji[s.sessionType] || '💪';
        return `
        <div class="card" style="cursor:pointer;margin-bottom:10px" onclick="toggleStoCard(this)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:15px">${emoji}</span>
              <span class="tag tg" style="font-size:11px">${escHtml(s.session)}</span>
              ${s.reply ? `<span style="background:rgba(20,184,166,.15);color:var(--teal);font-size:9px;font-weight:800;padding:2px 7px;border-radius:999px">💬</span>` : ''}
            </div>
            <span style="color:var(--muted);font-size:11px">${s.date}</span>
          </div>
          <div style="display:flex;gap:12px;font-size:12px;color:var(--muted);margin-bottom:6px">
            <span>Vol <strong style="color:var(--text)">${(s.vol||0).toLocaleString('it-IT')}</strong></span>
            <span>RPE <strong style="color:var(--amber)">${s.rpe||'—'}</strong></span>
            ${s.maxE1rm ? `<span>e1RM <strong style="color:var(--blue)">${s.maxE1rm} kg</strong></span>` : ''}
          </div>
          <div style="height:3px;background:var(--teal);border-radius:2px;opacity:.65;width:${Math.round((s.vol||0)/maxVol*100)}%;max-width:100%;margin-bottom:4px"></div>
          <div class="sto-details" style="display:none;margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
            ${s.notes ? `<div style="font-size:12px;color:var(--muted);margin-bottom:8px"><span style="font-weight:700;color:var(--text)">Note:</span> ${escHtml(s.notes)}</div>` : ''}
            ${s.variations ? `<div style="font-size:12px;color:var(--muted);margin-bottom:8px"><span style="font-weight:700;color:var(--text)">Variazioni:</span> ${escHtml(s.variations)}</div>` : ''}
            ${s.doms ? `<div style="font-size:12px;color:var(--muted);margin-bottom:8px"><span style="font-weight:700;color:var(--text)">DOMS:</span> ${escHtml(s.doms)}</div>` : ''}
            ${s.flag ? `<span style="background:rgba(239,68,68,.12);color:var(--coral);font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;display:inline-block;margin-bottom:8px">${escHtml(s.flag)}</span>` : ''}
            ${s.reply ? `<div style="margin-top:6px;font-size:12px;padding:8px 10px;background:var(--s2);border-left:3px solid var(--teal);border-radius:0 6px 6px 0"><span style="font-weight:700;color:var(--teal)">Coach:</span> ${escHtml(s.reply)}</div>` : ''}
          </div>
          <div style="text-align:right;font-size:10px;color:var(--border);margin-top:2px">▼ dettagli</div>
        </div>`;
    }).join('')}
    ${hasMore ? `<button onclick="loadMoreSto()" style="width:100%;padding:12px;background:var(--s1);border:1px solid var(--border);border-radius:10px;color:var(--muted);font-size:13px;cursor:pointer;margin-top:4px">Carica altri 10 →</button>` : ''}`;
}

export function toggleStoCard(el) {
    const det = el.querySelector('.sto-details');
    if (det) det.style.display = det.style.display === 'none' ? 'block' : 'none';
}

export function loadMoreSto() {
    window._stoPage = (window._stoPage || 0) + 1;
    renderAthStorico();
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

    const funanswered = document.getElementById('sf-unanswered')?.checked;
    const rows = [...DB.sessions].reverse().filter(s => {
        if (fa && s.athlete !== fa) return false;
        if (fs && s.session !== fs) return false;
        if (fp && s.phase   !== fp) return false;
        if (fq && ![s.notes, s.doms, s.flag, s.reply, s.variations, athName(s.athlete)].some(x => (x || '').toLowerCase().includes(fq))) return false;
        if (funanswered && !(s.notes && s.notes.trim() && (!s.reply || !s.reply.trim()))) return false;
        return true;
    });

    const tb = document.getElementById('sto-body'); tb.innerHTML = '';
    rows.forEach(sess => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color:var(--muted)">${sess.date}</td>
            <td><span class="tag tg">${sess.session}</span></td>
            <td style="font-weight:700;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(athName(sess.athlete))}</td>
            <td style="color:var(--muted)">W${sess.week || '—'}</td>
            <td><span class="tag tg" style="font-size:10px">${sess.phase || '—'}</span></td>
            <td style="color:var(--teal);font-weight:700">${sess.readiness || '—'}</td>
            <td>${(sess.vol || 0).toLocaleString('it-IT')}</td>
            <td style="color:var(--purple);font-weight:700">${sess.sRPE || '—'} UA</td>
            <td style="white-space:nowrap">${rpeCompareBadge(sess.plannedRpe ?? null, sess.rpe || null)}</td>
            <td style="color:var(--blue);font-weight:700">${sess.maxE1rm || '—'} kg</td>
            <td style="color:var(--muted);font-size:11px">${escHtml(sess.doms || '—')}</td>
            <td>${sess.flag ? `<span class="tag tc">${escHtml(sess.flag)}</span>` : '—'}</td>
            <td>${sess.reply ? '✓' : '—'}</td>
            <td>${sess.variations ? '<span style="color:var(--amber)">⚡</span>' : '—'}</td>
            <td>
                <button class="btn btn-g btn-xs" onclick="editReply('${sess.id}')">✎</button>
                <button class="btn btn-d btn-xs" onclick="delSess('${sess.id}')">✕</button>
            </td>`;
        tb.appendChild(tr);
    });
    document.getElementById('sto-count').textContent = `${rows.length} sessioni`;
    updateReplyBadge();
}

export function editReply(id) {
    const s = DB.sessions.find(x => x.id === id);
    if (!s) return;
    window._replySessionId = id;
    document.getElementById('mr-notes').textContent = s.notes || '—';
    document.getElementById('mr-reply').value = s.reply || '';

    // RPE comparazione
    const rpeWrap = document.getElementById('mr-rpe-compare');
    if (rpeWrap) {
        const p = s.plannedRpe ?? null;
        const a = s.rpe || null;
        if (p || a) {
            const delta = (p && a) ? (a - p) : null;
            const absDelta = delta !== null ? Math.abs(delta) : null;
            const col = absDelta === null ? 'var(--muted)' : absDelta <= 1 ? 'var(--teal)' : absDelta <= 2 ? 'var(--amber)' : 'var(--coral)';
            const label = delta === null ? '' : delta > 0 ? ' — atleta ha faticato più del previsto' : delta < 0 ? ' — sessione più facile del previsto' : ' — percezione allineata';
            rpeWrap.style.display = 'block';
            rpeWrap.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;
                            background:var(--s1);border-radius:8px;border-left:3px solid ${col};">
                    <div style="flex:1;font-size:12px;">
                        <div style="font-weight:700;color:var(--text);margin-bottom:2px;">RPE — Confronto</div>
                        <div style="color:var(--muted);font-size:11px;">${label}</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:800;">
                        ${p ? `<span style="color:var(--muted)">P:<span style="color:var(--text)">${p}</span></span>` : ''}
                        ${p && a ? `<span style="color:var(--border)">→</span>` : ''}
                        ${a ? `<span style="color:${col}">A:${a}</span>` : ''}
                        ${delta !== null ? `<span style="font-size:11px;color:${col}">(${delta > 0 ? '+' : ''}${delta.toFixed(1)})</span>` : ''}
                    </div>
                </div>`;
        } else {
            rpeWrap.style.display = 'none';
        }
    }

    const varsWrap = document.getElementById('mr-vars-wrap');
    const varsEl   = document.getElementById('mr-vars');
    if (s.variations) {
        varsEl.textContent  = s.variations;
        varsWrap.style.display = '';
    } else {
        varsWrap.style.display = 'none';
    }
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
            if (!error) {
                if (window._rtBroadcast) {
                    window._rtBroadcast.send({
                        type: 'broadcast', event: 'session_reply',
                        payload: { athlete_id: s.athlete }
                    });
                }
                _sendPushNotification('athlete', s.athlete, '💬 Risposta del Coach', 'Il tuo coach ha risposto al tuo allenamento', 'coach-reply');
            }
        }
    } catch (e) { toast('⚠️ Errore di connessione.'); }
}

export function delSess(id) {
    showConfirm('Eliminare definitivamente questa sessione?', async () => {
        DB.sessions = DB.sessions.filter(x => x.id !== id);
        await saveDB(); renderStorico(); renderAnalytics();
        try {
            if (window.mySupabase) {
                const { error } = await window.mySupabase.from('sessions').delete().eq('id', id);
                toast(error ? '⚠️ Cancellata solo in locale.' : 'Sessione eliminata dal Cloud! ✓');
            }
        } catch (e) { toast('⚠️ Errore di connessione.'); }
    });
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
    if (!DB.schedules[athId]) {
        DB.schedules[athId] = {
            meso: 'Meso 1', phase: 'Accumulo', coachNote: '', objective: '',
            sessions: [{ id: uid(), name: 'Seduta A', exercises: [] }]
        };
        appState.edSessId = DB.schedules[athId].sessions[0].id;
    }
    const sch = DB.schedules[athId];

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
        const stEl = document.getElementById('ed-sess-type');
        if (stEl) stEl.value = curSess.sessType || 'Palestra';
    }

    // Popola checkboxes scheduledDays
    const sdContainer = document.getElementById('ed-scheduled-days');
    if (sdContainer) {
        const savedDays = sch.scheduledDays || [];
        sdContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = savedDays.includes(parseInt(cb.value));
        });
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
    const newSess = { id: uid(), name: `Nuova Seduta ${sch.sessions.length + 1}`, sessType: 'Palestra', exercises: [] };
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

export function updateSessionType(val) {
    const sch     = DB.schedules[document.getElementById('ed-ath').value || appState.selAthId];
    const curSess = sch && sch.sessions.find(x => x.id === appState.edSessId);
    if (curSess) { curSess.sessType = val; saveDB(); }
}

export function deleteCurrentSession() {
    const athId = document.getElementById('ed-ath').value || appState.selAthId;
    const sch   = DB.schedules[athId];
    if (sch.sessions.length <= 1) { toast('Devi mantenere almeno una sessione.'); return; }
    showConfirm('Eliminare la sessione?', async () => {
        sch.sessions = sch.sessions.filter(x => x.id !== appState.edSessId);
        appState.edSessId = sch.sessions[0].id;
        await saveDB(); renderEditor();
    });
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
                const mode    = ex.circuitMode || 'circuit';
                const meta    = ex.circuitMeta || {};
                const circExs = ex.circuitExercises || [];

                const modeColors   = { circuit:'var(--amber)', emom:'var(--teal)', amrap:'var(--blue)', tabata:'var(--coral)' };
                const modeLabels   = { circuit:'⏱ CIRCUITO', emom:'⏱ EMOM', amrap:'🔁 AMRAP', tabata:'🔥 TABATA' };
                const accentColor  = modeColors[mode] || 'var(--amber)';
                const badgeLabel   = modeLabels[mode] || '⏱ CIRCUITO';

                const metaGridHtml = (() => {
                    if (mode === 'emom') return `
                      <div><span class="fl" style="color:${accentColor}!important;">DURATA</span><input type="number" value="${meta.duration||10}" placeholder="10" oninput="updateCircuitMeta(${i},'duration',this.value)"><span style="font-size:9px;color:var(--muted);display:block;text-align:center;margin-top:2px;">minuti</span></div>
                      <div style="display:flex;align-items:center;padding-top:14px;font-size:11px;color:var(--muted);">Es. ciclo ogni minuto</div>`;
                    if (mode === 'amrap') return `
                      <div><span class="fl" style="color:${accentColor}!important;">DURATA</span><input type="number" value="${meta.duration||12}" placeholder="12" oninput="updateCircuitMeta(${i},'duration',this.value)"><span style="font-size:9px;color:var(--muted);display:block;text-align:center;margin-top:2px;">minuti</span></div>
                      <div style="display:flex;align-items:center;padding-top:14px;font-size:11px;color:var(--muted);">Più giri possibili</div>`;
                    if (mode === 'tabata') return `
                      <div><span class="fl" style="color:${accentColor}!important;">LAVORO</span><input type="number" value="${meta.workTime||20}" placeholder="20" oninput="updateCircuitMeta(${i},'workTime',this.value)"><span style="font-size:9px;color:var(--muted);display:block;text-align:center;margin-top:2px;">secondi</span></div>
                      <div><span class="fl" style="color:var(--muted)!important;">RIPOSO</span><input type="number" value="${meta.restTime||10}" placeholder="10" oninput="updateCircuitMeta(${i},'restTime',this.value)"><span style="font-size:9px;color:var(--muted);display:block;text-align:center;margin-top:2px;">secondi</span></div>
                      <div><span class="fl" style="color:var(--teal)!important;">ROUND</span><input type="number" value="${meta.rounds||8}" placeholder="8" oninput="updateCircuitMeta(${i},'rounds',this.value)"><span style="font-size:9px;color:var(--muted);display:block;text-align:center;margin-top:2px;">round/es.</span></div>`;
                    return `
                      <div><span class="fl" style="color:${accentColor}!important;">LAVORO</span><input type="number" value="${meta.workTime||40}" placeholder="40" oninput="updateCircuitMeta(${i},'workTime',this.value)"><span style="font-size:9px;color:var(--muted);display:block;text-align:center;margin-top:2px;">secondi</span></div>
                      <div><span class="fl" style="color:var(--muted)!important;">REST ES.</span><input type="number" value="${meta.restBetweenEx||20}" placeholder="20" oninput="updateCircuitMeta(${i},'restBetweenEx',this.value)"><span style="font-size:9px;color:var(--muted);display:block;text-align:center;margin-top:2px;">secondi</span></div>
                      <div><span class="fl" style="color:var(--muted)!important;">REST GIRO</span><input type="number" value="${meta.restBetweenRounds||120}" placeholder="120" oninput="updateCircuitMeta(${i},'restBetweenRounds',this.value)"><span style="font-size:9px;color:var(--muted);display:block;text-align:center;margin-top:2px;">secondi</span></div>
                      <div><span class="fl" style="color:var(--teal)!important;">GIRI</span><input type="number" value="${meta.rounds||3}" placeholder="3" oninput="updateCircuitMeta(${i},'rounds',this.value)"><span style="font-size:9px;color:var(--muted);display:block;text-align:center;margin-top:2px;">round</span></div>`;
                })();

                const circExsHtml = circExs.map((ce, exIdx) => `
                    <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;flex-wrap:wrap;">
                        <span style="color:${accentColor};font-weight:700;font-size:11px;min-width:18px;">${exIdx + 1}.</span>
                        <input type="text" value="${(ce.name || '').replace(/"/g, '&quot;')}" placeholder="Nome esercizio" style="flex:2;font-size:11px;min-width:120px;" oninput="updateCircuitEx(${i},${exIdx},'name',this.value)">
                        <input type="text" value="${(ce.video || '').replace(/"/g, '&quot;')}" placeholder="Link Video YT" style="flex:1.5;font-size:11px;min-width:90px;" oninput="updateCircuitEx(${i},${exIdx},'video',this.value)">
                        <input type="text" value="${(ce.note || '').replace(/"/g, '&quot;')}" placeholder="Note / reps" style="flex:1;font-size:11px;min-width:80px;" oninput="updateCircuitEx(${i},${exIdx},'note',this.value)">
                        <button onclick="removeCircuitEx(${i},${exIdx})" style="background:none;border:1px solid var(--coral-d);color:var(--coral);padding:3px 8px;border-radius:6px;font-size:10px;cursor:pointer;flex-shrink:0;">✕</button>
                    </div>`).join('');

                const circDiv = document.createElement('div');
                circDiv.innerHTML = `
                  <div style="background:rgba(251,191,36,0.04);border:2px solid color-mix(in srgb, ${accentColor} 35%, transparent);border-radius:10px;padding:12px;margin-bottom:8px;position:relative;">
                    <div style="display:flex;gap:6px;margin-bottom:10px;align-items:center;flex-wrap:wrap;">
                      <div style="display:flex;flex-direction:column;gap:2px;flex-shrink:0;">
                        <button onclick="moveExercise(${i},-1)" ${i===0?'disabled':''} style="background:${i===0?'var(--s1)':'var(--s2)'};border:1px solid var(--border);border-radius:4px;color:${i===0?'var(--muted)':accentColor};font-size:11px;padding:2px 6px;cursor:${i===0?'default':'pointer'};line-height:1;opacity:${i===0?'0.35':'1'}">▲</button>
                        <button onclick="moveExercise(${i}, 1)" ${i===exs.length-1?'disabled':''} style="background:${i===exs.length-1?'var(--s1)':'var(--s2)'};border:1px solid var(--border);border-radius:4px;color:${i===exs.length-1?'var(--muted)':accentColor};font-size:11px;padding:2px 6px;cursor:${i===exs.length-1?'default':'pointer'};line-height:1;opacity:${i===exs.length-1?'0.35':'1'}">▼</button>
                      </div>
                      <input type="text" value="${escHtml(ex.name || badgeLabel)}" placeholder="Nome blocco" style="flex:2;font-weight:700;color:${accentColor};" oninput="updateEx(${i},'name',this.value)">
                      <select style="width:120px;font-size:11px;padding:5px;border-radius:8px;background:var(--s1);color:${accentColor};font-weight:700;" onchange="updateEx(${i},'section',this.value);renderEdExercises();">
                        <option value="warmup" ${ex.section==='warmup'?'selected':''}>🔥 Warm-up</option>
                        <option value="centrale" ${!ex.section||ex.section==='centrale'?'selected':''}>🏋️‍♂️ Centrale</option>
                        <option value="cooldown" ${ex.section==='cooldown'?'selected':''}>🧊 Cool-down</option>
                      </select>
                      <select style="font-size:10px;padding:4px 6px;border-radius:6px;font-weight:800;background:rgba(0,0,0,0.3);color:${accentColor};border:1px solid color-mix(in srgb, ${accentColor} 40%, transparent);" onchange="updateEx(${i},'circuitMode',this.value);renderEdExercises();">
                        <option value="circuit" ${mode==='circuit'?'selected':''}>⏱ Circuito</option>
                        <option value="emom"    ${mode==='emom'?'selected':''}>⏱ EMOM</option>
                        <option value="amrap"   ${mode==='amrap'?'selected':''}>🔁 AMRAP</option>
                        <option value="tabata"  ${mode==='tabata'?'selected':''}>🔥 Tabata</option>
                      </select>
                      <button class="btn btn-d btn-xs" onclick="delExConfirm(${i})">✕</button>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px;padding:8px;background:rgba(0,0,0,0.2);border-radius:8px;border:1px dashed rgba(255,255,255,0.08);">
                      ${metaGridHtml}
                    </div>
                    <div>
                      <span style="font-size:11px;font-weight:800;color:${accentColor};text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:6px;">Esercizi</span>
                      ${circExsHtml || '<div style="font-size:11px;color:var(--muted);font-style:italic;padding:4px 0;">Nessun esercizio.</div>'}
                      <button onclick="addCircuitEx(${i})" style="width:100%;padding:6px;margin-top:6px;background:rgba(255,255,255,0.03);border:1px dashed rgba(255,255,255,0.15);color:${accentColor};border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">+ Aggiungi Esercizio</button>
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
                <div><span class="fl">RPE</span>
                  <select onchange="updateEx(${i},'rpe',this.value)">
                    <option value="" ${!ex.rpe?'selected':''}>—</option>
                    ${[1,2,3,4,5,6,7,8,9,10].map(v=>`<option value="${v}" ${ex.rpe==v?'selected':''}>${v}</option>`).join('')}
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

export function openCustomTypeModal() {
    const existing = document.getElementById('mo-custom-type');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', `
        <div class="mo show" id="mo-custom-type" style="z-index:99999">
            <div class="mo-box" style="max-width:360px;text-align:center">
                <div class="mo-t" style="justify-content:center">Tipo personalizzato <button class="mo-x" onclick="document.getElementById('mo-custom-type').remove()">✕</button></div>
                <input type="text" id="custom-type-input" placeholder="Es: Drop Set, Cluster, EMOM..." style="margin-bottom:16px" autofocus
                    onkeydown="if(event.key==='Enter'){const v=document.getElementById('custom-type-input').value.trim();if(v){addExType(v);document.getElementById('mo-custom-type').remove();}}">
                <div style="display:flex;gap:8px;justify-content:center">
                    <button class="btn btn-g" onclick="document.getElementById('mo-custom-type').remove()">Annulla</button>
                    <button class="btn btn-p" onclick="const v=document.getElementById('custom-type-input').value.trim();if(v){addExType(v);document.getElementById('mo-custom-type').remove();}">Aggiungi</button>
                </div>
            </div>
        </div>`);
    setTimeout(() => document.getElementById('custom-type-input')?.focus(), 50);
}

export function addExType(type) {
    const defaults = {
        'max effort':     { set:3, rep:'3', rir:'0', rest:"180''", tut:'-' },
        'dynamic effort': { set:8, rep:'2', rir:'—', rest:"45''",  tut:'Max Velocità' },
        'repetition':     { set:3, rep:'10',rir:'1', rest:"90''",  tut:'-' },
        'tempo':          { set:3, rep:'6', rir:'2', rest:"90''",  tut:'4.0.X.0' }
    };
    const d = defaults[type] || { set:3, rep:'8', rir:'2', rest:"90''", tut:'-' };
    const newEx = { name:`Focus ${type.toUpperCase()}`, type, arm:'Bi', wset:1, set:d.set, rep:d.rep, kg:0, rir:d.rir, rest:d.rest, tut:d.tut, note:'', ytUrl:'', rpe:'' };
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
        type: 'circuit', circuitMode: 'circuit', name: 'Circuito a Tempo', section: 'centrale',
        circuitMeta: { workTime: 40, restBetweenEx: 20, restBetweenRounds: 120, rounds: 3 },
        circuitExercises: [{ name: 'Esercizio 1', note: '' }, { name: 'Esercizio 2', note: '' }],
        arm: 'Bi', wset: 0, set: 0, rep: 0, kg: 0, rir: '—', rest: '0', tut: '-', note: '', anatomicalZone: ''
    });
    renderEdExercises();
}

export function addEmom() {
    getEdExercises().push({
        type: 'circuit', circuitMode: 'emom', name: 'EMOM', section: 'centrale',
        circuitMeta: { duration: 10 },
        circuitExercises: [{ name: 'Esercizio 1', note: '10 reps', video: '' }, { name: 'Esercizio 2', note: '8 reps', video: '' }],
        arm: 'Bi', wset: 0, set: 0, rep: 0, kg: 0, rir: '—', rest: '0', tut: '-', note: '', anatomicalZone: ''
    });
    renderEdExercises();
}

export function addAmrap() {
    getEdExercises().push({
        type: 'circuit', circuitMode: 'amrap', name: 'AMRAP', section: 'centrale',
        circuitMeta: { duration: 12 },
        circuitExercises: [{ name: 'Esercizio 1', note: '10 reps', video: '' }, { name: 'Esercizio 2', note: '15 reps', video: '' }],
        arm: 'Bi', wset: 0, set: 0, rep: 0, kg: 0, rir: '—', rest: '0', tut: '-', note: '', anatomicalZone: ''
    });
    renderEdExercises();
}

export function addTabata() {
    getEdExercises().push({
        type: 'circuit', circuitMode: 'tabata', name: 'Tabata', section: 'centrale',
        circuitMeta: { workTime: 20, restTime: 10, rounds: 8 },
        circuitExercises: [{ name: 'Esercizio 1', note: '', video: '' }],
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
    await saveDB();
    await saveSchedule();
    renderEdExercises(); closeMo('mo-prog'); toast('Progressione salvata! ✓');
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
            // BUG FIX: accumula linearmente fino all'ultima settimana, poi scarico
            if (w === maxWeeks) {
                tSet = Math.max(1, baseSet - 1); tRep = Math.max(1, baseRepNum - 2); tKg = baseKg * 0.65;
            } else {
                const acc = (w - 1) / Math.max(1, maxWeeks - 2);
                tSet = baseSet + Math.round(acc * 2);
                tKg  = baseKg * (0.70 + acc * 0.15);
                tRep = baseRepNum;
            }
        } else if (type === 'hyper_stretch') {
            tSet = baseSet; tKg = baseKg * (0.70 + 0.025 * (w - 1));
            if (w === maxWeeks && maxWeeks > 2) { tSet = Math.max(1, baseSet - 1); tRep = baseRepNum; }
            else { tRep = baseRepNum + ' (+ 4/5 Parziali in Allungamento)'; }
        } else if (type === 'hyper_metabolic') {
            // DUP Metabolico: Activation set + Myo-reps cluster, intensità cresce
            tSet = 1; tKg = baseKg * (0.65 + 0.025 * (w - 1));
            if (w === maxWeeks && maxWeeks > 2) { tSet = Math.max(1, baseSet - 1); tRep = baseRepNum; tKg = baseKg * 0.60; }
            else { const activation = Math.max(12, baseRepNum * 2); const cluster = Math.round(baseRepNum / 2) || 3; tRep = `${activation} + ${cluster} + ${cluster} + ${cluster} (15" rest)`; }
        } else if (type === 'block_period') {
            // BUG FIX: fase realizzazione a 93% (peaking), non 60%
            const pct = w / maxWeeks;
            if (pct <= 0.50)      { tSet = baseSet; tRep = Math.max(8, baseRepNum); tKg = baseKg * (0.65 + 0.04 * (w - 1)); }
            else if (pct <= 0.80) { tSet = baseSet; tRep = Math.max(3, baseRepNum - 3); const lW = w - Math.floor(maxWeeks * 0.50); tKg = baseKg * (0.80 + 0.03 * (lW - 1)); }
            else                  { tSet = Math.max(1, baseSet - 1); tRep = '2'; tKg = baseKg * 0.93; }
        } else if (type === 'double_prog') {
            // Rep aumentano ogni settimana; ultima: reset rep, +5% kg
            tRep = w < maxWeeks ? baseRepNum + (w - 1) : baseRepNum;
            if (w === maxWeeks) tKg = baseKg * 1.05;
        } else if (type === 'overreach') {
            tSet = w < maxWeeks ? baseSet + (w - 1) : Math.max(1, baseSet - 1);
        } else if (type === 'lin_taper') {
            if (w > 1) { tRep = Math.max(1, baseRepNum - (w-1)); tKg = baseKg * (1 + 0.05 * (w-1)); if (w === maxWeeks) tSet = Math.max(1, baseSet - 1); }
        } else if (type === 'step_load') {
            tKg = baseKg * (1 + 0.05 * Math.floor((w - 1) / 2));
        } else if (type === 'wave_contrast') {
            // Settimane dispari: pesante; pari: esplosivo (80%, meno rep)
            if (w % 2 === 0) { tKg = baseKg * 0.80; tRep = Math.max(3, Math.round(baseRepNum * 0.6)); }
            else { tKg = baseKg * (1 + 0.05 * Math.floor(w / 2)); tRep = baseRepNum; }
        } else if (type === 'french_contrast') {
            const ts = Math.min(4, Math.max(3, baseSet)); const tr = Math.min(4, baseRepNum);
            // BUG FIX: ciclo su 4 settimane ripetuto, non si blocca a W4
            const fw = ((w - 1) % 4) + 1;
            if (fw === 1)      { tSet = ts; tRep = tr;                    tKg = baseKg * 0.80; }
            else if (fw === 2) { tSet = ts; tRep = Math.max(1, tr - 1);  tKg = baseKg * 0.85; }
            else if (fw === 3) { tSet = Math.max(2, ts - 1); tRep = Math.max(1, tr - 2); tKg = baseKg * 0.90; }
            else               { tSet = 2;  tRep = 2;                     tKg = baseKg * 0.70; }
        } else if (type === 'cluster') {
            // BUG FIX: kg progressivo ogni settimana (+2.5%)
            tKg = baseKg * (1 + 0.025 * (w - 1));
            if (baseRepNum >= 4) { const m = Math.round(baseRepNum / 3) || 1; tRep = `${m}.${m}.${m} (15" intra-serie)`; }
        } else if (type === 'wave_load') {
            tSet = Math.max(3, baseSet); tRep = '3, 2, 1'; tKg = baseKg * (0.80 + 0.025 * (w - 1));
        } else if (type === 'myo_reps') {
            // Myo-Reps: set di attivazione + mini-set a cedimento parziale (diverso da DUP metabolico)
            tSet = 1; tKg = baseKg * (0.70 + 0.02 * (w - 1));
            if (w === maxWeeks && maxWeeks > 2) { tSet = Math.max(1, baseSet - 1); tRep = baseRepNum; tKg = baseKg * 0.65; }
            else { const act = Math.max(10, baseRepNum + 2); tRep = `${act} + 3 + 3 + 3 (20" rest)`; }
        } else if (type === 'wup') {
            const ph = (w - 1) % 3;
            if (ph === 0) { tSet = Math.max(3, baseSet); tRep = 8; tKg = baseKg * 0.70; }
            else if (ph === 1) { tSet = Math.max(4, baseSet + 1); tRep = 3; tKg = baseKg * 0.88; }
            else { tSet = Math.max(5, baseSet + 2); tRep = 2; tKg = baseKg * 0.50; }
        } else if (type === 'triphasic') {
            // BUG FIX: ciclo ecc/iso/conc ripetuto per tutte le settimane
            tSet = baseSet;
            const tp = ((w - 1) % 3) + 1;
            if (tp === 1) tRep = baseRepNum + ' (Eccentrica 5s)';
            else if (tp === 2) tRep = baseRepNum + ' (Isometria 3s al parallelo)';
            else tRep = baseRepNum + ' (Super Esplosivo)';
            tKg = baseKg * (0.78 + 0.02 * (w - 1));
        } else if (type === 'wendler_531') {
            // 5/3/1 Wendler — ciclo 3+1 settimane
            const wc = ((w - 1) % 4) + 1;
            if (wc === 1) { tSet = 3; tRep = '5'; tKg = baseKg * 0.65; }
            else if (wc === 2) { tSet = 3; tRep = '3'; tKg = baseKg * 0.75; }
            else if (wc === 3) { tSet = 3; tRep = '1+ (AMRAP)'; tKg = baseKg * 0.85; }
            else               { tSet = 3; tRep = '5 (deload)'; tKg = baseKg * 0.50; }
        } else if (type === 'linear_classic') {
            // Progressione Lineare Classica: +5% ogni settimana, ultimo scarico
            if (w === maxWeeks) { tSet = Math.max(1, baseSet - 1); tRep = baseRepNum; tKg = baseKg * 0.60; }
            else { tKg = baseKg * (1 + 0.05 * (w - 1)); tRep = baseRepNum; }
        } else if (type === 'amrap_top') {
            // AMRAP Top Set: top set a cedimento + back-off sets
            if (w === maxWeeks) { tSet = Math.max(1, baseSet - 1); tRep = baseRepNum; tKg = baseKg * 0.65; }
            else {
                const topKg = baseKg * (0.85 + 0.025 * (w - 1));
                const backOff = Math.round(topKg * 0.80 / 2.5) * 2.5;
                tSet = baseSet;
                tRep = `AMRAP @ ${Math.round(topKg / 2.5) * 2.5}kg + ${Math.max(1, baseSet - 1)}x${baseRepNum} @ ${backOff}kg`;
                tKg  = topKg;
            }
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

    let color='var(--teal)', text='Ottimale', bg='rgba(249,115,22,.15)';
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
    const sdCont  = document.getElementById('ed-scheduled-days');
    if (sdCont) sch.scheduledDays = [...sdCont.querySelectorAll('input:checked')].map(cb => parseInt(cb.value));

    try {
        if (window.mySupabase && sch.sessions) {
            // Legge lo stato remoto per due motivi:
            // 1. Preservare le progressioni salvate dall'atleta live (il coach può non averle in memoria)
            // 2. Calcolare quali sessioni sono state rimosse localmente e vanno cancellate su Supabase
            const { data: currentRows } = await window.mySupabase
                .from('schedules').select('id, exercises').eq('athlete_id', athId);

            const remoteIds    = new Set((currentRows || []).map(r => r.id));
            const localIds     = new Set(sch.sessions.map(s => s.id));

            const supabaseProgs = {};
            (currentRows || []).forEach(row => {
                supabaseProgs[row.id] = {};
                (row.exercises || []).forEach(ex => {
                    if (ex.name && ex.progression) supabaseProgs[row.id][ex.name] = ex.progression;
                });
            });

            // Costruisce il batch di righe: merge progressioni remote dove il coach non le ha in memoria
            const rows = sch.sessions.map(s => {
                const sessionProgs = supabaseProgs[s.id] || {};
                const exercises = s.exercises.map(ex => {
                    if (!ex.progression && ex.name && sessionProgs[ex.name]) {
                        return { ...ex, progression: sessionProgs[ex.name] };
                    }
                    return ex;
                });
                return {
                    id: s.id, athlete_id: athId, session_name: s.name,
                    meso: sch.meso, duration: sch.duration, phase: sch.phase,
                    coach_note: sch.coachNote, objective: sch.objective, exercises
                };
            });

            // UPSERT atomico: inserisce le nuove sessioni, aggiorna quelle esistenti.
            // Non cancella nulla prima — se la rete cade, i dati remoti rimangono intatti.
            const { error: upsertErr } = await window.mySupabase
                .from('schedules').upsert(rows, { onConflict: 'id' });
            if (upsertErr) throw upsertErr;

            // Solo dopo un upsert confermato: elimina le sessioni rimosse localmente.
            // Se questo step fallisce rimangono sessioni orfane (non un problema per l'atleta).
            const idsToDelete = [...remoteIds].filter(id => !localIds.has(id));
            if (idsToDelete.length > 0) {
                const { error: delErr } = await window.mySupabase
                    .from('schedules').delete().in('id', idsToDelete);
                if (delErr) console.warn('[saveSchedule] Rimozione sessioni obsolete fallita:', delErr);
            }

            toast('Schede sincronizzate sul Cloud! ✓');
            if (window._rtBroadcast) {
                const sendResult = await window._rtBroadcast.send({
                    type: 'broadcast', event: 'schedule_updated', payload: { athlete_id: athId }
                });
                console.log('[RT] broadcast send result:', sendResult);
            }
            _sendPushNotification('athlete', athId, '📋 Nuova Scheda', 'Il tuo coach ha aggiornato il tuo programma di allenamento', 'sessione');
        }
    } catch (err) {
        console.error('Errore salvataggio schede:', err);
        toast('⚠️ Errore di rete — scheda salvata in locale, riprova tra qualche secondo.');
    }
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
        const b = document.createElement('button'); b.className = 'rpe-b'; b.textContent = v; b.dataset.v = v;
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

// ─────────────────────────────────────────────────────────────
// CALCOLATORI S&C
// ─────────────────────────────────────────────────────────────

export function calc1RM() {
    const kg  = parseFloat(document.getElementById('c1rm-kg')?.value)  || 0;
    const rep = parseInt(document.getElementById('c1rm-rep')?.value)   || 0;
    const res = document.getElementById('c1rm-result');
    if (!kg || !rep || rep < 1 || rep > 15 || !res) { if (res) res.style.display='none'; return; }

    const epley   = rep === 1 ? kg : kg * (1 + rep / 30);
    const brzycki = rep === 1 ? kg : kg * (36 / (37 - rep));
    const lander  = rep === 1 ? kg : (100 * kg) / (101.3 - 2.67123 * rep);
    const best    = Math.round((epley + brzycki + lander) / 3);

    const fmtEl = document.getElementById('c1rm-formulas');
    fmtEl.innerHTML = [
        { label: 'Epley',    val: Math.round(epley),   color: 'var(--teal)'  },
        { label: 'Brzycki',  val: Math.round(brzycki), color: 'var(--blue)'  },
        { label: 'Media',    val: best,                 color: 'var(--amber)' },
    ].map(f => `<div style="background:var(--s1);border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;margin-bottom:4px">${f.label}</div>
        <div style="font-size:22px;font-weight:800;color:${f.color}">${f.val} kg</div></div>`).join('');

    const pcts = [50,55,60,65,70,75,80,85,90,95,100];
    const tblEl = document.getElementById('c1rm-table');
    tblEl.innerHTML = pcts.map(p => {
        const v = Math.round(best * p / 100 / 2.5) * 2.5;
        const col = p >= 90 ? 'var(--coral)' : p >= 80 ? 'var(--amber)' : p >= 70 ? 'var(--teal)' : 'var(--muted)';
        return `<div style="background:var(--s1);border-radius:6px;padding:6px;text-align:center;">
            <div style="font-size:9px;color:var(--muted);font-weight:700">${p}%</div>
            <div style="font-size:14px;font-weight:800;color:${col}">${v}kg</div></div>`;
    }).join('');
    res.style.display = 'block';
}

export function calcHRZones() {
    const age    = parseInt(document.getElementById('chr-age')?.value)    || 0;
    const hrmax  = parseInt(document.getElementById('chr-hrmax')?.value)  || (age ? 220 - age : 0);
    const hrrest = parseInt(document.getElementById('chr-hrrest')?.value) || 0;
    const res    = document.getElementById('chr-result');
    if (!hrmax || !res) { if (res) res.innerHTML=''; return; }

    const useKarvonen = hrrest > 0;
    const hrr = hrmax - hrrest;

    const zones = [
        { name: 'Z1 — Recupero Attivo',    pct: [50, 60], color: '#3B82F6' },
        { name: 'Z2 — Base Aerobica',       pct: [60, 70], color: '#10B981' },
        { name: 'Z3 — Potenza Aerobica',    pct: [70, 80], color: '#F59E0B' },
        { name: 'Z4 — Soglia Lattato',      pct: [80, 90], color: '#F97316' },
        { name: 'Z5 — Massimale/Anaerobico',pct: [90,100], color: '#EF4444' },
    ];

    const hr = ([lo, hi]) => useKarvonen
        ? `${Math.round(lo/100*hrr+hrrest)} – ${Math.round(hi/100*hrr+hrrest)}`
        : `${Math.round(lo/100*hrmax)} – ${Math.round(hi/100*hrmax)}`;

    const subtitle = useKarvonen
        ? `FCmax ${hrmax} bpm · FC riposo ${hrrest} bpm · Metodo Karvonen`
        : `FCmax ${hrmax} bpm · Metodo % FCmax${age ? ` · Età ${age}` : ''}`;

    res.innerHTML = `<div style="font-size:11px;color:var(--muted);margin-bottom:10px;">${subtitle}</div>`
        + zones.map(z => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin-bottom:4px;
                    background:var(--s1);border-radius:8px;border-left:3px solid ${z.color}">
            <div style="flex:1;font-size:12px;font-weight:600;color:var(--text)">${z.name}</div>
            <div style="font-size:14px;font-weight:800;color:${z.color};white-space:nowrap">${hr(z.pct)} bpm</div>
        </div>`).join('');
}

let _vo2Tab = 'cooper';
export function setVO2Tab(tab) {
    _vo2Tab = tab;
    ['cooper','rockport','15k'].forEach(t => {
        document.getElementById(`vo2-section-${t}`).style.display = t === tab ? 'block' : 'none';
        const btn = document.getElementById(`vo2-tab-${t}`);
        if (btn) { btn.className = t === tab ? 'btn btn-p btn-sm' : 'btn btn-g btn-sm'; }
    });
    document.getElementById('vo2-result').innerHTML = '';
}

export function calcVO2() {
    const res = document.getElementById('vo2-result');
    if (!res) return;
    let vo2 = null;

    if (_vo2Tab === 'cooper') {
        const dist = parseFloat(document.getElementById('vo2-cooper-dist')?.value) || 0;
        if (dist > 0) vo2 = (dist - 504.9) / 44.73;
    } else if (_vo2Tab === 'rockport') {
        const timeStr = document.getElementById('vo2-rp-time')?.value || '';
        const hr      = parseFloat(document.getElementById('vo2-rp-hr')?.value)  || 0;
        const kg      = parseFloat(document.getElementById('vo2-rp-kg')?.value)  || 0;
        const sex     = parseFloat(document.getElementById('vo2-rp-sex')?.value) ?? 1;
        const mins    = _parseTimeToMin(timeStr);
        if (mins > 0 && hr > 0 && kg > 0) {
            const lbs = kg * 2.20462;
            vo2 = 132.853 - (0.0769 * lbs) - (0.3877 * _parseTimeToMin(timeStr) * 60 / 60)
                + (6.315 * sex) - (3.2649 * mins) - (0.1565 * hr);
        }
    } else if (_vo2Tab === '15k') {
        const timeStr = document.getElementById('vo2-15k-time')?.value || '';
        const mins    = _parseTimeToMin(timeStr);
        if (mins > 0) vo2 = 3.5 + 483 / mins;
    }

    if (vo2 == null || vo2 <= 0) { res.innerHTML = ''; return; }
    vo2 = Math.max(10, Math.round(vo2 * 10) / 10);

    const cat = vo2 < 25 ? {l:'Scarso',c:'var(--coral)'} : vo2 < 35 ? {l:'Sufficiente',c:'var(--amber)'}
              : vo2 < 45 ? {l:'Buono',c:'var(--teal)'} : vo2 < 55 ? {l:'Ottimo',c:'var(--teal)'}
              : {l:'Eccellente',c:'var(--blue)'};

    res.innerHTML = `
        <div style="display:flex;align-items:center;gap:14px;background:var(--s1);border-radius:10px;padding:14px;">
            <div style="text-align:center;flex:1">
                <div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase">VO2max stimato</div>
                <div style="font-size:32px;font-weight:800;color:var(--teal)">${vo2}</div>
                <div style="font-size:11px;color:var(--muted)">ml/kg/min</div>
            </div>
            <div style="text-align:center;flex:1">
                <div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase">Categoria</div>
                <div style="font-size:20px;font-weight:800;color:${cat.c}">${cat.l}</div>
            </div>
        </div>`;
}

export function calcVDOT() {
    const timeStr = document.getElementById('vdot-time')?.value || '';
    const dist    = parseFloat(document.getElementById('vdot-dist')?.value) || 0;
    const res     = document.getElementById('vdot-result');
    if (!res) return;

    const mins = _parseTimeToMin(timeStr);
    if (!mins || !dist) { res.innerHTML = ''; return; }

    const v = dist / mins; // m/min
    const vo2Race = -4.60 + 0.182258 * v + 0.000104 * v * v;
    const pct = 0.8 + 0.1894393 * Math.exp(-0.012778 * mins) + 0.2989558 * Math.exp(-0.1932605 * mins);
    const vdot = Math.round(vo2Race / pct * 10) / 10;

    const zonesPct = [
        { name: 'Easy / Long',   lo: 0.59, hi: 0.74, color: '#3B82F6', desc: 'Recupero e base aerobica' },
        { name: 'Marathon',      lo: 0.75, hi: 0.84, color: '#10B981', desc: 'Ritmo maratona' },
        { name: 'Threshold',     lo: 0.83, hi: 0.88, color: '#F59E0B', desc: 'Soglia lattato — 20-40 min' },
        { name: 'Interval',      lo: 0.95, hi: 1.00, color: '#F97316', desc: 'VO2max — 3-5 min' },
        { name: 'Repetition',    lo: 1.05, hi: 1.17, color: '#EF4444', desc: 'Economia — 60-200s' },
    ];

    const paceFromPct = p => {
        const targetVO2 = vdot * p;
        const vel = (-0.182258 + Math.sqrt(0.182258 ** 2 + 4 * 0.000104 * (targetVO2 + 4.60))) / (2 * 0.000104);
        return vel > 0 ? 1000 / vel : null; // min/km
    };
    const fmtPace = m => {
        if (!m || m <= 0) return '—';
        const min = Math.floor(m); const sec = Math.round((m - min) * 60);
        return `${min}:${sec.toString().padStart(2,'0')} /km`;
    };

    res.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;background:var(--s1);border-radius:8px;padding:10px 14px;margin-bottom:10px;">
            <div><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase">VDOT</div>
                <div style="font-size:28px;font-weight:800;color:var(--teal)">${vdot}</div></div>
            <div style="color:var(--muted);font-size:12px;">Distanza: ${(dist/1000).toFixed(2)}km · Tempo: ${timeStr}</div>
        </div>
        ${zonesPct.map(z => {
            const lo = paceFromPct(z.lo), hi = paceFromPct(z.hi);
            return `<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;margin-bottom:4px;
                        background:var(--s1);border-radius:8px;border-left:3px solid ${z.color}">
                <div style="flex:1"><div style="font-size:12px;font-weight:700;color:var(--text)">${z.name}</div>
                    <div style="font-size:10px;color:var(--muted)">${z.desc}</div></div>
                <div style="font-size:13px;font-weight:800;color:${z.color};white-space:nowrap">${fmtPace(hi)} – ${fmtPace(lo)}</div>
            </div>`;
        }).join('')}`;
}

export function calcPace(from) {
    const kmhEl    = document.getElementById('pace-kmh');
    const minkmEl  = document.getElementById('pace-minkm');
    const minmiEl  = document.getElementById('pace-minmi');
    if (!kmhEl || !minkmEl || !minmiEl) return;

    let kmh;
    if (from === 'kmh') {
        kmh = parseFloat(kmhEl.value) || 0;
    } else if (from === 'minkm') {
        kmh = _minPerKmToKmh(minkmEl.value);
    } else {
        const minkm = _minPerMiToMinPerKm(minmiEl.value);
        kmh = _minPerKmToKmh(_fmtMinKm(minkm));
    }
    if (!kmh || kmh <= 0) return;

    const minkm  = 60 / kmh;
    const minmi  = minkm * 1.60934;

    if (from !== 'kmh')    kmhEl.value   = kmh.toFixed(2);
    if (from !== 'minkm')  minkmEl.value = _fmtMinKm(minkm);
    if (from !== 'minmi')  minmiEl.value = _fmtMinKm(minmi);
}

function _parseTimeToMin(str) {
    if (!str) return 0;
    const p = str.trim().split(':').map(Number);
    if (p.length === 3) return p[0]*60 + p[1] + p[2]/60;
    if (p.length === 2) return p[0] + p[1]/60;
    return parseFloat(str) || 0;
}
function _fmtMinKm(m) {
    if (!m || m <= 0) return '';
    const min = Math.floor(m); const sec = Math.round((m - min)*60);
    return `${min}:${sec.toString().padStart(2,'0')}`;
}
function _minPerKmToKmh(str) {
    const m = _parseTimeToMin(str);
    return m > 0 ? 60 / m : 0;
}
function _minPerMiToMinPerKm(str) {
    const m = _parseTimeToMin(str);
    return m > 0 ? m / 1.60934 : 0;
}

// ─────────────────────────────────────────────────────────────
// RPE TARGET vs PERCEPITO
// ─────────────────────────────────────────────────────────────

/**
 * Calcola l'RPE medio programmato per una sessione di un atleta.
 * Legge ex.rpe da DB.schedules[athId].sessions[sessName].
 * Restituisce null se nessun esercizio ha RPE target impostato.
 */
export function calcPlannedRPE(athId, sessName) {
    const sch  = DB.schedules[athId];
    if (!sch || !sch.sessions) return null;
    const sess = sch.sessions.find(s => s.name === sessName);
    if (!sess || !sess.exercises) return null;
    const vals = sess.exercises
        .map(e => parseFloat(e.rpe))
        .filter(v => !isNaN(v) && v > 0);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : null;
}

/**
 * Badge HTML comparazione RPE pianificato vs percepito.
 * plannedRpe: numero|null, actualRpe: numero|null
 */
export function rpeCompareBadge(plannedRpe, actualRpe) {
    if (!actualRpe) return `<span style="color:var(--amber);font-weight:700">${actualRpe || '—'}</span>`;
    if (!plannedRpe) return `<span style="color:var(--amber);font-weight:700">${actualRpe}</span>`;
    const delta = actualRpe - plannedRpe;
    const absDelta = Math.abs(delta);
    const col = absDelta <= 1 ? 'var(--teal)' : absDelta <= 2 ? 'var(--amber)' : 'var(--coral)';
    const sign = delta > 0 ? '+' : '';
    return `<span style="font-size:11px;font-weight:700;color:var(--muted)">P:${plannedRpe}</span>
            <span style="color:var(--muted);margin:0 2px">→</span>
            <span style="font-weight:800;color:${col}">A:${actualRpe}</span>
            <span style="font-size:10px;color:${col};margin-left:2px">(${sign}${delta.toFixed(1)})</span>`;
}

// ─────────────────────────────────────────────────────────────
// PERFORMANCE TEST DATABASE
// ─────────────────────────────────────────────────────────────

const TEST_LIBRARY = {
    'Velocità':   [
        { name:'10m Sprint',    unit:'s',    lib:true },
        { name:'20m Sprint',    unit:'s',    lib:true },
        { name:'30m Sprint',    unit:'s',    lib:true },
        { name:'40m Sprint',    unit:'s',    lib:true },
        { name:'60m Sprint',    unit:'s',    lib:true },
        { name:'100m Sprint',   unit:'s',    lib:true },
    ],
    'Potenza':    [
        { name:'CMJ',           unit:'cm',   lib:false },
        { name:'Squat Jump',    unit:'cm',   lib:false },
        { name:'Broad Jump',    unit:'cm',   lib:false },
        { name:'Drop Jump RSI', unit:'',     lib:false },
        { name:'Lancio Palla',  unit:'m',    lib:false },
    ],
    'Agilità':    [
        { name:'T-Test',        unit:'s',    lib:true },
        { name:'505 Agility',   unit:'s',    lib:true },
        { name:'Illinois',      unit:'s',    lib:true },
        { name:'5-10-5 Shuttle',unit:'s',    lib:true },
    ],
    'Resistenza': [
        { name:'Cooper 12min',  unit:'m',    lib:false },
        { name:'Yo-Yo IR1',     unit:'m',    lib:false },
        { name:'Yo-Yo IR2',     unit:'m',    lib:false },
        { name:'3km TT',        unit:'mm:ss',lib:true  },
        { name:'5km TT',        unit:'mm:ss',lib:true  },
    ],
    'Forza':      [
        { name:'1RM Squat',     unit:'kg',   lib:false },
        { name:'1RM Panca Piana',unit:'kg',  lib:false },
        { name:'1RM Stacco',    unit:'kg',   lib:false },
        { name:'Pull-up Max',   unit:'reps', lib:false },
        { name:'IMTP',          unit:'N/kg', lib:false },
    ],
    'Mobilità':   [
        { name:'Sit & Reach',   unit:'cm',   lib:false },
        { name:'FMS Totale',    unit:'pts',  lib:false },
    ],
};

// lowerIsBetter per categoria/test
function _testLowerIsBetter(cat, name) {
    if (cat === 'Velocità' || cat === 'Agilità') return true;
    if (cat === 'Resistenza' && name.includes('TT')) return true;
    return false;
}

export function openTestModal() {
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('tst-date').value  = today;
    document.getElementById('tst-cat').value   = '';
    document.getElementById('tst-value').value = '';
    document.getElementById('tst-unit').value  = '';
    document.getElementById('tst-notes').value = '';
    document.getElementById('tst-custom-name-row').style.display = 'none';

    // Popola atleta select
    const athEl = document.getElementById('tst-ath');
    athEl.innerHTML = DB.athletes.map(a =>
        `<option value="${escHtml(a.id)}" ${a.id === appState.selAthId ? 'selected' : ''}>${escHtml(a.name)}</option>`
    ).join('');

    onTestCategoryChange();
    openMo('mo-test');
}

export function onTestCategoryChange() {
    const cat   = document.getElementById('tst-cat').value;
    const nameEl= document.getElementById('tst-name');
    const customRow = document.getElementById('tst-custom-name-row');

    if (!cat || cat === 'Personalizzato') {
        nameEl.innerHTML = '<option value="">—</option>';
        nameEl.disabled = true;
        customRow.style.display = cat === 'Personalizzato' ? 'block' : 'none';
        document.getElementById('tst-unit').value = '';
        return;
    }
    nameEl.disabled = false;
    customRow.style.display = 'none';
    const tests = TEST_LIBRARY[cat] || [];
    nameEl.innerHTML = '<option value="">Seleziona test...</option>'
        + tests.map(t => `<option value="${escHtml(t.name)}" data-unit="${escHtml(t.unit)}">${escHtml(t.name)}</option>`).join('');
    document.getElementById('tst-unit').value = '';
}

export function onTestNameChange() {
    const nameEl = document.getElementById('tst-name');
    const opt = nameEl.options[nameEl.selectedIndex];
    if (opt && opt.dataset.unit) document.getElementById('tst-unit').value = opt.dataset.unit;
}

export async function saveTest() {
    const date  = document.getElementById('tst-date').value;
    const athId = document.getElementById('tst-ath').value;
    const cat   = document.getElementById('tst-cat').value;
    const value = parseFloat(document.getElementById('tst-value').value);
    const unit  = document.getElementById('tst-unit').value.trim();
    const notes = document.getElementById('tst-notes').value.trim();

    let testName;
    if (cat === 'Personalizzato') {
        testName = document.getElementById('tst-custom-name').value.trim();
    } else {
        testName = document.getElementById('tst-name').value;
    }

    if (!date || !athId || !testName || isNaN(value)) {
        toast('Compila data, test e valore'); return;
    }

    const ath = DB.athletes.find(a => a.id === athId);
    if (!ath) return;
    if (!ath.testHistory) ath.testHistory = [];

    ath.testHistory.push({
        id:   uid(),
        date, category: cat || 'Personalizzato',
        test: testName, value, unit,
        lowerIsBetter: _testLowerIsBetter(cat, testName),
        notes
    });

    await saveDB();
    closeMo('mo-test');
    renderAnalytics();
    toast('✅ Test salvato');
}

// ─────────────────────────────────────────────────────────────
// BODY COMPOSITION TRACKING
// ─────────────────────────────────────────────────────────────

export function openBodyCompModal() {
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('bc-date').value   = today;
    document.getElementById('bc-weight').value = '';
    document.getElementById('bc-bf').value     = '';
    document.getElementById('bc-notes').value  = '';
    document.getElementById('bc-sf1').value    = '';
    document.getElementById('bc-sf2').value    = '';
    document.getElementById('bc-sf3').value    = '';
    document.getElementById('bc-jp-result').textContent = '';
    document.getElementById('bc-skinfold-toggle').checked = false;
    document.getElementById('bc-skinfold-section').style.display = 'none';

    // Pre-fill dall'ultima misurazione dell'atleta selezionato
    const ath = DB.athletes.find(a => a.id === appState.selAthId);
    if (ath && ath.anthropoHistory && ath.anthropoHistory.length) {
        const last = ath.anthropoHistory[ath.anthropoHistory.length - 1];
        if (last.weight) document.getElementById('bc-weight').value = last.weight;
        if (last.bf != null) document.getElementById('bc-bf').value = last.bf;
    }
    openMo('mo-body-comp');
}

export function toggleSkinfoldInputs() {
    const show = document.getElementById('bc-skinfold-toggle').checked;
    document.getElementById('bc-skinfold-section').style.display = show ? 'block' : 'none';
    if (!show) document.getElementById('bc-jp-result').textContent = '';
    _updateSkinfoldLabels();
}

function _updateSkinfoldLabels() {
    const sex = document.getElementById('bc-sex')?.value || 'M';
    const l1 = document.getElementById('bc-lbl-1');
    const l2 = document.getElementById('bc-lbl-2');
    const l3 = document.getElementById('bc-lbl-3');
    if (!l1) return;
    if (sex === 'M') { l1.textContent = 'PETTO'; l2.textContent = 'ADDOME'; l3.textContent = 'COSCIA'; }
    else             { l1.textContent = 'TRICIPITE'; l2.textContent = 'SOPRAILIACA'; l3.textContent = 'COSCIA'; }
}

export function calcBFFromSkinfolds() {
    _updateSkinfoldLabels();
    const sex  = document.getElementById('bc-sex')?.value || 'M';
    const age  = parseFloat(document.getElementById('bc-age')?.value) || 25;
    const s1   = parseFloat(document.getElementById('bc-sf1')?.value) || 0;
    const s2   = parseFloat(document.getElementById('bc-sf2')?.value) || 0;
    const s3   = parseFloat(document.getElementById('bc-sf3')?.value) || 0;
    const res  = document.getElementById('bc-jp-result');
    if (!s1 || !s2 || !s3) { if (res) res.textContent = ''; return; }

    const sum = s1 + s2 + s3;
    let bd;
    if (sex === 'M') {
        bd = 1.10938 - (0.0008267 * sum) + (0.0000016 * sum * sum) - (0.0002574 * age);
    } else {
        bd = 1.0994921 - (0.0009929 * sum) + (0.0000023 * sum * sum) - (0.0001392 * age);
    }
    const bf = Math.max(0, (495 / bd) - 450);
    const bfRounded = bf.toFixed(1);

    if (res) res.textContent = `→ BF% stimato: ${bfRounded}% (Σ pliche: ${sum}mm)`;
    const bfEl = document.getElementById('bc-bf');
    if (bfEl) bfEl.value = bfRounded;
}

export async function saveBodyComp() {
    const date   = document.getElementById('bc-date').value;
    const weight = parseFloat(document.getElementById('bc-weight').value);
    const bf     = parseFloat(document.getElementById('bc-bf').value);
    const notes  = document.getElementById('bc-notes').value.trim();

    if (!date || (!weight && bf == null)) { toast('Inserisci almeno data e peso'); return; }

    const ath = DB.athletes.find(a => a.id === appState.selAthId);
    if (!ath) { toast('Nessun atleta selezionato'); return; }
    if (!ath.anthropoHistory) ath.anthropoHistory = [];

    const entry = { date, weight: weight || null, bf: isNaN(bf) ? null : bf, notes };

    const useSkinfolds = document.getElementById('bc-skinfold-toggle')?.checked;
    if (useSkinfolds) {
        const s1 = parseFloat(document.getElementById('bc-sf1').value) || 0;
        const s2 = parseFloat(document.getElementById('bc-sf2').value) || 0;
        const s3 = parseFloat(document.getElementById('bc-sf3').value) || 0;
        if (s1 && s2 && s3) entry.skinfolds = [s1, s2, s3];
    }

    // Sostituisce se stessa data, altrimenti push
    const existIdx = ath.anthropoHistory.findIndex(h => h.date === date);
    if (existIdx >= 0) ath.anthropoHistory[existIdx] = entry;
    else               ath.anthropoHistory.push(entry);

    // Aggiorna anche i campi di riferimento sull'atleta
    if (weight) ath.weight = weight;
    if (!isNaN(bf)) ath.bf = bf;

    await saveDB();
    closeMo('mo-body-comp');
    renderBodyComp(ath);
    toast('✅ Misurazione salvata');
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
                    const { error } = await window.mySupabase.from('schedules').update({ exercises: curSess.exercises }).eq('id', curSess.id);
                    if (error) console.error('[saveFeedback] Errore sync carichi Supabase:', error);
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
    const cleanVars   = (document.getElementById('pw-vars')?.value || '').trim();
    const generatedId = DB.sessions.find(s => s.athlete===appState.selAthId && s.session===sessionName && s.date===today)?.id || ('sess_'+uid());

    DB.sessions = DB.sessions.filter(s => !(s.athlete===appState.selAthId && s.session===sessionName && s.date===today));

    const plannedRpe = sessType === 'Palestra' ? calcPlannedRPE(appState.selAthId, sessionName) : null;

    const sessObj = {
        id: generatedId, athlete: appState.selAthId, date: today,
        session: sessType==='Palestra' ? sessionName : `Allenamento ${sessType}`, sessionType: sessType,
        week: currentWeekNum, phase: DB.schedules[appState.selAthId] ? DB.schedules[appState.selAthId].phase : 'Accumulo',
        readiness: document.getElementById('ring-n') ? parseInt(document.getElementById('ring-n').textContent) : 80,
        vol: sessType==='Palestra' ? vol : 0, sRPE, rpe: appState.pwRpe, plannedRpe, qual: appState.pwStars, hrv: hrvVal,
        maxE1rm:  sessType==='Palestra' ? (window.liveMaxE1rm||0) : 0,
        e1rmDom:  sessType==='Palestra' ? (window.liveE1rmDom||0)  : 0,
        e1rmNDom: sessType==='Palestra' ? (window.liveE1rmNDom||0) : 0,
        doms: cleanDOMS, flag: cleanFlags, notes: cleanNotes, variations: cleanVars, reply: ''
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
                doms: cleanDOMS, flag: cleanFlags, notes: cleanNotes, variations: cleanVars, reply: ''
            }]);
            if (error) { toast('⚠️ Sync Cloud fallita. Dati salvati in locale.'); }
            else {
                if (ath) await window.mySupabase.from('atleti').update({ anthropo_history: ath.anthropoHistory }).eq('id', appState.selAthId);
                toast('Allenamento registrato e sincronizzato nel Cloud! ✓');
                const nomeAtleta = ath ? ath.name.split(' ')[0] : 'Un atleta';
                _sendPushNotification('coach', null, '💪 Allenamento Completato', `${nomeAtleta} ha completato un allenamento`, 'storico');
                window.realLog = {};
            }
        } else { window.realLog = {}; }
    } catch (err) { console.error(err); }

    initFB(); loadLive(); renderDashboard();
    if (window.userRole === 'ATLETA') showAthSummary(sessObj);
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
export function exportProgramPDF() {
    const athId = appState.selAthId || (document.getElementById('ed-ath') && document.getElementById('ed-ath').value);
    const ath   = athById(athId);
    const sch   = DB.schedules[athId];
    if (!ath || !sch) { toast('Seleziona un atleta con una scheda attiva.'); return; }

    const sessionsHTML = (sch.sessions || []).map(s => {
        const exRows = (s.exercises || []).map(ex => {
            if (ex.type === 'circuit') {
                const circEx = (ex.circuitExercises || []).map(ce => {
                    const vLink = ce.video ? `<a href="${ce.video}" target="_blank" style="color:#f97316;font-size:10px;font-weight:700;text-decoration:none;margin-left:6px">▶ Video</a>` : '';
                    return `<tr><td style="padding:4px 8px;color:#555">${escHtml(ce.name)}${vLink}</td><td colspan="7" style="padding:4px 8px;color:#888;font-size:11px">${escHtml(ce.note || '')}</td></tr>`;
                }).join('');
                return `<tr style="background:#fff7ed"><td colspan="8" style="padding:6px 8px;font-weight:700;color:#9a3412">⏱ Circuito: ${escHtml(ex.name)} — ${ex.circuitMeta ? `${ex.circuitMeta.rounds} round · ${ex.circuitMeta.workTime}s lavoro · ${ex.circuitMeta.restBetweenEx}s riposo` : ''}</td></tr>${circEx}`;
            }
            const progStr = ex.progression && Object.keys(ex.progression).length
                ? Object.entries(ex.progression).sort(([a],[b]) => a.localeCompare(b, undefined, { numeric: true })).map(([w, v]) => `${w.toUpperCase()}: ${v.set}x${v.rep}@${v.kg}kg`).join(' | ')
                : '';
            const vLink = ex.ytUrl ? `<a href="${ex.ytUrl}" target="_blank" style="color:#f97316;font-size:10px;font-weight:700;text-decoration:none;margin-left:6px">▶ Video</a>` : '';
            return `<tr>
                <td style="padding:5px 8px">${escHtml(ex.name || '')}${vLink}</td>
                <td style="padding:5px 8px;text-align:center">${escHtml(String(ex.wset ?? ''))}</td>
                <td style="padding:5px 8px;text-align:center">${escHtml(String(ex.set ?? ''))}</td>
                <td style="padding:5px 8px;text-align:center">${escHtml(String(ex.rep ?? ''))}</td>
                <td style="padding:5px 8px;text-align:center">${escHtml(String(ex.kg ?? ''))}</td>
                <td style="padding:5px 8px;text-align:center">${escHtml(String(ex.rir ?? ''))}</td>
                <td style="padding:5px 8px;text-align:center">${escHtml(ex.rest || '')}</td>
                <td style="padding:5px 8px;font-size:11px;color:#555">${escHtml(ex.note || '')}${progStr ? `<br><em style="color:#888">${progStr}</em>` : ''}</td>
            </tr>`;
        }).join('');
        return `<div style="margin-bottom:28px;page-break-inside:avoid">
            <h3 style="background:#431407;color:#fff;padding:10px 14px;border-radius:6px;margin-bottom:0;font-size:14px">${escHtml(s.name)}</h3>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead><tr style="background:#f1f5f9">
                    <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #e2e8f0">Esercizio</th>
                    <th style="padding:6px 8px">W-Set</th><th style="padding:6px 8px">Set</th>
                    <th style="padding:6px 8px">Rep</th><th style="padding:6px 8px">Kg</th>
                    <th style="padding:6px 8px">RIR</th><th style="padding:6px 8px">Rest</th>
                    <th style="padding:6px 8px;text-align:left">Note</th>
                </tr></thead>
                <tbody>${exRows || '<tr><td colspan="8" style="padding:8px;color:#888;font-style:italic">Nessun esercizio</td></tr>'}</tbody>
            </table>
        </div>`;
    }).join('');

    const w = window.open('', '_blank');
    if (!w) { toast('Popup bloccato — abilita i popup per esportare il PDF.'); return; }
    w.document.write(`<!DOCTYPE html><html lang="it"><head>
        <meta charset="UTF-8"><title>Scheda — ${escHtml(ath.name)}</title>
        <style>
            body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:28px;color:#1e293b;background:#fff}
            h1{font-size:22px;font-weight:800;margin-bottom:4px}
            h2{font-size:14px;color:#475569;font-weight:400;margin-top:0;margin-bottom:18px}
            .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #f97316}
            .brand{font-size:11px;font-weight:800;color:#f97316;letter-spacing:.15em;text-transform:uppercase}
            .meta{display:flex;gap:16px;flex-wrap:wrap;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 18px;margin-bottom:24px;font-size:13px}
            .meta div{display:flex;flex-direction:column;gap:2px}
            .meta strong{font-size:11px;text-transform:uppercase;color:#ea580c;letter-spacing:.04em}
            table th,table td{border-bottom:1px solid #e2e8f0}
            @media print{body{padding:10px}button{display:none!important}.no-print{display:none!important}}
        </style>
    </head><body>
        <div class="header">
          <div>
            <h1 style="margin:0">${escHtml(ath.name)}</h1>
            <h2 style="margin:4px 0 0">${escHtml(ath.level || '')}${ath.goal ? ' · ' + escHtml(ath.goal) : ''}</h2>
          </div>
          <div class="brand">Elite Sports Science</div>
        </div>
        <div class="meta">
            <div><strong>Mesociclo</strong>${escHtml(sch.meso || '—')}</div>
            <div><strong>Fase</strong>${escHtml(sch.phase || '—')}</div>
            <div><strong>Durata</strong>${sch.duration || 4} settimane</div>
            ${sch.objective ? `<div><strong>Obiettivo</strong>${escHtml(sch.objective)}</div>` : ''}
        </div>
        ${sch.coachNote ? `<div style="margin-bottom:20px;padding:10px 14px;background:#fff7ed;border-left:3px solid #f97316;border-radius:0 6px 6px 0;font-size:13px;color:#9a3412"><strong>Note Coach:</strong> ${escHtml(sch.coachNote)}</div>` : ''}
        ${sessionsHTML}
        <div style="margin-top:40px;text-align:center;padding-top:20px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">
            Generato da Elite Sports Science · ${new Date().toLocaleDateString('it-IT')}
        </div>
        <div class="no-print" style="margin-top:20px;text-align:center">
            <button onclick="window.print()" style="padding:12px 32px;background:#f97316;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(249,115,22,0.3)">
                📄 Stampa / Salva PDF
            </button>
        </div>
    </body></html>`);
    w.document.close();
    w.focus();
}

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

export function confirmReset() {
    showConfirm('Eliminare tutto? Tutti i dati locali verranno cancellati permanentemente.', async () => {
        await localforage.removeItem(KEY); location.reload();
    }, 'Elimina tutto');
}


// ─────────────────────────────────────────────────────────────
// MESSAGGISTICA DIRETTA
// ─────────────────────────────────────────────────────────────
export function renderMessaggi() {
    const athId = appState.selAthId;
    const selEl = document.getElementById('msg-ath-select');
    if (selEl) {
        selEl.innerHTML = DB.athletes.map(a => `<option value="${escHtml(a.id)}"${a.id === athId ? ' selected' : ''}>${escHtml(a.name)}</option>`).join('');
        selEl.onchange = () => { appState.selAthId = selEl.value; renderMessaggi(); };
    }

    const thread = document.getElementById('msg-thread');
    if (!thread) return;
    const msgs = (DB.messages && DB.messages[athId]) ? DB.messages[athId] : [];

    if (!msgs.length) {
        thread.innerHTML = `<div style="text-align:center;color:var(--muted);padding:30px 20px;font-size:13px">Nessun messaggio con questo atleta.</div>`;
    } else {
        thread.innerHTML = msgs.map(m => {
            const isCoach = m.from_type === 'coach';
            const time    = m.created_at ? new Date(m.created_at).toLocaleString('it-IT', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
            return `<div style="display:flex;flex-direction:column;align-items:${isCoach ? 'flex-end' : 'flex-start'};margin-bottom:10px">
                <div style="max-width:78%;padding:10px 14px;border-radius:${isCoach ? '14px 14px 4px 14px' : '14px 14px 14px 4px'};background:${isCoach ? 'var(--teal)' : 'rgba(139,92,246,0.15)'};color:${isCoach ? '#000' : 'var(--text)'};font-size:13px;line-height:1.5;word-break:break-word">${escHtml(m.content)}</div>
                <div style="font-size:10px;color:var(--muted);margin-top:3px;padding:0 4px">${time}</div>
            </div>`;
        }).join('');
        thread.scrollTop = thread.scrollHeight;
    }

    if (athId && window.mySupabase) {
        const unread = msgs.filter(m => m.from_type === 'athlete' && !m.read_at);
        if (unread.length) {
            const ids = unread.map(m => m.id);
            window.mySupabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', ids).then(() => {
                unread.forEach(m => { m.read_at = new Date().toISOString(); });
                updateMsgBadge();
            });
        }
    }
}

export async function sendMessageCoach() {
    const input = document.getElementById('msg-input');
    const content = (input ? input.value : '').trim();
    if (!content) return;
    const athId = appState.selAthId;
    if (!athId) { toast('Seleziona un atleta.'); return; }

    input.value = '';
    input.disabled = true;

    const msg = { athlete_id: athId, from_type: 'coach', content, created_at: new Date().toISOString(), read_at: new Date().toISOString() };

    try {
        if (window.mySupabase) {
            const { data, error } = await window.mySupabase.from('messages').insert([{ athlete_id: athId, from_type: 'coach', content }]).select().single();
            if (!error && data) { msg.id = data.id; msg.created_at = data.created_at; }
            else if (error) { toast('Errore invio: ' + error.message); input.disabled = false; return; }
        }
    } catch (e) { toast('Errore connessione.'); input.disabled = false; return; }

    if (!DB.messages) DB.messages = {};
    if (!DB.messages[athId]) DB.messages[athId] = [];
    DB.messages[athId].push(msg);
    input.disabled = false;
    renderMessaggi();
    _sendPushNotification('athlete', athId, '💬 Messaggio dal Coach', content.slice(0, 80), 'coach-reply');
}

export function renderAthleteChat() {
    const athId  = window.mioIdLoggato;
    const thread = document.getElementById('athlete-chat-thread');
    if (!thread) return;
    const msgs = (DB.messages && DB.messages[athId]) ? DB.messages[athId] : [];

    if (!msgs.length) {
        thread.innerHTML = `<div style="text-align:center;color:var(--muted);padding:30px 20px;font-size:13px">Nessun messaggio con il tuo coach.</div>`;
    } else {
        thread.innerHTML = msgs.map(m => {
            const isAth = m.from_type === 'athlete';
            const time  = m.created_at ? new Date(m.created_at).toLocaleString('it-IT', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
            return `<div style="display:flex;flex-direction:column;align-items:${isAth ? 'flex-end' : 'flex-start'};margin-bottom:10px">
                <div style="max-width:78%;padding:10px 14px;border-radius:${isAth ? '14px 14px 4px 14px' : '14px 14px 14px 4px'};background:${isAth ? 'rgba(139,92,246,0.7)' : 'var(--teal)'};color:${isAth ? '#fff' : '#000'};font-size:13px;line-height:1.5;word-break:break-word">${escHtml(m.content)}</div>
                <div style="font-size:10px;color:var(--muted);margin-top:3px;padding:0 4px">${time}</div>
            </div>`;
        }).join('');
        thread.scrollTop = thread.scrollHeight;
    }

    if (athId && window.mySupabase) {
        const unread = msgs.filter(m => m.from_type === 'coach' && !m.read_at);
        if (unread.length) {
            const ids = unread.map(m => m.id);
            window.mySupabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', ids).then(() => {
                unread.forEach(m => { m.read_at = new Date().toISOString(); });
            });
        }
    }
}

export async function sendMessageAthleta() {
    const input   = document.getElementById('athlete-chat-input');
    const content = (input ? input.value : '').trim();
    if (!content) return;
    const athId = window.mioIdLoggato;
    if (!athId) return;

    input.value = '';
    input.disabled = true;

    const msg = { athlete_id: athId, from_type: 'athlete', content, created_at: new Date().toISOString() };

    try {
        if (window.mySupabase) {
            const { data, error } = await window.mySupabase.from('messages').insert([{ athlete_id: athId, from_type: 'athlete', content }]).select().single();
            if (!error && data) { msg.id = data.id; msg.created_at = data.created_at; }
            else if (error) { toast('Errore invio: ' + error.message); input.disabled = false; return; }
        }
    } catch (e) { toast('Errore connessione.'); input.disabled = false; return; }

    if (!DB.messages) DB.messages = {};
    if (!DB.messages[athId]) DB.messages[athId] = [];
    DB.messages[athId].push(msg);
    input.disabled = false;
    renderAthleteChat();
    _sendPushNotification('coach', null, '💬 Messaggio da Atleta', content.slice(0, 80), 'messaggi');
}

export function updateMsgBadge() {
    // Coach badge (messages from athletes unread)
    const coachEl = document.getElementById('nb-msg');
    if (coachEl) {
        let unread = 0;
        if (DB.messages) {
            Object.values(DB.messages).forEach(msgs => {
                unread += msgs.filter(m => m.from_type === 'athlete' && !m.read_at).length;
            });
        }
        coachEl.textContent = unread;
        coachEl.style.display = unread > 0 ? '' : 'none';
    }
    // Athlete badge (messages from coach unread)
    const athEl = document.getElementById('bb-msg-badge');
    if (athEl && window.mioIdLoggato) {
        const msgs = (DB.messages && DB.messages[window.mioIdLoggato]) || [];
        const unreadAth = msgs.filter(m => m.from_type === 'coach' && !m.read_at).length;
        athEl.textContent = unreadAth;
        athEl.style.display = unreadAth > 0 ? '' : 'none';
    }
}

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
        const d    = (prev && prev.vol > 0) ? ((s.vol - prev.vol) / prev.vol * 100) : null;
        const ds   = d === null ? '—' : (d >= 0 ? '+' : '') + d.toFixed(1) + '%';
        const div  = document.createElement('div'); div.className = 'pb-row';
        div.innerHTML = `<div class="pb-week">W${s.week}</div><div class="pb-phase">${escHtml(s.phase)}</div>
            <div class="pb-track"><div class="pb-fill" style="width:${Math.round(s.vol/maxV*100)}%;background:var(--teal)"></div></div>
            <div class="pb-vol">${(s.vol/1000).toFixed(2)} t</div><div class="pb-d">${ds}</div>`;
        wrap.appendChild(div);
    });
}


// ─────────────────────────────────────────────────────────────
// MACRO PERIODIZZAZIONE
// ─────────────────────────────────────────────────────────────
const _MACRO_PHASES = ['Accumulo', 'Intensificazione', 'Picco', 'Scarico'];
const _MACRO_COLORS = {
    'Accumulo':         'var(--teal)',
    'Intensificazione': 'var(--amber)',
    'Picco':            'var(--coral)',
    'Scarico':          'var(--blue)',
    '':                 'var(--border)'
};
const _MACRO_SHORT  = { 'Accumulo':'ACC', 'Intensificazione':'INT', 'Picco':'PIC', 'Scarico':'SCA', '':'—' };

function _getMacroPlan(athId) {
    if (!DB.macroPlans[athId]) DB.macroPlans[athId] = { weeks: 12, plan: [] };
    const mp = DB.macroPlans[athId];
    const weeks = mp.weeks || 12;
    // Ensure plan has an entry for every week
    for (let w = 1; w <= weeks; w++) {
        if (!mp.plan.find(p => p.week === w)) {
            mp.plan.push({ week: w, phase: '', targetSessions: 4, notes: '' });
        }
    }
    mp.plan = mp.plan.filter(p => p.week <= weeks).sort((a, b) => a.week - b.week);
    return mp;
}

export function renderMacro() {
    const athSel = document.getElementById('macro-ath');
    if (athSel) {
        athSel.innerHTML = DB.athletes.map(a =>
            `<option value="${escHtml(a.id)}"${a.id === appState.selAthId ? ' selected' : ''}>${escHtml(a.name)}</option>`
        ).join('');
        athSel.onchange = () => { appState.selAthId = athSel.value; renderMacro(); };
    }

    const athId = appState.selAthId;
    if (!athId) return;

    const mp = _getMacroPlan(athId);

    // Sync weeks selector
    const wkSel = document.getElementById('macro-weeks');
    if (wkSel) wkSel.value = mp.weeks;

    // Historical data per mesocycle week
    const hist = {};
    DB.sessions.filter(s => s.athlete === athId).forEach(s => {
        const w = s.week;
        if (!w) return;
        if (!hist[w]) hist[w] = { count: 0, vol: 0 };
        hist[w].count++;
        hist[w].vol += s.vol || 0;
    });

    // Build grid
    const grid = document.getElementById('macro-grid');
    if (!grid) return;

    const weekCols = mp.plan.map(wp => {
        const c    = _MACRO_COLORS[wp.phase];
        const s    = _MACRO_SHORT[wp.phase];
        const h    = hist[wp.week];
        const done = h ? h.count : null;
        const vol  = h ? (h.vol / 1000).toFixed(1) + 't' : '—';
        const hit  = done !== null && done >= (wp.targetSessions || 4);

        return `<div style="min-width:68px;text-align:center;padding:0 3px">
            <div style="font-size:10px;font-weight:700;color:var(--muted);margin-bottom:5px">W${wp.week}</div>
            <div onclick="cycleMacroPhase(${wp.week})" title="Clicca per cambiare fase"
                 style="background:${c}22;border:2px solid ${c};border-radius:8px;
                        padding:8px 2px;cursor:pointer;margin-bottom:6px;
                        font-size:11px;font-weight:800;color:${c};
                        letter-spacing:.04em;user-select:none;transition:opacity .15s">
                ${escHtml(s)}
            </div>
            <div style="font-size:9px;color:var(--muted);margin-bottom:2px">Target</div>
            <input type="number" min="1" max="7" value="${wp.targetSessions || 4}"
                style="width:48px;text-align:center;font-size:13px;font-weight:700;
                       background:var(--s2);border:1px solid var(--border);border-radius:6px;
                       padding:4px 0;color:var(--text)"
                onchange="setMacroSessions(${wp.week},+this.value)">
            <div style="margin-top:6px;font-size:11px;font-weight:700;
                        color:${done===null ? 'var(--border)' : hit ? 'var(--teal)' : 'var(--amber)'}">
                ${done !== null ? done + '/' + (wp.targetSessions||4) : '—'}
            </div>
            <div style="font-size:10px;color:var(--muted)">${vol}</div>
        </div>`;
    }).join('');

    grid.innerHTML = `<div style="display:flex;gap:6px;min-width:max-content">${weekCols}</div>`;

    // Summary bar
    const counts = {};
    mp.plan.forEach(wp => { counts[wp.phase || ''] = (counts[wp.phase || ''] || 0) + 1; });
    const total = mp.weeks;
    const summarySegs = _MACRO_PHASES.map(ph => {
        const n = counts[ph] || 0;
        if (!n) return '';
        const pct = Math.round(n / total * 100);
        return `<div style="flex:${n};background:${_MACRO_COLORS[ph]};height:100%;
                              display:flex;align-items:center;justify-content:center;
                              font-size:10px;font-weight:800;color:#000;opacity:.85;
                              border-radius:4px;min-width:32px">
                    ${pct}%
                </div>`;
    }).join('');

    const undefinedN = counts[''] || 0;
    const summaryEl = document.getElementById('macro-summary');
    if (summaryEl) summaryEl.innerHTML = `
        <div style="font-size:11px;color:var(--muted);margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">
            Distribuzione fasi
        </div>
        <div style="display:flex;gap:3px;height:26px;border-radius:6px;overflow:hidden;background:var(--s3)">
            ${summarySegs}
            ${undefinedN ? `<div style="flex:${undefinedN};background:var(--s3);height:100%;border-radius:4px"></div>` : ''}
        </div>
        <div style="display:flex;gap:16px;margin-top:8px;font-size:11px;flex-wrap:wrap">
            ${_MACRO_PHASES.map(ph => `<span style="color:${_MACRO_COLORS[ph]};font-weight:700">${ph}: ${counts[ph]||0} sett.</span>`).join('')}
            ${undefinedN ? `<span style="color:var(--muted)">Non definite: ${undefinedN}</span>` : ''}
        </div>`;
}

export function cycleMacroPhase(week) {
    const athId = appState.selAthId;
    const mp = _getMacroPlan(athId);
    const wp = mp.plan.find(p => p.week === week);
    if (!wp) return;
    const idx = _MACRO_PHASES.indexOf(wp.phase);
    wp.phase = idx < 0 ? _MACRO_PHASES[0] : _MACRO_PHASES[(idx + 1) % _MACRO_PHASES.length];
    renderMacro();
}

export function setMacroSessions(week, val) {
    const mp = _getMacroPlan(appState.selAthId);
    const wp = mp.plan.find(p => p.week === week);
    if (wp) { wp.targetSessions = Math.max(1, Math.min(7, val)); renderMacro(); }
}

export function setMacroWeeks(val) {
    const athId = appState.selAthId;
    if (!athId) return;
    if (!DB.macroPlans[athId]) DB.macroPlans[athId] = { weeks: val, plan: [] };
    DB.macroPlans[athId].weeks = val;
    renderMacro();
}

export function applyMacroTemplate(type) {
    if (!type) return;
    const athId = appState.selAthId;
    const mp = _getMacroPlan(athId);
    const { weeks, plan } = mp;

    plan.forEach(wp => {
        const pct = wp.week / weeks;
        if (type === 'linear') {
            if (pct <= 0.50)      wp.phase = 'Accumulo';
            else if (pct <= 0.75) wp.phase = 'Intensificazione';
            else if (pct <= 0.90) wp.phase = 'Picco';
            else                  wp.phase = 'Scarico';
        } else if (type === 'block') {
            if (pct <= 0.40)      wp.phase = 'Accumulo';
            else if (pct <= 0.70) wp.phase = 'Intensificazione';
            else if (pct <= 0.87) wp.phase = 'Picco';
            else                  wp.phase = 'Scarico';
        } else if (type === 'undulating') {
            // Cicli da 4 settimane: 2 Acc + 1 Int + 1 Sca
            const ph = ((wp.week - 1) % 4);
            if (ph < 2)      wp.phase = 'Accumulo';
            else if (ph ===2)wp.phase = 'Intensificazione';
            else             wp.phase = 'Scarico';
        } else if (type === 'competition') {
            // Picco nelle ultime 2-3 sett, scarico nell'ultima
            if (pct <= 0.45)      wp.phase = 'Accumulo';
            else if (pct <= 0.75) wp.phase = 'Intensificazione';
            else if (pct <= 0.92) wp.phase = 'Picco';
            else                  wp.phase = 'Scarico';
        }
        // Target sessions standard per fase
        const targets = { 'Accumulo': 4, 'Intensificazione': 4, 'Picco': 3, 'Scarico': 2 };
        wp.targetSessions = targets[wp.phase] || 4;
    });

    toast('✅ Template applicato');
    renderMacro();
}

export async function saveMacroPlan() {
    const athId = appState.selAthId;
    if (!athId) { toast('Seleziona un atleta'); return; }
    const mp = _getMacroPlan(athId);
    try {
        if (window.mySupabase) {
            const { error } = await window.mySupabase.from('atleti')
                .update({ macro_plan: mp }).eq('id', athId);
            if (error) throw error;
            toast('Piano salvato! ✓');
        } else {
            toast('Salvato localmente (offline)');
        }
        // Persisti anche in localforage
        if (typeof window.saveDB === 'function') window.saveDB();
    } catch (e) {
        console.error('[Macro] Errore salvataggio:', e);
        toast('Errore: ' + e.message);
    }
}
