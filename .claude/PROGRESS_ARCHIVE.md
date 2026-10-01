# PROGRESS ARCHIVE
Storia completa delle sessioni di sviluppo fino a v6.74.

---

**Design System v2 (Coach Console redesign)**
- Importati Archivo + IBM Plex Mono da Google Fonts
- Token CSS in `:root`: palette più fredda/scura, nuove variabili `--s4`, `--nav-bg`, `--input-bg`, `--text2`, `--dim2`, `--dim3`, `--mono-dim`, `--green`, `--fmono`, `--radius-btn`
- Border-radius card: 18px → 9px; button: 12px → 6px
- Topbar: gradient `#14181E→#0F1318` + border-bottom + ombra profonda
- Sidebar: `#0D1014`, nav items Archivo 12.5px/500, left-border inset su `.on`
- Tabelle: header `#171C23`, IBM Plex Mono, border-bottom `.10`, row separator `.04`
- Bottone primario: gradient arancio con inset highlight + shadow

**Design System v3 — Redesign visivo completo Coach Console**
- Token `:root` migrati a oklch: `--teal oklch(0.76 0.16 52)`, `--coral oklch(0.66 0.20 22)`, `--amber oklch(0.82 0.13 88)`, `--green oklch(0.74 0.11 175)`
- Card header gradient su tutti i pannelli coach tranne Editor schede
- Nav active: `inset 3px 0 0 var(--teal)`, background quasi trasparente
- Grafici Chart.js tutti con IBM Plex Mono su assi e tooltip scuro `rgba(12,15,19,.95)`
- Alert dashboard, triage, LSI, monotonia Foster: background e border in oklch semantico

**Fix UI Profilo Atleta (2026-09-16)**
- Badge topbar "ATLETA" nella vista atleta (id `role-badge`, gestito via JS in `main.js`)
- Nascosti `save-dot` e `save-txt` nella vista atleta
- Bottom bar atleta: icone geometriche a tutti i tab (⊞/◎/▲/◇/⊙/▶)

**Focus Mode (2026-09-16)**
- Overlay full-screen `#mo-focus` con un esercizio alla volta, navigazione prev/next, progress bar
- Sezione ANALISI: e1RM stimato + trend + storico + progressione carichi
- Dot set interattivi sincronizzati, timer REST autonomo, campo "Prossimo Carico"
- `refreshFocusIfOpen()` chiamato dopo ogni toggle/log

**Video Exercise Library (2026-09-16)**
- Completati tutti i `ytUrl` in `EXERCISE_LIBRARY` (100%)
- Fix: link video editor coach aprono modal in-app
- Nuovo modulo `library.js`: 9 categorie filtrabili, ricerca live, grid con thumbnail YouTube, bottone "+" coach-only
- Deploy v6.59

**Fix Video Libreria Esercizi (2026-09-17)**
- Verificati con oEmbed API tutti i 121 video — trovati 70 morti → sostituiti con URL funzionanti
- Deploy v6.59.1 (patch inline)

**Espansione Exercise Library v1 (2026-09-17)**
- Aggiunti 83 nuovi esercizi (da 122 a 206 totali), CAT_MAP allineato, tutti video live
- Deploy v6.60

**Fix Realtime storico/calendario (2026-09-17)**
- `_onSessionChange` in `auth.js`: aggiunto ri-render di `ath-storico` e `calendario`
- Deploy v6.60.1

**Espansione Exercise Library v2 (2026-09-17)**
- Aggiunti 56 esercizi (da 206 a 262 totali), 4 nuovi URL verificati oEmbed
- Deploy v6.61

**Espansione Exercise Library v3 (2026-09-18)**
- Aggiunti 56 esercizi (da 262 a 318 totali), tutti video verificati, 0 duplicati
- Deploy v6.62

**Dataset demo realistico — first-login "wow" (2026-09-18)**
- Riscritta `seed()`: 4 atleti demo con 8 settimane di storico (PRNG deterministico mulberry32)
  - Niccolò Trentin (tennis, sano): ACWR ottimali, e1RM in salita
  - Marco Bianchi (powerlifting, peak): 3 fondamentali in progressione
  - Elena Riva (calcio, a rischio): ACWR campo 1.62 DANGER, rischio 160, infortunio ginocchio VAS 6
  - Giulia Fontana (a4, lapsed): aggiunta in v6.66, storico fermo ~18gg fa
- Banner "Dati demo attivi" + `clearDemoData()` con flag `coachOS_noDemo`
- Deploy v6.63

