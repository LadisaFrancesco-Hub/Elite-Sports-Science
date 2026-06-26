/* ══════════════════════════════════════════════════════════════
   ELITE SPORTS SCIENCE — auth.js
   Responsabilità:
     1. Inizializzazione client Supabase
     2. Flusso di Login (codice atleta + admin/coach)
     3. Onboarding atleta (wizard multi-step)
     4. Bootstrap applicazione: initApp(), loadDB()
     5. Registrazione Service Worker
   ══════════════════════════════════════════════════════════════ */

import { DB, KEY, replaceDB, appState } from './state.js';
import { toast, escHtml }     from './utils.js';

// ─────────────────────────────────────────────────────────────
// 1. SUPABASE
// ─────────────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://ncvmnoaelzdmuiqrvcjl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jdm1ub2FlbHpkbXVpcXJ2Y2psIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4Njg1ODIsImV4cCI6MjA5NDQ0NDU4Mn0.hokcRP2rNZK6f_rn1-WSeXd-F46VlbGyNijj7wthdXA';

const checkSupabase = setInterval(() => {
    if (typeof supabase !== 'undefined') {
        clearInterval(checkSupabase);
        window.mySupabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase pronto.');
    }
}, 100);


// ─────────────────────────────────────────────────────────────
// 2. AUTH PROMISE
// ─────────────────────────────────────────────────────────────
export let resolveAppAuth;
export const authPromise = new Promise(resolve => { resolveAppAuth = resolve; });


// ─────────────────────────────────────────────────────────────
// 3. TRADUZIONI LOGIN
// ─────────────────────────────────────────────────────────────
const loginTranslations = {
    it: {
        lblCode:         'Codice Accesso Atleta',
        placeholderCode: 'Inserisci il tuo codice',
        btnCode:         'Accedi',
        hintCode:        '',
        lblEmail:        'Email Admin',
        lblPass:         'Password',
        btnAdmin:        'Accedi come Coach',
        btnBack:         'Torna indietro',
        alertEmpty:      'Inserisci un codice valido.',
        alertErrorCode:  'Codice errato o atleta non trovato!',
        alertFields:     'Compila tutti i campi.'
    },
    en: {
        lblCode:         'Athlete Access Code',
        placeholderCode: 'Enter your code',
        btnCode:         'Login',
        hintCode:        '',
        lblEmail:        'Admin Email',
        lblPass:         'Password',
        btnAdmin:        'Login as Coach',
        btnBack:         'Go back',
        alertEmpty:      'Please enter a valid code.',
        alertErrorCode:  'Incorrect code or athlete not found!',
        alertFields:     'Please fill in all fields.'
    }
};

let currentLoginLang = 'it';
let pendingAthlete   = null;
let pendingCode      = '';
let loginAttempts    = 0;
let loginLockUntil   = 0;


// ─────────────────────────────────────────────────────────────
// 4. setLoginLanguage
// ─────────────────────────────────────────────────────────────
export function setLoginLanguage(lang) {
    currentLoginLang = lang;
    const t = loginTranslations[lang];

    document.getElementById('lbl-login-code').textContent      = t.lblCode;
    document.getElementById('input-login-code').placeholder    = t.placeholderCode;
    document.getElementById('btn-login-code').textContent      = t.btnCode;
    document.getElementById('lbl-admin-email').textContent     = t.lblEmail;
    document.getElementById('lbl-admin-pass').textContent      = t.lblPass;
    document.getElementById('btn-login-admin').textContent     = t.btnAdmin;
    document.getElementById('btn-admin-back').textContent      = t.btnBack;

    const itEl = document.getElementById('lang-it');
    const enEl = document.getElementById('lang-en');

    if (lang === 'it') {
        itEl.style.color = '#10b981'; itEl.style.fontWeight = '700';
        enEl.style.color = '#6b7280'; enEl.style.fontWeight = '500';
    } else {
        enEl.style.color = '#10b981'; enEl.style.fontWeight = '700';
        itEl.style.color = '#6b7280'; itEl.style.fontWeight = '500';
    }
}


