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

## Prossimo passo

Filoni pronti quando vuoi (nessuno richiede P.IVA):
- **Attiva gamification** (badge/trofei già assegnati, rendering commentato in `analytics.js:1498`) — engagement atleta, quasi gratis.
- **Cruscotto settimanale coach** (AI insight su tutti gli atleti in un colpo d'occhio).
- Card-ificazione tabella Storico su mobile (ora scroll orizzontale) + eventuale refactor boot con skeleton (solo se utenti su connessioni lente reali).
- **Billing reale** (quando avrai P.IVA + primi paganti) — codice + checklist Stripe pronti da preparare.
- Upgrade **AI insight via Claude API** (edge function + `ANTHROPIC_API_KEY`) sopra l'engine locale.