**Empty-states + invito WhatsApp (2026-09-18)**
- Bottone "Invia invito via WhatsApp" nel modal codice atleta → `wa.me/?text=...`
- Empty-state lista atleti con CTA "+ Aggiungi il primo atleta"
- Deploy v6.64

**Smoke test visivo + fix badge (2026-09-18)**
- Fix: `clearDemoData` ora chiama `populateSelects()` → badge nav azzerati
- Aggiunto `node_modules/` a `.gitignore`
- Deploy v6.65

**Motore di adozione atleta (2026-09-18)**
- Card "Attività atleti" con semaforo 3 livelli (Attivo/A rischio/Silente)
- Nudge singolo + bulk → messaggio coach + push
- Deploy v6.66

**Analisi automatica settimanale — engine locale (2026-09-18)**
- `generateWeeklyInsight(athId)`: aderenza, ACWR, monotonia Foster, e1RM trend, HRV, readiness, LSI, infortuni
- Card dashboard `#dh-insight` con verdetto POSITIVO/DA MONITORARE/CRITICO + raccomandazione
- Deploy v6.67

**PDF Report mensile — white-label (2026-09-18)**
- `exportAthleteReport()` potenziato: white-label (brandName/Color/Logo), sezione "Analisi del coach" (riusa insight engine), PR del mese (top 6 e1RM), composizione corporea
- Deploy v6.68

**Qualità percepita — empty states pannelli coach (2026-09-18)**
- Storico, Calendario, Messaggi, Macro: empty state coerenti con testo adattivo
- Deploy v6.69

**Qualità percepita — mobile pass Coach Console (2026-09-18)**
- Topbar mobile: nascosto wordmark + testo save (collisione); resta solo pallino
- Decisione: skeleton rimandato (boot già gestito dallo splash)
- Deploy v6.70

**Qualità percepita — empty states lato atleta (2026-09-18)**
- Fix `renderAthWeek` senza programma: banner "Scheda non ancora assegnata" + giorni neutri
- Deploy v6.71

**Gamification riattivata (2026-09-19)**
- Bacheca trofei decommentata in `analytics.js`
- `badgeStripHtml()` in `badges.js`: striscia compatta in home atleta (trofei + streak + ultimo badge)
- Deploy v6.72

**Time-to-value coach — template programmi + duplica (2026-09-19)**
- 6 template in `PROGRAM_TEMPLATES` (state.js): Full Body 3×, Upper/Lower 4×, PPL, Forza 5×5, Atletica, Ricomposizione
- `applyProgramTemplate` + `_expandTemplateEx` in `app.js`
- `duplicateScheduleFrom` + `duplicateCurrentSession`
- Deploy v6.73

**Verifica + fix realtime coach (2026-09-19)**
- Verifica end-to-end Supabase: realtime funziona; gap = eventi persi con tab in background
- Fix `auth.js`: `_reloadSessions()` agganciato a `visibilitychange`, `online`, riconnessione canale
- Deploy v6.74