// ─────────────────────────────────────────────────────────────
// 5. Rate limiting
// ─────────────────────────────────────────────────────────────
export function _isLoginLocked() {
    const now = Date.now();
    if (loginLockUntil > now) {
        const secsLeft = Math.ceil((loginLockUntil - now) / 1000);
        alert(`Troppi tentativi. Riprova tra ${secsLeft} secondi.`);
        return true;
    }
    return false;
}

export function _registerFailedAttempt() {
    loginAttempts++;
    if      (loginAttempts >= 10) loginLockUntil = Date.now() + 5 * 60 * 1000;
    else if (loginAttempts >= 5)  loginLockUntil = Date.now() + 30 * 1000;
    else if (loginAttempts >= 3)  loginLockUntil = Date.now() + 5 * 1000;
}


// ─────────────────────────────────────────────────────────────
// 6. handleLoginStepCode
// ─────────────────────────────────────────────────────────────
export async function handleLoginStepCode() {
    if (_isLoginLocked()) return;

    const codice = document.getElementById('input-login-code').value.trim();
    const t      = loginTranslations[currentLoginLang];

    if (!codice) { alert(t.alertEmpty); return; }
    if (!window.mySupabase) { alert('Connessione non disponibile. Riprova tra un momento.'); return; }

    const btn = document.getElementById('btn-login-code');
    btn.disabled = true;
    btn.textContent = '...';

    try {
        let athleteInfo = null;
        let fullData    = null;

        const { data: rpcData, error: rpcErr } = await window.mySupabase
            .rpc('lookup_athlete_by_code', { p_code: codice });

        if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
            athleteInfo = rpcData[0];
        } else if (rpcErr) {
            const { data: fd } = await window.mySupabase
                .from('atleti')
                .select('id, name, email, user_id, onboarding_completed, codice_accesso')
                .eq('codice_accesso', codice)
                .single();
            if (fd) {
                fullData    = fd;
                athleteInfo = { id: fd.id, name: fd.name, email: fd.email, has_auth: !!fd.user_id, onboarding_completed: !!fd.onboarding_completed };
            }
        }

        if (!athleteInfo) {
            _registerFailedAttempt();
            alert(t.alertErrorCode);
            return;
        }

        loginAttempts = 0;
        pendingCode   = codice;
        pendingAthlete = {
            id:                   athleteInfo.id,
            name:                 athleteInfo.name,
            email:                athleteInfo.email || '',
            has_auth:             athleteInfo.has_auth,
            onboarding_completed: athleteInfo.onboarding_completed,
            ...(fullData || {})
        };

        document.getElementById('login-step-code').style.display = 'none';

        if (athleteInfo.has_auth) {
            const welcome = document.getElementById('lbl-ath-welcome');
            if (welcome) welcome.textContent = `Bentornato, ${athleteInfo.name.split(' ')[0]}!`;
            document.getElementById('login-step-athlete-password').style.display = 'block';
        } else {
            const emailField = document.getElementById('input-ath-setup-email');
            if (emailField && athleteInfo.email) emailField.value = athleteInfo.email;
            document.getElementById('login-step-athlete-setup').style.display = 'block';
        }
    } finally {
        btn.disabled = false;
        btn.textContent = loginTranslations[currentLoginLang].btnCode;
    }
}


// ─────────────────────────────────────────────────────────────
// 7. handleAthletePasswordLogin
// ─────────────────────────────────────────────────────────────
export async function handleAthletePasswordLogin() {
    if (_isLoginLocked()) return;
    if (!pendingAthlete) { backToCodeStep(); return; }

    const password = document.getElementById('input-ath-password').value;
    if (!password) { alert('Inserisci la password.'); return; }

    const { data, error } = await window.mySupabase.auth.signInWithPassword({
        email: pendingAthlete.email,
        password
    });

    if (error) {
        _registerFailedAttempt();
        alert('Password errata. Riprova.');
        document.getElementById('input-ath-password').value = '';
        return;
    }

    loginAttempts = 0;
    await _completeAthleteLogin();
}


