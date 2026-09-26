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
         _clearLoginErr,
         toggleOtherSport, nextOnbStep, submitOnboarding,
         subscribePush, _showPushBanner, _showUpdateBanner } from './auth.js';

import { upW, setW, mkPips, renderInjuries, renderQuickWellness, qwSet, quickWellnessSubmit,
         openInjuryMo, saveInjury, resolveInjury,
         startCnsTest, registerCnsTap, endCnsTest, evaluateCnsTest,
         confermaWellnessLive, computeSessionModifiers } from './wellness.js';

import { calculateACWR, renderAnalytics, renderAthProgressi,
         renderE1rmChart, calculateEfficiencyIndex,
         calculateProgressionIndex, getRollingHrvTrend,
         renderTestDB, setTestCat, showTestChart, closeTestChart } from './analytics.js';

import { loadLive, updateLiveTotals, toggleDot,
         openRealLog, saveRealLog, unlockAudio,
         startTimer, startIsoTimer, formatTime,
         startCircuit, _resetCircuitUI, amrapLap,
         saveLiveNextLoad,
         toggleIsometricTimer, abortIsometricTimer, saveTimerSet,
         openVideoModal, closeVideoModal, endWorkout } from './workout.js';

import { saveDB, seed, clearDemoData, go, toggleMobileMenu, renderWeekWidget,
         populateSelects, onAthChange, updateModalSessions,
         renderCoachOnboarding, renderDashboard, renderAthletes, renderStorico, renderCoachReply,
         exportAthleteReport,
         renderCalendario, renderAthStorico, calPrev, calNext, calToday,
         renderEditor, renderEdExercises, renderProg,
         getEdExercises, loadEditorForAthlete,
         getAthleteRiskScore, cockpitSelectAthlete, openNewAthleteModal, openEditAthleteModal,
         deleteSelectedAthlete, addAthlete, nudgeAthlete, nudgeSilent,
         editReply, saveReply, delSess, saveSess,
         addExType, openCustomTypeModal, addCircuit, addCircuitEx, removeCircuitEx,
         updateCircuitMeta, updateCircuitEx,
         updateEx, linkToGroup, delExConfirm, moveExercise,
         openProgressionModal, saveProgressionData, applySmartMicrocycle,
         handleExNameChange, syncEdDuration, syncEdCoachNote,
         addNewSessionToSchedule, renameCurrentSession, deleteCurrentSession,
         openTemplatesModal, applyProgramTemplate, openDuplicateModal,
         duplicateScheduleFrom, duplicateCurrentSession,
         openCopyToModal, toggleAllCopyTargets, copyScheduleToTargets, refreshCopyToBtn,
         openImportModal, renderImportPreview, confirmImport,
         saveSchedule, updatePhaseStyle, updatePredictiveACWR,
         openMesocycleArchive, archiveAndNewMeso, confirmMesoArchive,
         calcSrpe, initFB, submitFB, testPushNotification, activatePushCoach,
         updateExpInfo, doExport, exportJSON, exportMyData, confirmReset,
         showConfirm, copyCodiceAtleta, inviteAthleteWhatsApp,
         exportProgramPDF,
         renderMessaggi, sendMessageCoach,
         renderAthleteChat, sendMessageAthleta, updateMsgBadge,
         renderMacro, cycleMacroPhase, setMacroSessions, setMacroWeeks,
         applyMacroTemplate, saveMacroPlan,
         sendWellnessReminders,
         openBodyCompModal, toggleSkinfoldInputs, calcBFFromSkinfolds, saveBodyComp,
         updateSessionType, addEmom, addAmrap, addTabata,
         calc1RM, calcHRZones, setVO2Tab, calcVO2, calcVDOT, calcPace,
         openTestModal, onTestCategoryChange, onTestNameChange, saveTest,
         toggleStoCard, loadMoreSto, dismissOnboarding } from './app.js';

