/* ══════════════════════════════════════════════════════════════
   ELITE SPORTS SCIENCE — auth.js
   Responsabilità:
     1. Inizializzazione client Supabase
     2. Flusso di Login (codice atleta + admin/coach)
     3. Onboarding atleta (wizard multi-step)
     4. Bootstrap applicazione (DOMContentLoaded)
     5. Registrazione Service Worker
   ══════════════════════════════════════════════════════════════ */

'use strict';

// Escapes user-controlled strings before interpolating into innerHTML.
// Must be defined before all other scripts (auth.js loads first).
function escHtml(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ─────────────────────────────────────────────────────────────
// 1. SUPABASE — Inizializzazione asincrona
//    Aspetta che la libreria CDN sia disponibile, poi crea il
//    client e lo espone su window.mySupabase.
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
//    Usata per bloccare il bootstrap finché l'utente non si
//    autentica. resolveAppAuth() viene chiamata dal login.
// ─────────────────────────────────────────────────────────────
let resolveAppAuth;
let authPromise = new Promise(resolve => { resolveAppAuth = resolve; });


// ─────────────────────────────────────────────────────────────
// 3. TRADUZIONI LOGIN (IT / EN)
// ─────────────────────────────────────────────────────────────
const loginTranslations = {
    it: {
        lblCode:       'Codice Accesso Atleta',
        placeholderCode: 'Inserisci il tuo codice',
        btnCode:       'Accedi',
        hintCode:      '',
        lblEmail:      'Email Admin',
        lblPass:       'Password',
        btnAdmin:      'Accedi come Coach',
        btnBack:       'Torna indietro',
        alertEmpty:    'Inserisci un codice valido.',
        alertErrorCode:'Codice errato o atleta non trovato!',
        alertFields:   'Compila tutti i campi.'
    },
    en: {
        lblCode:       'Athlete Access Code',
        placeholderCode: 'Enter your code',
        btnCode:       'Login',
        hintCode:      '',
        lblEmail:      'Admin Email',
        lblPass:       'Password',
        btnAdmin:      'Login as Coach',
        btnBack:       'Go back',
        alertEmpty:    'Please enter a valid code.',
        alertErrorCode:'Incorrect code or athlete not found!',
        alertFields:   'Please fill in all fields.'
    }
};

let currentLoginLang = 'it';


// ─────────────────────────────────────────────────────────────
// 4. setLoginLanguage(lang)
//    Aggiorna tutte le label e i placeholder del login
//    e aggiorna lo stile dei selettori IT/EN.
// ─────────────────────────────────────────────────────────────
function setLoginLanguage(lang) {
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
        itEl.style.color      = '#10b981'; itEl.style.fontWeight = '700';
        enEl.style.color      = '#6b7280'; enEl.style.fontWeight = '500';
    } else {
        enEl.style.color      = '#10b981'; enEl.style.fontWeight = '700';
        itEl.style.color      = '#6b7280'; itEl.style.fontWeight = '500';
    }
}


// ─────────────────────────────────────────────────────────────
// 5. handleLoginStepCode()
//    Step 1 del login:
//      - Codice "COACH" / "ADMIN" → mostra il form admin
//      - Qualsiasi altro codice   → verifica su Supabase (tabella atleti)
//      - Se onboarding non completato → mostra wizard
// ─────────────────────────────────────────────────────────────
async function handleLoginStepCode() {
    const codice = document.getElementById('input-login-code').value.trim();
    const t      = loginTranslations[currentLoginLang];

    if (!codice) {
        alert(t.alertEmpty);
        return;
    }

    if (codice.toUpperCase() === 'COACH' || codice.toUpperCase() === 'ADMIN') {
        // Accesso coach: mostra il secondo step con email + password
        document.getElementById('login-step-code').style.display  = 'none';
        document.getElementById('login-step-admin').style.display = 'block';
        document.getElementById('login-card').style.borderLeft    = '4px solid #10b981';
    } else {
        // Accesso atleta: verifica il codice sul database
        const { data } = await window.mySupabase
            .from('atleti')
            .select('*')
            .eq('codice_accesso', codice)
            .single();

        if (data) {
            window.mioIdLoggato = data.id;
            DB.athletes = [data];
            document.getElementById('login-screen').style.display = 'none';

            // Se l'onboarding non è stato completato, mostra il wizard
            if (!data.onboarding_completed) {
                document.getElementById('onboarding-screen').style.display = 'block';
            }

            resolveAppAuth('ATLETA');
        } else {
            alert(t.alertErrorCode);
        }
    }
}