// ─────────────────────────────────────────────────────────────
// 8. handleAthleteFirstTimeSetup
// ─────────────────────────────────────────────────────────────
export async function handleAthleteFirstTimeSetup() {
    if (!pendingAthlete) { backToCodeStep(); return; }

    const email   = document.getElementById('input-ath-setup-email').value.trim();
    const pass    = document.getElementById('input-ath-setup-password').value;
    const confirm = document.getElementById('input-ath-setup-confirm').value;

    if (!email || !pass)      { alert('Compila tutti i campi.');                    return; }
    if (pass.length < 8)      { alert('La password deve avere almeno 8 caratteri.'); return; }
    if (pass !== confirm)     { alert('Le password non coincidono.');                return; }
    if (!email.includes('@')) { alert("Inserisci un'email valida.");                 return; }

    const btn = document.querySelector('#login-step-athlete-setup button');
    if (btn) { btn.disabled = true; btn.textContent = 'Creazione account...'; }

    try {
        const { data: signUpData, error: signUpErr } = await window.mySupabase.auth.signUp({ email, password: pass });

        if (signUpErr) { alert('Errore: ' + signUpErr.message); return; }

        const userId = signUpData?.user?.id;
        if (!userId) {
            alert("Controlla la tua email per confermare l'account, poi accedi con email e password.");
            backToCodeStep();
            return;
        }

        const { data: linked } = await window.mySupabase.rpc('link_athlete_auth', {
            p_athlete_id: pendingAthlete.id,
            p_code:       pendingCode
        });

        if (!linked) {
            alert("Errore nel collegamento account. Il codice non corrisponde o l'account è già collegato.");
            return;
        }

        const { error: signInErr } = await window.mySupabase.auth.signInWithPassword({ email, password: pass });
        if (signInErr) {
            alert('Account creato! Accedi ora con email e password.');
            backToCodeStep();
            return;
        }

        pendingAthlete.email   = email;
        pendingAthlete.user_id = userId;
        loginAttempts = 0;
        await _completeAthleteLogin();

    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Crea account e accedi'; }
    }
}


// ─────────────────────────────────────────────────────────────
// 9. _completeAthleteLogin
// ─────────────────────────────────────────────────────────────
async function _completeAthleteLogin() {
    window.mioIdLoggato = pendingAthlete.id;
    DB.athletes         = [pendingAthlete];
    document.getElementById('login-screen').style.display = 'none';

    if (!pendingAthlete.onboarding_completed) {
        document.getElementById('onboarding-screen').style.display = 'block';
    }

    resolveAppAuth('ATLETA');
}


// ─────────────────────────────────────────────────────────────
// 10. showCoachLogin
// ─────────────────────────────────────────────────────────────
export function showCoachLogin() {
    document.getElementById('login-step-code').style.display  = 'none';
    document.getElementById('login-step-admin').style.display = 'block';
    document.getElementById('login-card').style.borderLeft    = '4px solid #10b981';
}


// ─────────────────────────────────────────────────────────────
// 11. handleLoginAdmin
// ─────────────────────────────────────────────────────────────
export async function handleLoginAdmin() {
    const email    = document.getElementById('input-admin-email').value.trim();
    const password = document.getElementById('input-admin-password').value.trim();
    const t        = loginTranslations[currentLoginLang];

    if (!email || !password) { alert(t.alertFields); return; }

    const { data, error } = await window.mySupabase.auth.signInWithPassword({ email, password });

    if (error) { alert('Accesso negato: ' + error.message); return; }

    document.getElementById('login-screen').style.display = 'none';
    resolveAppAuth('ADMIN');
}