import { uid, openMo, closeMo } from './utils.js';
import { appState, DB, replaceDB } from './state.js';
import { checkAndAwardBadges, renderBadgesSection } from './badges.js';
import { renderNutritionCard, openNutritionModal, saveNutritionLog, saveNutritionTargets } from './nutrition.js';
import { loadBranding, applyBranding, saveBranding, renderBrandingSettings } from './branding.js';
import { renderTeamPanel, sendTeamInvite, revokeInvite, checkAndAcceptInvite } from './team.js';
import { connectWearable, disconnectWearable, checkWearableCallback,
         initWearable, syncWearableData, renderWearableStatus } from './wearable.js';


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
    _clearLoginErr,
    toggleOtherSport, nextOnbStep, submitOnboarding,
    // Wellness
    setW, mkPips, upW, openInjuryMo, saveInjury, resolveInjury,
    renderQuickWellness, qwSet, quickWellnessSubmit,
    startCnsTest, registerCnsTap, endCnsTest, evaluateCnsTest,
    confermaWellnessLive, computeSessionModifiers,
    // Analytics
    renderAnalytics, renderAthProgressi, renderE1rmChart,
    calculateACWR, calculateEfficiencyIndex, calculateProgressionIndex, getRollingHrvTrend,
    renderTestDB, setTestCat, showTestChart, closeTestChart,
    // Workout
    loadLive, updateLiveTotals, openRealLog, saveRealLog,
    unlockAudio, startTimer, startIsoTimer,
    startCircuit, _resetCircuitUI, amrapLap, formatTime, saveLiveNextLoad,
    toggleIsometricTimer, abortIsometricTimer, saveTimerSet,
    openVideoModal, closeVideoModal, endWorkout,
    // Atleti
    renderAthletes, openNewAthleteModal, openEditAthleteModal, deleteSelectedAthlete,
    // Storico
    renderStorico, renderCoachReply, editReply, saveReply, delSess, saveSess,
    toggleStoCard, loadMoreSto, dismissOnboarding,
    // Editor
    renderEditor, renderEdExercises, loadEditorForAthlete,
    getEdExercises, getAthleteRiskScore, cockpitSelectAthlete,
    addExType, openCustomTypeModal, addCircuit, addCircuitEx, removeCircuitEx,
    updateCircuitMeta, updateCircuitEx, updateEx, linkToGroup,
    delExConfirm, moveExercise, handleExNameChange,
    syncEdDuration, syncEdCoachNote,
    addNewSessionToSchedule, renameCurrentSession, deleteCurrentSession,
    openTemplatesModal, applyProgramTemplate, openDuplicateModal,
    duplicateScheduleFrom, duplicateCurrentSession,
    openCopyToModal, toggleAllCopyTargets, copyScheduleToTargets, refreshCopyToBtn,
    openImportModal, renderImportPreview, confirmImport,
    saveSchedule, updatePhaseStyle,
    openProgressionModal, saveProgressionData, applySmartMicrocycle,
    openMesocycleArchive, archiveAndNewMeso, confirmMesoArchive,
    // Modal helpers
    showConfirm, copyCodiceAtleta, inviteAthleteWhatsApp,
    // Feedback
    calcSrpe, initFB, submitFB,
    // Push
    testPushNotification, activatePushCoach,
    // Esportazione
    updateExpInfo, doExport, exportJSON, exportMyData, confirmReset,
    // Persistenza (usata da auth.js via window bridge)
    saveDB, seed, clearDemoData, replaceDB,
    // Stato condiviso (mutabile — tutti i moduli vedono la stessa reference)
    appState,
    // Utility (usata negli onclick inline nell'editor e nei modali)
    uid, openMo, closeMo,
    // Atleti — azioni dirette
    addAthlete, nudgeAthlete, nudgeSilent,
    // Render
    renderCoachOnboarding, renderDashboard, renderProg,
    renderCalendario, renderAthStorico, calPrev, calNext, calToday,
    // PDF Export
    exportProgramPDF, exportAthleteReport,
    // Badge & Nutrition
    checkAndAwardBadges, renderBadgesSection,
    openNutritionModal, saveNutritionLog, saveNutritionTargets, renderNutritionCard,
    // Branding & Team
    saveBranding, renderBrandingSettings, applyBranding,
    sendTeamInvite, revokeInvite,
    // Wearable
    connectWearable, disconnectWearable, syncWearableNow: () => syncWearableData(appState.selAthId, true),
    // Messaggistica
    renderMessaggi, sendMessageCoach,
    renderAthleteChat, sendMessageAthleta, updateMsgBadge,
    // Macro Periodizzazione
    renderMacro, cycleMacroPhase, setMacroSessions, setMacroWeeks,
    applyMacroTemplate, saveMacroPlan,
    // Wellness notifications
    sendWellnessReminders,
    // Test Atletici
    openTestModal, onTestCategoryChange, onTestNameChange, saveTest,
    // Body Composition
    openBodyCompModal, toggleSkinfoldInputs, calcBFFromSkinfolds, saveBodyComp,
    // Calcolatori S&C
    calc1RM, calcHRZones, setVO2Tab, calcVO2, calcVDOT, calcPace,
    // Session types + conditioning
    updateSessionType, addEmom, addAmrap, addTabata,
});