// ─────────────────────────────────────────────────────────────
// 6. handleLoginAdmin()
//    Step 2 del login: autentica il coach via email/password
//    tramite Supabase Auth.
// ─────────────────────────────────────────────────────────────
async function handleLoginAdmin() {
    const email    = document.getElementById('input-admin-email').value.trim();
    const password = document.getElementById('input-admin-password').value.trim();
    const t        = loginTranslations[currentLoginLang];

    if (!email || !password) {
        alert(t.alertFields);
        return;
    }

    const { data, error } = await window.mySupabase.auth.signInWithPassword({ email, password });

    if (error) {
        alert('Accesso negato: ' + error.message);
        return;
    }

    document.getElementById('login-screen').style.display = 'none';
    resolveAppAuth('ADMIN');
}


// ─────────────────────────────────────────────────────────────
// 7. backToCodeStep()
//    Torna dal form admin allo step iniziale del codice atleta.
// ─────────────────────────────────────────────────────────────
function backToCodeStep() {
    document.getElementById('login-step-admin').style.display = 'none';
    document.getElementById('login-step-code').style.display  = 'block';
    document.getElementById('login-card').style.borderLeft    = '1px solid rgba(255,255,255,0.08)';
}


// ─────────────────────────────────────────────────────────────
// 8. ONBOARDING — Wizard multi-step
// ─────────────────────────────────────────────────────────────
let currentOnbStep = 1;
const totalOnbSteps = 5;

/**
 * toggleOtherSport(value)
 * Mostra/nasconde il campo testo libero quando l'atleta
 * sceglie "Altro" nel selettore sport.
 */
function toggleOtherSport(value) {
    const otherInput = document.getElementById('onb-sport-other');
    if (value === 'Altro') {
        otherInput.style.display = 'block';
        otherInput.focus();
    } else {
        otherInput.style.display = 'none';
        otherInput.value = '';
    }
}

/**
 * nextOnbStep(nextStep)
 * Avanza al passo successivo del wizard con validazione inline.
 *   Step 1 → valida selezione sport
 *   Step 2 → valida altezza e peso
 */

function nextOnbStep(nextStep) {
    // Validazione Step 1: Sport obbligatorio
    if (currentOnbStep === 1 && nextStep === 2) {
        const sportVal = document.getElementById('onb-sport').value;
        const otherVal = document.getElementById('onb-sport-other').value.trim();

        if (!sportVal) {
            toast('❌ Seleziona uno sport prima di procedere.');
            return;
        }
        if (sportVal === 'Altro' && !otherVal) {
            toast('❌ Specifica lo sport nel campo di testo.');
            return;
        }
    }

    // Validazione Step 2: Biometria e Dati Personali
    if (currentOnbStep === 2 && nextStep === 3) {
        const age = document.getElementById('onb-age').value;
        const gender = document.getElementById('onb-gender').value;
        const h = document.getElementById('onb-height').value;
        const w = document.getElementById('onb-weight').value;
        
        if (!age || !gender || !h || !w) {
            toast('❌ Compila tutti i dati richiesti (Età, Sesso, Altezza, Peso).');
            return;
        }
    }

    // Validazione Step 3: Stile di vita e Frequenza
    if (currentOnbStep === 3 && nextStep === 4) {
        const lifestyle = document.getElementById('onb-lifestyle').value;
        const freq = document.getElementById('onb-freq').value;
        
        if (!lifestyle || !freq) {
            toast('❌ Seleziona il tuo stile di vita e la frequenza di allenamento.');
            return;
        }
    }

    // Validazione Step 4: Salute Medica
    if (currentOnbStep === 4 && nextStep === 5) {
        const health = document.getElementById('onb-health').value;
        if (!health) {
            toast('❌ Seleziona il tuo stato di salute attuale.');
            return;
        }
    }

    // Transizione: nasconde lo step corrente, mostra il prossimo
    document.getElementById(`onb-step-${currentOnbStep}`).style.display = 'none';
    document.getElementById(`onb-step-${nextStep}`).style.display       = 'block';
    currentOnbStep = nextStep;

    // Aggiorna la progress bar in cima al wizard
    const progressPct = (currentOnbStep / totalOnbSteps) * 100;
    document.getElementById('onb-progress').style.width = `${progressPct}%`;
}