// ─────────────────────────────────────────────────────────────
// 12. backToCodeStep
// ─────────────────────────────────────────────────────────────
export function backToCodeStep() {
    pendingAthlete = null;
    pendingCode    = '';

    ['login-step-admin', 'login-step-athlete-password', 'login-step-athlete-setup']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

    const pwField = document.getElementById('input-ath-password');
    if (pwField) pwField.value = '';

    document.getElementById('login-step-code').style.display = 'block';
    document.getElementById('login-card').style.borderLeft   = '1px solid rgba(255,255,255,0.08)';
}


// ─────────────────────────────────────────────────────────────
// 13. ONBOARDING
// ─────────────────────────────────────────────────────────────
let currentOnbStep = 1;
const totalOnbSteps = 5;

export function toggleOtherSport(value) {
    const otherInput = document.getElementById('onb-sport-other');
    if (value === 'Altro') {
        otherInput.style.display = 'block';
        otherInput.focus();
    } else {
        otherInput.style.display = 'none';
        otherInput.value = '';
    }
}

export function nextOnbStep(nextStep) {
    if (currentOnbStep === 1 && nextStep === 2) {
        const sportVal = document.getElementById('onb-sport').value;
        const otherVal = document.getElementById('onb-sport-other').value.trim();
        if (!sportVal) { toast('❌ Seleziona uno sport prima di procedere.'); return; }
        if (sportVal === 'Altro' && !otherVal) { toast('❌ Specifica lo sport nel campo di testo.'); return; }
    }
    if (currentOnbStep === 2 && nextStep === 3) {
        const age = document.getElementById('onb-age').value;
        const gender = document.getElementById('onb-gender').value;
        const h = document.getElementById('onb-height').value;
        const w = document.getElementById('onb-weight').value;
        if (!age || !gender || !h || !w) { toast('❌ Compila tutti i dati richiesti (Età, Sesso, Altezza, Peso).'); return; }
    }
    if (currentOnbStep === 3 && nextStep === 4) {
        const lifestyle = document.getElementById('onb-lifestyle').value;
        const freq = document.getElementById('onb-freq').value;
        if (!lifestyle || !freq) { toast('❌ Seleziona il tuo stile di vita e la frequenza di allenamento.'); return; }
    }
    if (currentOnbStep === 4 && nextStep === 5) {
        const health = document.getElementById('onb-health').value;
        if (!health) { toast('❌ Seleziona il tuo stato di salute attuale.'); return; }
    }

    document.getElementById(`onb-step-${currentOnbStep}`).style.display = 'none';
    document.getElementById(`onb-step-${nextStep}`).style.display       = 'block';
    currentOnbStep = nextStep;

    const progressPct = (currentOnbStep / totalOnbSteps) * 100;
    document.getElementById('onb-progress').style.width = `${progressPct}%`;
}

export async function submitOnboarding() {
    let selectedSport = document.getElementById('onb-sport').value;
    if (selectedSport === 'Altro') selectedSport = document.getElementById('onb-sport-other').value.trim();

    const eta        = document.getElementById('onb-age').value;
    const sesso      = document.getElementById('onb-gender').value;
    const stileVita  = document.getElementById('onb-lifestyle').value;
    const salute     = document.getElementById('onb-health').value;
    const farmaci    = document.getElementById('onb-meds').value.trim()     || 'Nessuno';
    const infortuniText = document.getElementById('onb-injuries').value.trim() || 'Nessuno';

    const noteFinali = `[ANAGRAFICA] Età: ${eta} | Sesso: ${sesso}
[SPORT] ${selectedSport} | Stile di vita: ${stileVita}
[SALUTE] Stato: ${salute} | Farmaci: ${farmaci}
[INFORTUNI] ${infortuniText}`;

    const onboardingData = {
        height:               parseInt(document.getElementById('onb-height').value) || 0,
        weight:               parseFloat(document.getElementById('onb-weight').value) || 0,
        freq:                 parseInt(document.getElementById('onb-freq').value) || 3,
        goal:                 document.getElementById('onb-goal').value,
        notes:                noteFinali,
        onboarding_completed: true
    };

    try {
        const athId = window.mioIdLoggato;
        const { error } = await window.mySupabase.from('atleti').update(onboardingData).eq('id', athId);
        if (error) throw error;

        const mioProfilo = DB.athletes.find(a => a.id === athId);
        if (mioProfilo) {
            Object.assign(mioProfilo, onboardingData);
            // saveDB è definita in app.js — disponibile via window bridge
            if (typeof window.saveDB === 'function') await window.saveDB();
        }

        toast('🚀 Profilo configurato con successo!');
        document.getElementById('onboarding-screen').style.display = 'none';

    } catch (err) {
        console.error(err);
        toast('❌ Errore di salvataggio. Riprova.');
    }
}


