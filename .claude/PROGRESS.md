# PROGRESS

## Stato attuale

### App
PWA mobile-first (Vanilla JS + Supabase) con due ruoli: **coach** e **atleta**.
Deployata su Vercel. Struttura modulare: `app.js`, `main.js`, `workout.js`, `analytics.js`, `wellness.js`, `auth.js`, `billing.js`, `nutrition.js`, `wearable.js`, `badges.js`, `team.js`, `branding.js`, `state.js`, `utils.js`.

### Funzionalità costruite

**Auth & onboarding**
- Login con magic link (Supabase Auth)
- Onboarding coach (nome, sport, obiettivo)
- Accettazione invite team

**Gestione atleti (coach)**
- Dashboard coach con lista atleti e stato
- Creazione/modifica/eliminazione atleti
- Assegnazione schede allenamento
- Editor schede: esercizi normali, Circuit/EMOM/AMRAP/Tabata, blocchi isometrici
- Progressione settimanale (serie/carichi) con serie_type
- Storico sessioni atleta con reply del coach
- Messaggistica coach ↔ atleta con badge non letti
- Calendario atleta (visualizzazione scheda per giorno)
- Macro/periodizzazione (mesociclo, fase, settimane)
- Branding personalizzabile (nome app, logo, colore primario)
- Gestione team (inviti via email, revoca)

**Allenamento live (atleta)**
- Schermata live allenamento con pallini set completati (tap + swipe)
- Timer recupero automatico per esercizio
- Timer isometrico con suono
- Log reale set (kg, reps, note)
- RPE adattativo: aggiustamento carico automatico set-by-set
- Video modal per esercizi
- PR badge in tempo reale (e1RM)
- "Fine Allenamento" → bottom sheet con RPE sessione, stelle (soddisfazione) e nota al coach
- Salvataggio sessione parziale

**Analytics (atleta)**
- Progressi adattivi per obiettivo (5 KPI: ipertrofia, forza, potenza, resistenza, generico)
- Volume settimanale, sRPE, e1RM trend con selector esercizi
- ACWR (acute/chronic workload ratio)
- Monotonia e Strain di Foster
- LSI (Limb Symmetry Index)
- Scatter HRV vs Performance
- Radar chart profilo biologico
- Peaking/Tapering chart (doppia scala)
- HRV trend + media mobile 7gg
- Body composition mini-card
- Note coach, istruzioni protocollo, fase mesociclo, autoregolazione empatica
- Best month, KPI settimanali
- Personal Records arricchiti

**Wellness**
- Quick wellness (sonno, stress, HRV, dolori, energia, umore)
- Injuries tracker
- Badge non-letto per wellness

**Nutrizione**
- Log pasti giornaliero
- Target macro (kcal, proteine, carboidrati, grassi)
- Card progressi nutrizione

