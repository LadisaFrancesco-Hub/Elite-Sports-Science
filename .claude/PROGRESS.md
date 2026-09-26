# PROGRESS

> Storia completa fino a v6.74 → `.claude/PROGRESS_ARCHIVE.md`

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
- Dashboard coach con lista atleti, cruscotto settimanale, analisi automatica
- Creazione/modifica/eliminazione atleti; invito via WhatsApp
- Editor schede: esercizi normali, Circuit/EMOM/AMRAP/Tabata, blocchi isometrici
- 6 template programmi (Full Body, Upper/Lower, PPL, Forza 5×5, Atletica, Ricomposizione)
- Duplica scheda da atleta / duplica sessione / copia su più atleti (replace o append)
- Progressione settimanale (serie/carichi) con serie_type
- Storico sessioni atleta con reply del coach
- Messaggistica coach ↔ atleta con badge non letti
- Calendario atleta (visualizzazione scheda per giorno)
- Macro/periodizzazione (mesociclo, fase, settimane)
- Branding personalizzabile (nome app, logo, colore primario)
- Gestione team (inviti via email, revoca)
- PDF report mensile white-label (brand coach, insight, PR, composizione)

**Allenamento live (atleta)**
- Schermata live allenamento con pallini set completati (tap + swipe)
- Focus Mode: overlay full-screen un esercizio alla volta con analisi e1RM
- Timer recupero automatico per esercizio; timer isometrico con suono
- Log reale set (kg, reps, note); RPE adattativo set-by-set
- Video modal per esercizi; PR badge in tempo reale (e1RM)
- "Fine Allenamento" → bottom sheet con RPE sessione, stelle e nota al coach

**Analytics (atleta)**
- Progressi adattivi per obiettivo (5 KPI: ipertrofia, forza, potenza, resistenza, generico)
- Volume settimanale, sRPE, e1RM trend con selector esercizi
- ACWR, Monotonia/Strain di Foster, LSI, Scatter HRV vs Performance
- Radar chart profilo biologico, Peaking/Tapering chart, HRV trend + 7gg MA
- Body composition, Note coach, Best month, Personal Records

**Wellness**
- Quick wellness (sonno, stress, HRV, dolori, energia, umore)
- Injuries tracker; Badge non-letto per wellness

**Nutrizione**
- Log pasti giornaliero; Target macro (kcal, proteine, carboidrati, grassi)

**Badges & gamification**
- Sistema trofei 17 badge (comuni/rari/epici) — bacheca + striscia home atleta attive
- Streak giornaliero; toast award in tempo reale

**Wearable**
- Struttura pronta per Garmin/Polar/WHOOP (Coming Soon); edge function `wearable-proxy`

**Billing**
- Integrazione Stripe (checkout, webhook); edge functions `create-checkout-session` + `stripe-webhook`

**Push notifications**
- Edge function `send-push`; migrations: `push_migration.sql`

**Infrastruttura Supabase**
- RLS policies (v1, v2, v3 patch); Realtime migration
- Migrations: billing, messages, nutrition, team, wearable
- Progetto: `ncvmnoaelzdmuiqrvcjl`

**Design System**
- Coach Console: Archivo + IBM Plex Mono, palette oklch, card scure, topbar/sidebar scuri, icone SVG sidebar
- App Atleta v4: `body.is-athlete` scoped, un solo accento arancione, semantica verde/ambra/corallo per stati, micro-interazioni (count-up, ring sweep, sheen CTA)
- `theme-color` PWA = `#14181E` (blend seamless con topbar)

---

## Changelog recente

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
- **Client**: SW bumpato a **v6.83**. Deploy Vercel + commit (vedi sotto).

---

## Prossimo passo — roadmap

Priorità per arrivare ai primi 10 coach beta (billing escluso, no P.IVA).

**Blocker (impediscono uso/vendita):**
1. **Distribuzione + prova sociale** (non-codice): reclutare 1 coach reale come caso zero + video demo 60–90s.
2. **Time-to-value coach** → ✅ template + duplica + copia su più atleti + ✅ import da Excel/Sheets (2026-09-26).
3. **Adozione atleta** → ✅ gamification + PWA install + ✅ push reminder allenamento (2026-09-26, da deployare). Resta: sessione persistente.
4. ~~**Fiducia minima (GDPR)**~~ → ✅ privacy in-app, export dati, wording onesto.

**Nice-to-have (retention/percezione):**
- Semplificare il default (modalità base PT vs toggle "Performance/Avanzato" per analytics S&C).
- Nascondere tile wearable "Coming Soon" + de-enfatizzare nutrizione senza DB alimenti.
- ACWR come supporto alla decisione con metodologia visibile e disattivabile.
- Card-ificazione tabella Storico su mobile.

**Rimandati (P.IVA / costi):**
- Billing reale (codice + checklist Stripe pronti).
- Upgrade analisi automatica via Claude API (edge function + `ANTHROPIC_API_KEY`, fallback engine locale).