// ─────────────────────────────────────────────────────────────
// 14. _autoRestoreSession
// ─────────────────────────────────────────────────────────────
async function _autoRestoreSession(user) {
    if (user.app_metadata?.role === 'coach') {
        const el = document.getElementById('login-screen');
        if (el) el.style.display = 'none';
        resolveAppAuth('ADMIN');
        return;
    }

    try {
        const { data: atleta } = await window.mySupabase
            .from('atleti')
            .select('id, name, email, onboarding_completed')
            .eq('user_id', user.id)
            .single();

        if (atleta) {
            window.mioIdLoggato = atleta.id;
            pendingAthlete      = { ...atleta, has_auth: true };
            DB.athletes         = [atleta];
            const el = document.getElementById('login-screen');
            if (el) el.style.display = 'none';
            resolveAppAuth('ATLETA');
        }
    } catch (e) {
        console.warn('Sessione trovata ma profilo non recuperato:', e);
    }
}


// ─────────────────────────────────────────────────────────────
// 15. initApp
// ─────────────────────────────────────────────────────────────
export async function initApp() {
    console.log("Avvio dell'app con sistema di protezione Fallback...");

    try {
        const oldData = localStorage.getItem(KEY);
        if (oldData) {
            let parsed;
            try { parsed = JSON.parse(decodeURIComponent(atob(oldData))); }
            catch (_) { parsed = JSON.parse(oldData); }
            await localforage.setItem(KEY, parsed);
            localStorage.removeItem(KEY);
            console.log('Migrazione localStorage → IndexedDB completata.');
        }
    } catch (migErr) {
        console.error('Errore durante la migrazione:', migErr);
    }

    try {
        const localData = await localforage.getItem(KEY);
        if (localData) {
            replaceDB(localData);
            console.log('Dati locali caricati con successo.');
        }
    } catch (e) {
        console.error('Errore nel caricamento dei dati locali:', e);
    }

    setTimeout(async () => {
        let attempts = 0;
        while (!window.mySupabase && attempts < 10) {
            await new Promise(r => setTimeout(r, 200));
            attempts++;
        }
        if (window.mySupabase) {
            console.log('Supabase agganciato in background!');
            try {
                const { data: { session } } = await window.mySupabase.auth.getSession();
                if (session?.user) await _autoRestoreSession(session.user);
            } catch (e) {
                console.warn('Errore verifica sessione:', e);
            }
        } else {
            console.warn('Supabase non disponibile. Modalità offline locale attiva.');
        }
    }, 500);

    return authPromise;
}