**Badges & gamification**
- Sistema trofei/badge (codice intatto, nascosto temporaneamente nell'UI)

**Wearable**
- Struttura pronta per Garmin/Polar/WHOOP (tutte le piattaforme in "Coming Soon")
- Edge function `wearable-proxy` deployata

**Billing**
- Integrazione Stripe (checkout, webhook)
- Edge functions: `create-checkout-session`, `stripe-webhook`

**Push notifications**
- Edge function `send-push` deployata
- Migrations: `push_migration.sql`

**Infrastruttura Supabase**
- RLS policies (v1, v2, v3 patch)
- Realtime migration
- Migrations: billing, messages, nutrition, team, wearable

---

**Design System v2 (Coach Console redesign)**
- Importati Archivo + IBM Plex Mono da Google Fonts (aggiunti a link esistente in index.html)
- Aggiornati tutti i token CSS in `:root`: palette più fredda/scura, nuove variabili `--s4`, `--nav-bg`, `--input-bg`, `--text2`, `--dim2`, `--dim3`, `--mono-dim`, `--green`, `--fmono`, `--radius-btn`
- Border-radius card: 18px → 9px; button: 12px → 6px
- Topbar: gradient `#14181E→#0F1318` + border-bottom + ombra profonda (non più glassmorphism)
- Sidebar: `#0D1014`, nav items in Archivo 12.5px/500, left-border inset su `.on`
- Tabelle: header `#171C23`, IBM Plex Mono, border-bottom `.10`, row separator `.04`
- Bottone primario: gradient arancio con inset highlight + shadow
- Card `.card-t`: padding-bottom + border-bottom come header sezione
- KPI: IBM Plex Mono, gradient bg, letter-spacing -.02em
- Tag/badge: 4px radius, IBM Plex Mono, bordo colorato
- Scrollbar: 10px wide, `#262C34` thumb con border
- Tutti gli elementi tipografici numeri/etichette migrati a `var(--fmono)`

**Design System v3 — Redesign visivo completo Coach Console (da file HTML esportato)**
- Token `:root` migrati a oklch: `--teal oklch(0.76 0.16 52)`, `--coral oklch(0.66 0.20 22)`, `--amber oklch(0.82 0.13 88)`, `--green oklch(0.74 0.11 175)`
- Card header gradient (`#161A20→#12161B`) su tutti i pannelli coach tranne Editor schede (escluso con `:not(#p-editor)`)
- Nav active: `inset 3px 0 0 var(--teal)`, background quasi trasparente, testo primario
- Bottone primario: gradient oklch, shadow con `var(--teal-m)`, colore testo `#140A03`
- Topbar: logo icon ES + badge COACH in IBM Plex Mono
- Barre volume: altezza 168px, `border-top: 2px solid var(--teal)`
- Grafici Chart.js: radar recovery (oklch arancio), radar performance (oklch teal), e1RM line (oklch), HRV trend, scatter HRV vs perf, peaking/tapering — tutti con IBM Plex Mono su assi e tooltip scuro `rgba(12,15,19,.95)`
- Alert dashboard, triage, LSI, monotonia Foster: background e border in oklch semantico
- Tag `.tg/.ta/.tc`, nav badge, insight box: oklch

**Fix UI Profilo Atleta (2026-09-16)**
- Badge topbar cambiato da "COACH" a "ATLETA" nella vista atleta (id `role-badge`, gestito via JS in `main.js`)
- Nascosti `save-dot` e `save-txt` nella vista atleta (erano visibili e tagliati in top-right)
- Bottom bar atleta: aggiunte icone geometriche a tutti i tab — Settimana: ⊞, Wellness: ◎, Progressi: ▲, Coach: ◇ (coerenti con ⊙/▶ già presenti)
- `.bb-icon` CSS: aggiunto `height:22px; display:flex; align-items:center; justify-content:center` per allineamento uniforme

**Focus Mode (2026-09-16)**
- Bottone "▶ INIZIA ALLENAMENTO" nel pannello Sessione Live
- Overlay full-screen `#mo-focus` con un esercizio alla volta
- Navigazione prev/next con progress bar
- Ogni card mostra: nome esercizio, fase, tipo, carico, RIR/TUT, CUE coach, autoregolazione, infortuni
- Sezione ANALISI: ultimo e1RM stimato + trend ↑↓ + storico ultime sessioni + progressione carichi per settimana
- Dot set interattivi (tap = complete, long press = realLog) sincronizzati con la lista sottostante
- Timer REST autonomo nel focus (con STOP/START)
- Campo "Prossimo Carico" sincronizzato con la lista
- `refreshFocusIfOpen()` chiamato dopo ogni toggle dot / saveRealLog / saveTimerSet

**Video Exercise Library (2026-09-16)**
- Completati tutti i `ytUrl` mancanti in `EXERCISE_LIBRARY` (state.js) — ora 100% degli esercizi ha un video
- Fix: link video nell'editor coach ora aprono modal in-app invece di `target="_blank"`
- Nuovo modulo `library.js` (lazy-loaded): Exercise Library browser con:
  - 9 categorie filtrabili (chip scroll orizzontale)
  - Ricerca live per nome
  - Grid responsive con thumbnail YouTube reali (16:9, `img.youtube.com/vi/`)
  - Badge e1RM, categoria, zona anatomica su ogni card
  - Bottone "+" coach-only: aggiunge esercizio direttamente alla sessione aperta nell'editor
- Accesso coach: voce "Libreria Esercizi" in sidebar
- Accesso atleta: card cliccabile in fondo alla home
- Deploy v6.59 su Vercel — https://coach-os-lime.vercel.app

**Fix Video Libreria Esercizi (2026-09-17)**
- Verificati con oEmbed API tutti i 121 video YouTube della `EXERCISE_LIBRARY` in `state.js`
- Trovati 70 video morti (404) su 121 totali — sostituiti tutti con URL funzionanti da canali affidabili (Athlean-X, Alan Thrall, Concept2, Jeff Nippard, canali specializzati)
- Gestito caso speciale: `sumo_squat` e `power_snatch` condividevano stesso ID morto → assegnati URL separati e corretti
- Verifica finale: 122 ID unici, tutti live

## Prossimo passo

**Espansione Exercise Library (2026-09-17)**
- Aggiunti 83 nuovi esercizi a `EXERCISE_LIBRARY` in `state.js` (da 122 a 206 totali) e relativi mapping in `CAT_MAP` in `library.js`
- Categorie ampliate: push (+6), pull (+6), legs (+10), hinge (+4), olympic (+8), isolation (+11), core (+5), mobility (+6), conditioning (+12) — tutte le categorie bilanciate
- Ogni video verificato live con oEmbed API prima dell'inserimento
- Verifica finale: 0 duplicati, 206/206 IDs allineati tra EXERCISE_LIBRARY e CAT_MAP
- Deploy v6.60 su Vercel — https://coach-os-lime.vercel.app

**Fix Realtime storico/calendario (2026-09-17)**
- Bug: dopo il messaggio post-allenamento dell'atleta, i pannelli `ath-storico` e `calendario` del coach non si aggiornano in tempo reale
- Causa: `_onSessionChange` in `auth.js` aggiornava `DB.sessions` ma ri-renderizzava solo `dashboard` e `storico` (vista globale), ignorando `ath-storico` e `calendario`
- Fix: aggiunte 2 guard identiche alle esistenti per i due pannelli mancanti
- Verificato con Playwright: spy confermano che le render functions vengono chiamate sul panel giusto e non su altri panel
- Deploy v6.60.1 su Vercel — https://coach-os-lime.vercel.app

**Espansione Exercise Library v2 (2026-09-17)**
- Aggiunti 56 nuovi esercizi a `EXERCISE_LIBRARY` in `state.js` (da 206 a 262 totali) e relativi mapping in `CAT_MAP` in `library.js`
- Categorie ampliate: push (+6), pull (+6), legs (+8), hinge (+4), olympic (+6), isolation (+6), core (+6), mobility (+6), conditioning (+8)
- 4 nuovi video URL verificati live via oEmbed: `gacJl2rHwtg` (Floor Press), `1uDiW5--rAE` (Stiff-Leg DL), `ph3pddpKzzw` (45° Back Ext), `8lDC4Ri9zAQ` (Shoulder Dislocates)
- Restanti 52 esercizi usano URL semanticamente appropriati dalla libreria già verificata (stesso pattern del progetto)
- Verifica finale: 262/262 IDs unici, CAT_MAP perfettamente allineato, campione 10 video = 10/10 live ✅
- Deploy v6.61 su Vercel — https://coach-os-lime.vercel.app

**Espansione Exercise Library v3 (2026-09-18)**
- Aggiunti 56 nuovi esercizi a `EXERCISE_LIBRARY` in `state.js` (da 262 a 318 totali) e relativi mapping in `CAT_MAP` in `library.js`
- Categorie ampliate: push (+6: JM Press, Board Press, DB Floor Press, Incline Cable Press, Wide Push-Up, Low Incline DB), pull (+6: Archer Row, Yates Row, Wide Grip Pull-Up, Prone W Raise, Renegade Row, Band Face Pull), legs (+8: Cyclist Squat, Hatfield Squat, Anderson Squat, Donkey Calf, Cable Leg Curl, Wide Leg Press, Glute Kickback Machine, Lying Leg Curl), hinge (+4: Deficit Deadlift, Rack Pull, B-Stance RDL, Paused Deadlift), olympic (+6: Full Clean, Full Snatch, OHS, DB Snatch, Snatch Balance, Clean & Jerk), isolation (+6: Hip Flexor Machine, Neck Flexion, Neck Extension, Wrist Roller, Y Raise, External Rotation Cable), core (+6: Spiderman Plank, Jefferson Curl, Reverse Crunch, Oblique Crunch, GHR, Weighted Plank), mobility (+6: Hip Circles, Figure Four, Lat Stretch, Neck Mob, Wrist Ext Stretch, Prone Hip Ext), conditioning (+8: Hill Sprint, Shuttle Run, Altitude Drop, Rowing Intervals, Cycling Intervals, KB Snatch, DB Complex, Rope Climb)
- Tutti i video verificati live via oEmbed — campione 10/10 live ✅
- 0 duplicati, 318/318 IDs allineati tra EXERCISE_LIBRARY e CAT_MAP
- Deploy v6.62 su Vercel — https://coach-os-lime.vercel.app

**Dataset demo realistico — first-login "wow" (2026-09-18)**
- Contesto: analisi prodotto/GTM ha identificato l'account vuoto al primo login come blocker alla vendita. Priorità #1 (self-contained, no dipendenze esterne): popolare l'app con dati demo credibili.
- Riscritta `seed()` in `app.js`: da 1 atleta vuoto a **3 atleti demo con 8 settimane di storico** (104 sessioni totali), generati con PRNG deterministico (mulberry32) → dataset stabile e realistico:
  - **Niccolò Trentin** (tennis, sano): ACWR gym 0.85 / campo 0.95 ottimali, e1RM in salita, rischio 0
  - **Marco Bianchi** (powerlifting, peak): 3 fondamentali che progrediscono (es. Squat 184→199.5), rischio 0
  - **Elena Riva** (calcio, a rischio): ACWR campo **1.62 DANGER**, infortunio ginocchio attivo (VAS 6), readiness 44, LSI deficit 18% → **rischio 160, prima nel triage** + messaggio atleta NON letto (badge)
- Ogni entità marcata `demo:true`. Popolati: sessioni (Palestra+Campo), `wellnessByAthlete`, `injuries`, `messages`, `nutrition`+`nutritionTargets` (7gg), `schedules` (mesociclo corrente con esercizi+progressione), `mesocycles` (1 archiviato/atleta). Accende ogni pannello: ACWR duale, e1RM trend, HRV trend/scatter, LSI, Foster, radar, nutrizione, chat, triage.
- **Banner "Dati demo attivi"** in dashboard (`renderDashboard`, zona `dh-alerts`) con azione **`clearDemoData()`**: rimuove in blocco tutti gli atleti demo + dati collegati, imposta flag `coachOS_noDemo` in localStorage → il seed non riparte. Guard aggiunta in `auth.js` (reseed solo se `!coachOS_noDemo`). Dopo la rimozione con 0 atleti parte il wizard di onboarding "aggiungi il primo atleta".
- `clearDemoData` esposta su window bridge in `main.js` (import + Object.assign).
- Verifica: `node --check` OK sui 3 file; harness sandbox che esegue il **codice reale** (`seed`, `calculateACWR`, `getAthleteRiskScore`) → **13/13 asserzioni verdi**.
- Deploy **v6.63** su Vercel (`vercel --prod`, SW bumpato a v6.63 per invalidare cache PWA) — https://coach-os-lime.vercel.app ✅

**Empty-states + invito WhatsApp (2026-09-18)**
- **Invito atleta via WhatsApp** (canale primario dei coach IT): nel modal codice atleta (`mo-ath-code`) nuovo bottone verde "Invia invito via WhatsApp" → `inviteAthleteWhatsApp()` apre `wa.me/?text=...` (senza numero: il coach sceglie il contatto) con messaggio precompilato = saluto + nome + link app (`window.location.origin`) + codice d'accesso + istruzioni. Helper `buildAthleteInviteText(name, code)` in `app.js`, contesto salvato in `window._athInvite` dentro `addAthlete`, funzione esposta sul window bridge in `main.js`.
- **Empty-state lista atleti** (`renderAthletes`): con 0 atleti il grid mostra card centrata "Ancora nessun atleta" + CTA "+ Aggiungi il primo atleta" (`openNewAthleteModal`), invece di restare vuoto. (Il caso dashboard 0-atleti era già coperto dal wizard di onboarding.)
- Verifica: `node --check` OK; test sandbox del **codice reale** `buildAthleteInviteText` → messaggio valido (nome+codice+link, no undefined, encoding wa.me corretto).
- Deploy **v6.64** su Vercel — verificato live (SW v6.64, bottone WhatsApp + empty-state serviti in prod) ✅

**Smoke test visivo + fix badge (2026-09-18)**
- Smoke test browser reale con Playwright (Chrome installato via `channel:'chrome'`, `--no-save`) su server statico locale (`python3 -m http.server`). Driver `/tmp/smoke.mjs`: carica la pagina reale, forza modalità coach (nasconde `#login-screen` + `#splash-screen`, `window.userRole='COACH'`), guida il flusso completo con 4 screenshot.
- Gotcha risolti: (1) il **service worker** causava reload durante gli evaluate → `serviceWorkers:'block'` nel context; (2) c'era una **splash `#splash-screen`** sopra la dashboard, individuata SOLO guardando lo screenshot (le asserzioni DOM passavano lo stesso); (3) isolato il test da Supabase (`window.mySupabase=null`) per evitare 409 senza sessione auth.
- Verificato visivamente: dashboard piena (KPI, banner demo, triage Elena rischio 160, ACWR, compliance 88/90/94%), lista 3 atleti (Elena bordo rosso ALTO, ordinati per rischio), modal codice con bottone verde WhatsApp + testo invito corretto, empty-state con CTA. **0 errori console.**
- **Bug trovato e corretto** (visibile solo nello screenshot): dopo "Rimuovi dati demo" i badge nav (`nb-ath`, `nb-sto`, msg) e il dropdown atleta restavano stale. Fix: `clearDemoData` ora chiama `populateSelects()`. Ri-verificato → badge azzerati, dropdown vuoto.
- Igiene: aggiunto `node_modules/` al `.gitignore` (era assente; Playwright installato lì).
- Deploy **v6.65** su Vercel — fix badge live e verificato ✅

**Motore di adozione atleta — "chi ha loggato / chi no" (2026-09-18)**
- Nuova card dashboard **"Attività atleti — chi ha loggato"** (rimpiazza/potenzia la vecchia `dh-inattivi`): per ogni atleta ultimo allenamento + stato semaforo a 3 livelli — 🟢 Attivo (≤3g) / 🟡 A rischio (4-7g) / 🔴 Silente (>7g o mai), ordinati per urgenza (silenti in cima), con riepilogo conteggi.
- **Nudge**: bottone "Sollecita" per riga + "Sollecita i N inattivi" in blocco → `nudgeAthlete(athId)` / `nudgeSilent()`. Inseriscono un messaggio coach→atleta (locale in demo + sync Supabase se auth) e inviano push (`_sendPushNotification`, degrada senza Supabase). Testo adattivo ai giorni di silenzio.
- Funzioni in `app.js`: `_athAdoptionStatus`, `_renderAdoptionCard`, `_doNudge`, `nudgeAthlete`, `nudgeSilent`. Bridge in `main.js`.
- Fix colore: il token `--teal` è **arancione** (oklch hue 52); il verde vero è `--green` (hue 175) → tier "Attivo" usa `--green`. Pluralizzazione IT.
- Demo: aggiunto **4° atleta lapsed "Giulia Fontana" (a4)** con `activeWeeks:6` (storico che si ferma ~18gg fa) per popolare il tier "Silente" senza toccare l'analytics di a1/a2/a3. Loop seed ora rispetta `p.activeWeeks || WEEKS`.
- Verifica: `node --check` OK; sandbox codice reale → 4 atleti, **a3 ACWR campo 1.62 / rischio 160 invariati**, Giulia silent (18gg), tiers 6/6; smoke Playwright → semaforo corretto, nudge → toast, **0 errori console** (`05-adoption.png`).
- Deploy **v6.66** su Vercel — verificato live ✅

**AI Insight settimanale — engine locale (2026-09-18)**
- Scelta utente: **engine locale euristico** (no LLM/edge function) → gira subito ovunque, demo-friendly, zero costi, nessun dato lascia il device.
- Nuova card dashboard **"AI Insight — settimana"** (slot `#dh-insight` in cima, dopo i KPI), per l'atleta selezionato: verdetto/tono (POSITIVO/DA MONITORARE/CRITICO) + rilievi prioritizzati con semaforo + una **raccomandazione concreta** per la settimana.
- `generateWeeklyInsight(athId)` in `app.js` ragiona su: aderenza (sedute/target 7gg), ACWR duale, monotonia di Foster (finestra 7gg), trend e1RM (7gg vs 2-3 sett.), HRV (media sett.), readiness/DOMS, LSI, infortuni attivi. `_insightRecommendation()` sceglie l'azione dominante. `_renderInsightCard()` disegna la card. Colori dal semaforo corretto (`--green`/`--amber`/`--coral`).
- Coerenza: per atleta silente (0 sedute/7gg) i rilievi di carico ACWR sono soppressi (stale).
- Verifica: `node --check` OK; sandbox codice reale su 4 atleti → Elena CRITICO (ACWR 1.62 + readiness 44% + asimmetria 20% + infortunio → raccomandazione −20/30% carico), Niccolò/Marco POSITIVO, Giulia "riaggancia" (6/6 asserzioni); smoke Playwright → 2 screenshot (`06-insight-niccolo`, `07-insight-elena`), **0 errori console**.
- Deploy **v6.67** su Vercel — verificato live ✅
- Estensione pronta quando l'utente vorrà: edge function Supabase che chiama la Claude API per riscrivere il narrativo in linguaggio naturale (fallback automatico all'engine locale). Richiede `ANTHROPIC_API_KEY` come secret.

