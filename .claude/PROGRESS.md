# PROGRESS

> Storia completa fino a v6.93 → `.claude/PROGRESS_ARCHIVE.md`

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

**Demo athlete popolato — Luca Verdi (2026-10-01)**
- Scopo: preparare il video demo per il primo coach beta (profilo **Strength & Conditioning**). Scoperto che l'atleta demo `Luca Verdi` (id `ziovvy8`, goal "Performance Atletica") era un **guscio vuoto** (0 sessioni, 0 HRV/readiness, 0 messaggi, 0 video, peso/bf a 0) → il demo sarebbe girato su schermate vuote.
- Seminato via SQL (NON codice): **32 sessioni su 8 settimane** con periodizzazione realistica (Accumulo w1-3 → Deload w4 → Intensificazione w5-7 con **overreaching in w7**: readiness 66, HRV 56, carico al picco → Realizzazione w8 con e1RM PR 161 e recupero). Alimenta tutti gli analytics S&C (ACWR ~1.16 in w7, monotonia/strain, e1RM trend, HRV+MA7, readiness, volume). Composizione corporea (82kg/11.5% + `anthropo_history` 4 punti ricomposizione). 5 messaggi chat coach↔atleta coerenti (ultimo non letto → badge).
- **Pulizia** (è tutto fixture): sessioni `delete from sessions where id like 'seed_lv_%'`; chat `delete from messages where athlete_id='ziovvy8'` (aveva 0 msg prima, tutti seed); body-comp azzerabile a mano su `atleti` id `ziovvy8`.
- **Da fare nel demo (dal vivo)**: il beat form-check video + annotazione NON è seminabile (serve file reale in Storage) → registrarlo dal vivo (atleta carica video → coach annota), che coincide con lo smoke test sul telefono. Script demo 75s + messaggi outreach S&C pronti (in chat sessione, non in repo).



**Foto-progressi coach↔atleta — v1 (2026-09-29)**
- Contesto/strategia: confronto competitivo (TrueCoach, Trainerize, Everfit, TrainHeroic, CoachRx) → gap #1 per impatto/sforzo. Le foto-progressi sono table-stake in tutti i top e la feature di retention/motivazione più usata; l'app aveva solo numeri di composizione corporea, nessuna foto. Costo basso perché riusa l'infra Storage del form-check.
- **Modello**: l'atleta carica foto datate per posa (Fronte/Lato/Retro); atleta e coach le vedono; il **coach le confronta side-by-side su due date**. Metadati in `atleti.progress_photos` JSONB (`[{id,date,pose,path}]`, camelCase `progressPhotos` in memoria); immagini nel bucket **privato** `progress-photos` (URL firmati on-render, scad. 2h) — stesso pattern del form-check, **zero rete al render se non firmando**.
- **Backend (via Supabase MCP, migration `progress_photos`)**: `ALTER TABLE atleti ADD COLUMN progress_photos jsonb`; bucket privato `progress-photos` (cap 10MB, mime `jpeg/png/webp/heic/heif` incl. iPhone); RLS `progress_photos_auth_all` su `storage.objects` (`TO authenticated`, coerente con `form_checks_auth_all`, modello mono-coach). `success:true`, bucket+colonna verificati.
- **Client (v7.02)**:
  - `utils.js` — helper: `uploadProgressPhoto` (valida image + cap 10MB, path `{athId}/{ts}-{uid}.ext`), `signProgressPhotoUrl`, `hydratePhotoThumbs` (`img[data-ppath]` → src firmata).
  - `app.js` — `PROGRESS_POSES`, `renderProgressPhotos` (galleria atleta raggruppata per data), `renderPhotoCompare` (confronto coach: due `<select>` data + griglia per posa, default più-recente vs più-vecchia), `openPhotoUpload`/`onProgressPhotoPick` (upload + push meta + update cloud mirato tipo body-comp + re-render), `deleteProgressPhoto` (confirm + `storage.remove` del file reale), `openPhotoLightbox`, `setCompareDate`.
  - `analytics.js` — `renderAthProgressi` chiama `window.renderProgressPhotos`; `renderAnalytics` chiama `window.renderPhotoCompare` (evita import circolare via bridge window).
  - `index.html` — contenitori `#ap-photos` (atleta) e `#an-photos` (coach) + modali `mo-photo` (upload: data/posa/file, `capture=environment`) e `mo-photo-view` (lightbox).
  - `auth.js` — **fix incluso**: normalizzazione snake→camel in `loadDB` per `progress_photos→progressPhotos` **e** `anthropo_history→anthropoHistory`. Senza, i dati sopravvivevano solo via cache localforage sullo stesso device (bug cross-device latente del body-comp, ora sistemato: coach su desktop vede le foto caricate dal telefono).
  - `main.js` — bridge 7 funzioni. `sw.js` + import-map `V` → **v7.02** in sync.