**Fiducia minima — privacy + export dati + rinomina "AI" (2026-09-19)**
- Privacy policy linkata in-app (login, foot sidebar, footer atleta)
- Fix wording: "AI Insight" → "Analisi automatica" + sottotitolo trasparenza
- `exportMyData()` lato atleta (portabilità GDPR, solo dati dell'atleta loggato)
- Verifica: 0 "AI Insight" user-facing; export JSON corretto; 0 errori console.
- Deploy v6.75

**Copia scheda su più atleti — replace o append (2026-09-24)**
- Modal `mo-copyto` a 3 step: (1) sedute da copiare, (2) replace/append, (3) atleti destinatari
- `_pushScheduleToCloud(athId)` sincronizza su Supabase scheda di atleta arbitrario
- Helpers: `_scheduleMeta`, `_cloneSessions`, `_cloneSchedule`; Bridge in `main.js`
- Verifica: `_cloneSchedule` 11/11 + split/replace/append 12/12; sorgente sempre intatta.
- Deploy v6.76

**Icone sidebar coach + install PWA (2026-09-24)**
- Sprite SVG inline 13 icone, stroke `currentColor`, attiva in `--teal`
- Capture `beforeinstallprompt` → banner pill "Installa l'app" sopra bottom bar atleta
- Deploy v6.77

**Cruscotto settimanale coach (2026-09-24)**
- Card `dh-cockpit`: riga per atleta con verdetto/aderenza/ACWR/rischio/infortunio/rilievo prioritario
- Righe ordinate per gravità; clic → seleziona atleta e aggiorna dashboard
- Deploy v6.78

**Igiene per i primi utenti reali (2026-09-24)**
- `alert()` → toast tipizzati (coral=errore, verde=successo); `z-index` toast alzato a `100002`
- Console gating in produzione (log/debug = no-op; riattivabili con `ess_debug='1'`)
- `window.onerror` + `unhandledrejection` globali → toast "ricarica la pagina" (throttled 15s)
- Deploy v6.79

**Login: errori inline sotto il campo (2026-09-24)**
- 4 slot `.login-err` per step; `oninput` pulisce errore mentre si digita
- `_loginErr(slot,msg)` + `_clearLoginErr(slot)` in `auth.js`; successi restano toast
- Deploy v6.80

**Redesign visivo Coach Console — gap reali (2026-09-24)**
- `theme-color` / `manifest.json` `#f97316` → `#14181E`
- Avatar atleti: rimossa palette random `_ATH_PALETTE`, uniform CSS `.ac-av`
- Chip Storico: `.tg` → `.tn` (neutro); flag resta coral `.tc`
- Spark Analytics: Volume=blu, Carico=viola, e1RM=arancio
- Macro: bug fix fill CSS invalido `var(--…)22` → mappa `_MACRO_FILL` rgba espliciti; ramp fasi (Accumulo blu → Intensif arancio → Picco rosso → Scarico verde)
- Deploy v6.81

**Redesign visivo App Atleta v4 (2026-09-25)**
- Scope `body.is-athlete`; regola: arancione = azione/dati, verde/ambra/corallo = stati
- Nuovi token `:root` (`--accent*`, `--ok/--warn/--bad`, elevazione, `--sheen`, `--ease-out`)
- Template JS tutti aggiornati (app/workout/analytics/wellness/nutrition/badges/index.html)
- Grafici: tema `AX` condiviso in `utils.js` (gradiente area reale, solo ultimo punto, range Y ±4%)
- Micro-interazioni: `playEntrance()` → count-up KPI, sweep ring, sheen CTA, ping check-in, glow PR
- Bug corretti: toast pillola vuota mobile, KPI Volume sbagliato, e1RM default multi-esercizio, "0/0 esercizi", grafico nutrizione assi vuoti, contrasto testo su arancione (WCAG)
- Deploy v6.82 (merge `3d6d3ad` + `e4364a5` da branch Claude Design)

**Verifica indipendente redesign atleta v4 (2026-09-25)**
- `git pull --ff-only` (main locale era fermo a `59c93d2`)
- `node --check` OK tutti i 15 moduli; guard `is-athlete` in `playEntrance()`; token aliasati correttamente
- Smoke Playwright: atleta 390px (6 tab, 0 errori), coach 1360px (tutti pannelli intatti, 0 errori)
- Conclusione: redesign promosso, già live in produzione

**Import da Excel/Sheets + reminder allenamento (2026-09-26)**
- **A · Import da Excel/Sheets** (client, zero dipendenze): bottone "Importa da Excel/Sheets" in toolbar editor → modal `mo-import` con textarea + anteprima live + conferma. Parser `parseImportedSchedule()` in `app.js`: rileva delimitatore (tab/`;`/`,` — tab = copia da Excel/Sheets), header o ordine default (Seduta·Esercizio·Serie·Reps·Carico·RIR/RPE·Recupero·Note), raggruppa per colonna "seduta" o righe-titolo, converte RPE→RIR, rimuove numerazione "1.". Match nome→`EXERCISE_LIBRARY` (`_matchLibExercise`, overlap di token, soglia 0.6) per agganciare video+e1RM; fallback a testo libero. `confirmImport` sostituisce la scheda (showConfirm se piena). Bridge in `main.js`.
- **B · Reminder allenamento** (server-side, controllo coach per-atleta, default ON):
  - Migration `reminders_migration.sql`: `atleti.training_reminder bool default true` + `schedules.scheduled_days int[]` (fixa il bug: prima `scheduledDays` viveva solo nel browser, non persistito né riletto dal cloud) + job `pg_cron` orario che invoca l'edge function.
  - Client: toggle "Promemoria allenamento" per-atleta nel modal `mo-ath` (default acceso); persiste/rilegge `scheduled_days` in `saveSchedule`/`_pushScheduleToCloud`/load `auth.js`; `training_reminder` in add/edit atleta.
  - Edge function `supabase/functions/send-reminders/index.ts`: gira ogni ora, invia solo alle 08:00 Europe/Rome (DST gestita via `Intl`), agli atleti con reminder ON + seduta programmata oggi + non ancora loggata. Riusa VAPID di send-push, pulisce subscription stantie. Auth via header `x-cron-secret`.
- Verifica: `node --check` OK (app/auth/main); parser testato sul **codice reale** (17/17: delimitatori, header, righe-titolo, RPE→RIR, match/fallback, numerazione); `romeNow` testato (dow+DST corretti); smoke Playwright coach 1360px (import sostituisce 3 sedute demo con Push/Pull, anteprima video+fallback, toggle reminder presente+acceso, **0 errori console**).
- **Auth cron autosufficiente** (niente secret CLI): tabella `reminder_config` (RLS on, nessuna policy → solo service role) con segreto generato; il cron legge il segreto dal DB e lo passa in header `x-cron-secret`; la funzione lo rilegge dal DB e confronta.
- **Backend DEPLOYATO in produzione** (via Supabase MCP): migration colonne+config+estensioni applicata; `pg_cron`/`pg_net` attivi; edge function `send-reminders` ACTIVE (`verify_jwt=false`); cron `training-reminders-hourly` (`0 * * * *`) attivo. Testato live: chiamata autorizzata → 200 (`dow=6 hour=16`, 8 atleti reminder ON, 0 programmati oggi = corretto); secret errato → 401.
- **Client DEPLOYATO**: SW **v6.83**, commit `7f3573c` + push su `main`, `vercel --prod` (dpl_Ai8arLe11dHzaWyg1YGUACGKQEEv). Verificato live su `coach-os-lime.vercel.app`: SW v6.83 + bottone "Importa da Excel/Sheets" + toggle `ma-reminder` serviti. ✅ Entrambe le feature live end-to-end.
- Da valutare in futuro: qualità del match nome→libreria per termini 100% italiani (es. "Panca piana" → ok via "Panca"; nomi molto diversi restano testo libero, corretto); primo vero invio push del cron osservabile in `cron.job_run_details`.

**Sessione persistente lato atleta — ripresa dopo crash/chiusura (2026-09-26)**
- Ultimo blocker di adozione. Prima: solo i pallini sopravvivevano; i **valori reali** (kg/reps in `window.realLog`) erano salvati in `coachOS_real_log` ma **mai ri-caricati** → dopo un crash i set sembravano fatti ma i dati erano persi (a fine allenamento si salvavano i target); nessuno scoping per atleta/giorno; `coachOS_real_log` orfano a fine sessione; nessun segnale di ripresa.
- **Fix (workout.js)**: helper recovery scoped — `saveLiveCtx` (stampa `{athId,sessId,week,date}` in `coachOS_live_ctx` insieme a dots+realLog, solo se c'è progresso), `_rehydrateLiveRecovery` (ripristina `window.realLog` all'inizio di `loadLive` **prima del render** solo se stesso atleta+giorno; altrimenti pulisce i residui), `clearLiveRecovery`, `restartLiveSession`. Restore pallini gated a `sessId+week` corrispondenti. Auto-save (`updateLiveTotals`) ora scrive anche il contesto.
- **Banner "Riprendi"** (`#lv-resume` in index.html, `_renderResumeBanner`): compare sopra il set tracker quando ci sono set già registrati oggi per quella sessione+settimana ("N set già registrati") con azione "Ricomincia da capo".
- **Cleanup a fine allenamento (app.js)**: `clearLiveRecovery()` sostituisce il vecchio `removeItem('coachOS_live_dots')` (pulisce dots+realLog+ctx); il conteggio set per la schermata di riepilogo è calcolato **prima** della pulizia e passato a `showAthSummary(sessObj, loggedSets)` (fallback al vecchio path localStorage preservato).
- Verifica: `node --check` OK (app/workout/main); smoke Playwright (atleta 390px, codice reale) → persistenza+scoping, ripresa dopo crash simulato (realLog rehydrated + banner visibile), caso stale (data di ieri → pulito), "Ricomincia da capo" (tutto pulito), **0 errori console**.
- **DEPLOYATO**: SW **v6.84**, commit + push su `main`, `vercel --prod`. Client-only.

**Nascosti i tile wearable "Coming Soon" (2026-09-26)**
- Contesto: con tutte le piattaforme (`whoop/polar/apple_health/garmin`) in `comingSoon:true`, la card "Dati Fisiologici" mostrava 4 chip "Coming Soon" = effetto vaporware.
- Fix (`wearable.js`, `renderWearableStatus`): i tile `comingSoon` (e i `nativeOnly` su web) non vengono più renderizzati se non già connessi; il contenitore `#wearable-platform-list` va in `display:none` quando non resta alcun tile azionabile. `index.html`: contenitore `display:none` di default (niente gap se il render non gira). Restano i **campi manuali HRV/RHR** nella card. Riattivare una piattaforma = rimuovere `comingSoon:true` → il tile ricompare da solo.
- Verifica: `node --check` OK; smoke Playwright (atleta 390px) → 0 chip, 0 "Coming Soon" nel DOM, `display:none`, campo HRV manuale intatto, 0 errori console.
- **DEPLOYATO**: SW **v6.85**, commit + push + `vercel --prod`. Client-only.

**ACWR individualizzato + framing onesto + gate dati (2026-09-26)**
- Contesto: l'ACWR con soglie universali (0.8–1.3 / >1.5 "DANGER") è scientificamente contestato (Lolli, Impellizzeri, Coutts) → rischio di credibilità coi coach S&C. Scelta utente: perfezionarlo (1+2+3), non disattivarlo.
- **#1 Individualizzazione** (`calculateACWR` in `analytics.js` riscritto): oltre al valore finale, cammina la serie storica dei ratio per binario e calcola lo **standard personale** (media/σ). Sopra 1.3 classifica via z-score rispetto al baseline dell'atleta; la fascia sicura 0.8–1.3 resta sempre "nella norma" (l'individualizzazione **riduce** i falsi allarmi, non ne crea). Fallback a soglie generiche con poco storico.
- **#2 Framing onesto**: niente più "DANGER". Etichette descrittive ("In linea col suo standard", "Sopra il suo standard", "Carico in forte aumento — verifica") + `note` con metodologia. Nuovo campo `level` (`insufficient|low|optimal|elevated|high`) che i consumatori usano al posto del match su stringa. Aggiornati: `generateWeeklyInsight`, alert carico dashboard, `updatePredictiveACWR` (editor), card Analytics (con nota "supporto alla decisione, non predizione"). Colore "ottimale" corretto da arancione a verde.
- **#3 Gate per-binario**: min 6 sessioni **e** ~21 giorni di calendario per quel binario (prima: 7 sessioni totali, contate non nel tempo).
- **Decisione utente**: Elena campo 1.62 (baseline 1.22, +1.5σ) → da rosso "DANGER" a giallo "Sopra il suo standard" (individualizzato). Il rischio complessivo **resta 160/CRITICO** (guidato da infortunio+readiness+LSI; il `>1.5` aggiunge comunque +40 al risk score).
- Verifica: `node --check` OK (analytics/app); confronto etichette sul **codice reale** (4 atleti demo, vecchio→nuovo mostrato all'utente); coerenza rischio/insight (Niccolò/Marco good rischio 0, Elena bad rischio 160, Giulia bad); smoke Playwright coach 1360px → 0 "DANGER" nel DOM, KPI con nuove etichette, nota metodologia, 0 errori console.
- **Nota**: il **toggle** per disattivare l'ACWR NON è incluso (fuori dallo scope 1+2+3) — follow-up rapido se desiderato.
- **DEPLOYATO**: SW **v6.86**, commit + push + `vercel --prod`. Client-only.

**#4 decadimento su calendario — VALUTATO E SCARTATO (2026-09-26)**
- Implementata e testata l'EWMA giornaliera (Williams et al.: scorre il calendario, i giorni di stop entrano come carico 0). Esito sul **codice reale** (seed): **peggiora** i risultati per questo dominio. Con l'allenamento di forza sparso (2-4 sedute/sett.) i giorni di riposo fanno decadere l'acuto e nel giorno-seduta "schizza" sopra il cronico → il ratio diventa dominato da "oggi è giorno di allenamento sì/no", non dal trend. Falso allarme reale: **Niccolò (atleta sano) → field 1.52 [high] "Molto sopra il suo standard", rischio 40**. Ancorando a oggi, il decadimento fino a oggi schiacciava l'acuto di tutti ("tutti in calo") e faceva perdere a Elena il +40 (160→120).
- **Decisione**: mantenere l'EWMA **per-sessione** (media ~3 sedute, robusta ai dati sparsi). Il caso "non si allena da giorni" è già coperto dal motore di adozione. Aggiunto solo un **commento** in `analytics.js` che documenta la scelta (per non ri-tentarla). Nessun cambiamento di comportamento → **non deployato** (prod v6.86 già identica).

**Nutrizione de-enfatizzata (posizionamento forza/atletica) (2026-09-26)**
- Contesto: la nutrizione è solo inserimento manuale dei totali (kcal/P/C/G), **senza database alimenti** → attrito alto, compete male con MyFitnessPal/Cronometer, diluisce il core S&C. La vista coach (`renderNutritionCoach`) non è nemmeno collegata. Scelta utente: mercato forza/atletica → de-enfatizzare (non cancellare).
- **Gate opt-in** (`renderNutritionCard`, `nutrition.js`): la card nel tab Progressi atleta si mostra SOLO se il coach ha impostato dei target **o** ci sono già log; altrimenti è nascosta (`el.innerHTML=''`). L'atleta di forza di default non trova più un "diario alimentare"; chi ha dati (e il demo) la mantiene.
- **Riformulazione onesta**: card "Nutrizione" → **"Aderenza nutrizionale"**, bottone "+ Log oggi" → "+ Aggiorna", empty-state e modal rimandano al *proprio* tracker ("inserisci i totali dal tuo tracker, es. MyFitnessPal") invece di fingere di essere il tracker.
- Verifica: `node --check` OK; smoke Playwright (atleta 390px) → demo a2 con dati mostra card riformulata; atleta senza target/log → card nascosta; 0 errori console.
- **DEPLOYATO**: SW **v6.87**, commit + push + `vercel --prod`. Client-only.

**Bottom bar atleta 6→5: "Settimana" assorbita in "Oggi" (2026-09-26)**
- UX: 6 voci nella bottom bar mobile erano oltre il limite comodo (iOS/Material: 3-5). "Settimana" era l'unica tab passiva (sola panoramica) e condivide il modello mentale di "Oggi" (il piano, a due zoom) → candidata ideale da fondere.
- `renderAthWeek(targetId='ath-week-content', embedded=false)` parametrizzata: in modalità `embedded` niente `padding-bottom:100px` e titolo compatto "Questa settimana" invece di "La mia settimana". `renderAthHome` inserisce `<div id="ah-week">` dopo la sessione (prima del motivazionale) e la popola con `renderAthWeek('ah-week', true)` → striscia settimanale **sempre aperta** (compliance + griglia 7 giorni). Nessuna riscrittura di logica.
- Rimossa la voce `bb-week` dalla bottom bar (→ 5 voci: Oggi·Wellness·Sessione·Progressi·Coach). Rotta `ath-week` lasciata come orfano innocuo (fallback, `go()` gestisce il bb mancante con optional chaining). Aggiornata la guida onboarding (Oggi ora descrive anche la panoramica settimanale).
- Verifica: `node --check` OK; smoke Playwright (atleta 390px) → 5 voci senza "Settimana", sezione "Questa settimana" dentro Oggi con compliance/giorni, rotta orfana non rompe, 0 errori console.
- **DEPLOYATO**: SW **v6.88**, commit + push + `vercel --prod`. Client-only, solo lato atleta mobile.

**Card-ificazione Storico coach su mobile (2026-09-26)**
- Prima: su mobile lo Storico coach (tabella densa 15 colonne) nascondeva colonne via CSS `nth-child` → compromesso povero. Ora card leggibili.
- `index.html`: aggiunto `<div id="sto-cards">` accanto a `.tw`. `styles.css`: `.sto-cards{display:none}` di default; `@media(max-width:768px)` nasconde `#p-storico .tw` e mostra le card (flex column). `app.js` `renderStorico`: nello stesso loop costruisce righe tabella (desktop) **e** card curate (mobile) — header atleta + chip sessione/fase/data/flag, griglia 4 metriche (Read/Vol/sRPE/e1RM), riga RPE P→A + stato risposta + azioni Rispondi/✕, DOMS se presente. Empty-state gestito per entrambi. Nessun listener di resize (doppio render nello stesso passaggio, CSS decide cosa mostrare).
- Verifica: `node --check` OK; smoke Playwright → mobile 390px (tabella nascosta, 122 card, esempio Elena con flag+metriche), desktop 1360px (tabella visibile, card nascoste), 0 errori console.
- **DEPLOYATO**: SW **v6.89**, commit + push + `vercel --prod`. Client-only.

**Mesociclo a blocchi/fasi + data d'inizio automatica (2026-09-27)**
- Contesto: caso rientro da infortunio → un mesociclo (es. 12 sett.) in cui **esercizi e split cambiano nel corso delle settimane** (sett. 1 test → 2-3 casa senza carico + 1 palestra → dalla 4 esercizi diversi casa+palestra). Prima l'app variava solo set/rep/kg per settimana (progressione), non *quali* esercizi/split. Scelta utente: granularità **a blocchi/fasi**, blocco attivo scelto in automatico dalla **data d'inizio**.
- **Modello**: un mesociclo = sequenza di **blocchi**. Ogni blocco copre `[weekStart..weekEnd]` e ha le proprie sedute (split), esercizi, giorni e progressione. La progressione per-settimana esistente gestisce il carico *dentro* il blocco. Retro-compatibile: scheda senza `blocks`/`blockId` = un blocco unico implicito `1..duration` (comportamento identico al vecchio).
- **Helper puri** in `utils.js` (condivisi coach/atleta, testati 17/17 su codice reale): `ensureBlocks` (normalizza/garantisce blocco+blockId), `mesoWeekFromDate` (settimana dal calendario, clamp a durata), `activeBlock` (null se ≤1 blocco → legacy), `sessionsForWeek` (filtro sedute sul blocco attivo, con fallback safety), `activeScheduledDays` (giorni del blocco, fallback a livello scheda).
- **Persistenza** (`blocks_migration.sql`, applicata in prod): nuove colonne su `schedules` — `block_id`, `block_name`, `block_week_start`, `block_week_end`, `meso_start_date`, **+ `session_type`** (non era mai stato persistito su cloud; serve al round-trip casa/palestra). `saveSchedule`/`_pushScheduleToCloud` scrivono via helper `_scheduleRow` (giorni = quelli del blocco). Load `auth.js`: sotto-raggruppa le righe per `block_id` → ricostruisce `blocks[]`, poi `ensureBlocks` per le schede legacy.
- **Editor coach** (`app.js` `renderEditor` + `index.html`): campo **Data inizio mesociclo**; card **Blocchi/Fasi** con chip-tab per blocco (label `Nome · S1-3 · N sed.`), nome/settimana-da/a per blocco, giorni per blocco, "+ Nuovo blocco", "Elimina blocco" (nascosto se 1 solo). I tab-seduta e gli esercizi sono **filtrati sul blocco attivo**; nuove sedute nascono nel blocco corrente. Modale progressione limitata alle settimane del blocco; smart-microcycle ragiona sulla lunghezza del blocco (settimane relative) ma scrive sulle assolute. Funzioni: `syncMesoStart/addBlock/renameBlock/syncBlockWeeks/deleteBlock` (bridge in `main.js`).
- **Atleta**: `loadLive`/`renderAthWeek`/`renderAthHome`/`showAthSummary` passano per `sessionsForWeek`/`activeScheduledDays`. Con data d'inizio impostata la **settimana è guidata dal calendario** (`mesoWk`) e il blocco/fase attivo scelto di conseguenza (selettore settimana riflette `mesoWk`); senza data, comportamento manuale legacy.
- **Archivio meso**: snapshot include `blocks`/`mesoStartDate`; "Archivia & Nuovo Meso" resetta blocchi + azzera data d'inizio.
- Verifica: `node --check` OK (utils/auth/app/workout/main); **17/17** test logica sullo scenario utente (sett 1 test / 2-3 casa / 4-12 carico, legacy, clamp); smoke Playwright coach 1360px (3 blocchi, range, filtro tab-seduta per blocco, **0 errori**) + atleta 390px (settimana 5 → `lv-week=5` e `lv-sess` mostra SOLO la seduta del blocco 4-12, **0 errori di codice**; i 2 errori osservati = FK Supabase su atleta demo, ambientali).
- Bug trovato dallo smoke e corretto: `renameCurrentSession` usava `.sess-tab.on` non scopato → collideva coi tab-blocco (stessa classe) sovrascrivendo l'etichetta del blocco col nome della seduta; ora scopato a `#ed-tabs`.
- **DEPLOYATO**: SW **v6.90**, migration in prod, commit `f71db02` + push su `main` + `vercel --prod`. Verificato live su `coach-os-lime.vercel.app` (sw v6.90 + `ed-meso-start`/`ed-block-tabs` serviti).

**Email atleta facoltativa alla creazione (2026-09-27)**
- Contesto (attrito coach): creare un atleta richiedeva l'email → scomodo. Verificato sul **codice reale + funzione deployata**: l'email inserita dal coach NON serve. Il collegamento login↔atleta avviene per **codice** (`link_athlete_auth(p_athlete_id, p_code)`); la funzione legge l'email vera dall'account auth dell'atleta (`auth.users` via `auth.uid()`) e **sovrascrive** `atleti.email` al primo accesso. L'email del coach serviva solo a pre-compilare il campo setup (comodità), poi viene buttata.
- **Fix (`app.js` `addAthlete`)**: email ora facoltativa. Se vuota → `null` (colonna `atleti.email` è `UNIQUE` ma nullable → Postgres ammette più `NULL`, niente conflitto tra atleti senza email). Se il coach la inserisce, dev'essere valida (`includes('@')`). Oggetto locale + insert Supabase ereditano `email || null`. Display codice invito: mostra "· email" solo se presente (niente separatore penzolante).
- **`index.html`**: label campo → "opzionale, la imposta l'atleta al primo accesso", placeholder "Facoltativa".
- Nessuna migration necessaria (colonna già nullable). `saveAthleteEdits` non tocca l'email → nessun cambiamento lato modifica.
- Verifica: `node --check` OK (app/utils). Confermato via Supabase MCP: `link_athlete_auth` deployata linka per codice + sovrascrive email; `atleti.email` nullable + UNIQUE. Smoke Playwright (chromium, app reale + Supabase stubbato) → 3 casi: senza email (insert con `email:null`, modal codice aperto, nessun "null"/separatore penzolante nel display), email malformata (insert bloccato), email valida (scritta + mostrata); **0 errori console**.
- **DEPLOYATO**: SW **v6.91**, commit `fb80909` + push su `main` + `vercel --prod` (dpl_BYGFZ9YrpKimVGfLULAgsLqqMMcz). Verificato live su `coach-os-lime.vercel.app`: sw v6.91 + label "opzionale" + `emailRaw || null` serviti.

**RIR/TUT per settimana nella progressione (2026-09-27)**
- Contesto: prima la progressione settimanale portava solo `set/rep/kg`; RIR e TUT erano un valore unico per esercizio (non variavano con la settimana). Nei protocolli di riabilitazione/forza cambiano spesso di settimana.
- **Fix vista atleta (`workout.js`)**: nel render live, oltre a `set/rep/kg`, si leggono `rir` e `tut` dalla settimana attiva della `progression` (`pW.rir`/`pW.tut`), con **fallback** ai valori fissi `ex.rir`/`ex.tut` per le schede senza dato per-settimana. Chip `RIR`/`TUT` ora week-aware (guidati automaticamente da `mesoStartDate`).
- **Difese editor (`app.js`)**: `saveProgressionData` e lo smart-microcycle preservano i `rir`/`tut` per-settimana esistenti quando ricostruiscono la progressione (prima li avrebbero persi). `saveLiveNextLoad` già modificava solo `.kg` → ok. Nessuna migration (la progressione vive dentro la colonna `exercises` JSONB).
- Verifica: `node --check` OK (workout/app); smoke Playwright (atleta 390px, app reale + `replaceDB`) → S3 mostra RIR 2/TUT 3-1-1-0, S5 mostra RIR 1/TUT 3-0-X-0 (cambiano), fallback ai valori fissi quando la progressione non ha rir/tut, **0 errori console**.
- Uso reale: scheda riabilitativa Agoge ricaricata con nomi corti + note minime + riscaldamenti espansi (sezione `warmup`) + RIR/TUT per settimana (13 sedute, 103 esercizi, round-trip verificato su Supabase).
- **DEPLOYATO**: SW **v6.92**, commit `6a53b44` + push + `vercel --prod`. Verificato live (`pW.rir`/`targetRir` in workout.js).

**Campi RIR/TUT per settimana nell'editor coach (2026-09-27)**
- Completa la feature precedente: la modale progressione (`openProgressionModal`/`saveProgressionData` in `app.js`) ora ha, per ogni settimana, oltre a Set/Rep/Kg anche i campi **RIR** e **TUT** (input testo, così accetta range tipo "1-2" e cadenze "3-0-X-0"). Vuoto = eredita il valore fisso dell'esercizio.
- **Kg reso testuale** nella modale (prima `type=number`): supporta carichi non numerici ("al RIR", "elastico", "+2,5kg/sett"); pre-fill con fallback a `ex.kg`; salvato come stringa (`|| ex.kg`).
- Verifica: `node --check` OK; smoke Playwright coach 1360px (app reale + `replaceDB`) → campi presenti e pre-compilati (S3 RIR2/3-1-1-0, S5 RIR1/3-0-X-0), modifica S4 salvata (RIR0/TUT 2-0-1-0/kg testo), settimane non toccate preservate, **0 errori console**.
- **Da deployare**: SW bump v6.93 + commit + push + `vercel --prod` (client-only, editor coach).
