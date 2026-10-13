# PROGRESS

> Storia completa fino al 2026-10-04 → `.claude/PROGRESS_ARCHIVE.md`

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

**Serie "a tempo" → timer vero sul pallino lato atleta (2026-10-13)**
- Richiesta coach (foto): per esercizi a tempo (es. `spanish squat 2×45"`) i pallini set mostravano `45"` ma erano solo da spuntare. Voluto: tap sul pallino → parte un countdown da 45" **sul pallino stesso** → a 0 **suona**. I due pallini restano, diventano timer.
- **Soluzione (solo `workout.js` + `styles.css`, nessun tocco a DB/HTML/backend)**:
  - Nuovo helper `_setTimeSeconds(raw)` (accanto a `_compactRep`): riconosce i tempi "puri" `45"`/`45''`/`30''`/`1'`/`2'`/`45s` (anche con suffisso `/gamba`·`/lato`) → secondi; **esclude** gli schemi compositi/intervalli (con `+`, `(`, o `5x…` tipo `30''/lato + 12/lato`, `5x(1'+4')`) → restano pallini normali.
  - Al render dei pallini (`loadLive`): ogni dot lavorativo porta ora `data-label` (etichetta originale) e, se è un tempo puro, classe `timed` + `data-secs`. Il parsing usa la rep **sorgente** per-serie (gestisce anche i piramidali a tempo `30"-20"`), non la meta compattata.
  - `attachDotSwipe`: il tap su un pallino `.timed` non ancora `.done` chiama il nuovo `startSetTimer(dot)` invece di `toggleDot`.
  - `startSetTimer(dot)` (nuovo, export): 1° tap → countdown sul pallino (display `45`→`0`; `≥60s` mostrato `M:SS` via `formatTime`), classe `.running`; a 0 → `playTimerEndSound()` (beep 880Hz + vibrazione, **riusato** dal timer REST) + `.done` + etichetta ripristinata + **auto-start del timer REST** come per un set normale; tap durante il countdown → annulla e ripristina. Long-press invariato (registra rep/kg reali).
  - Fix collaterale: `toggleDot` ora ripristina l'etichetta da `data-label` (corregge anche i piramidali, che prima tornavano al numero di serie).
  - CSS: `.dot.timed` bordo accento (segnala "è un timer"); `.dot.timed.running` anello accento pulsante (`@keyframes dot-ring-pulse`, gated da `prefers-reduced-motion`); versione athlete-scoped `.is-athlete .dot.timed(.running)`. Hook impeccable: nessun finding.
- **Verifica**: `node --check` OK; harness Node su `_setTimeSeconds` estratto dal sorgente reale vs **formati reali del DB prod** (`45"`,`30''`,`1'`,`2'`,`5'`,`30'`,`4''`,`45''/gamba` + compositi) → **17/17**. Playwright 390×844 touch con **sorgente reale** di `_setTimeSeconds`+`startSetTimer` (stub deps) + vero `styles.css` (`tests/verify_set_timer.py`, riutilizzabile) → **18/18 PASS**: detection, bordo accento, pallino=44px, `.running`+anello durante countdown, a 0 → `.done`+suono+etichetta ripristinata, secondo tap = annulla, 0 errori console. Screenshot `tests/set_timer_iphone.png`.
- **NON deployato** (come da prassi). **Prossimo passo**: conferma al coach, poi deploy — bump `APP_VERSION` in `sw.js` + `var V` in `index.html` + `package.json`, `npm run build:web`, commit, `vercel --prod`. Convenzione documentata in `.claude/coaching/SCHEDE_STYLE.md` (riga `rep`).