- Verifica: `node --check` OK (utils/app/analytics/auth/main/sw); cross-check export↔bridge↔onclick 7/7; test logica raggruppamento/confronto (date desc, default new-vs-old, unione pose) OK; **smoke Playwright reale** (app servita in locale, Supabase stubbato, SW neutralizzato per evitare il reload su controllerchange) → galleria atleta 4 foto+hydrate, modale upload (pose+data precompilata), upload stub → 5 foto/nuova data, confronto coach (2 date, 3 pose affiancate front-both/side-old/back-new), cambio data B, lightbox. **0 errori reali** (unico errore = stub SW incompleto del test, non del codice).
- **Escluso da v1** (naturale follow-up): ~~retention/cleanup del bucket foto~~ → ✅ FATTO orphan-only (2026-10-01, vedi sotto). Riordino/reorder pose, note per foto, misura con overlay → ancora da fare dopo validazione sul campo.

**Cleanup foto-progressi — orphan-only (2026-10-01)**
- Contesto/decisione: a differenza dei video form-check, le foto-progressi NON vanno cancellate per età (il loro valore è il confronto longitudinale nel tempo → cancellare le vecchie distrugge la baseline). Deciso con l'utente: cleanup **solo degli orfani** (zero rischio su foto vive).
- **Modello**: fonte di verità = `atleti.progress_photos[].path`. Il job costruisce il Set dei path referenziati, lista il bucket `progress-photos`, e rimuove SOLO i file non referenziati (es. atleta eliminato, delete fallito a metà). **Grace period 24h** (`PROGRESS_PHOTO_GRACE_HOURS`) protegge i file appena caricati il cui update JSONB non è ancora committato (evita falsi orfani). Nessuna pulizia metadati (per definizione già assenti).
- **Backend**: edge function `cleanup-progress-photos` (ACTIVE v1, `verify_jwt=false`, in `supabase/functions/cleanup-progress-photos/index.ts`), stesso pattern auth di `cleanup-form-checks` (segreto `reminder_config` via `x-cron-secret`). Cron **`progressphoto-cleanup-weekly`** (`45 3 * * 0`, settimanale — gli orfani si accumulano lentamente; migration `progressphoto_cleanup_cron`). Param `dryRun=1` per verifica non distruttiva.
- **Testato live** attraverso il path reale del cron: secret giusto + dryRun → **200** (`ok:true`, bucket vuoto 0 file/0 orfani), secret errato → **401**.
- **DEPLOYATO (2026-10-01)**: backend già in prod (migration applicata). Client: commit `c3da56c` + push su `main` + `vercel --prod` (coach-nsouuaaf4). Live su `coach-os-lime.vercel.app` verificato via curl → SW v7.02, `APP_ASSET_VERSION = 7.02`, `renderProgressPhotos` nel bundle. **Smoke su telefono vero ancora consigliato** (upload da camera + confronto coach side-by-side) come validazione finale sul campo.