// ─────────────────────────────────────────────────────────────
// 16. loadDB
// ─────────────────────────────────────────────────────────────
export async function loadDB() {
    try {
        if (!window.mySupabase) throw new Error('Supabase non connesso');

        const { data: atletiData, error: errA } = await window.mySupabase.from('atleti').select('*');
        if (!errA && atletiData) DB.athletes = atletiData;

        const { data: schedData, error: errSch } = await window.mySupabase.from('schedules').select('*');
        if (!errSch && schedData) {
            const mesoLocali = {};
            Object.entries(DB.schedules).forEach(([aId, sch]) => {
                if (sch.meso) mesoLocali[aId] = sch.meso;
            });

            const perAtleta = {};
            schedData.forEach(row => {
                const aId  = row.athlete_id;
                const meso = row.meso || '';
                if (!perAtleta[aId]) perAtleta[aId] = {};
                if (!perAtleta[aId][meso]) perAtleta[aId][meso] = { meta: row, sessions: [] };
                perAtleta[aId][meso].sessions.push({
                    id:        row.id,
                    name:      row.session_name,
                    exercises: row.exercises || []
                });
            });

            DB.schedules = {};
            Object.entries(perAtleta).forEach(([aId, gruppi]) => {
                const voci = Object.values(gruppi);
                let scelto = voci[0];
                if (voci.length > 1) {
                    const mesoLocale  = mesoLocali[aId];
                    const corrisponde = mesoLocale ? voci.find(v => v.meta.meso === mesoLocale) : null;
                    scelto = corrisponde || voci.sort((a, b) => b.sessions.length - a.sessions.length)[0];
                }
                DB.schedules[aId] = {
                    meso:      scelto.meta.meso,
                    duration:  scelto.meta.duration || 4,
                    phase:     scelto.meta.phase,
                    coachNote: scelto.meta.coach_note,
                    objective: scelto.meta.objective,
                    sessions:  scelto.sessions
                };
            });
        }

        const { data: sessData, error: errS } = await window.mySupabase.from('sessions').select('*');
        if (!errS && sessData) {
            DB.sessions = sessData.map(s => ({
                id:          s.id,
                athlete:     s.athlete_id,
                date:        s.date,
                session:     s.session_name,
                sessionType: s.session_type,
                week:        s.week,
                phase:       s.phase,
                readiness:   s.readiness,
                vol:         s.vol,
                sRPE:        s.sRPE || s.srpe,
                rpe:         s.rpe,
                qual:        s.qual,
                hrv:         s.hrv,
                maxE1rm:     s.max_e1rm,
                e1rmDom:     s.e1rm_dom,
                e1rmNDom:    s.e1rm_ndom,
                doms:        s.doms,
                flag:        s.flag,
                notes:       s.notes,
                reply:       s.reply
            }));
        }

        const { data: mesoData, error: errM } = await window.mySupabase
            .from('mesocycles').select('*').order('archived_at', { ascending: false });
        if (!errM && mesoData) {
            DB.mesocycles = mesoData.map(m => ({
                id:         m.id,
                athlete:    m.athlete_id,
                meso:       m.meso,
                phase:      m.phase,
                duration:   m.duration,
                coachNote:  m.coach_note,
                objective:  m.objective,
                archivedAt: m.archived_at,
                sessions:   m.sessions || []
            }));
        }

        console.log('Dati atomici caricati con successo dal Cloud! ☁️');
        await localforage.setItem(KEY, DB);

    } catch (e) {
        console.warn('Fallito caricamento Cloud, uso backup locale:', e);
        try {
            const d = await localforage.getItem(KEY);
            if (d) {
                DB.athletes   = d.athletes   || [];
                DB.sessions   = d.sessions   || [];
                DB.schedules  = d.schedules  || {};
                DB.mesocycles = d.mesocycles || [];
            }
        } catch (err) {
            // silenzioso: l'app parte comunque con DB vuoto
        }
    }

    if (!DB.athletes.length) {
        // seed è in app.js — disponibile via window bridge
        if (typeof window.seed === 'function') window.seed();
    }
}


