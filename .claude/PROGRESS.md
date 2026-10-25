# PROGRESS

> Storia completa fino al 2026-10-13 → `.claude/PROGRESS_ARCHIVE.md`

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
- Schermata live allenamento con pallini set completati (tap + swipe) — vista anteprima/overview
- **Focus Mode** (START → full-screen, un esercizio alla volta): pager scroll-snap che riusa le card già renderizzate; pallini progresso globali + timer durata totale in alto; nav Indietro/Avanti (→ Fine Allenamento sull'ultimo)
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

**Schermata Sessione — da scheda interattiva a SOLA anteprima (2026-10-25)**
- Contesto: la schermata "Sessione" che l'atleta vede **prima** di "▶ Inizia allenamento" mostrava le card complete (pallini serie tappabili, bottone START REST + timer, input "Prossimo carico", volume "0 kg", grafico settimanale) e sotto la lista le KPI (VOLUME TOTALE / E1RM MAX / MAX E1RM DOM-NDOM), il grafico "EVOLUZIONE E1RM" e il bottone "Fine Allenamento" — tutti a `0`/vuoto prima di iniziare = rumore, e card troppo alte. Il coach vuole che questa schermata sia **solo anteprima** ("cosa farò"): l'allenamento vero (e la chiusura) avviene in **Focus Mode**.
- **Decisioni col coach (AskUserQuestion + iterazioni)**: pallini → **togliere** dall'anteprima; KPI+grafico+Fine → **togliere** dall'anteprima; video → **tenere**. Recupero → spostato **in coda alla riga serie×reps•kg** (`· Rec m:ss`), non più riga a sé. RAMPING → **tolto anche dall'anteprima** (all'atleta non serve prima di iniziare; risparmia spazio) — resta solo in Focus.
- **Vincolo chiave**: anteprima e Focus **riusano le stesse card** (`startFocus()` sposta `#lv-exs` in `#focus-stage`) → NON si cancella markup; si sfrutta il pattern CSS già esistente di `.ax-wk-chart`: **default = anteprima (nascondi), `.focus-stage …` = Focus (ripristina)**. La specificità regge perché `.focus-stage X` ha una classe in più del default `X` (⚠️ non usare `#lv-exs …` nel default: l'id vincerebbe sul `.focus-stage` anche in Focus). Verificato: `focusNext()` sull'ultima card fa `exitFocus(); endWorkout()` (`workout.js:3093`) → chiudere da Focus funziona già; `endWorkout()` legge `#lv-vol.textContent` (`:2744`) → le KPI vanno **nascoste ma NON rimosse dal DOM**.
- **Modifiche**: `styles.css` — toggle anteprima/Focus: `.ax-dots` default `display:none` + `.focus-stage .ax-dots{display:flex}`; `.ax-nextload` idem; `#hint-lp-first` idem; `.ax-ex-vol{display:none}` (mai più utile); **recupero accorpato alla riga serie×reps•kg** in anteprima (nuovo `<span class="ax-meta-rest">· Rec m:ss</span>` in coda alla `.ax-ex-meta`, calcolato dallo stesso `totalSeconds`/`formatTime` del timer; "· No rest" se linkedToNext) con `.ax-rest-row{display:none}` in anteprima e ripristino `.focus-stage .ax-rest-row{display:flex}` (il bottone START REST resta solo in Focus) + `.focus-stage .ax-meta-rest{display:none}`; **RAMPING** nascosto in anteprima (`.ax-ramp{display:none}` + `.focus-stage .ax-ramp{display:block}`); compattazione `.ax-ex` padding `16px→12px 14px` con `.focus-stage .lv-card .ax-ex{padding:16px}`. `workout.js` — rimossa la Tip card "Tap sul pallino…" in `loadLive()` (anteprima non interattiva; la guida long-press resta per-card in Focus via `#hint-lp-first`); `cardMargin` standalone `12px→8px` (Focus azzera via CSS). `index.html` — `.g4` KPI grid, card grafico "Evoluzione E1RM" e bottone "Fine Allenamento" dentro `#p-sessione` → `display:none` (nodi tenuti per `endWorkout`/`renderE1rmChart`).
- **Verifica (Playwright/Chromium reale, 390×844, vero `styles.css` via fixture `tests/_preview_vs_focus.html` — card in due contesti: fuori e dentro `.focus-stage`)**: `node --check workout.js` OK. **Anteprima**: `getComputedStyle` → `.ax-dots`/`.ax-rest-row`/`.ax-nextload`/`.ax-ex-vol`/`#hint-lp-first`/`.ax-wk-chart`/`.ax-ramp` = `none`; `.ax-meta-rest` `inline` e la riga meta legge **"4×8-10 • 110kg · Rec 1:30"**; meta/params/cue/nome/video visibili; `.ax-ex` padding `12px 14px`. **Focus**: tutti ripristinati (`.ax-dots` flex, `.ax-rest-row` flex con START REST, `.ax-ramp` block, `.ax-wk-chart` block, padding `16px`), `.ax-meta-rest` = `none`. Screenshot `tests/preview_vs_focus.png` (cattura successiva in timeout 5s sul wrapper MCP — ambientale già noto; verifica via asserzioni DOM). (Gotcha: `styles.css` va ricaricato con cache-buster — il browser cache-ava la versione precedente dando falsi negativi.)
- **Follow-up fuori ambito**: valutare di spostare il grafico "Evoluzione E1RM" in **Progressi** invece di solo nasconderlo.
- **NON deployato**: in attesa di approvazione del coach nell'app prima di bump versione + `build:web` + commit + `vercel --prod`.

**Focus Mode — frecce nav da Unicode a SVG (centraggio perfetto) (2026-10-25)**
- Contesto: dopo v7.28 (bottoni uguali + frecce 40px) il coach ha notato che le frecce "non sono al centro del bottone". **Diagnosi misurata (Playwright, canvas `measureText`)**: il box riga era centrato (offset ~0), ma il **glifo** Unicode `→/←` cade sull'asse matematico del font (ink center ~14px sopra la baseline, come una maiuscola) → ~1.4px sotto il centro ottico su Chromium e potenzialmente di più col fallback di sistema su iOS. Centraggio dipendente dal font/device.
- **Fix (device-independent): freccia SVG geometrica** al posto del carattere. `index.html` (2 bottoni statici) + `workout.js` (`updateFocusChrome`, ramo non-ultimo) → `<svg class="fnav-arw" viewBox="0 0 24 24" fill="none"><path d="M4 12h16"/><path d="M13 5l7 7-7 7"/></svg>` (destro) / `M20 12H4`+`M11 5l-7 7 7 7` (sinistro), disegnata simmetrica attorno a (12,12). `styles.css` `.fnav-arw` → da `font-size:40px` a `width/height:34px; display:block; stroke:currentColor; stroke-width:2.5; linecap/linejoin round` (currentColor = colore del bottone: testo chiaro su Indietro, accent-ink su Avanti). "✓ Fine Allenamento" invariato (testo).
- **Verifica (Playwright, vero `styles.css`+markup via fixture aggiornato, device 390px)**: entrambi i bottoni → ink bbox `getBBox` centro **(12,12)** = centro viewBox; SVG centrato nel bottone (`dx=dy=0`) su **entrambi gli assi**; size 34×34; stroke `currentColor` corretto (prev `rgb(230,233,237)`, primary `rgb(26,12,2)`). `node --check workout.js` OK. (Gotcha: il fixture HTML va ricaricato con cache-buster — `getBBox`/`querySelectorAll('path')` davano vuoto sulla versione cache precedente.)
- **DEPLOYATO v7.29 (2026-10-25)**: bump 7.28→7.29, build:web, commit su `main`, `vercel --prod`.

**Focus Mode — bottom nav: frecce uguali e più grandi (2026-10-25)**
- Contesto (screenshot coach): i due bottoni nav in fondo alla Focus Mode erano di larghezza diversa (Indietro `flex:0 0 40%`, Avanti `flex:1 1 auto` → il destro molto più largo) e le frecce (30px) sembravano piccole/sproporzionate.
- **Fix (`styles.css` + `workout.js`)**: entrambi i bottoni `flex:1 1 0` → larghezza uguale; `.fnav-arw` 30→**40px**. `box-sizing:border-box` sulla regola condivisa + `border:1px solid transparent` sul primario (il bordo 1px dell'Indietro, prima in content-box, spostava 2px → ora geometria simmetrica, larghezze identiche). Sull'**ultimo esercizio** il primario ha testo "✓ Fine Allenamento": nuova classe `.focus-primary.is-final{flex:1.8 1 0}` (più largo = azione terminale prominente + spazio al testo) togglata in `updateFocusChrome` (`prim.classList.toggle('is-final', isLast)`).
- **Verifica (Playwright, vero `styles.css` via fixture, device 390px)**: stato freccia → `prevW===primW===176` (equalWidth, stessa altezza), arrow `font-size:40px`; stato ultimo → "✓ Fine Allenamento" su **una riga** senza overflow (prim 225 / prev 127 px). `node --check workout.js` OK. (Screenshot `tests/focus_nav_equal.png` non catturato: wrapper screenshot MCP in timeout 5s — ambientale; verifica via asserzioni DOM.)
- **DEPLOYATO v7.28 (2026-10-25)**: bump 7.27→7.28, build:web, commit su `main`, `vercel --prod`.

**Focus Mode — schermata di transizione "3-2-1 · VIA" all'avvio (2026-10-25)**
- Contesto: il coach voleva uno stacco mentale tra "sfogliare la scheda" (anteprima) e "allenare" (Focus Mode), stile TrainHeroic/Hevy: al tap di "▶ Inizia allenamento" un breve countdown prima di entrare nella prima card.
- **Vincolo chiave**: `startFocus()` NON parte sempre da zero — riusa il timestamp `coachOS_focus_start` e atterra sulla prima card incompleta (rientro anti-crash a metà sessione). Un countdown ad ogni ingresso sarebbe fastidioso → mostrarlo **solo all'avvio vero**, saltarlo al rientro.
- **Decisioni col coach (AskUserQuestion)**: (1) solo avvio fresco; (2) ~3s con **tap per saltare**; (3) nessun beep sui numeri, **beep + vibrazione solo sul "VIA"**; (4) contenuto minimale (eyebrow "Si parte" + numerone 3→2→1→VIA).
- **Modifiche**: `index.html` — nuovo layer `#focus-countdown` (eyebrow `.focus-cd-eyebrow` + `#focus-cd-num` + hint `.focus-cd-skip`) come ultimo figlio di `#focus-ovl`. `workout.js` — `startFocus()` rifattorizzata: `unlockAudio()` in testa (user gesture → beep recupero su iOS); `_focusTimerStart()` spostato **dopo** il countdown (il timer totale si ancora sul VIA, non al tap) nel ramo `fresh`, immediato nel ramo rientro; nuove `_focusCountdown(onDone)` (sequencer `setTimeout` 3→2→1→VIA 820ms+480ms, ri-trigger animazione pop ad ogni numero, tap-to-skip via `pointerdown {once}`, guard `_focusCdRunning` per idempotenza) e `_focusGoSound()` (beep secco 880Hz ~180ms + `vibrate(90)`, più leggero del triplo `playTimerEndSound`); `fresh = !localStorage.getItem(LK_FOCUS_TS) && firstInc===0`. `styles.css` — blocco `.focus-cd` (absolute inset:0 z-index:20 dentro l'overlay, radial-gradient, safe-area, centrato) + `.focus-cd-num` (IBM Plex Mono 800, clamp(84,34vw,160)px, tabular, `.go`→`--accent`) + keyframe `cdPop`. `main.js` **invariato** (skip = listener interno, nessun nuovo export).
- **Verifica (Playwright/Chromium reale, 430×920, vero `styles.css` via `tests/_focus_preview.html` aggiornato)**: `node --check workout.js` OK; nessun `_focusTimerStart` duplicato. **Layout**: layer copre tutto il device, z-index 20, numero centrato X/Y, IBM Plex Mono 800 146px tabular, **colore accento sul VIA** (`oklch(0.76 0.16 52)`=`--accent`), eyebrow muted. **Logica (vero sorgente slice, stub conta-beep)**: sequenza `['3','2','1','VIA']`, `_focusGoSound` chiamato **1 volta** sul VIA, `onDone` 1 volta, ~2950ms (≈3s), layer `hidden`+`aria-hidden=true` a fine. **Skip**: tap su "3" → `onDone` **1 sola volta** (guard idempotenza regge sui timeout residui), 0 beep (saltato prima del VIA), uscita immediata (~452ms), layer nascosto. Screenshot `tests/focus_countdown_iphone.png`. (Path autenticato completo non esercitato — logica di render card invariata.)
- **Nota design-hook**: 3 segnalazioni (`low-contrast` ×2, `dark-glow`) tutte sul **fixture** `tests/_focus_preview.html`, rispecchiano stili già spediti (`--muted` come `.focus-sub`, glow del `.focus-primary`) → lasciate in piedi.
- **DEPLOYATO v7.26 (2026-10-25)**: bump 7.25→7.26, build:web, commit `1ef6150` su `main`, `vercel --prod` → READY. Verifica live `coach-os-lime.vercel.app`: `sw.js`→`v7.26`, `var V='7.26'`, markup `#focus-countdown`, `_focusCountdown` in workout.js, `.focus-cd-num`/`cdPop` in styles.css ✓.
- **Fix v7.27 (2026-10-25) — il coach non vedeva il countdown da cellulare**: causa = rilevamento "fresh" fragile. `fresh` era `!localStorage.getItem('coachOS_focus_start') && firstInc===0`, ma quel timestamp si azzera **solo** con "Fine Allenamento" (`_focusTimerStop(true)` in `endWorkout`). Dopo decine di aperture della Focus Mode nei test v7.21→v7.25 **senza chiudere la sessione**, il timestamp era stantio → `fresh=false` → countdown saltato per sempre (stessa radice del bug già noto "timer riparte da ore prima"). **Fix** (`workout.js` `startFocus`): `fresh` ora = **nessuna serie di lavoro completata** nella sessione (`!list.some(c => c.querySelector('.dot.done:not(.warm)'))`), indipendente dal timestamp; quando fresh, `localStorage.removeItem(LK_FOCUS_TS)` prima del countdown così il timer totale riparte dal VIA (sistema anche il bug del timer stantio). **Verifica (Playwright, markup reale fixture)**: 0 serie done → fresh=true (countdown); 1 serie done → fresh=false (nessun countdown). `node --check` OK; selettore coerente con `_focusCardDone`/`clearLiveRecovery`. **DEPLOYATO v7.27**: bump 7.26→7.27, build:web, commit su `main`, `vercel --prod`.

**Focus Mode — rimossi pallini warm-up + hint a sinistra + nav solo frecce (2026-10-25)**
- Contesto: dopo v7.23 il coach ha chiesto 3 rifiniture alla card Focus Mode: (1) togliere i pallini **warm-up** (quelli con la "W") perché ridondanti con la tabella RAMPING e rubano spazio ai pallini delle serie allenanti; (2) la scritta "✎ tieni premuto per registrare rep/kg reali" era allineata a destra → **a sinistra**; (3) i bottoni "← Indietro"/"Avanti →" → **solo frecce** (via le parole) con freccia **più grande**.
- **Decisione col coach (AskUserQuestion)**: sull'**ultimo esercizio** il bottone a destra **resta "✓ Fine Allenamento" con testo** (azione terminale; evita chiusure accidentali). Solo i normali Indietro/Avanti diventano frecce.
- **Modifiche**: `workout.js` — rimosso il loop dei pallini warm (`<div class="dot warm" id="wd-...">W</div>`, prima a riga ~753): ora `.ax-dots` mostra solo le serie allenanti (il conteggio `dotsTotal/dotsDone` diventa più corretto; RAMPING a riga ~835 è indipendente, invariato); hint `#hint-lp-first` inline `text-align:right`→**`left`**; `updateFocusChrome` ramo non-ultimo → `'<span class="fnav-arw">→</span>'` (ultimo invariato = "✓ Fine Allenamento"). `index.html` — bottoni `focus-prev`/`focus-primary` ridotti alla sola freccia `.fnav-arw` + `aria-label` Indietro/Avanti. `styles.css` — `.fnav-arw{font-size:24px;line-height:1;font-weight:700}`.
- **Verifica (Playwright/Chromium reale, 390×844, vero `styles.css` via `tests/_focus_preview.html` aggiornato)**: `node --check workout.js` OK; grep → 0 loop warm residui; `.dot.warm`=0 e 4 pallini lavorativi presenti; `#hint-lp-first` `text-align:left`; bottoni = solo `←`/`→` senza parole, `.fnav-arw` 24px, `aria-label` presenti. (Screenshot in timeout sul wrapper MCP — ambientale; verifica via asserzioni DOM.)
- **DEPLOYATO v7.24 (2026-10-25)**: approvato dal coach. Bump 7.23→7.24 (`sw.js`+`index.html`+`package.json`), `npm run build:web` (38 file), commit su `main`, `vercel --prod`.

**Focus Mode — icona cronometro (timer totale + rest) + bottone "START REST" (2026-10-25)**
- Contesto: dopo v7.22 un atleta ha segnalato che il bottone **START** arancione al centro della card, guardato di fretta, sembra avviare *l'allenamento* e non il *recupero*. Il coach ha chiesto: (1) icona timer accanto al **timer totale** in alto a destra (`#focus-timer`) e nella **riga rest**; (2) riordinare la riga rest in `[START REST] · tempo · ⏱` con "REST" assorbito nel bottone; (3) icona **SVG vera**, non emoji.
- **Decisioni col coach (AskUserQuestion)**: icona = **cronometro** (monoline come la sidebar); rifinitura **"rest in corsa"** = **sì** (tempo arancione mentre scorre).
- **Modifiche**: `index.html` — nuovo simbolo sprite `#ic-timer` (cerchio + stem/crossbar + pulsantino + lancetta, `currentColor`, coerente con le 13 icone esistenti); icona `.focus-timer-ic` aggiunta come **fratello** dopo `#focus-timer` (non dentro: `_focusTick` aggiorna via `textContent`). `workout.js` — `restTimerHtml` riordinato (rimosso `.ax-timer-l`, ordine **button → display → icona `.ax-timer-ic`**), bottone iniziale "START" → **"START REST"**; label coerente anche nei 3 reset/fine del timer rest (`_autoStartRestTimer`, reset e fine countdown) → "START REST" (resta "RESET" in corsa). `styles.css` — stile icone `.focus-timer-ic`/`.ax-timer-ic` (`fill:none; stroke:currentColor; 1.7`); rifinitura `.is-athlete .timer-running .timer-display{color:var(--accent)!important}`.
- **Verifica (Playwright/Chromium reale, 390×844, vero `styles.css` via `tests/_focus_preview.html` aggiornato)**: `node --check workout.js` OK; simbolo `#ic-timer` presente; icona top = fratello dopo `#focus-timer`, a destra del tempo, renderizza (`fill:none`, stroke muted); riga rest ordine `button→display→icon`, testo "START REST", `.ax-timer-l` assente, icona rest renderizza; rest in corsa → `.timer-display` da bianco a `oklch(0.76 0.16 52)`=accent. (Screenshot `tests/focus_timer_icon_iphone.png` non catturato: wrapper screenshot MCP in timeout 5s — ambientale; verifica via asserzioni DOM.)
- **DEPLOYATO v7.23 (2026-10-25)**: approvato dal coach. Bump 7.22→7.23 (`sw.js`+`index.html`+`package.json`), `npm run build:web` (38 file), commit su `main`, `vercel --prod`.

**Focus Mode — barra inferiore nascosta + testi card più grandi (2026-10-25)**
- Contesto: il coach ha provato la Focus Mode da cellulare (profilo atleta) e segnalato via screenshot due problemi: (1) i pulsanti **Indietro/Avanti** in fondo erano **coperti dalla tab bar atleta**; (2) nome esercizio, serie×reps e kg **troppo piccoli**.
- **Causa barra (verificata)**: `.bottom-bar` ha `z-index:99999 !important` (`styles.css:314`) > overlay `.focus-ovl` `z-index:9000` → la barra stava sopra l'overlay. Fix come chiesto dal coach: **nasconderla in Focus Mode**. La classe `body.focus-lock` è già messa da `startFocus()` e tolta da `exitFocus()` → **solo CSS**: `body.focus-lock .bottom-bar{display:none!important}` (ricompare da sola all'uscita, zero JS).
- **Font (scelta coach via AskUserQuestion = "Moderato")**: override scoped a `.focus-stage` (nessun effetto su anteprima/analytics): nome `.ax-ex-name` 18.5px→**21px**; riga `.ax-ex-meta` →**15px**; kg `b.ax-load` →**17px**. Il **kg** (dato su cui agisce l'atleta) reso il più prominente: il colore inline del `<b>` (`workout.js:929`) è stato convertito in **classe** `ax-load` (+ `autoreg` se target autoregolato) così lo gestisce il CSS: default bianco (`--text`), **ambra** (`--amber`) se autoreg (segnale mantenuto), **arancione** (`--accent`) in Focus Mode quando non autoreg. Anteprima invariata.
- **Verifica (Playwright/Chromium reale, 430×920, vero `styles.css` via `tests/_focus_preview.html` aggiornato)**: `node --check workout.js` OK; barra `display:none` con `.focus-lock` e `flex` senza (exit) → pulsanti non più coperti; font nome=21 / meta=15 / kg=17; kg in focus non-autoreg=`oklch(0.76 0.16 52)`=accent, autoreg=`oklch(0.82 0.13 88)`=amber, anteprima=text + 12.5px (invariato). (Screenshot `tests/focus_mode_v3_iphone.png` non catturato: wrapper screenshot MCP in timeout 5s — ambientale, già visto; verifica via asserzioni DOM.)
- **Segnalato, fuori ambito**: timer totale `4:49:36` → `_focusTimerStart()` (`workout.js:3026`) riusa il timestamp `coachOS_focus_start` (anti-crash); se una sessione non viene chiusa con "Fine Allenamento" riparte da ore prima. Da valutare in sessione dedicata.
- **DEPLOYATO v7.22 (2026-10-25)**: approvato dal coach. Bump 7.21→7.22 (`sw.js`+`index.html`+`package.json`), `npm run build:web` (38 file), commit `946ea30` su `main`, `vercel --prod` → READY. Verifica live `coach-os-lime.vercel.app`: `sw.js`→`v7.22` ✓, `var V='7.22'` ✓, `styles.css` con `focus-lock .bottom-bar` + regole `ax-load` ✓, `workout.js` con `class="ax-load"` ✓.

**Focus Mode atleta — allenamento "un esercizio alla volta" (stile TrainHeroic/Hevy) (2026-10-24)**
- Contesto: la schermata Sessione atleta (`#p-sessione`, `loadLive()` in `workout.js`) mostrava **tutti** gli esercizi come lista scrollabile — buona come anteprima, dispersiva durante l'allenamento. Il coach ha chiesto un bottone **START** che apra una vista full-screen con **un esercizio alla volta**, pallini di progresso + **timer durata totale** in alto, nav tra esercizi in basso, mantenendo TUTTI i calcolatori esistenti (serie/reps/carico, **TUT/RPE/RIR, note coach**, e1RM/PR, tecniche, ramping, autoregolazione, timer recupero). ⚠️ Nota: `PROGRESS.md` dichiarava una "Focus Mode" già esistente — **non c'era nel codice**; ora è reale.
- **Decisioni col coach (AskUserQuestion)**: (1) pagine focus = **tutti** gli elementi (warm-up + centrali + circuiti + cooldown); (2) **full-screen con ← per tornare all'anteprima** (allenamento in corso non si perde); (3) bottone centrale: il coach lo voleva per "avanti" → risolto senza doppioni con nav **Indietro / Avanti →** (Avanti sull'ultimo = **✓ Fine Allenamento**) + **timer recupero reso sezione prominente** dentro la card.
- **Approccio — riuso, zero duplicazione**: la Focus Mode è un **pager CSS scroll-snap sopra le card già renderizzate** da `loadLive()` + un controller JS sottile. `startFocus()` **sposta** il nodo `#lv-exs` (listener intatti) in `#focus-stage` e applica `focus-on`; il CSS trasforma `#lv-exs` in carosello orizzontale (1 card = 100%), nasconde header di fase/prog-header/tip (`> *:not(.lv-card)`). Pallini/log/timer/e1RM funzionano identici (nessun tocco alla logica).
- **Modifiche**: `workout.js` — in `loadLive()` ogni card riceve `class="lv-card"` + `data-ex-idx/ex-name/phase` (normali **e** circuiti); nuove `startFocus/exitFocus/focusNext/focusBack/focusGoTo/updateFocusChrome` + **timer totale** (timestamp in `localStorage` `coachOS_focus_start`, tick 1/s, anti-crash come il recovery); hook: `updateLiveTotals` chiama `updateFocusChrome()` (pallini globali: card piena = tutti i `.dot:not(.warm)` done) e, a sessione completa, **ferma il cronometro + prefilla la durata** del Post-Workout log (`#pw-dur` + `calcSrpe`); `endWorkout()` ferma/azzera il timer + `exitFocus()`. `index.html` — bottone **"▶ Inizia allenamento"** (`#lv-start`) + card rinominata "Anteprima allenamento"; overlay `#focus-ovl` in fondo al body (top bar close·pips·timer, `#focus-stage`, bottom nav). `styles.css` — blocco `.focus-ovl` (pager scroll-snap, barre fisse con `env(safe-area-inset-*)`, `100dvh`, pips `.fdot`, timer recupero prominente, press `:active`, hover gated `@media (hover:hover)`). `main.js` — import + `window` delle 6 funzioni.
- **Verifica (Playwright, Chromium reale, source :8791, 390×844)**: `node --check workout.js/main.js` OK; 6 funzioni su window; con sessione sintetica 3 esercizi (completo/parziale/vuoto): `startFocus` → overlay on, `#lv-exs` spostato in stage, 3 pagine, header-fase `display:none`, body-lock, **atterra sulla prima card non completata** (idx1), pips `[done,·,·]`, sub "Esercizio 2/3", **timer che avanza** (0:46); completando una card il pip si riempie; `focusNext` → idx2 + primario "✓ Fine Allenamento"; `focusBack` ×n → idx1→idx0→**exitFocus** (overlay off, unlock, `#lv-exs` ripristinato nella card); **0 errori/0 warning** console. Screenshot `tests/focus_mode_iphone.png`. (Path autenticato completo — login + scheda reale — non esercitato; la logica di render card è invariata.)
- **Skill usata**: `mobile-native` (safe-area, `100dvh`, scroll-snap, no tap-highlight, `touch-action`, `:active`).
- **Iter 2 — arricchimento card su richiesta coach (2026-10-24)**: il coach ha visto la Focus Mode nell'app e chiesto di usare lo spazio vuoto sotto "dando più aria ai dati". 4 aggiunte (tutte in `workout.js` `loadLive()` + helper nuovi + CSS):
  1. **Anteprima video inline** al posto del bottone ▶: nuovo `_videoPreviewHtml(ex)` (+ `_ytId`/`_ytThumb`) → thumbnail 16:9 (`img.youtube.com/vi/<id>/hqdefault.jpg`, `loading="lazy"`, `onerror`→`.no-thumb`) con overlay play + caption, sotto il nome e sopra il meta; tap → `openVideoModal` esistente. Rimosso `${videoBadge}` dall'header (var lasciata, dead-innocua). Vale in anteprima **e** focus.
  2. **Reps nei pallini** invece del numero di serie: ramo `else` dei dot ora usa `repCompact.meta` (es. "10"); i range (es. "8-10") già lo facevano; nuova classe `.dot.lbl-sm` (font 10.5px) per etichette >2 caratteri così "8-10" non deborda dal cerchio 44px.
  3. **Mini-grafico carico/settimana + e1RM** `_weeklyLoadChart(ex,currentWeek,sch,isVBT,isIso)`: **SVG a mano, NIENTE Chart.js** (coerente con l'ottimizzazione lazy di v7.19) — barre = carico programmato/settimana (dalla `progression` w1..wN, fallback base=w1), **linea** = e1RM stimato (`kg*(1+(reps+rir)/30)`), settimana corrente accentata, header con "1RM stim. ≈ X kg". Gated **focus-only** via CSS (`.ax-wk-chart{display:none}` + `.focus-stage .ax-wk-chart{display:block}`). Skip per VBT/isometrici. Inserito dopo ramping.
  4. **Ramping** invariato (confermato dal coach).
  - **Verifica (Playwright 390×844, algoritmi reali degli helper eseguiti in-page)**: thumbnail URL corretto da link `youtu.be`; bottone ▶ rimosso; pallini mostrano "8-10" con `.lbl-sm` (10.5px); grafico 4 barre + 4 marker, **1RM stim. ≈ 136 kg** (W3: 110×(1+7/30)=135.7 ✓), altezza 1ª barra 44.3 (100/140×62 ✓); **chart `display:none` in anteprima, `block` in focus**; video `aspect-ratio 16/9`. `node --check` OK. (Screenshot `tests/focus_mode_v2_iphone.png` non catturato: il tool screenshot MCP è andato in timeout ripetuto a fine sessione — ambientale, la cattura interna completava ma superava il limite 5s del wrapper; verifica fatta via asserzioni DOM.)
- **Iter 3 — rifinitura card su feedback coach (2026-10-24)**: visto il risultato nell'app, il coach ha chiesto 3 aggiustamenti (tutto in `workout.js` `loadLive()`/helper + `styles.css`):
  1. **Anteprima video ridotta e spostata**: da 16:9 a tutta larghezza → **compatta 116px** (solo un indizio "c'è un video"), e spostata **sotto** la prescrizione+parametri (prima era sopra il meta). `_videoPreviewHtml` + CSS `.ax-video-prev` (tolto il box-shadow glow, play 26px, caption "Video").
  2. **Riga parametri prominente** `.ax-params`: RIR · TUT · **RPE** come **chip** (etichetta mono piccola + valore 800 su `--e2`), al posto del grigetto in `.ax-ex-meta`. RPE prima **non era mostrato** nella card → ora letto da `ex.rpe` (o `progression[wN].rpe` se presente). Chip vuoti nascosti. La prescrizione `serie×reps • kg` resta la riga principale sopra i chip.
  3. **Grafico → dati REALI fatti** (decisione coach): **nuova persistenza** `donePerExercise[nome]={kg,reps}` (set di lavoro più pesante, esclusi warm-up/VBT) accumulata in `updateLiveTotals`, esposta su `window.liveDonePerExercise`, salvata nell'oggetto sessione in **entrambi** i path (auto-create in `updateLiveTotals` + `_saveAndSend` di `endWorkout`). Salvataggio **locale** (`saveDB`); cloud sync del campo = follow-up (serve colonna Supabase; `sessionCloudRow` è whitelist → nessun errore upsert). `_weeklyLoadChart` **riscritto**: barre = kg **fatti** per settimana (da `DB.sessions[].donePerExercise[nome]`, raggruppate per `week`, top set, ultime 6), valore kg sopra la barra + `W{n}` e `×{reps}` sotto, settimana corrente accentata; **empty-state** "I tuoi carichi appariranno qui dopo le prime sessioni"; skip VBT/iso; rimossa la linea e1RM (il coach ha scelto i dati reali). ⚠️ **Dato non retroattivo**: per gli atleti esistenti il grafico resta all'empty-state finché non completano sessioni (lo storico passato non è recuperabile).
  - **Verifica (Playwright 390×844, algoritmi reali in-page)**: chart su `DB.sessions` sintetiche → 3 barre W1 100×8 · W2 105×8 · W3 110×7, altre-atleta ignorate, empty-state senza storico, VBT skip, `display:block` in focus; card → 3 chip (RIR1/TUT 3-1-2/RPE8, valore 800, bg `--e2`), **video 116px** e **posizionato dopo i parametri**. `node --check` workout/main OK. Anteprima statica aggiornata in `tests/_focus_preview.html`.
- **Iter 3-bis — linea di tendenza + pulizia gerarchia (2026-10-24)**: il coach ha chiesto un parere onesto ("troppo confusionario? dati inutili?") + la linea di andamento nel grafico. (1) **Grafico**: aggiunta **polyline** che collega i top delle barre (markers `--text`, settimana corrente evidenziata dalla barra accent) → mostra l'andamento del carico. (2) Diagnosi gerarchia: i pallini (azione principale) erano sepolti sotto video/prossimo-carico/cue; proposti 3 trim, **tutti approvati** (AskUserQuestion): **(a)** `.ax-ex-vol` "0 kg" nascosto in focus (`.focus-stage .ax-ex-vol{display:none}` — resta in anteprima/analytics); **(b)** card riordinata → `nome → how-to → prescrizione → parametri → cue → **pallini + timer recupero** → [riferimento: video · ramping · grafico] → prossimo carico`; **(c)** "Prossimo carico" reso discreto (`.ax-nextload`, opacity .72, input stretto) e spostato in fondo. **Verifica (Playwright)**: vol `display:none` in focus, ordine parametri(2)→cue(3)→pallini(4)→timer(5)→video(6), nextload ultimo+opacity .72, pallini prima del video, polyline presente. `node --check` OK. `tests/_focus_preview.html` aggiornato (telaio iPhone 390×844 per proporzioni reali).
- **Iter 3-ter — layout definito dal coach (2026-10-25)**: il coach ha bocciato la versione precedente ("estremamente confusionario") e dettato ordine + stile esatti. **Ordine card** (dall'alto): nome esercizio → video → serie/rep → RIR·TUT·RPE → cue del coach → pallini → ramping → rest → prossimo carico → grafico. **Centratura**: contenuto card centrato in focus (`.focus-stage .ax-ex{text-align:center}` + `justify-content:center` sulle nuove wrapper `.ax-ex-head`/`.ax-dots`/`.ax-rest-row`/`.ax-params`/`.ax-nextload`; `.ax-cue`/`.ax-ramp` text-center). **RIR/TUT/RPE**: stessa riga **senza riquadro** (`flex-wrap:nowrap`), label muted + **valori in arancione** (`.ax-param-v{color:var(--accent)}`) — tolti box/bordo/sfondo. **Verifica (Playwright)**: ordine DOM = esattamente i 10 step richiesti; `text-align:center`; params `nowrap`+`justify-center`, valore colore `oklch(0.76 0.16 52)`=accent, `border-width:0`, item sulla stessa riga; dots centrati. `node --check` OK. `tests/_focus_preview.html` aggiornato (telaio iPhone).
- **DEPLOYATO v7.21 (2026-10-25)**: approvato dal coach dopo gli ultimi ritocchi (nome 18.5px + cue più ampio). Rimosso il codice morto della thumbnail video (`_ytId`/`_ytThumb`/`_videoPreviewHtml` + CSS `.ax-video-prev*`). Bump 7.20→7.21 (`sw.js`+`index.html`+`package.json`), `npm run build:web` (38 file, webDir Capacitor), commit `0a63045` su `main`, `vercel --prod` → READY. **Nota deploy**: Vercel serve la **root** del repo (non `www/`, che è solo la webDir Capacitor e non contiene `sw.js`). Verifica live `coach-os-lime.vercel.app`: `sw.js`→`v7.21` ✓, `var V='7.21'` ✓, `workout.js` con `startFocus`/`donePerExercise` ✓. **Follow-up opzionale**: colonna Supabase per sincronizzare `donePerExercise` sul cloud (ora solo locale).

> Sessioni dal 2026-10-19 in giù (redesign landing "Laboratorio/dati" v2, audit performance JS/PWA v7.19→v7.20, Macro Periodizzazione vista derivata + fase per-blocco, toggle promemoria wellness v7.15/v7.16, editor day-pills + header blocco, fix checkbox `.cbx` v7.17, fix cambio atleta editor v7.14; e prima: timer set a tempo, fix video iPhone, tecniche per-serie, audit mobile-native/Supabase, redesign PDF, fix login atleta, audit legale/GDPR, redesign coach v7.04→v7.05) → `.claude/PROGRESS_ARCHIVE.md`

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