**FIX "Annota" non apriva l'editor — `_anRate` typo (2026-09-29)**
- **Sintomo (coach)**: premere ✏️ Annota su un video in chat non apriva nulla ("il bottone non fa niente").
- **Causa**: in `_anOpen` (app.js) la chiamata era a **`_anRate(1)`** (helper interno **inesistente**) invece di **`annotRate(1)`** (la funzione esiste solo come export). `_anRate(1)` è **prima** di `openMo('mo-annot')` → `ReferenceError` → il modal non veniva mai aperto. `node --check` e i test logici NON l'hanno preso perché è una reference a runtime dentro `_anOpen`, mai eseguita nei test puri.
- **Diagnosi (Playwright, guidando `openAnnotator` con `mySupabase` stubbato + `window.appState.selAthId`)**: `THROW: _anRate is not defined`. Post-fix: modal = classe `"mo show"`, `display:flex`, video src impostato, toolbar visibile.
- **Fix**: `_anRate(1)` → `annotRate(1)` in `_anOpen`.
- **DEPLOYATO**: **v7.01** (SW + `APP_ASSET_VERSION` in sync), commit `2c6744f` + push + `vercel --prod` (coach-gstv104z0). Verificato sul live: asset v7.01, `openAnnotator` apre il modal, 0 errori.
- **Lezione/processo**: la verifica pre-deploy della v2 era solo `node --check` + test logici puri; il flusso reale (aprire l'editor) non era stato guidato in un browser → il typo runtime è passato. Per feature con molta UI, guidare almeno un happy-path in Playwright prima del deploy.

**FIX splash infinito dopo login — regressione del loader import-map (2026-09-29)**
- **Sintomo (coach, sul telefono)**: dopo aver inserito la password, l'app resta sullo splash "Elite Sports Science" e non entra mai (schermata di caricamento infinita).
- **Causa-radice**: il loader import-map (fix precedente) inietta l'entry module **dinamicamente** (`document.head.appendChild`). Uno `<script type="module">` **statico** è *deferred* (esegue prima di `DOMContentLoaded`), ma uno **iniettato** è *async* → su rete lenta esegue **dopo** che `DOMContentLoaded` è già scattato → `document.addEventListener('DOMContentLoaded', bootstrap)` registra un handler per un evento **già passato** → **il bootstrap non parte mai** → lo splash (nascosto solo nel `finally` del bootstrap) resta infinito. Aggravante: `auth.js` fa `location.reload()` su `controllerchange` (auto-reload quando un nuovo SW prende il controllo) → ogni update SW colpiva la race.
- **Diagnosi (Playwright headless sul live)**: firma inequivocabile → funzioni su `window` **definite** (il modulo gira, `Object.assign` eseguito) ma **splash mai nascosto** e **0 errori console**. Esattamente "listener aggiunto troppo tardi".
- **Fix (`main.js`)**: il bootstrap è ora una funzione `_bootstrap()` invocata **subito** se `document.readyState !== 'loading'`, altrimenti su `DOMContentLoaded`. Così parte sempre, indipendentemente da quando il modulo async esegue. **+ rete-di-sicurezza** `setTimeout(12s)` che nasconde comunque lo splash (mai più caricamento infinito, qualunque cosa accada nel boot).
- Verifica: `node --check` OK; live post-deploy → SW v7.00, `main.js?v=7.00` contiene `_bootstrap`/`readyState`, splash si sblocca (headless: via rete-di-sicurezza perché in sandbox `checkWearableCallback` resta appeso per limiti di rete; su dispositivo reale si chiude in fretta col `finally`).
- **DEPLOYATO**: **v7.00** (SW + `APP_ASSET_VERSION` in sync), commit `3ee5669` + push su `main` + `vercel --prod` (coach-1bypcv1oz), alias `coach-os-lime.vercel.app`.
- **Lezione**: iniettare moduli dinamicamente rompe l'ordine col `DOMContentLoaded`; qualunque handler `DOMContentLoaded` in un modulo caricato così necessita della guardia `readyState`.

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