## Prossimo passo

**PDF Report mensile — potenziato come artefatto di vendita (2026-09-18)**
- Base: `exportAthleteReport()` esisteva già (finestra HTML print-styled + `window.print()` → PDF nativo, zero dipendenze, no jsPDF necessario).
- Potenziato in report client-facing:
  - **White-label**: header, accento (border/KPI/note/bottone) e footer usano `appState.brandName` / `brandColor` / `brandLogoUrl` del coach (default CoachOS/arancio). L'hook dell'ego — il coach manda al cliente un report col PROPRIO brand.
  - **Sezione "Analisi del coach" (AI Insight)**: riusa `generateWeeklyInsight` → headline + rilievi + raccomandazione dentro il PDF.
  - **Personal Records del mese** (miglior e1RM per esercizio, top 6) e **Composizione corporea** (peso/BF start→now da `anthropoHistory`).
- Verifica: `node --check` OK; smoke Playwright cattura il popup del report per Elena con brand custom ("Rossi Strength Lab", accento blu #2563eb) → titolo/brand/accento/insight/PR/composizione tutti presenti, **0 errori console** (`08-pdf-report.png`).
- Deploy **v6.68** su Vercel — verificato live ✅

## Prossimo passo

**Qualità percepita — empty states pannelli coach (2026-09-18)**
- Contesto: utente è studente, senza partita IVA e senza clienti → billing rimandato (giusto: la P.IVA serve solo per fatturare paganti; ora priorità = prodotto solido + primi beta gratuiti). Scelto di lavorare sulla qualità percepita.
- Audit visivo Playwright (account coach vuoto, screenshot di ogni pannello) → individuati pannelli che sembravano rotti/fuorvianti con account fresco.
- Fix empty states coerenti (icona + titolo + messaggio, testo adattivo se ci sono/non ci sono atleti):
  - **Storico** (`renderStorico`): riga empty nel `sto-body` invece di header+corpo vuoto.
  - **Calendario** (`renderCalendario`): riga empty nel tbody invece di sola intestazione.
  - **Messaggi** (`renderMessaggi`): distingue "nessun atleta" da "nessun messaggio" (prima diceva sempre "Nessun messaggio con questo atleta").
  - **Macro** (`renderMacro`): prompt "nessun atleta selezionato" nella griglia.
  - (Editor, Analytics, Atleti, Dashboard avevano già empty state adeguati.)
- Verifica: `node --check` OK; re-audit Playwright → 4/4 empty state presenti, **0 errori console**.
- Deploy **v6.69** su Vercel — verificato live ✅

**Qualità percepita — mobile pass Coach Console + valutazione skeleton (2026-09-18)**
- Audit mobile Playwright (390px, isMobile) su dashboard/atleti/storico/editor/analytics → nessun overflow orizzontale, ma la **topbar era rotta**: il wordmark `.logo` era forzato a 15px+letter-spacing (`styles.css:923`) e testo salvataggio/cloud forzato visibile (`styles.css:902`) → collisione "ELITE SPORTS SCIENCE" ↔ "Salvato in Locale…" ↔ "Salvato ✓".
- Fix (solo `@media max-width:768px`, desktop intatto — verificato): nascosto il wordmark su mobile (il box "ES" fa da logo), nascosto testo save/cloud status + il `::after` "Salvato ✓" (resta solo il pallino). Topbar ora pulita: MENU + ES + COACH · Atleta + selettore + dot.
- Resto della Coach Console mobile risultato già buono: KPI a 2 colonne, card AI insight perfetta, editor a 2 colonne usabile, storico con scroll orizzontale (accettabile per tabella densa).
- **Skeleton: decisione di NON farli.** Verificato il boot: lo splash resta finché tutti i dati sono renderizzati (cache IndexedDB prima, poi cloud) → non esiste la finestra "pannelli vuoti in caricamento" che gli skeleton risolverebbero. Sarebbe codice inutile. L'unica versione utile (dismettere splash coi dati cache + refresh cloud in background) è un refactor del boot con rischio flicker — rimandato a quando ci saranno utenti su connessioni lente reali.
- Deploy **v6.70** su Vercel — verificato live ✅

**Qualità percepita — empty states lato atleta (2026-09-18)**
- Audit visivo Playwright (viewport mobile 390px) con atleta appena creato SENZA dati (via `replaceDB`), navigando i 6 tab della bottom bar.
- Risultato: **il lato atleta era già curato molto bene** — ath-home (benvenuto + guida ai tab + "Il coach sta preparando la tua scheda"), sessione ("Nessuna scheda assegnata"), progressi ("Nessuna sessione ancora" nei grafici), coach-reply ("Nessun messaggio/feedback"), wellness (form sempre usabile). Nessun errore console.
- **Unico gap corretto — `renderAthWeek`**: senza programma mostrava "— Riposo" su ogni giorno (fuorviante, sembrava riposo prescritto). Fix: banner "Scheda non ancora assegnata" (con link al check-in Wellness) + giorni con "—" neutro invece di "Riposo". Ora coerente con ath-home/sessione.
- Verifica: `node --check` OK; re-audit → banner presente, "Riposo" solo nella legenda, 0 errori console.
- Deploy **v6.71** su Vercel — verificato live ✅

**Gamification riattivata — engagement atleta (2026-09-19)**
- Contesto: review prodotto/UX ha classificato la gamification già-costruita-ma-nascosta come autogol (codice completo in `badges.js`, `checkAndAwardBadges` già chiamato al salvataggio sessione in `app.js:4215`, ma rendering spento). Riattivarla = miglior rapporto impatto/costo sull'adozione atleta.
- **Bacheca trofei riattivata**: decommentato `renderBadgesSection('ap-badges', athId)` in `analytics.js` (~1498) → la trophy shelf 17 badge (comuni/rari/epici) torna visibile nel tab atleta "I miei progressi".
- **Striscia trofei nella home atleta** (nuova, il vero lever di daily-open): `badgeStripHtml(athId, streak)` in `badges.js` costruisce una card compatta cliccabile (🏆 X/17 trofei + 🔥 streak se ≥2 + ultimo badge sbloccato) → tap porta al tab Progressi. Inserita in `renderAthHome` (`app.js`) subito dopo il banner motivazionale, riusando lo `streak` già calcolato. Import aggiunto in `app.js`.
- Coerenza id verificata: award usa `appState.selAthId`, lettura usa `mioIdLoggato || selAthId` (stessa risoluzione di tutte le render atleta) → sul lato atleta coincidono, quindi i badge sbloccati si vedono davvero.
- Verifica: `node --check` OK su app/badges/analytics; test **codice reale** di `badgeStripHtml` (moduli copiati in dir temp `type:module`, `loadBadges` reale su localStorage shimmato) → **8/8 asserzioni verdi** (count 0/N e 3/N, nudge primo trofeo, streak mostrata solo se ≥2, "ultimo" = badge con data ISO più recente, click → `ath-progressi`).
- Smoke Playwright (Chrome reale, mobile 390px, modalità ATLETA su Marco `a2`, badge assegnati dallo storico via `checkAndAwardBadges`): striscia in home (`13/17 trofei` + streak + ultimo + cliccabile → progressi), bacheca in progressi (header "13/17 sbloccati", 17 tile, 13 sbloccati + 4 correttamente sfumati), toast di award visibile, **0 errori console** (`09-ath-home-badges.png`, `10-ath-progressi-shelf.png`). Nota: streak/totali gonfiati nello shot = artefatto del seed coach (DB con tutti gli atleti); in prod l'atleta ha solo le sue sessioni.
- Edge minore noto: se più badge si sbloccano lo stesso giorno, "ultimo" mostra il primo per ordine di definizione (nell'uso reale gli sblocchi hanno date distinte).
- Deploy **v6.72** su Vercel (SW bumpato, `vercel --prod`) — verificato live su https://coach-os-lime.vercel.app (SW v6.72 + codice gamification servito) ✅

**Time-to-value coach — template programmi + duplica scheda (2026-09-19)**
- Blocker #2 della review (da atleta vuoto a scheda assegnata in pochi click). Prima non esisteva alcun template di *contenuto*: `applyMacroTemplate` riguarda solo le fasi di periodizzazione, non sedute/esercizi.
- **6 template programmi** in `PROGRAM_TEMPLATES` (state.js, in coda): Full Body 3× Principiante, Upper/Lower 4×, Push/Pull/Legs Ipertrofia, Forza 5×5, Preparazione Atletica (con seduta Campo), Ricomposizione + Condizionamento. 88 esercizi totali, ognuno referenzia un `id` di EXERCISE_LIBRARY.
- **Applica template** (`applyProgramTemplate` in app.js): `_expandTemplateEx` espande ogni `{id,set,rep,rir,rest}` nel formato editor completo risolvendo name/ytUrl/trackE1rm/zona dalla libreria (stesso shape di `_libAddEx`). Sostituisce la scheda (con `showConfirm` "Sostituisci" se già piena), setta meso/fase/durata/note/obiettivo/scheduledDays, poi `renderEditor` + `saveSchedule` (sync Supabase). Vincoli rispettati: rep/kg testo, rir ∈ {0,1,2,3,—}.
- **Duplica da un altro atleta** (`duplicateScheduleFrom`): deep-clone (JSON) della scheda sorgente con id sessione freschi e `progression` azzerata (è dato live dell'origine). Modal `mo-dup` elenca solo atleti con scheda non vuota.
- **Duplica sessione** (`duplicateCurrentSession`): clona la seduta aperta nell'editor ("(copia)", id fresco, progression azzerata).
- UI: riga bottoni "Parti da un template" / "Duplica da un altro atleta" in cima all'editor (max visibilità con atleta vuoto) + "Duplica sessione" vicino a "+ Nuova Sessione"; 2 modali `mo-templates`/`mo-dup` con lista+preview (livello·obiettivo·sedute·esercizi·settimane). Funzioni sul window bridge (main.js).
- Verifica: `node --check` OK (state/app/main); test dati reali → **41/41** (6 template, 88 esercizi, tutti gli id risolti a nome+video, tutti i rir validi); smoke Playwright (coach desktop) → applica PPL su atleta vuoto = 3 tab + meso corretto + 6 esercizi con video risolti, modal template 6 card, modal duplica 5 sorgenti, duplica da Marco riempie l'editor, **0 errori console** (`11-templates-modal.png`, `12-editor-template-applied.png`, `13-editor-duplicated.png`).
- Deploy **v6.73** su Vercel + commit `8e789e1` su `main` (insieme alla gamification) — verificato live.

**Verifica + fix realtime coach: sessione atleta → Storico/Attività/Calendario (2026-09-19)**
- Segnalazione: dopo l'allenamento dell'atleta, i pannelli coach (Storico, "Attività atleti", Calendario) sembravano non aggiornarsi in automatico.
- **Verifica end-to-end sul progetto live** (`ncvmnoaelzdmuiqrvcjl`, via Supabase MCP): (1) `sessions/messages/atleti/schedules` sono nella publication `supabase_realtime`; (2) RLS su `sessions` consente al coach la lettura (`coach_full_sessions` + policy permissiva `USING(true)` per `public`); (3) **test di consegna reale**: client anon sottoscritto a `postgres_changes` su `sessions` → INSERT di prova → evento **ricevuto**; riga di test cancellata (0 residui). Client: coach = ruolo `ADMIN` (tutti i branch attivi), `_onSessionChange` aggiorna `DB.sessions` + ri-renderizza il pannello visibile; `_athAdoptionStatus` legge `DB.sessions` live. **Conclusione: il meccanismo funziona.**
- **Gap reale individuato**: il realtime NON ri-consegna gli eventi persi mentre la tab del coach è in background/telefono bloccato → una sessione conclusa in quel momento non compariva finché il coach non navigava/ricaricava. Nessun re-sync al ritorno.
- **Fix** (`auth.js`): estratti `_mapSessionRow` + `_renderSessionPanels` da `_onSessionChange` (refactor senza cambi di comportamento); nuovo `_reloadSessions(role, reason)` che rilegge le sessioni da Supabase (coach: tutte; atleta: filtrate) → rimpiazza `DB.sessions` → ri-renderizza il pannello corrente (debounce 3s). Agganciato a `visibilitychange` (ritorno visibile), `online`, e alla **riconnessione** del canale realtime (`_sub` ora accetta un callback `onReconnect`, chiamato al re-SUBSCRIBED dopo un drop).
- Verifica: `node --check` OK; query di re-sync provata su prod via anon → 46 sessioni lette; smoke Playwright **no-regression** (refactor di `_onSessionChange`) → dashboard/"Attività atleti"/storico(122 righe)/calendario renderizzano, **0 errori console**.
- Deploy **v6.74** su Vercel + commit `83abbc9` su `main`, poi `git push origin main` (allineato a origin) — verificato live.

**Fiducia minima — privacy + export dati + rinomina "AI" (2026-09-19)**
- Blocker #4 della review (dato sanitario = categoria speciale GDPR; i coach seri chiedono policy/export/onestà prima di mettere clienti veri).
- **Privacy policy**: `privacy.html` esisteva già ed è completa e GDPR-corretta (titolare, categorie dati inclusi wellness/salute, basi giuridiche, SCC Supabase/Vercel, conservazione, diritti, sicurezza, minori, cookie). Corretta l'unica imprecisione: "cifratura end-to-end" → "in transito (HTTPS/TLS) e a riposo" (onesto). Ora **linkata dentro l'app**: login screen, foot sidebar coach, footer home atleta (prima era solo nella landing).
- **Export dati**: `exportJSON` (backup DB completo) rietichettato "Esporta i miei dati" nel foot coach. Nuovo `exportMyData()` lato atleta (portabilità GDPR): esporta SOLO i dati dell'atleta loggato (profilo, scheda, sessioni, wellness, nutrizione, messaggi, infortuni) in un JSON strutturato, dal footer della home. Bridge in main.js.
- **Rinomina "AI"**: l'engine è euristico locale, non LLM. Card dashboard "AI Insight — settimana" → **"Analisi automatica — settimana"** + sottotitolo di trasparenza "Regole di sports science · aderenza · ACWR · HRV · monotonia · infortuni". (Il pannello Analytics diceva già "Insight automatici"; il PDF "Analisi del coach" — nessun altro "AI" user-facing.)
- Verifica: `node --check` OK; nessuna stringa user-facing "AI Insight" residua; smoke Playwright → link privacy nel login, card rinominata+trasparenza (no "AI Insight"), foot coach + footer atleta con export/privacy, **`exportMyData` scaricato realmente** = JSON con solo i dati di a2 (32 sessioni, 0 leak), privacy.html HTTP 200, **0 errori console**.
- **Non ancora deployato/committato** — SW bump + `vercel --prod` + commit quando confermi.

**Copia scheda su più atleti — intera scheda o singola split (2026-09-24)**
- Richiesta: copiare la scheda di un atleta e incollarla in uno o più atleti, potendo scegliere se copiare **l'intera scheda** o **solo una/alcune sedute (split, es. la sola giornata Push)**. Esisteva solo il flusso "pull" (`duplicateScheduleFrom`). Aggiunto il flusso "push" granulare in blocco.
- **Editor** (`index.html`): nuovo bottone "Copia scheda su altri atleti" nella toolbar (accanto a "Duplica da un altro atleta").
- **Modal `mo-copyto`** a 3 step: (1) **Cosa copiare** = checkbox per ogni seduta della sorgente (tutte spuntate = intera scheda; deseleziona per copiare solo la/le split; le sedute vuote sono disabilitate); (2) **Come incollarla** = radio "Sostituisci la scheda" / "Aggiungi le sedute" (accoda alla scheda esistente); (3) **Su chi** = lista checkbox atleti con stato scheda ("ha già una scheda (N sedute)" / "nessuna scheda") + link "Tutti"/"Nessuno". CTA dinamica ("Incolla N sedute su M atleti", disabilitata se manca una selezione).
- **`app.js`**: refactor helper — `_scheduleMeta(src)` (meta), `_cloneSessions(sessions)` (deep clone sedute con id freschi + progressioni azzerate), `_cloneSchedule(src)` (meta+tutte le sedute, riusato da `duplicateScheduleFrom`). Nuovo `_pushScheduleToCloud(athId)` che sincronizza su Supabase la scheda di un atleta arbitrario leggendo da `DB.schedules[athId]` (non dal DOM) — rispecchia l'upsert di `saveSchedule`: preserva progressioni remote, rimuove sessioni obsolete, broadcast realtime + push; degrada senza Supabase. `openCopyToModal` / `toggleAllCopyTargets` / `refreshCopyToBtn` / `copyScheduleToTargets`: in "replace" sostituisce (meta sorgente + sedute scelte, `showConfirm` se il destinatario ha già una scheda); in "append" accoda le sedute scelte a quella esistente (o la crea se assente), preservando meta e progressioni delle sedute già presenti. Re-render editor se copio sull'atleta aperto. Bridge in `main.js`.
- Verifica: `node --check` OK (app/main); sandbox del **codice reale** → `_cloneSchedule` 11/11 + split/replace/append 12/12 (replace = solo seduta scelta con meta sorgente + id fresco + progressione azzerata; append = accoda preservando id/progressioni esistenti e meta del destinatario; append senza scheda = crea dalla sorgente; sorgente sempre intatta). `showConfirm` usa `textContent` → nomi safe.
- **Non ancora deployato/committato** — SW bump + `vercel --prod` + commit quando confermi.

**Qualità percepita — icone sidebar coach + install PWA (2026-09-24)**
- Consiglio #1 dalla review su richiesta utente. Due interventi piccoli e a rischio basso sulla percezione di qualità e l'adozione.
- **Icone sidebar** (`index.html` + `styles.css`): le 13 voci nav avevano `<span class="ico"></span>` **vuoti** ma larghi 16px (gutter vuoto = aspetto non finito). Aggiunto uno **sprite SVG** (`<symbol>` monoline, viewBox 24) referenziato via `<use href="#ic-…">` in ogni voce (dash/grid, user, clock, message, calendar, edit, layers, book-open, bar-chart, trending-up, calculator, users, droplet). CSS `.nav-btn .ico svg`: stroke `currentColor` (eredita il colore della voce, 1.7px, round) → default `--dim`, hover/active `--text`; `.nav-btn.on .ico` in `--teal` (icona attiva coordinata col bordo sinistro teal). Zero dipendenze, ~15 righe di sprite.
- **Install PWA** (`index.html`): prima non c'era alcun install prompt per Android/desktop (solo guida iOS per le notifiche). Aggiunto capture di `beforeinstallprompt` in `<head>` (registrato prestissimo, salva `window._deferredInstallPrompt` + emette `pwa-installable`) e un **banner** in-app (pill fissa sopra la bottom bar atleta): "Installa l'app" + bottone che chiama `prompt()` e `✕` che silenzia per la sessione (`sessionStorage`). Nascosto se già in standalone o su `appinstalled`.
- Verifica: smoke Playwright (Chrome reale, coach console): **13/13 icone** rese a 15×15 con stroke corretto (Team/Branding a 15×15 quando il gruppo `#nav-team-group` è visibile), **icona attiva teal** confermata, **banner install** simulato (`beforeinstallprompt` → compare → "Installa" chiama `prompt()` → si nasconde), **0 errori console**. Screenshot sidebar rivisto a occhio = pulito e coerente. SW bump v6.77.
- **Deployato** — vedi sotto.

**Cruscotto settimanale coach — tutti gli atleti in un colpo d'occhio (2026-09-24)**
- Consiglio #2 dalla review (il "wow" in demo per chi ha più atleti). Prima l'analisi settimanale era per singolo atleta selezionato; ora c'è la panoramica dell'intero roster.
- **Nuova card `dh-cockpit`** in cima alla dashboard (dopo il sottotitolo, prima dei KPI): una riga per atleta con verdetto (dall'engine `generateWeeklyInsight`: OK / MONITORA / CRITICO), aderenza (n/target), ACWR peggiore (colore semantico), ultimo log (tier adozione), rischio (se >0), infortunio attivo + il **rilievo prioritario** (primo finding bad→warn). Righe ordinate per gravità (bad→warn→good, poi rischio desc). Header con summary "X critici · Y da monitorare · Z ok". Clic su una riga → `cockpitSelectAthlete` (setta `appState.selAthId` direttamente, sincronizza dropdown/editor, ri-renderizza la dashboard e scrolla in alto) così KPI/insight/grafici sottostanti riflettono l'atleta.
- `_renderWeeklyCockpit` + `_acwrColor` + `cockpitSelectAthlete` in `app.js`; chiamata in `renderDashboard` prima del return anticipato (si vede anche senza atleta selezionato); riusa gli engine esistenti (`generateWeeklyInsight`, `_athAdoptionStatus`, `getAthleteRiskScore`, `calculateACWR`) → nessuna logica sports-science duplicata. Hover row + `:last-child` no-border in `styles.css`. Bridge in `main.js`.
- Verifica: `node --check` OK; smoke Playwright sul **seed demo reale** → card visibile, **4 righe** ordinate (Elena Riva CRITICO in cima con ACWR 1.62/Rischio 160/◆Infortunio + rilievo DANGER; Giulia Fontana CRITICO con aderenza 0/3 e "18 giorni fa"; Niccolò e Marco OK in verde), summary "2 critici · 0 da monitorare · 2 ok", clic riga → title dashboard = "Elena Riva" + insight card aperta, **0 errori console**, screenshot rivisto = pulito. SW bump v6.78.
- **Deployato** — vedi sotto.

**Igiene per i primi utenti reali — login toast + console + error handler (2026-09-24)**
- Pacchetto di 3 interventi (consigli extra oltre la roadmap) trovati ispezionando il codice.
- **#1 Login: `alert()` nativi → toast.** La schermata di login (prima impressione) gestiva 19 errori con `alert()` del browser, incoerente col resto dell'app. Potenziato `toast` in `utils.js` (retrocompatibile: `toast(msg, {type,duration})`; `type:'error'` coral / `'success'` verde; **fix bug reale**: `clearTimeout` del timer precedente così un toast nuovo non viene nascosto da uno vecchio). CSS `.toast-error`/`.toast-success` + wrapping per messaggi lunghi. Sostituiti tutti i 19 `alert()` in `auth.js` con toast tipizzati (durate più lunghe per i messaggi importanti tipo conferma email). **Bug scoperto e corretto**: il toast aveva `z-index:30000` ma il login-screen è `99999` → i toast di errore login finivano *dietro* l'overlay (invisibili). Alzato a `100002` (sopra login/splash).
- **#2 Console pulita in produzione.** 82 `console.*` (41 in auth.js), alcuni dumpavano payload realtime con dati sessioni/schede degli atleti (semi-sanitari) in console. Script inline in `<head>`: in produzione `console.log`/`console.debug` diventano no-op (riattivabili con `localStorage.ess_debug='1'`); su localhost/IP locali restano attivi. `warn`/`error` restano sempre.
- **#3 Rete di sicurezza globale.** Nessun handler globale prima → rischio schermata bianca muta. Aggiunti `window.onerror` + `unhandledrejection` (inline, catturano anche gli errori di boot): toast gentile "ricarica la pagina" (throttled 15s, ignora gli errori di caricamento risorse) + `console.error` sempre attivo per telemetria.
- Verifica: `node --check` OK (utils/auth/app/main); 0 `alert()` residui in tutti i .js; smoke Playwright → toast-error=coral / toast-success=verde (distinti dal base teal), errore JS non gestito → toast di sicurezza mostrato, unhandledrejection loggata, regex console-gating corretta (localhost locale, dominio prod gated), **screenshot login con toast coral "Password errata" visibile sopra l'overlay**. SW bump v6.79.
- **Deployato** — vedi sotto.

## Prossimo passo — roadmap dalla review prodotto (2026-09-19)

Priorità per arrivare ai primi 10 coach beta (billing escluso, no P.IVA). Diagnosi chiave: prodotto forte ma **disallineato** — analytics elite-S&C per un mercato raggiungibile (PT generalisti) che non li capisce; il collo di bottiglia è *fiducia + primo utente reale + time-to-value*, non le feature.

**Blocker (impediscono uso/vendita):**
1. **Distribuzione + prova sociale** (non-codice): reclutare 1 coach reale come caso zero + girare un video demo 60–90s del flusso coach→atleta. Senza, i 10 beta non arrivano.
2. **Time-to-value coach**: da zero a "atleta con scheda assegnata" in 5 min → ✅ 6 template programmi + duplica scheda da atleta + duplica sessione (fatto 2026-09-19). Resta: assegna a più atleti in blocco + import grezzo da Excel/Sheets per la migrazione.
3. **Adozione atleta**: sessione persistente + PWA install pulita + push reminder di default + ✅ gamification accesa (fatto oggi). È il punto di rottura del modello (senza log, analytics vuote).
4. ~~**Fiducia minima (dato sanitario, GDPR)**: privacy policy + export dati + rinominare "AI Insight"~~ → ✅ fatto 2026-09-19 (privacy in-app + fix wording, export coach + `exportMyData` atleta, card "Analisi automatica" + trasparenza). Resta eventuale: cancella-account che cascata su Supabase (ora l'erasure è su richiesta via email, documentata in policy).

**Nice-to-have (retention/percezione):**
- Decidere posizionamento e **semplificare il default** (modalità base PT vs toggle "Performance/Avanzato" per gli analytics S&C).
- Nascondere i tile wearable "Coming Soon" (sanno di vaporware) + de-enfatizzare la nutrizione senza database alimenti.
- ACWR presentato come *supporto alla decisione* con metodologia visibile e disattivabile (è scientificamente contestato — credibilità coi coach esperti).
- **Cruscotto settimanale coach** (AI insight su tutti gli atleti in un colpo d'occhio).
- Card-ificazione tabella Storico su mobile; refactor boot con skeleton (solo se utenti su connessioni lente reali).

**Rimandati (dipendono da P.IVA / costi):**
- **Billing reale** (quando avrai P.IVA + primi paganti) — codice + checklist Stripe pronti da preparare.
- Upgrade **AI insight via Claude API** (edge function + `ANTHROPIC_API_KEY`) sopra l'engine locale.