**Fix modale video atleta "si apre a metà" su iPhone (2026-10-13)**
- Sintomo (foto coach): aprendo il "Video" da un esercizio lato atleta, lo sheet del player saliva solo di ~1/3 e la parte bassa del video (controlli/scrubber) finiva **coperta dalla barra di navigazione** in basso.
- **Causa radice (verificata in `styles.css`)**: `.bottom-bar` ha `z-index: 99999 !important`, mentre tutti i modali/bottom-sheet `.mo` hanno `z-index: 200`. Quindi la nav atleta si disegna **sopra** lo sheet. Gli altri sheet se la cavano col `padding-bottom` (28px + safe-area) che tiene il contenuto sopra la nav, ma il box video a 16:9 (`padding-bottom:56.25%`) sconfina in quella fascia e viene clippato. In più, su mobile la regola bottom-sheet (`.mo-box{padding:… !important}`) sovrascriveva il `padding:0` inline del box video, aggiungendo 20px di padding laterale + spazio morto in basso attorno al player.
- **Fix (solo `styles.css`, scoped a `#mo-video` nel `@media (max-width:768px)`)**: `#mo-video{z-index:100000 !important}` (sopra la nav) + `#mo-video .mo-box{padding:0 0 env(safe-area-inset-bottom) !important}` (video edge-to-edge, niente dead space) + `#mo-video .mo-box::before{display:none}` (via il drag-handle sopra il player). Nessun tocco a JS/HTML: `openVideoModal`/`closeVideoModal` invariati; impatta solo il modale video.
- **Verifica**: Playwright 390×844 contesto touch (`tests/verify_video_modal.py`, riutilizzabile) → **5/5 PASS**: z-index video (100000) > nav (99999); handle `::before` display:none; padding laterale 0; `elementFromPoint` sul bordo basso del video ricade su `#mo-video-iframe` (non più coperto dalla nav); 0 errori console. Screenshot `tests/video_modal_iphone.png` (player ora fino al bordo inferiore).
- **DEPLOYATO v7.11 (2026-10-13)**: bump 7.10→7.11 (`sw.js` APP_VERSION + `index.html` `var V` + `package.json`), `npm run build:web` (38 file in `www/`, `#mo-video` ×3 propagato in `www/styles.css`), commit `b73e877` su `main` (6 sorgenti; `www/` è gitignored → servito da Vercel), `vercel --prod` → READY, aliasato su `coach-os-lime.vercel.app`. Verifica live: `sw.js`→`v7.11` ✓, `index.html`→`var V='7.11'` ✓, `styles.css`→`#mo-video` ×3 ✓. **Da confermare su iPhone reale**: apri Video da un esercizio → il player sale intero, controlli YouTube visibili, la nav non lo taglia.