/**
 * submitOnboarding()
 * Raccoglie tutti i dati, li formatta in un'unica stringa pulita
 * e li invia al database.
 */
async function submitOnboarding() {
    let selectedSport = document.getElementById('onb-sport').value;
    if (selectedSport === 'Altro') {
        selectedSport = document.getElementById('onb-sport-other').value.trim();
    }

    // Recupero nuovi dati
    const eta = document.getElementById('onb-age').value;
    const sesso = document.getElementById('onb-gender').value;
    const stileVita = document.getElementById('onb-lifestyle').value;
    const salute = document.getElementById('onb-health').value;
    const farmaci = document.getElementById('onb-meds').value.trim() || 'Nessuno';
    const infortuniText = document.getElementById('onb-injuries').value.trim() || 'Nessuno';

    // Generazione della stringa strutturata per il campo "notes"
    const noteFinali = `[ANAGRAFICA] Età: ${eta} | Sesso: ${sesso}
[SPORT] ${selectedSport} | Stile di vita: ${stileVita}
[SALUTE] Stato: ${salute} | Farmaci: ${farmaci}
[INFORTUNI] ${infortuniText}`;

    // Mappa esatta con i nomi delle colonne Supabase
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

        // 1. Persistenza remota su Supabase
        const { error } = await window.mySupabase
            .from('atleti')
            .update(onboardingData)
            .eq('id', athId);

        if (error) throw error;

        // 2. Aggiornamento istantaneo del DB in memoria locale
        const mioProfilo = DB.athletes.find(a => a.id === athId);
        if (mioProfilo) {
            Object.assign(mioProfilo, onboardingData);
            await saveDB();
        }

        toast('🚀 Profilo configurato con successo!');
        document.getElementById('onboarding-screen').style.display = 'none';

    } catch (err) {
        console.error(err);
        toast('❌ Errore di salvataggio. Riprova.');
    }
}


// ─────────────────────────────────────────────────────────────
// 9. initApp()
//    Avvio con sistema di protezione Fallback:
//      a) Carica i dati dal localStorage (risposta immediata)
//      b) Aspetta Supabase in background (max 2s)
//      c) Rimuove lo splash screen
//      d) Restituisce authPromise (si risolve al login)
// ─────────────────────────────────────────────────────────────
async function initApp() {
    console.log("Avvio dell'app con sistema di protezione Fallback...");

    // MIGRAZIONE: sposta i dati dal vecchio localStorage → IndexedDB (una tantum)
    try {
        const oldData = localStorage.getItem(KEY);
        if (oldData) {
            let parsed;
            try {
                parsed = JSON.parse(decodeURIComponent(atob(oldData)));
            } catch (_) {
                parsed = JSON.parse(oldData);
            }
            await localforage.setItem(KEY, parsed);
            localStorage.removeItem(KEY);
            console.log('Migrazione localStorage → IndexedDB completata.');
        }
    } catch (migErr) {
        console.error('Errore durante la migrazione:', migErr);
    }

    // a) Dati locali → UI istantanea (offline-first)
    try {
        const localData = await localforage.getItem(KEY);
        if (localData) {
            DB = localData;
            console.log('Dati locali caricati con successo.');
            if (typeof renderDashboard === 'function') renderDashboard();
            if (typeof renderAthletes  === 'function') renderAthletes();
            if (typeof renderStorico   === 'function') renderStorico();
        }
    } catch (e) {
        console.error('Errore nel caricamento dei dati locali:', e);
    }

    // b) Supabase in background (non blocca lo splash)
    setTimeout(async () => {
        let attempts = 0;
        while (!window.mySupabase && attempts < 10) {
            await new Promise(r => setTimeout(r, 200));
            attempts++;
        }
        if (window.mySupabase) {
            console.log('Supabase agganciato in background!');
        } else {
            console.warn('Supabase non disponibile. Modalità offline locale attiva.');
        }
        // La rimozione dello splash è spostata alla fine di DOMContentLoaded,
        // dopo go() e tutti i render, per evitare il flash di contenuto.
    }, 500);

    // c) Blocco sull'autenticazione
    return authPromise;
}


