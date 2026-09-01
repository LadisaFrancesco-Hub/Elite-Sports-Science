/* ══════════════════════════════════════════════════════════════
   ELITE SPORTS SCIENCE — main.js
   Entry point ES Module. Importa tutti i moduli, espone le
   funzioni necessarie agli onclick HTML via window bridge,
   e lancia il bootstrap DOMContentLoaded.
   ══════════════════════════════════════════════════════════════ */

import { initApp, loadDB, startRealtime,
         setLoginLanguage, backToCodeStep, showCoachLogin,
         handleLoginStepCode, handleLoginAdmin,
         handleAthletePasswordLogin, handleAthleteFirstTimeSetup,
         toggleOtherSport, nextOnbStep, submitOnboarding,
         subscribePush, _showPushBanner, _showUpdateBanner } from './auth.js';

import { upW, setW, mkPips, renderInjuries, renderQuickWellness, qwSet, quickWellnessSubmit,
         openInjuryMo, saveInjury, resolveInjury,
         startCnsTest, registerCnsTap, endCnsTest, evaluateCnsTest,
         confermaWellnessLive, computeSessionModifiers } from './wellness.js';

import { calculateACWR, renderAnalytics, renderAthProgressi,
         renderE1rmChart, calculateEfficiencyIndex,
         calculateProgressionIndex, getRollingHrvTrend } from './analytics.js';

import { loadLive, updateLiveTotals, toggleDot,
         openRealLog, saveRealLog, unlockAudio,
         startTimer, startIsoTimer, formatTime,
         startCircuit, _resetCircuitUI,
         saveLiveNextLoad,
         toggleIsometricTimer, abortIsometricTimer, saveTimerSet } from './workout.js';

import { saveDB, seed, go, toggleMobileMenu, renderWeekWidget,
         populateSelects, onAthChange, updateModalSessions,
         renderDashboard, renderAthletes, renderStorico, renderCoachReply,
         renderCalendario, renderAthStorico, calPrev, calNext, calToday,
         renderEditor, renderEdExercises, renderProg,
         getEdExercises, loadEditorForAthlete,
         getAthleteRiskScore, openNewAthleteModal, openEditAthleteModal,
         deleteSelectedAthlete, addAthlete,
         editReply, saveReply, delSess, saveSess,
         addExType, addCircuit, addCircuitEx, removeCircuitEx,
         updateCircuitMeta, updateCircuitEx,
         updateEx, linkToGroup, delExConfirm, moveExercise,
         openProgressionModal, saveProgressionData, applySmartMicrocycle,
         handleExNameChange, syncEdDuration, syncEdCoachNote,
         addNewSessionToSchedule, renameCurrentSession, deleteCurrentSession,
         saveSchedule, updatePhaseStyle, updatePredictiveACWR,
         openMesocycleArchive, archiveAndNewMeso, confirmMesoArchive,
         calcSrpe, initFB, submitFB, testPushNotification,
         updateExpInfo, doExport, exportJSON, confirmReset,
         showConfirm, copyCodiceAtleta } from './app.js';

import { uid, openMo, closeMo } from './utils.js';
import { appState, DB, replaceDB } from './state.js';