**Tecniche d'intensità per-serie: target set + reps compatte su mobile + evidenziazione (2026-10-13)**
- Contesto: il coach non era convinto della gestione progressione/intensità delle serie. Tre problemi verificati nel codice: (1) una tecnica si applicava solo all'**intero esercizio** (`series_type`) o **intera settimana** (`progression.wN.tech`) — niente granularità per-serie (`app.js`); (2) `applySmartMicrocycle` cuce schemi tipo `16 + 4 + 4 + 4 (15" rest)` dentro `rep`, che finisce grezzo nella riga meta atleta (`workout.js`) e sfora su iPhone (`.ax-ex-meta` senza overflow handling); (3) la serie con tecnica non si distingueva dalle altre.
- **Decisioni col coach (AskUserQuestion)**: granularità = **scelta serie bersaglio** (una tecnica per esercizio/settimana + target tutte/ultima/ultime N/serie specifica); editor = **solo nella modale Progressione**; vista atleta = **badge sul pallino + espandibile**.
- **Modello dati**: nuovo campo opzionale `techSet` in `progression[wN]` (accanto a `tech`). Valori: `'all'` (default/assente = back-compat), `'last'`, `'last2'`, `'last3'`, numero `'1'..'N'`. Nessuno schema salvato nelle reps: il dettaglio numerico (16+4+4+4, 80→60→45) si **calcola a render time**. Documentato in `.claude/coaching/SCHEDE_STYLE.md`.
- **Editor coach (`app.js`)**: modale Progressione → nuovo select "Su quale serie" (`p-techset-${w}`, helper `_techSetOptions`, abilitato solo se c'è una tecnica); `saveProgressionData` salva `techSet` se ≠ 'all'; `applySmartMicrocycle` preserva `techSet`. Riepilogo editor + PDF (`progHTML`, helper `_techSetShort`) mostrano la serie bersaglio (es. `DROP (ultima)`).
- **Atleta live (`workout.js`)**: 4 helper nuovi — `describeTechnique` (dettaglio compatto da rep/kg: drop `80→60→45`, myo `+3+3+3`, ecc.), `_resolveTechSets` (indici serie bersaglio), `_techSetLabel`, `_compactRep` (separa `rep` in `meta` corta + `detail` completo → risolve overflow anche per schede **legacy** già salvate, senza migrazione). Riga meta + pallini usano `repCompact.meta`; la serie bersaglio ha classe `dot tech` + `data-tech` (badge col codice); badge esercizio-level mostrato solo se target='all'; riquadro "Come eseguire" arricchito con serie bersaglio + dettaglio numerico. Compattato anche il target del modale "log reale set".
- **CSS (`styles.css`)**: `.is-athlete .dot.tech` = anello accento + mini-pill `::after{content:attr(data-tech)}` in alto a destra; `overflow-wrap:anywhere` su `.ax-ex-meta` come rete.
- **Verifica**: `node --check` app.js/workout.js OK; **harness logica Node** che estrae i 4 helper dal sorgente reale di `workout.js` → **22/22 PASS** (resolveTechSets, compactRep che riduce `16 + 4 + 4 + 4 (15" rest)`→`16+4+4+4`, describeTechnique drop/myo/cluster, label); **Playwright render 390×844** (`tests/verify_set_technique.py`, server interno + vero `styles.css`) → **7/7 PASS** (solo la serie bersaglio ha `.tech`, anello accento presente, badge `::after`="DROP", meta `1×16+4+4+4` non sfora, 0 errori console) + screenshot `tests/set_technique_iphone.png`.
- **NON deployato** (come da prassi). **Prossimo passo**: smoke su telefono reale lato coach (modale Progressione → tecnica + "Solo ultima" → salva → verifica nel live atleta); al deploy bump `APP_VERSION` in `sw.js` + `var V` in `index.html` + `package.json`, `npm run build:web`, commit, `vercel --prod`.

**Audit `mobile-native` lato atleta — P1 hover-gating + P2 dvh + P3 text-size-adjust (2026-10-10)**
- Contesto: l'utente ha chiesto le migliori skill per migliorare UI/layout/viewport/screen del **lato atleta su iPhone**. Verificato che sono tutte **già installate** (`mobile-native`, `apple-design`, `emil-design-eng`, `break-ui`, `animate`/`find-animation-opportunities`/`improve-animations`/`review-animations` a livello utente; `webapp-testing` + impeccable plugin): nessuna installazione, sarebbe stato un no-op. Poi eseguito l'**audit `mobile-native`** sul codice athlete-scoped (`index.html` + `styles.css`) contro gli 11 punti della skill. Esito: fondamenta già solide (viewport-fit=cover, tap-highlight transparent, overscroll-behavior:none, safe-area insets topbar/bottom-bar/sheet, touch-action manipulation+pan-y+none su canvas, input `font-size:16px!important` anti-zoom, `100dvh` sulla shell mobile, `:active` press-feedback, target ≥44px, nessun `user-scalable=no`). Tre gap reali → P1/P2/P3.
- **P1 — hover "appiccicato" su touch (il tell più grosso)**: 21 regole `:hover`, **zero** dietro capability query → su iPhone il primo tap applica `:hover` e resta incollato. Peggiori perché tappate set-by-set nel live allenamento: `.rpe-b:hover{transform:translateY(-1px)}` (il bottone RPE restava sollevato), `.dot`, `.ac`, `.mo-x`, + nav/btn/foot-btn/tab. **Fix**: wrappate 20 regole in `@media (hover:hover) and (pointer:fine)`. `.bm-hot:hover,:active` **splittato** (hover gated, `:active` lasciato libero per non perdere il feedback touch). Lasciato apposta `::-webkit-scrollbar-thumb:hover` (chrome desktop, nessun problema touch). Il feedback touch resta garantito dai `:active` già presenti.
- **P2 — `100vh` sugli overlay full-screen atleta**: la shell era già `100dvh`, ma gli overlay inline no → taglio/overflow sotto la barra URL di Safari iOS. **Fix** (`100dvh` con `100vh` sopra come fallback): `#login-screen` (prima schermata atleta), `#onboarding-screen`, `#custom-confirm-modal` in `index.html`; `body` min-height e `.sidebar` drawer mobile in `styles.css`.
- **P3 — `text-size-adjust`**: aggiunto `-webkit-text-size-adjust:100%`+`text-size-adjust:100%` su `html` (evita gonfiaggio font in landscape iOS). **Non toccate** (non difetti): `theme-color` singolo `#14181E` (app dark-only → corretto) e `interactive-widget=resizes-content` (solo Android, irrilevante su iPhone target).
- **Verifica da codice**: grep conferma 19+1 blocchi `hover:hover`, solo lo scrollbar non-gated (voluto); `100dvh` presente su tutti e 5 i punti. **Nota hook impeccable**: i ~201 low-contrast di `index.html` sono tutti **preesistenti** (caption mute tema scuro / bianco-su-rosso d'errore, già documentati e confermati come design language); i miei edit hanno solo aggiunto `height:100dvh`, zero introdotti; nessuna soppressione file-wide aggiunta. **NON deployato** (come da prassi): al deploy servirà bump `APP_VERSION` in `sw.js` + `V` in `index.html`.
- **Verifica Playwright a 390×844 (contesto touch emulato, `is_mobile`+`has_touch` → `hover:none`) — 7/7 PASS** (`tests/verify_mobile_native.py`, riutilizzabile): viewport 390×844 ✓; emulazione touch attiva (hover:none/pointer:coarse) ✓; **P2** `#login-screen` offsetHeight==844 (dvh riempie il viewport) ✓; zero overflow orizzontale (scrollWidth=390) ✓; **P1 prova runtime** `.rpe-b:hover` → `transform:none` su touch (non si solleva) ✓; **P1 prova strutturale CSSOM** la regola vive in `@media (hover:hover) and (pointer:fine)` ✓; 0 errori console ✓. Screenshot `tests/mobile_native_iphone_login.png`. Nota: il Chromium headless non emula `hover:hover` in modo affidabile → la controprova desktop del transform è stata sostituita dal check CSSOM (deterministico).
- **DEPLOYATO v7.09 (2026-10-10)**: bump 7.08→7.09 (`sw.js` APP_VERSION + `index.html` `var V` + `package.json`), `npm run build:web` (38 file in `www/`, versione propagata; `sw.js` escluso dall'allowlist www by-design → servito da root su Vercel), commit `134a525` su `main` (6 file, +163/−77, incluso `tests/verify_mobile_native.py`), `vercel --prod` → READY, aliasato su `coach-os-lime.vercel.app`. Verifica live: `sw.js`→`APP_VERSION='v7.09'` ✓, `index.html`→`var V='7.09'` ✓ (il bump SW forza il refresh cache offline per tutti). Nota: commit firmato con identità git auto-rilevata (`Ladisa <ladisa@Mini-di-Ladisa.station>`) — `user.name/email` globali non configurati, nessun impatto sul deploy.
- **Da confermare su iPhone reale** (non riproducibile da codice/emulazione): il *feel* del tap senza lag sui bottoni RPE/pallini set e il collasso reale della barra URL di Safari; font stabile in landscape; sidebar-drawer fino a fondo schermo. Smoke consigliato: aprire `coach-os-lime.vercel.app` su iPhone, login atleta, provare un set.

**Fix "non fa accettare i termini" Tommaso Ambrosini — `link_athlete_auth` case/spazio-sensibile (2026-10-10)**
- Sintomo riportato dal coach: Tommaso (già sbloccato in login dal fix precedente) accetta i termini + inserisce email/password nello step "PRIMA CONFIGURAZIONE", clicca "Crea account e accedi" e **fallisce** → percepito come "non fa accettare i termini". Riprodotto live su `coach-os-lime.vercel.app` (v7.08) con Playwright: lo step consenso, il checkbox `#ath-setup-consent`, i link `/terms.html`+`/privacy.html` (200) e lo `signUp` funzionano — il meccanismo di accettazione NON è rotto.
- **Causa radice (diagnosi su DB prod)**: il fix di stamattina ha normalizzato SOLO `lookup_athlete_by_code` (login), **non** `link_athlete_auth` (collegamento account post-signUp). Quest'ultima confrontava `v_code = p_code` (case + spazio sensibile). Codice DB = `TomAmbers`; il client lo normalizza a `TOMAMBERS` (`auth.js:171` `.toUpperCase().replace(/\s/g,'')`) → `'TomAmbers' = 'TOMAMBERS'` → **FALSE** → `handleAthleteFirstTimeSetup` mostra "Errore nel collegamento account" (`auth.js:314`). Quindi: login passa (lookup ignora case/spazi), ma la creazione account fallisce al linking. Confermato: in `auth.users` esisteva `ambrosini004@gmail.com` creato oggi 11:02 (lo `signUp` era andato a buon fine e auto-confermato), ma `atleti.user_id` di Tommaso era rimasto `null` → al nuovo tentativo avrebbe pure preso "User already registered".
- **Fix 1 — RPC (migration `link_athlete_auth_ignore_case_spaces`)**: confronto ora `LOWER(REPLACE(v_code,' ','')) = LOWER(REPLACE(p_code,' ',''))`, coerente con `lookup_athlete_by_code`. `CREATE OR REPLACE` preserva SECURITY DEFINER/search_path=public e i GRANT. Copre qualunque codice mixed-case/con-spazi futuro.
- **Fix 2 — dati Tommaso**: collegato l'utente auth già creato al suo record (`update atleti set user_id='2d037948-…', email='ambrosini004@gmail.com' where id='0fw6lqc' and user_id is null`) → `has_auth` ora TRUE. Così non resta bloccato su "User already registered": al prossimo login col codice va diretto allo step password e usa la password già scelta alle 11:02 (nessuna nuova accettazione termini necessaria).
- **Verifica**: `lookup_athlete_by_code('TOMAMBERS')` → `has_auth:true`; query sugli atleti non collegati con codice non-uppercase o con spazi → **0 righe** (nessun altro caso latente). Nessun deploy client necessario (fix solo DB). **Da dire a Tommaso**: rientra col suo codice e inserisci la password scelta poco fa (schermata "Bentornato, Tommaso!").

**Fix login atleta — codice d'accesso con spazio (2026-10-10)**
- Sintomo: nuovo atleta "Tommaso Ambrosini" non riusciva ad accedere col codice inviato via WhatsApp. Diagnosi sui dati reali (DB prod): il suo `codice_accesso` era `Tom Ambers` (**con spazio**) — unico in tutto il DB; tutti gli altri codici sono senza spazi. Il login (`auth.js:171`) normalizza l'input con `.toUpperCase().replace(/\s/g,'')` → cerca `TOMAMBERS`, mentre la RPC `lookup_athlete_by_code` confrontava `LOWER(codice_accesso)=LOWER(p_code)` → `'tom ambers' ≠ 'tomambers'` → nessun match, accesso impossibile (a prescindere dalla password). Maiuscole/simboli non c'entravano (c'è `LOWER()`); solo lo spazio. Origine dello spazio: modifica manuale (dashboard/import), perché in-app il codice è auto-generato (`prima parola nome`+4 cifre, già senza spazi) e mostrato in sola lettura — nessun campo per digitarlo.
- Fix dati: `update atleti … replace(codice_accesso,' ','')` → ora `TomAmbers`.
- Fix "a prova di futuro" al punto di confronto (migration `lookup_athlete_by_code_ignore_spaces`): la RPC ora fa `LOWER(REPLACE(codice_accesso,' ','')) = LOWER(REPLACE(p_code,' ',''))` → ignora gli spazi su **entrambi** i lati, coprendo qualunque origine (dashboard, import Excel, digitazione). `CREATE OR REPLACE` preserva SECURITY DEFINER/search_path=public e i GRANT EXECUTE (anon+authenticated verificati). Verifica: lookup OK sia con `TOMAMBERS` sia con `Tom Ambers`, altri atleti (`TOTTI`) intatti. Nessun deploy client necessario (fix solo DB).

**Skill ufficiale Supabase installato + audit/hardening DB (2026-10-09)**
- Contesto: l'utente ha chiesto di trovare su GitHub le migliori skill/agenti per sviluppare l'app a 360°. Mappate le hub reali (hesreallyhim/awesome-claude-code ~55k★, VoltAgent/awesome-claude-code-subagents, wshobson/agents) sul suo stack; molto già coperto dagli skill installati (impeccable, mobile-native, suite business, code-review/security-review, MCP Supabase/Vercel). Gap tecnico più rischioso = backend Supabase → installato lo **skill ufficiale**: `npx skills add supabase/agent-skills` → 2 skill (`supabase` + `supabase-postgres-best-practices`) in `.agents/skills/` + symlink `.claude/skills/`. Installato anche `anthropics/skills@webapp-testing` (official, 172K install): script Playwright nativi + helper `with_server.py` → rende riutilizzabile il flusso di verifica Playwright finora fatto a mano. Scartati come ridondanti/overkill sul suo stack: sql-pro (coperto da supabase), Trail of Bits (orientato a C/C++/Rust/smart-contract), deployment-engineer (ha Vercel MCP); Capacitor/iOS = nessun buon skill nel registry.
- **Test reale dello skill** sul progetto `ncvmnoaelzdmuiqrvcjl`: audit security+performance via `get_advisors`. Diagnosi interpretata con la checklist dello skill. Migration `audit_p2_p4_p5_hardening` applicata (apply_migration, prod) + ri-verifica advisors:
  - **P2** `function_search_path_mutable` 8→0: `ALTER FUNCTION … SET search_path = public` sulle 8 funzioni. Pin a `public` (non `''`) perché i corpi usano tabelle non schema-qualificate (`coaches`/`atleti`/`coach_invitations`) → `''` le avrebbe rotte. Verificato leggendo `pg_get_functiondef`.
  - **P4** `auth_rls_initplan` 12→0: `auth.uid()` → `(select auth.uid())` su 12 policy (DROP+CREATE, ruoli/cmd/espressioni identici, zero cambio di comportamento).
  - **P5** `unindexed_foreign_keys` 4→0: indici su `schedules.athlete_id`, `sessions.athlete_id`, `wellness.athlete_id`, `push_subscriptions.user_id`. (`unused_index` 7→11 = i nuovi indici non ancora interrogati, benigno.)
  - **Falso allarme chiarito**: le policy `nutrition`/`wearable_connections` flaggate su `anon` sono `{public}` ma filtrano su `auth.uid()` (null per anon → 0 righe) → nessun buco.
- **P1 — risolto, era CRITICO non cosmetico (stessa sessione)**: ispezionando le 4 policy legacy IT è emerso che avevano `USING` **sempre-vero** (`(id=id)`, `(athlete_id=athlete_id)`, `true`) sul ruolo `public`. Essendo le RLS permissive in OR, **annullavano** le policy scoped e — con GRANT anon confermato `SELECT/INSERT/UPDATE/DELETE` — esponevano atleti/schede/sessioni/**wellness (dati art.9)** a chiunque avesse la anon key (pubblica, nel client JS). Breach reale. Verificato che il flusso autenticato è quello vero (7/11 atleti con `user_id`; athlete_own_* + coach_full_* coprono tutti gli accessi legittimi). Migration `p1_drop_insecure_legacy_policies` → droppate le 4 policy. Post-verifica: su quelle tabelle restano solo policy `{authenticated}`, `anon` = deny-by-default; `multiple_permissive` 61→57 (i 57 residui sono coppie atleta+coach legittime, lasciate). Rischio residuo noto: i 4 atleti senza `user_id` (demo/seed) perdono l'accesso anon finché non fanno login — corretto. **Reversibile** ricreando le policy se un flusso reale si rompe → consigliato smoke test atleta su device reale.
- **Smoke test P1 — PASS (stessa sessione)**: battezzato lo skill `webapp-testing` (installato Playwright Python + Chromium). (1) **Verifica autorevole via anon key** (REST prod): `anon` ora legge **0 righe** da atleti/sessions/wellness/schedules (prima: tutte) e `rpc lookup_athlete_by_code('TOTTI')` torna l'atleta → breach chiuso + path login intatto. (2) **Browser smoke** (`tests/smoke_athlete_login.py`, servito via `with_server.py`): login atleta col codice reale "TOTTI" → UI avanza allo step password "Bentornato, Francesco!", **0 errori console** + screenshot. Confermato che il fix P1 **non rompe** il login atleta (usa la RPC SECURITY DEFINER, non la `.select()` anon). Nota: il fallback `auth.js:191` (`.select()` su atleti da anon) ora è **dead code** — scatta solo se la RPC erra, e in quel caso non leggerebbe nulla; cleanup minore, non urgente.
- **P3 + fix invitations_read_by_token — fatto (stessa sessione)**: migration `p3_revoke_anon_rpc_and_fix_invitations_read` + correzione `p3_revoke_anon_rpc_direct`. (a) **RPC coach-management**: `REVOKE EXECUTE … FROM anon` su `ensure_coach_profile`/`get_team_coaches` (chiamate solo post-login; `auth_can` resta true). **Gotcha scoperto verificando**: in Supabase l'EXECUTE di anon è un grant **esplicito** (via ALTER DEFAULT PRIVILEGES), NON via PUBLIC → il primo `revoke from public` non è bastato, servito `revoke from anon` diretto (per questo la verifica di ogni fix è d'obbligo). (b) **`invitations_read_by_token` droppata**: aveva `USING(true)` SELECT a public → anon leggeva tutti gli inviti; non usata da alcun flusso (head coach via `invitations_head_coach`; accept via RPC SECURITY DEFINER). **Lasciate volutamente anon** (documentato): `lookup_athlete_by_code`+`link_athlete_auth` (login atleta pre-auth), `is_coach` (helper dentro le policy RLS, revocarlo le romperebbe), `accept_team_invitation` (auto-protetta su `auth.uid()`, non trapela dati, UX migliore per link aperto da sloggato). Verifica (anon key reale): `ensure_coach_profile`/`get_team_coaches` → **401**, `SELECT coach_invitations` → **0 righe**, `lookup_athlete_by_code('TOTTI')` → OK; advisors `anon_security_definer` **6→4** (i 4 residui = quelli accettati by-design). Nessun deploy client. 
- **Rimasto (non bloccante, by-design o dashboard)**: i 4 `anon_security_definer` + 6 `authenticated_security_definer` residui sono intenzionali (login atleta, helper policy, RPC coach legittime); toggle dashboard (leaked-password protection in Auth, `pg_net` fuori da `public`); `duration`/`reminder_config` RLS-no-policy = deny-all corretto. **Riepilogo sessione audit DB**: 4 migration applicate (P2+P4+P5, P1 drop insicure, P3 ×2) + smoke test atleta automatizzato in `tests/smoke_athlete_login.py`. Superficie `anon` ora deny-by-default su tutti i dati sensibili.

**Esporta scheda PDF — round 2 rifiniture + v7.08 (2026-10-07)**
- Contesto: il coach ha visto il redesign (round 1, v7.07 live) e ha chiesto una seconda passata d'uso/estetica. Modifiche (sola `exportProgramPDF()` in `app.js`, scelte confermate via AskUserQuestion):
  - **Superset senza lettera**: chip solo "SUPERSET" (niente A/B/C); colore stabile per `groupId` mantenuto; rimossa la legenda a lettere (`ssMeta`→`ssColor`).
  - **Divisione split più chiara**: titolo seduta su **barra piena colore accento** (`background:${accent}`, testo bianco) + più spazio tra sedute → gerarchia Blocco (scuro) › Seduta (accento) › sezione (muted).
  - **Nuova colonna "W-up"** (serie di avvicinamento = `wset`): la colonna **Sets** ora mostra un solo numero (basta "2+4").
  - **Carico autoregolato = "—"** (non più "auto"); legenda footer aggiornata (`"—" = autoregulated`).
  - **UI del documento tradotta in inglese** (W-up/Sets/Reps/Load/RIR/RPE/TUT/Rest, Warm-up/Workout/Cool-down, Weeks, Mesocycle/Phase/Duration/Goal, Coach notes, Print / Save PDF, CIRCUIT, superset "back-to-back, rest after the round", `lang="en"`, title "Program — "); **restano in italiano** le `note` esercizio, i valori-dato (`sessType`, nomi blocco/meso) e i `toast` dell'app.
- Estetica rifinita con skill **`impeccable`** (barra-seduta, ritmo verticale, 9 colonne su A4). Detector: i soli findings sono white-on-orange delle barre-seduta (linguaggio CTA brand, scelta confermata dal coach) + 10-10.5px caption print (come round 1) → lasciati.
- Verifica: `node --check` OK; harness Node sulla funzione reale + dati reali di Ernest + screenshot Playwright: SUPERSET senza lettera, 9 colonne EN, Sets a numero singolo (hip thrust: W-up 2 / Sets 4), Load "—", barre-seduta accento, note IT intatte, onda/filtro-blocco ancora corretti.
- **DEPLOYATO**: bump **7.07→7.08** (sw/asset/package) + build:web (`www/`), commit su `main` (+ branch `feat/ios-native-shell`), `vercel --prod`, verifica live su `coach-os-lime.vercel.app`.

**Redesign "Esporta scheda PDF" — `exportProgramPDF()` (2026-10-07)**
- Contesto: provata su Ernest, la vecchia export produceva un documento confuso. Diagnosi verificata sui dati reali del DB: la funzione iterava `sch.sessions` come **lista piatta** ignorando `sch.blocks`/`blockId` → i 2 blocchi di Ernest (`Forza→Potenza` w1-2, `Potenza/RFD` w3-8) si fondevano (ed entrambi hanno una seduta "POTENZA" e una "RINFORZO" → sembravano duplicati mescolati); nessuna divisione warmup/allenamento (benché `section:"warmup"` esista); mancava la colonna **TUT** (il campo `tut` esiste e in alcune sedute ha valori reali tipo `4-2-x-1`); l'intensità è memorizzata come **`rir`** non `rpe`; i **superset** (`type:"superset"`+`groupId`) uscivano come righe slegate; la `progression` veniva stampata come stringa compressa `W1: 4x5@0kg` (con `kg:0` → `@0kg`, sembra un bug); i bottoni video usavano `onclick="openVideoModal()"` **rotto nel popup**.
- **Decisioni col coach (AskUserQuestion)**: intensità = **RIR + RPE (10−RIR) + TUT** (3 colonne); onda = **mini-tabella per settimana**; motore estetico = **skill `impeccable`**.
- **Fix (riscritta solo `exportProgramPDF()` in `app.js`, nessun tocco a DB/backend)**:
  - Raggruppa per **blocco** (`sch.blocks` ord. per `weekStart`, filtro `s.blockId===block.id`) con fascia-intestazione scura (nome + "Settimane W–W"); la fascia è soppressa se il blocco è unico (schede legacy via `ensureBlocks`).
  - Ogni seduta divisa in **sotto-sezioni** per `section`: Riscaldamento / Allenamento / Defaticamento (header solo se non vuota).
  - **Superset** = esercizi consecutivi con stesso `groupId` → wrappati in `<tbody class="grp">` (page-break-safe) con **tinta di sfondo + chip "SUPERSET A/B…"** (palette print-safe di 6 colori, assegnata stabilmente per `groupId`; i finti-superset a membro singolo cadono a riga normale). Niente border-left spesso (craft-floor).
  - Colonne `Esercizio · Serie · Reps · Carico · RIR · RPE · TUT · Rest` (mono IBM Plex + `tabular-nums` sui dati). Carico `0` → "auto"; RPE = `10−RIR` (`—`→`—`); `wset` mostrato come `2+4`.
  - **Onda** = mini-tabella sotto il nome, **filtrata alle settimane assolute del blocco** (block A→W1-2, block B→W3-8); niente più `@0kg`.
  - Video = veri `<a href>` a YouTube (SVG play, non emoji). Brand **white-label** (`appState.brandColor/Name/LogoUrl`). CSS print A4 (`@page`, `print-color-adjust:exact`, page-break su seduta/gruppo). Legenda a piè pagina (auto/RIR/RPE/TUT + chip superset). Font self-hosted `/fonts/fonts.css` via `location.origin` (popup è `about:blank`).
- **Verifica**: `node --check` OK. Harness Node che esegue la **funzione reale estratta da app.js** sui dati reali di Ernest (8 sedute/2 blocchi) + screenshot Playwright: 2 fasce-blocco, 8 sedute, sezioni warmup/allenamento, 15 superset colorati (conteggio atteso esatto), 6 mini-tabelle onda con filtro settimane corretto (A=W1-2, B=W3-8, scarico W6 presente), colonne RIR/RPE/TUT con TUT reali, carico "auto", link video reali, 0 `@0kg`, 0 `openVideoModal`. Detector `impeccable`: dopo fix i soli residui sono 10-10.5px functional text (standard per A4 di stampa, coerente con la scala caption dell'app) e white-on-orange del **bottone CTA solo-schermo** (nascosto in stampa, linguaggio brand preesistente); corretto anche l'outline heading (sedute → `h2`).
- **NON deployato** (come da prassi). **Prossimo passo**: smoke su telefono vero (export reale da coach + da atleta), poi al deploy bump `sw.js`/`index.html` `V` e `vercel --prod`. Piano in `~/.claude/plans/radiant-dancing-kettle.md`.

> Sessioni 2026-10-05 (audit legale/compliance + fix GDPR prima fase; redesign lato coach v7.04→v7.05) → `.claude/PROGRESS_ARCHIVE.md`

---

## Prossimo passo — roadmap

### ⚖️ Follow-up legali/compliance (DA FARE PRIMA DI RIATTIVARE LA VENDITA)
> Contesto: audit legale 2026-10-05 → prima fase fix **deployata in prod (v7.06)**. Queste sono le voci **non-tecniche** rimaste, fuori dal controllo del codice. Finché non sono chiuse, i piani a pagamento restano "IN ARRIVO" e il checkout Stripe è disabilitato.
1. **P.IVA + dati fiscali** (BLOCCANTE per vendere): aprire P.IVA, poi pubblicare denominazione, indirizzo/sede, P.IVA ed eventuale REA nei footer + in `terms.html` (c'è già un placeholder "dati fiscali da inserire"). Senza, vietato vendere con continuità (D.Lgs. 70/2003 art. 7; D.P.R. 633/1972).
2. **Riattivazione vendita** (dopo P.IVA): creare i prodotti su **Stripe** e sostituire i price ID placeholder `price_XXX` in `billing.js`; riattivare i CTA (landing + modal upgrade); rimuovere i badge "IN ARRIVO"; aggiungere al checkout "rinnovo automatico, IVA inclusa, recesso 14gg".
3. **Validazione legale** (consigliata prima del go-live): far rivedere a un legale/consulente privacy `terms.html`, `privacy.html` e l'impianto **consenso art. 9** (dati salute); far validare la parte fiscale da un commercialista.
4. **Claim marketing** (continuo): mantenere la tabella comparativa landing **generica** (niente brand/prezzi di terzi non verificabili); se un domani si cita un concorrente, serve dato datato e verificabile (D.Lgs. 145/2007).
5. **Recensioni** (quando arriveranno): pubblicare solo recensioni reali e verificabili (obbligo autenticità, D.Lgs. 26/2023 — Omnibus).
6. **Accessibilità** (se cresci / EAA): rientrano i ~200 low-contrast preesistenti di `index.html` e la navigazione da tastiera (controlli `div onclick` → `button`). Non bloccante ora, obbligatorio oltre certe soglie (Dir. UE 2019/882, WCAG 2.1 AA).

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
