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

**Aggiornamenti atomici: import map versionato per i moduli JS (2026-09-29)**
- **Sintomo (segnalato dall'utente sul telefono)**: dopo il deploy v6.98, premere "Annota" non faceva nulla + toast globale "Qualcosa non ha risposto". Diagnosi: il codice era **corretto** (verificato su caricamento pulito del live via Playwright headless: `window.openAnnotator` = function, 0 errori), ma il telefono eseguiva un **`main.js` vecchio dalla cache** (senza il bridge) mentre l'`app.js` nuovo disegnava già il bottone → `openAnnotator is not defined` → error handler globale (`index.html` `window.addEventListener('error')`).
- **Causa-radice**: i moduli JS erano caricati **senza cache-busting** (`<script type="module" src="main.js">` + `import './app.js'` a catena). Il SW usa `networkFirst` ma su rete mobile ballerina può servire un file fresco (`app.js`) e uno dalla cache (`main.js`) → **mix vecchio/nuovo** tra deploy.
- **Fix (`index.html`)**: sostituito il tag modulo statico con un **loader inline** che genera un **import map** da un'unica costante `APP_ASSET_VERSION` (`V='6.99'`): ogni import a catena viene versionato (`./app.js` → `./app.js?v=6.99`), entry `main.js` versionato nel `src`. Il browser tratta i file di ogni deploy come URL nuovi → **impossibile mischiare versioni**. Import map iniettato **prima** del modulo entry. Fallback sicuro sui browser senza import map (caricano non versionato, funziona lo stesso). `library.js` escluso (codice morto, non importato).
- Verifica: test locale (python http.server + Playwright headless) → **14/14 moduli caricati con `?v=6.99`**, `window.openAnnotator`/`renderMessaggi`/`go` = function, **0 errori console**. Live: SW v6.99 + loader `importmap`/`APP_ASSET_VERSION` serviti, `app.js?v=6.99` → 200. **L'utente ha confermato: dopo reload "Annota" funziona.**
- **MANUTENZIONE**: ad ogni deploy futuro bump **due numeri in sync** → `sw.js` `APP_VERSION` **e** `index.html` `APP_ASSET_VERSION` (costante `V` nel loader). Entrambi commentati con l'avviso.
- **DEPLOYATO**: SW **v6.99**, commit `330847f` + push su `main` + `vercel --prod` (dpl_… coach-9249vrq60), aliasato su `coach-os-lime.vercel.app`.

**Video form-check con annotazioni — v2 (2026-09-29)**
- Contesto/strategia: dal confronto competitivo, il gap #1 vs mercato NON era analytics (lì vinciamo) ma le *table-stake del coaching a distanza*. La v1 dava l'upload atleta→coach; la killer feature di TrueCoach/CoachRx è che il coach **disegni sopra il video** per correggere la tecnica. Questa v2 la aggiunge.
- **Scope deciso con l'utente**: strumenti = **penna libera + testo** (niente linea/freccia/angolo per ora); **solo coach** annota; **voice-over rimandato** a v2.1.
- **Architettura (scelta chiave)**: annotazioni come **overlay vettoriale sincronizzato ai timestamp**, NON video ri-codificato. Niente `ffmpeg.wasm` (pesante/lento su mobile), file invariati, editabile, riusa la playback con URL firmato della v1. **Zero costo Storage aggiuntivo.**
- **Modello di consegna**: l'annotazione è un **nuovo messaggio del coach che riusa lo stesso `media_url` (path)** del video dell'atleta (nessun secondo upload) + nuova colonna `annotations` (JSONB). Verificato che passa dal realtime esistente (`_onMessageChange`, `auth.js`, `event:'*'`, upsert by id + re-render → arriva live all'atleta con badge non-letto + push) e che la retention (`cleanup-form-checks`, `.in('media_url', chunk)`) pulisce coerentemente entrambi i messaggi che condividono il path.
- **Struttura JSON**: `{ v:1, shapes:[ {id,t,type:'pen',color,w,pts:[[x,y]…]} | {id,t,type:'text',color,x,y,text} ] }`. Coord **normalizzate 0..1 sul content-rect** del frame (letterbox `contain`) → allineamento regge su schermi/aspetti diversi. "Momento" = timestamp distinto; vive dal suo `t` al `t` successivo.
- **Backend (via Supabase MCP, migration `form_check_annotations`)**: `ALTER TABLE messages ADD COLUMN annotations jsonb` (nullable, retro-compatibile). RLS invariata (`USING(true)`). `success:true`.
- **Client (v6.98)**:
  - `utils.js` — helper puri condivisi: `hasAnnotations`, `videoContentRect` (letterbox), `activeMomentShapes`, `annotationMoments`, `drawAnnotationShapes` (penna→polilinea/dot, testo→label con sfondo).
  - `app.js` — motore annotator: `openAnnotator(path)` (coach authoring), `openAnnotationReview(id)` (sola lettura, atleta+coach), `saveAnnotations` (insert nuovo msg, push, re-render), transport (`annotPlayPause/annotFrame` ±1/30s/`annotSeek`/`annotRate` 1×·0.5×·0.25×/`annotResume`), strumenti (`annotTool/annotColor/annotUndo/annotClearMoment`), pointer events → penna/testo, redraw su `timeupdate/seeked/resize`, auto-pausa ai momenti in review + "▶ Continua", markers sullo scrubber. Bolle chat: bottone **"✏️ Annota"** sui video (chat coach) + card **"📝 Correzione video"** per i messaggi con annotazioni (entrambe le chat). Canvas separato dal video → **nessun taint CORS** (non si legge il pixel del video).
  - `index.html` — modal unico **`mo-annot`** (authoring + review via toggle `an-tools`/`an-save`): stage video+canvas sovrapposti, transport, velocità, toolbar, momenti, Salva/Annulla.
  - `main.js` — bridge (13 funzioni su window). `sw.js` — bump **v6.98**.
- Verifica: `node --check` OK (utils/app/main/sw); **test logica 15/15** (hasAnnotations, videoContentRect landscape/portrait/no-meta, activeMomentShapes confini+carry-over, annotationMoments, drawAnnotationShapes mappatura coord + no-throw su testo con `<b>`); cross-check handler↔export↔bridge (13/13, 0 typo).
- **DEPLOYATO + VERIFICATO LIVE (2026-09-29)**: commit `3965d45` + push su `main` + `vercel --prod` (dpl_6CfvRhVJE43kVkbK3L5A8yUA2Dyw). SW v6.98 servito, `openAnnotator`/`openAnnotationReview` bridgeati, modal `mo-annot` presente. **L'utente ha confermato dal telefono che "Annota" apre l'editor** (dopo il fix cache sotto). Feature v2 LIVE.
- **Follow-up esclusi da v2**: voice-over (v2.1), linea/freccia/angolo, editing di un'annotazione esistente (ora ogni annotazione = nuovo messaggio), side-by-side di due video. **Da validare sul campo**: allineamento disegni tra schermo coach/atleta (video verticali) + auto-pausa ai momenti nel replay.

**Video form-check coach↔atleta — v1 (2026-09-29)**
- Contesto/strategia: analisi competitiva (TrueCoach, Everfit, TrainHeroic, CoachRx, Trainerize) → la lacuna vera vs mercato non era analytics ma una *table-stake del coaching a distanza*: **il video form-check** (l'atleta filma l'alzata, il coach la rivede). È LA killer feature di TrueCoach. Prima l'app aveva video **solo coach→atleta** come demo (link YouTube in iframe), zero upload dall'atleta.
- **Ostacolo nascosto**: l'app **non usava Supabase Storage** da nessuna parte (tutti i "video" erano embed YouTube). v1 = prima infra Storage.
- **Backend deployato (via Supabase MCP, migration `form_check_video`)**: colonne `media_url`/`media_type` su `messages` (nullable, retro-compatibili); bucket **privato** `form-checks` (cap 50MB, mime video: mp4/quicktime/webm/mkv/3gpp); RLS `form_checks_auth_all` su `storage.objects` (`TO authenticated`, coerente con la posture esistente `messages` `USING(true)`, modello mono-coach). Advisors security: **nessun nuovo problema** (solo warning pre-esistenti).
- **Modello**: si aggancia alla messaggistica esistente (niente sistema nuovo). Un video = un messaggio con `media_type='video'` e `media_url = PATH` nel bucket (NON URL pubblico). L'URL firmato è generato **on-render** (`createSignedUrl`, scad. 2h) → il bucket resta privato.
- **Client (v6.97)**: helper condivisi in `utils.js` — `uploadFormCheckVideo(file, athId)` (valida tipo+size, path `{athId}/{ts}-{uid}.ext`, upload), `signFormCheckUrl(path)`, `hydrateMediaBubbles(container)` (post-processa `<video data-mpath>` → inietta src firmata), `mediaBubbleHtml(path, caption, isMine)`. `renderMessaggi`/`renderAthleteChat` (`app.js`) renderizzano la bolla-video se `media_type==='video'` + chiamano hydrate. Nuova `onFormCheckPick(side, inputEl)` (upload+insert+push+re-render, un solo handler per coach/atleta). Bottone 🎥 + file input nascosto in entrambe le chat (`index.html`). Bridge in `main.js`. Realtime già passa i nuovi campi (`payload.new` completo, dedupe per id).
- Verifica: `node --check` OK (utils/app/main/sw); test logica **10/10** (validazione tipo/size, cap esatto 50MB, escaping XSS su path+caption). Migration `success:true`, bucket confermato (private, 50MB, 5 mime).
- **Escluso da v1** (deciso con l'utente): annotazioni video (canvas overlay) → v2.
- **Retention Storage — FATTA (2026-09-29)**: edge function **`cleanup-form-checks`** (ACTIVE, `verify_jwt=false`, in `supabase/functions/cleanup-form-checks/index.ts`) cancella i **file reali** via Storage API (`list` per prefisso-atleta + `remove` a blocchi; delete via SQL NON rimuove il file) più vecchi di `FORM_CHECK_RETENTION_DAYS` (default **30gg**), poi ripulisce i messaggi collegati (`media_url/media_type=null`, content "🎥 Video non più disponibile (scaduto)"). Età file = `created_at` Storage, fallback al timestamp nel nome. Auth: riusa il segreto di `reminder_config` (RLS → solo service role), come i reminder. Cron **`formcheck-retention-daily`** (`30 3 * * *`, migration `formcheck_retention_cron`). Param `dryRun=1` per verifica non distruttiva. **Testato live** attraverso il path reale del cron: autorizzato+dryRun → **200** (`ok:true`, cutoff −30gg, bucket vuoto 0 file), secret errato → **401**.
- **DEPLOYATO + VERIFICATO (2026-09-29)**: SW v6.97, commit `9134cfa` + push su `main` + `vercel --prod` (dpl_HCB8YKfWFfujWFnVJEP9z9vhXDYx). Live su `coach-os-lime.vercel.app` (SW v6.97 + bottoni 🎥 su entrambe le chat). **Smoke test su telefono vero: OK** (l'utente ha confermato upload atleta→coach funzionante end-to-end). Feature v1 COMPLETA.
- **Follow-up futuri** (non bloccanti): retention 30gg configurabile via env `FORM_CHECK_RETENTION_DAYS`; annotazioni video (canvas overlay) = v2, da fare solo dopo aver validato l'uso reale del form-check.

**Tecniche d'intensità per-settimana nella progressione (2026-09-28)**
- Contesto (richiesta coach): la progressione per-settimana copriva set/rep/kg/RIR/TUT, ma le tecniche d'intensità (drop set, ecc.) restavano fisse per esercizio → per dire "sett. 4 → drop set" il coach doveva scriverlo nelle note (orribile). Ora è un campo per-settimana come RIR/TUT.
- Distinzione emersa dal codice: `series_type` mescolava **schemi di periodizzazione multi-settimana** (Wendler, block period, linear…) e **vere tecniche d'intensità da singola seduta**. Per il campo per-settimana esposto solo un **sottoinsieme curato** (scelta utente): Drop set, Rest-pause, Myo-reps, Cluster, Serie in allungamento, Top set/AMRAP, Densità metabolica. Aggiunte badge (`DROP`/`RP`) e schede istruzioni per Drop set e Rest-pause (prima mancavano).
- **Modello**: campo opzionale `tech` dentro l'oggetto settimana della progressione (`ex.progression.w4.tech = 'drop_set'`), analogo a `rir`/`tut`. **Zero migration** (progressione già in `exercises` JSONB).
- **Editor (`app.js`)**: nuova costante `INTENSITY_TECHNIQUES`; select "Tecnica d'intensità" per settimana in `openProgressionModal`; salvataggio in `saveProgressionData` (vuoto = nessuna); `applySmartMicrocycle` preserva `tech` esistente (come rir/tut); riepilogo progressione nell'editor mostra la sigla tecnica accanto alla settimana (viola). Badge `drop_set:'DROP'`/`rest_pause:'RP'` in `_seriesTypeLabels`.
- **Atleta (`workout.js`)**: render live week-aware — `activeTech` legge `pW.tech` della settimana attiva (guidata da `mesoStartDate`), fallback a `ex.series_type` fisso; badge + scheda istruzioni "Come eseguire" seguono la tecnica della settimana. `_stLabels` e `SERIES_TYPE_INSTRUCTIONS` estesi con drop_set/rest_pause.
- Verifica: `node --check` OK (app/workout); test logica 8/8 sul comportamento reale (scenario blocco 6 sett con drop set alla 4, fallback al fisso, override per-settimana, manual ignorato, tech vuota non salvata). SW bump v6.96.
- **Da fare**: smoke test coach+atleta → commit + push + `vercel --prod` (client-only, nessuna migration).

**Briefing IA settimanale coach — sintesi in linguaggio naturale (2026-09-28)**
- Contesto/strategia: primo uso reale dell'IA nell'app. Scelta ragionata (obiettivo = primi coach beta + demo che converte): l'IA come **acceleratore di distribuzione** (momento wow nel demo) senza minare la credibilità S&C né i costi. Principio cardine: **l'IA NON calcola** — riceve i KPI già calcolati dal motore deterministico (`generateWeeklyInsight` + `calculateACWR` + readiness + rischio) e li trasforma in un briefing da coach. Fallback: resta l'analisi deterministica.
- **Backend deployato (via Supabase MCP)**:
  - Migration `ai_insight_cache`: tabella `ai_insights` (`athlete_id text` FK → `atleti.id`, `iso_week`, `input_hash`, `summary`, `model`, unique `(athlete_id, iso_week)`). RLS allineata alle tabelle esistenti: policy `coach_full_ai_insights` con `is_coach()` (nello schema NON esiste `coach_id`; modello mono-coach). File: `ai_insight_migration.sql`.
  - Edge function `coach-insight` (ACTIVE, `verify_jwt=true`): chiama Anthropic `claude-haiku-4-5-20251001`, `max_tokens:500`, **prompt caching** (`cache_control: ephemeral`) sul system prompt fisso. System prompt blinda il framing: niente numeri inventati, ACWR = supporto non predizione, output ~120 parole, etichettato bozza. File: `supabase/functions/coach-insight/index.ts`.
- **Client (v6.95)**: in `_renderInsightCard` (app.js) bottone "✨ Genera briefing IA" + contenitore `#dh-ai-briefing`. Nuove funzioni `generateAiBriefing(athId, force)` / `copyAiBriefing()` / helper `_buildInsightPayload` (payload compatto), `_isoWeek`, `_hashStr`, `_renderAiBriefingBox` (textarea **editabile** "Bozza IA · rivedi prima di usare" + Copia/Rigenera). **On-demand** (mai automatico) + **cache DB** per atleta+settimana via `input_hash` → riaperture senza nuovi dati = costo zero. Bridge in `main.js` (import + `Object.assign(window)`).
- Controllo costi: Haiku + on-demand + prompt caching + cache DB. Credibilità: numeri solo dal motore, output bozza editabile, framing ACWR onesto.
- Verifica: `node --check` OK (app/main/sw). Migration `success:true`; edge function `status:ACTIVE`.
- **BLOCCANTE PRIMA DELL'USO**: impostare il secret `ANTHROPIC_API_KEY` sul progetto Supabase (`supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` oppure dashboard → Edge Functions → Secrets). Senza, la function risponde `missing_api_key` e il client mostra il fallback ("analisi automatica resta valida").
- **Bottone nascosto dietro flag** (`AI_BRIEFING_ENABLED = false` in `app.js`): il backend è deployato ma il bottone "Genera briefing IA" NON è renderizzato finché la chiave non c'è. Quando il secret è impostato: `AI_BRIEFING_ENABLED = true` → commit + `vercel --prod`. (Deciso il 2026-09-28: utente non ancora pronto a pagare i crediti API → deployata solo la feature tecniche per-settimana, IA parcheggiata.)
- **Da fare**: set secret → flip flag → smoke test coach (genera briefing su atleta demo, cache hit alla riapertura) → commit + push + `vercel --prod`.

**FIX sync fine-allenamento: storico/calendario non si aggiornavano (2026-09-28)**
- Sintomo (segnalato dal coach): a fine allenamento arriva il **messaggio recap in chat** ma **storico e calendario restano vuoti**.
- Causa (confermata con probe REST): in `_saveAndSend` (bottom sheet "Fine Allenamento", `workout.js`) e nel handler `ew-skip`, l'oggetto cloud era costruito con `{ ...sessObj, ... }` → portava chiavi **non-colonna** (`athlete`, `session`, `sRPE`, `maxE1rm`, `e1rmDom`, `e1rmNDom`). PostgREST rispondeva **400 PGRST204** "Could not find the 'athlete' column" → upsert su `sessions` fallito (errore solo in `console.error`, **silenziato in produzione**). Il messaggio invece partiva perché usa un oggetto pulito. Stesso bug latente in `saveSess` (aggiunta manuale coach, `app.js`).
- Fix: nuovo helper condiviso **`sessionCloudRow(s)`** in `utils.js` che mappa camelCase→snake_case e include **solo** le colonne reali di `sessions` (`athlete_id, date, session_name, session_type, week, phase, readiness, vol, srpe, rpe, qual, hrv, max_e1rm, e1rm_dom, e1rm_ndom, doms, flag, notes, reply, variations`). Usato nei 3 punti di upsert. Aggiunto **toast visibile** on-error (prima era muto in prod).
- Verifica: `node --check` OK (utils/workout/app); probe REST con anon key → oggetto "sporco" = **HTTP 400 PGRST204**, oggetto `sessionCloudRow` = **HTTP 201** (righe di test poi eliminate). Nessuno spread residuo verso `sessions`.
- **Da deployare**: SW bump (v6.94) + commit + push + `vercel --prod` (client-only).

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

---

## Prossimo passo — roadmap

Priorità per arrivare ai primi 10 coach beta (billing escluso, no P.IVA).

**Blocker (impediscono uso/vendita):**
1. **Distribuzione + prova sociale** (non-codice): reclutare 1 coach reale come caso zero + video demo 60–90s.
2. **Time-to-value coach** → ✅ template + duplica + copia su più atleti + ✅ import da Excel/Sheets (2026-09-26).
3. **Adozione atleta** → ✅ gamification + PWA install + ✅ push reminder allenamento + ✅ sessione persistente (2026-09-26). Blocker chiuso.
4. ~~**Fiducia minima (GDPR)**~~ → ✅ privacy in-app, export dati, wording onesto.

**Nice-to-have (retention/percezione):**
- Semplificare il default (modalità base PT vs toggle "Performance/Avanzato" per analytics S&C).
- ~~Nascondere tile wearable "Coming Soon" + de-enfatizzare nutrizione~~ → ✅ entrambi fatti (2026-09-26).
- ~~ACWR come supporto alla decisione con metodologia visibile~~ → ✅ individualizzato + framing onesto + gate (2026-09-26). Decadimento su calendario (#4) valutato e scartato (peggiora coi dati sparsi). Resta opzionale: toggle di disattivazione.
- ~~Card-ificazione tabella Storico su mobile~~ → ✅ fatto (2026-09-26).

**Rimandati (P.IVA / costi):**
- Billing reale (codice + checklist Stripe pronti).
- Upgrade analisi automatica via Claude API (edge function + `ANTHROPIC_API_KEY`, fallback engine locale).