// ─────────────────────────────────────────────────────────────
// 10. loadDB()
//     Scarica i dati da Supabase (atleti, schedules, sessioni)
//     e li normalizza nel formato JS. Fallback su localStorage.
// ─────────────────────────────────────────────────────────────
async function loadDB() {
    try {
        if (!window.mySupabase) throw new Error('Supabase non connesso');

        // 10a. Atleti
        const { data: atletiData, error: errA } = await window.mySupabase
            .from('atleti')
            .select('*');
        if (!errA && atletiData) DB.athletes = atletiData;

        // 10b. Schedules — ricostruisce la struttura nested
        //
        // Strategia anti-accumulo: raggruppa le righe per (athlete_id + meso).
        // Se esistono più gruppi per lo stesso atleta (residui di vecchi mesocicli
        // non ancora cancellati), sceglie il gruppo corretto nell'ordine:
        //   1. Meso che corrisponde al valore salvato in localStorage (fonte locale)
        //   2. Gruppo con più sessioni (scheda più completa = più recente)
        // In questo modo nessuna sessione di un vecchio mesociclo contamina
        // DB.schedules[athId].sessions dell'atleta.
        const { data: schedData, error: errSch } = await window.mySupabase
            .from('schedules')
            .select('*');
        if (!errSch && schedData) {
            // Salva i meso attivi dal locale PRIMA di sovrascrivere DB.schedules
            const mesoLocali = {};
            Object.entries(DB.schedules).forEach(([aId, sch]) => {
                if (sch.meso) mesoLocali[aId] = sch.meso;
            });

            // Raggruppa per (athlete_id, meso)
            const perAtleta = {};
            schedData.forEach(row => {
                const aId  = row.athlete_id;
                const meso = row.meso || '';
                if (!perAtleta[aId]) perAtleta[aId] = {};
                if (!perAtleta[aId][meso]) {
                    perAtleta[aId][meso] = { meta: row, sessions: [] };
                }
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
                    // Priorità al meso registrato in locale (più affidabile di Supabase
                    // in caso di dati stantii)
                    const mesoLocale     = mesoLocali[aId];
                    const corrisponde    = mesoLocale
                        ? voci.find(v => v.meta.meso === mesoLocale)
                        : null;
                    // Fallback: gruppo con più sessioni
                    scelto = corrisponde
                        || voci.sort((a, b) => b.sessions.length - a.sessions.length)[0];
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

        // 10c. Storico sessioni — snake_case → camelCase
        const { data: sessData, error: errS } = await window.mySupabase
            .from('sessions')
            .select('*');
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

        // 10d. Archivio mesocicli — ordinato dal più recente
        const { data: mesoData, error: errM } = await window.mySupabase
            .from('mesocycles')
            .select('*')
            .order('archived_at', { ascending: false });
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
        // Aggiorna il backup locale con i dati freschi del cloud
        await localforage.setItem(KEY, DB);

    } catch (e) {
        console.warn('Fallito caricamento Cloud, uso backup locale:', e);
        try {
            const d = await localforage.getItem(KEY);
            if (d) {
                DB.athletes      = d.athletes   || [];
                DB.sessions      = d.sessions   || [];
                DB.schedules     = d.schedules  || {};
                DB.mesocycles    = d.mesocycles || [];
            }
        } catch (err) {
            // Silenzioso: l'app parte comunque con DB vuoto
        }
    }

    if (!DB.athletes.length) seed();
}


// ─────────────────────────────────────────────────────────────
// 11. Service Worker — PWA offline support
// ─────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    navigator.serviceWorker
        .register('./sw.js')
        .catch(err => console.log('SW Error:', err));
}


// ─────────────────────────────────────────────────────────────
// 12. DOMContentLoaded — Bootstrap principale
//     Ordine di esecuzione:
//       1. initApp()      → autenticazione + carica dati locali
//       2. loadDB()       → sincronizzazione con il Cloud
//       3. Isolamento UX  → se ATLETA, nasconde elementi Coach
//       4. Render iniziale → popola tutta l'interfaccia
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

    // 1. Autenticazione (blocca qui finché l'utente non fa login)
    const authResult  = await initApp();
    window.userRole   = authResult; // 'ADMIN' | 'ATLETA'

    // 2. Sincronizzazione dati dal cloud
    await loadDB();

    // 3-4. Setup UX + Render iniziale — TUTTO dentro try-finally.
    //      Il finally garantisce la rimozione dello splash SEMPRE, anche se
    //      go('sessione') → loadLive() → renderE1rmChart() lancia un'eccezione
    //      (causa root del blocco interfaccia su Android).
    try {
        // 3. Se atleta: isola i suoi dati e trasforma l'UI in modalità mobile
        if (authResult === 'ATLETA') {
            const mioProfilo = DB.athletes.find(a => a.id === window.mioIdLoggato) || DB.athletes[0];

            if (mioProfilo) {
                selAthId = mioProfilo.id;

                // Filtra le sessioni e le schede al solo atleta loggato
                if (DB.sessions)  DB.sessions  = DB.sessions.filter(s => s.athlete === mioProfilo.id);
                const miaScheda   = DB.schedules[mioProfilo.id];
                DB.schedules      = {};
                if (miaScheda)    DB.schedules[mioProfilo.id] = miaScheda;

                // — Trasformazione UX mobile per l'atleta —
                // a. Nasconde sidebar e hamburger
                document.querySelector('.sidebar').style.setProperty('display', 'none', 'important');
                const hamburger = document.querySelector('.menu-toggle');
                if (hamburger) hamburger.style.setProperty('display', 'none', 'important');

                // b. Rimuove il padding-left del menu e aggiusta lo spazio per la bottom bar
                document.querySelector('.topbar').style.setProperty('padding-left', '20px', 'important');
                document.querySelector('.content').style.paddingBottom = '90px';

                // c. Nasconde il widget atleta in topbar (inutile per l'atleta stesso)
                const athPill = document.querySelector('.ath-pill');
                if (athPill) athPill.style.setProperty('display', 'none', 'important');

                // d. Mostra la bottom bar di navigazione
                document.getElementById('athlete-bottom-bar').classList.add('show');

                // e. Porta l'atleta direttamente alla sessione live
                go('sessione');
            }
        } else {
            // Se l'utente è ADMIN (Coach), accendi la dashboard al termine del caricamento
            go('dashboard', document.querySelector('.nav-btn'));
        }

        // 4. Render iniziale dell'intera interfaccia
        populateSelects();
        initFB();
        upW();
        loadLive();
        renderDashboard();
        renderAthletes();
        renderStorico();
        renderInjuries();

        // Imposta la data odierna nel form sessione e avvia l'autosalvataggio ogni 30s
        document.getElementById('ms-date').value = new Date().toISOString().slice(0, 10);
        setInterval(saveDB, 30000);

    } catch (err) {
        console.error('[CoachOS] Errore nel bootstrap:', err);
    } finally {
        // 5. Rimozione splash — GARANTITA anche in caso di eccezione nel bootstrap.
        //    pointer-events:none è impostato IMMEDIATAMENTE per sbloccare i tocchi
        //    su Android già durante la transizione di opacità (fix blocco interfaccia).
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            // Su Android la classe .hidden forza display:none e z-index:-9999 immediatamente,
            // eliminando il layer invisibile che blocca tutti i tocchi durante la transizione.
            splash.classList.add('hidden');
        }
    }
});