// ─────────────────────────────────────────────────────────────
// 18. startRealtime(role)
//     Attiva le Postgres Changes subscription per mantenere
//     coach e atleta sincronizzati senza ricaricamento manuale.
//     Richiede: ALTER PUBLICATION supabase_realtime ADD TABLE ...
//     (vedi realtime_migration.sql)
// ─────────────────────────────────────────────────────────────
export function startRealtime(role) {
    if (!window.mySupabase) {
        console.warn('[RT] mySupabase non disponibile — realtime saltato');
        return;
    }

    const _sub = (name, table, handler) => {
        window.mySupabase
            .channel(`rt-${name}`)
            .on('postgres_changes', { event: '*', schema: 'public', table }, handler)
            .subscribe((status, err) => {
                console.log(`[RT] ${name}: ${status}`, err ?? '');
                if (status === 'SUBSCRIBED') _updateRtIndicator(true);
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') _updateRtIndicator(false);
            });
    };

    // ── Broadcast channel (schedule notifications coach → atleta) ──
    // Usa Broadcast invece di postgres_changes per evitare dipendenze
    // da RLS filtering lato server, che può essere inaffidabile sul
    // free tier con tabelle a politiche complesse.
    const broadcast = window.mySupabase
        .channel('coach-broadcast')
        .on('broadcast', { event: 'schedule_updated' }, ({ payload }) => {
            console.log('[RT] broadcast schedule_updated ricevuto:', payload);
            if (role === 'ATLETA' && payload?.athlete_id === window.mioIdLoggato) {
                if (typeof window.loadLive === 'function') window.loadLive();
                toast('📋 Scheda aggiornata dal coach');
            }
        })
        .on('broadcast', { event: 'session_reply' }, ({ payload }) => {
            if (role === 'ATLETA' && payload?.athlete_id === window.mioIdLoggato) {
                toast('💬 Nuovo reply del coach!');
            }
        })
        .subscribe((status, err) => {
            console.log(`[RT] broadcast: ${status}`, err ?? '');
        });
    window._rtBroadcast = broadcast;

    // ── Postgres Changes: sessions (coach riceve sessioni atleta) ──
    _sub('sessions',  'sessions',  payload => _onSessionChange(payload, role));
    if (role === 'ADMIN') _sub('atleti', 'atleti', _onAtletiChange);
}

function _updateRtIndicator(connected) {
    let dot = document.getElementById('rt-dot');
    if (!dot) {
        dot = document.createElement('span');
        dot.id = 'rt-dot';
        dot.title = 'Realtime';
        dot.style.cssText = 'width:7px;height:7px;border-radius:50%;display:inline-block;margin-left:6px;vertical-align:middle;transition:background .4s';
        const topbar = document.querySelector('.topbar');
        if (topbar) topbar.appendChild(dot);
    }
    dot.style.background = connected ? '#10B981' : '#EF4444';
}

function _onScheduleChange(payload, role) {
    console.log('[RT] schedule event →', payload.eventType, payload.new, payload.old);
    const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
    if (!row || !row.id) return;

    const athId = row.athlete_id;
    if (role === 'ATLETA' && athId !== window.mioIdLoggato) return;

    if (payload.eventType === 'DELETE') {
        if (DB.schedules[athId]) {
            DB.schedules[athId].sessions = DB.schedules[athId].sessions.filter(s => s.id !== row.id);
        }
    } else {
        if (!DB.schedules[athId]) {
            DB.schedules[athId] = {
                meso:      row.meso       || 'Meso 1',
                duration:  row.duration   || 4,
                phase:     row.phase      || 'Accumulo',
                coachNote: row.coach_note || '',
                objective: row.objective  || '',
                sessions:  []
            };
        } else {
            DB.schedules[athId].meso      = row.meso       || DB.schedules[athId].meso;
            DB.schedules[athId].duration  = row.duration   || DB.schedules[athId].duration;
            DB.schedules[athId].phase     = row.phase      || DB.schedules[athId].phase;
            DB.schedules[athId].coachNote = row.coach_note || DB.schedules[athId].coachNote;
            DB.schedules[athId].objective = row.objective  || DB.schedules[athId].objective;
        }
        const sess = { id: row.id, name: row.session_name, exercises: row.exercises || [] };
        const idx  = DB.schedules[athId].sessions.findIndex(s => s.id === row.id);
        if (idx >= 0) DB.schedules[athId].sessions[idx] = sess;
        else          DB.schedules[athId].sessions.push(sess);
    }

    if (role === 'ATLETA') {
        if (typeof window.loadLive === 'function') window.loadLive();
        toast('📋 Scheda aggiornata dal coach');
    } else if (appState.curPanel === 'editor') {
        if (typeof window.renderEditor === 'function') window.renderEditor();
    }
}