// ─────────────────────────────────────────────────────────────
// WINDOW BRIDGE
// Espone le funzioni ai 117 onclick/oninput inline dell'HTML.
// Rimuovere gradualmente man mano che si migra agli addEventListener.
// ─────────────────────────────────────────────────────────────
Object.assign(window, {
    // Navigazione
    go, toggleMobileMenu, renderWeekWidget,
    // Selettori
    onAthChange, updateModalSessions, populateSelects,
    // Auth
    setLoginLanguage, backToCodeStep, showCoachLogin,
    handleLoginStepCode, handleLoginAdmin,
    handleAthletePasswordLogin, handleAthleteFirstTimeSetup,
    toggleOtherSport, nextOnbStep, submitOnboarding,
    // Wellness
    setW, mkPips, upW, openInjuryMo, saveInjury, resolveInjury,
    renderQuickWellness, qwSet, quickWellnessSubmit,
    startCnsTest, registerCnsTap, endCnsTest, evaluateCnsTest,
    confermaWellnessLive, computeSessionModifiers,
    // Analytics
    renderAnalytics, renderAthProgressi, renderE1rmChart,
    calculateACWR, calculateEfficiencyIndex, calculateProgressionIndex, getRollingHrvTrend,
    // Workout
    loadLive, updateLiveTotals, openRealLog, saveRealLog,
    unlockAudio, startTimer, startIsoTimer,
    startCircuit, _resetCircuitUI, formatTime, saveLiveNextLoad,
    toggleIsometricTimer, abortIsometricTimer, saveTimerSet,
    // Atleti
    renderAthletes, openNewAthleteModal, openEditAthleteModal, deleteSelectedAthlete,
    // Storico
    renderStorico, renderCoachReply, editReply, saveReply, delSess, saveSess,
    // Editor
    renderEditor, renderEdExercises, loadEditorForAthlete,
    getEdExercises, getAthleteRiskScore,
    addExType, addCircuit, addCircuitEx, removeCircuitEx,
    updateCircuitMeta, updateCircuitEx, updateEx, linkToGroup,
    delExConfirm, moveExercise, handleExNameChange,
    syncEdDuration, syncEdCoachNote,
    addNewSessionToSchedule, renameCurrentSession, deleteCurrentSession,
    saveSchedule, updatePhaseStyle,
    openProgressionModal, saveProgressionData, applySmartMicrocycle,
    openMesocycleArchive, archiveAndNewMeso, confirmMesoArchive,
    // Modal helpers
    showConfirm, copyCodiceAtleta,
    // Feedback
    calcSrpe, initFB, submitFB,
    // Push test
    testPushNotification,
    // Esportazione
    updateExpInfo, doExport, exportJSON, confirmReset,
    // Persistenza (usata da auth.js via window bridge)
    saveDB, seed, replaceDB,
    // Stato condiviso (mutabile — tutti i moduli vedono la stessa reference)
    appState,
    // Utility (usata negli onclick inline nell'editor e nei modali)
    uid, openMo, closeMo,
    // Atleti — azioni dirette
    addAthlete,
    // Render
    renderDashboard, renderProg,
    renderCalendario, renderAthStorico, calPrev, calNext, calToday,
});


// ─────────────────────────────────────────────────────────────
// BOOTSTRAP — DOMContentLoaded
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

    const authResult = await initApp();
    window.userRole  = authResult;

    await loadDB();
    startRealtime(authResult);

    try {
        if (authResult === 'ATLETA') {
            const mioProfilo = DB.athletes.find(a => a.id === window.mioIdLoggato) || DB.athletes[0];

            if (mioProfilo) {
                appState.selAthId = mioProfilo.id;

                DB.sessions = DB.sessions.filter(s => s.athlete === mioProfilo.id);
                const miaScheda = DB.schedules[mioProfilo.id];
                DB.schedules = {};
                if (miaScheda) DB.schedules[mioProfilo.id] = miaScheda;

                document.querySelector('.sidebar').style.setProperty('display', 'none', 'important');
                const hamburger = document.querySelector('.menu-toggle');
                if (hamburger) hamburger.style.setProperty('display', 'none', 'important');
                document.querySelector('.topbar').style.setProperty('padding-left', '20px', 'important');
                document.querySelector('.content').style.paddingBottom = '90px';
                const athPill = document.querySelector('.ath-pill');
                if (athPill) athPill.style.setProperty('display', 'none', 'important');
                document.getElementById('athlete-bottom-bar').classList.add('show');
                go('sessione');
            }
        } else {
            go('dashboard', document.querySelector('.nav-btn'));
        }

        populateSelects();
        initFB();
        upW();
        loadLive();
        renderDashboard();
        renderAthletes();
        renderStorico();
        renderInjuries();

        document.getElementById('ms-date').value = new Date().toISOString().slice(0, 10);
        setInterval(saveDB, 30000);

    } catch (err) {
        console.error('[CoachOS] Errore nel bootstrap:', err);
    } finally {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            splash.classList.add('hidden');
        }
    }
});