// ─────────────────────────────────────────────────────────────
// BOOTSTRAP — DOMContentLoaded
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

    const authResult = await initApp();
    window.userRole  = authResult;

    // Timeout 8s: se Supabase non risponde, prosegui con la cache IndexedDB
    const _loadTimeout = new Promise(resolve => setTimeout(() => {
        resolve('timeout');
    }, 8000));
    const _loadResult = await Promise.race([loadDB().then(() => 'ok'), _loadTimeout]);
    if (_loadResult === 'timeout') {
        console.warn('[CoachOS] loadDB timeout — modalità offline con cache locale');
        // Banner non bloccante
        const banner = document.createElement('div');
        banner.id = 'offline-banner';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#431407;color:#fed7aa;font-size:12px;font-weight:700;text-align:center;padding:8px 16px;letter-spacing:.03em';
        banner.textContent = '⚡ Modalità offline — dati dalla cache locale';
        document.body.prepend(banner);
        // Rimuovi banner quando torna la connessione
        window.addEventListener('online', () => banner.remove(), { once: true });
    }
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
                const saveDot = document.getElementById('save-dot');
                const saveTxt = document.getElementById('save-txt');
                if (saveDot) saveDot.style.setProperty('display', 'none', 'important');
                if (saveTxt) saveTxt.style.setProperty('display', 'none', 'important');
                const roleBadge = document.getElementById('role-badge');
                if (roleBadge) roleBadge.textContent = 'ATLETA';
                document.body.classList.add('is-athlete');   // scope del redesign v4 (styles.css §APP ATLETA)
                document.getElementById('athlete-bottom-bar').classList.add('show');
                go('ath-home');
            }
        } else {
            // Deep linking: app aperta da tap su notifica → naviga al pannello specificato
            const _notifPanel = new URLSearchParams(window.location.search).get('panel');
            const _startPanel = _notifPanel || 'dashboard';
            const _startBtn   = document.querySelector(_notifPanel
                ? `.nav-btn[onclick*="'${_notifPanel}'"]`
                : '.nav-btn');
            go(_startPanel, _startBtn);
            if (_notifPanel) window.history.replaceState({}, '', window.location.pathname);
        }

        populateSelects();
        initFB();
        upW();
        loadLive();
        renderDashboard();
        renderAthletes();
        renderStorico();
        renderInjuries();

        // Wearable: processa eventuale callback OAuth e carica connessioni
        await checkWearableCallback();
        if (appState.selAthId) await initWearable(appState.selAthId);

        // Auto-sync wearable quando si apre il pannello wellness
        const _wPanel = document.getElementById('p-wellness');
        if (_wPanel) {
            new MutationObserver(() => {
                if (_wPanel.classList.contains('active')) {
                    syncWearableData(appState.selAthId);
                }
            }).observe(_wPanel, { attributes: true, attributeFilter: ['class'] });
        }

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