function _onSessionChange(payload, role) {
    console.log('[RT] session event →', payload.eventType, payload.new, payload.old);
    const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
    if (!row || !row.id) return;
    if (role === 'ATLETA' && row.athlete_id !== window.mioIdLoggato) return;

    const mapped = {
        id:          row.id,
        athlete:     row.athlete_id,
        date:        row.date,
        session:     row.session_name,
        sessionType: row.session_type,
        week:        row.week,
        phase:       row.phase,
        readiness:   row.readiness,
        vol:         row.vol,
        sRPE:        row.sRPE || row.srpe,
        rpe:         row.rpe,
        qual:        row.qual,
        hrv:         row.hrv,
        maxE1rm:     row.max_e1rm,
        e1rmDom:     row.e1rm_dom,
        e1rmNDom:    row.e1rm_ndom,
        doms:        row.doms,
        flag:        row.flag,
        notes:       row.notes,
        reply:       row.reply
    };

    if (payload.eventType === 'DELETE') {
        DB.sessions = DB.sessions.filter(s => s.id !== row.id);
    } else {
        const idx = DB.sessions.findIndex(s => s.id === row.id);
        if (idx >= 0) DB.sessions[idx] = mapped;
        else          DB.sessions.push(mapped);
    }

    if (appState.curPanel === 'dashboard' && typeof window.renderDashboard === 'function')
        window.renderDashboard();
    if (appState.curPanel === 'storico' && typeof window.renderStorico === 'function')
        window.renderStorico();

    if (role === 'ADMIN' && payload.eventType === 'INSERT') {
        const ath  = DB.athletes.find(a => a.id === row.athlete_id);
        const nome = ath ? ath.name.split(' ')[0] : 'Atleta';
        toast(`⚡ Nuova sessione da ${nome}`);
    }
}

function _onAtletiChange(payload) {
    const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
    if (!row || !row.id) return;

    if (payload.eventType === 'DELETE') {
        DB.athletes = DB.athletes.filter(a => a.id !== row.id);
    } else {
        const idx = DB.athletes.findIndex(a => a.id === row.id);
        if (idx >= 0) Object.assign(DB.athletes[idx], row);
        else          DB.athletes.push(row);
    }

    if (typeof window.renderAthletes === 'function') window.renderAthletes();
    if (appState.curPanel === 'dashboard' && typeof window.renderDashboard === 'function')
        window.renderDashboard();
}


// ─────────────────────────────────────────────────────────────
// 17. Service Worker
// ─────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
        if (reg.waiting) _showUpdateBanner(reg.waiting);
        reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    _showUpdateBanner(newWorker);
                }
            });
        });
    }).catch(err => console.log('SW Error:', err));

    let _swRefreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!_swRefreshing) { _swRefreshing = true; location.reload(); }
    });
}

export function _showUpdateBanner(worker) {
    const banner = document.getElementById('sw-update-banner');
    if (!banner || banner.classList.contains('show')) return;
    banner.classList.add('show');
    banner.querySelector('.sw-update-reload').addEventListener('click', () => {
        worker.postMessage({ type: 'SKIP_WAITING' });
    });
    banner.querySelector('.sw-update-dismiss').addEventListener('click', () => {
        banner.classList.remove('show');
    });
}
