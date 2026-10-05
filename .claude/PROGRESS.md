# PROGRESS

> Storia completa fino a v7.01 → `.claude/PROGRESS_ARCHIVE.md`

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

**Audit legale/compliance + fix GDPR prima fase (2026-10-05)**
- Contesto: audit completo su 20 rischi legali (privacy/ToS/cookie/consensi/tracking/SDK/claim/accessibilità/business details) verificando il **comportamento reale** del codice vs le policy, non solo l'esistenza dei documenti. Risultato: la Privacy Policy esisteva ma era **contraddetta dal codice** (afferma "nessun cookie di profilazione" mentre embeddava YouTube `youtube.com/embed` + cookie referral); mancavano del tutto ToS, Cookie Policy/banner, consenso al signup e gestione art. 9 (dati salute: farmaci, infortuni, ciclo mestruale, HRV); business details incompleti (no P.IVA/sede) mentre la landing vende piani.
- **Fix implementati (NON deployato)**:
  - `workout.js:2384` → embed video via `youtube-nocookie.com` (niente cookie ads al render).
  - `index.html` → (1) checkbox consenso **non pre-spuntata** al first-time setup atleta (`#ath-setup-consent`, Privacy+ToS+≥14 anni); (2) checkbox consenso **esplicito art. 9** nello step finale onboarding (`#onb-health-consent`, dati salute); (3) **cookie banner** (`#cookie-banner`) con "Accetta tutti / Solo necessari" + script `window._cookieConsent` (localStorage `coachos_cookie_consent`); (4) link Termini/Cookie nel login card e nel footer coach.
  - `auth.js` → guard in `handleAthleteFirstTimeSetup` (blocca signUp senza consenso) e in `submitOnboarding` (blocca salvataggio dati salute senza consenso art. 9).
  - `landing.html` → cookie referral `coachos_ref` impostato **solo** dopo consenso "all" (prima partiva sempre); banner + link footer ToS/Cookie.
  - `privacy.html` v1.1 → §3 base giuridica art. 9(2)(a) + box disclaimer medico; §4 terze parti estese (Stripe/Google/jsDelivr/Cloudflare + nota wearable non attivi); §9 minori corretti **16→14 anni** (D.Lgs. 101/2018); §10 cookie riscritto (rimossa affermazione falsa, rinvio a Cookie Policy).
  - Nuovi: `terms.html` (disclaimer medico, recesso 14gg, legge IT/foro consumatore, pagamenti Stripe, nota P.IVA pre-vendita) e `cookie.html` (tabelle tecnici vs terze parti). Aggiunti a `sitemap.xml`.
- Verifica: `node --check` auth.js/workout.js OK; cross-check ID consenso definiti↔referenziati OK; 0 occorrenze residue di `www.youtube.com/embed`. Hook impeccable: i ~201 low-contrast di `index.html` + white-on-orange landing sono **preesistenti** (tema scuro/brand, già §12 audit), nessuno introdotto dai fix (banner/label usano colori ad alto contrasto o i colori-fratelli esistenti).
- **Claim marketing landing riscritti (stessa sessione)**: rimossi claim non verificabili ("usati dai migliori preparatori atletici" → "strumenti di sports science: ACWR/HRV/e1RM"; "centri sportivi di élite" → factual; "Wellness Tracking Superiore" → "Completo"). **Tabella comparativa resa generica** (scelta utente via AskUserQuestion): tolti i brand Volt/QuickCoach + prezzi inventati + "✓ AI"; ora CoachOS vs "App di schede generiche" vs "Excel/carta" + disclaimer "confronto indicativo". Soppresso `tiny-text` per `landing.html` (disclaimer 11px = scala caption preesistente della pagina). Verificato: 0 claim rischiosi residui.
- **Vendita disattivata — piani "in arrivo" (stessa sessione)**: su richiesta utente, piani a pagamento marcati **IN ARRIVO** finché non c'è P.IVA. Landing: Free resta CTA attiva ("Inizia gratis"), Pro/Team con badge "IN ARRIVO" + "prezzo indicativo"; CTA Pro → span disabilitato "In arrivo", Team → resta mailto "Contattaci" (contatto, non vendita); sottotitolo pricing riscritto. In-app `billing.js` modal upgrade: bottoni checkout Pro disabilitati ("in arrivo"), Team → mailto, nota "Pagamento sicuro via Stripe" → "I piani a pagamento sono in arrivo. Per ora il servizio è nel piano gratuito." Nessun path di checkout attivo nella UI (il bridge `window._billingCheckout` resta definito ma non più invocato). `node --check` billing.js OK.
- **Google Fonts self-hosted (stessa sessione)**: eliminato del tutto il trasferimento IP a Google per i caratteri. Scaricati i 10 woff2 (subset **latin**, che copre tutte le accentate italiane U+0000-00FF) da **Fontsource via jsDelivr** (gstatic.com è DNS-bloccato nell'ambiente; stessi font OFL/Apache) in `fonts/`: Archivo + Syne (variabili, weight-range), IBM Plex Mono 400/500/600, DM Mono 300/400/500 + italic, Bebas Neue 400 (~190KB totali). Generato `fonts/fonts.css` con `@font-face` locali + `fonts/_dl.txt` (manifest re-download). Sostituiti i `<link>` Google in `index.html` e `landing.html` con `/fonts/fonts.css`. SW invariato: `STATIC_EXT` già include `woff2?` → cache offline automatica same-origin. Aggiornati privacy.html §4/§10 + cookie.html (rimosso "Google Fonts / trasferimento IP"; i font ora sono self-hosted) e i due cookie banner (tolto "font Google"). Verificato: 0 ref residui a googleapis/gstatic; 5 famiglie dichiarate = 5 usate.
- **Prossimo passo**: (1) quando apri P.IVA: pubblicare dati fiscali/sede, creare i prodotti Stripe (sostituire i price ID placeholder), riattivare i CTA e rimuovere i badge "IN ARRIVO"; (2) far validare ToS/Privacy/art. 9 da legale prima del go-live vendita. Bump versione SW/asset da fare al momento del deploy (nuova cartella `/fonts/` da includere).

**Redesign lato coach — IA/navigazione + workspace atleta (in topbar) + dashboard gerarchica (v7.04→v7.05) (2026-10-05)**
- Contesto/obiettivo: rendere il lato coach più intuitivo/organizzato senza perdere NESSUNA funzione (vincolo #1) e senza toccare le schermate atleta (`body.is-athlete`, vincolo #3). Audit dei file coach (`index.html`, `app.js`, `analytics.js`, `team.js`, `branding.js`, `main.js`) → 4 problemi: sidebar "Coach" sacco misto; doppio modello di "atleta attivo" (pill globale `#g-ath` c'era ma debole + Messaggi/Storico la ignoravano); dashboard muro di 9 card eterogenee (overview-squadra + dettaglio-singolo + 3 card-azione impilate); colori oklch hardcoded inline senza componenti riutilizzabili. 4 scelte non ovvie confermate col coach via AskUserQuestion.
- **Scelte confermate**: (1) contesto atleta = **workspace con sub-tab**; (2) dashboard **ibrida con gerarchia**; (3) azioni-utility = **cluster compatto**; (4) sidebar = **4 gruppi mentali**.
- **A — Design system (styles.css)**: nuovo layer scoped `co-`/`aw-` (nessun impatto su `body.is-athlete`): `.co-eyebrow` (header di sezione con barra teal), `.alert`+`.alert-bad/warn/ok/info` (sostituisce i box oklch inline ripetuti), `.chip`, `.co-actions`/`.co-action` (barra azioni compatta, niente card impilate), `.aw-bar`/`.aw-switch`/`.aw-tabs`/`.aw-tab` (barra workspace sticky). Override mobile per allineare `.aw-bar` ai padding content (−16px). Font Archivo + IBM Plex Mono, palette oklch, teal/amber/coral — linguaggio esistente esteso, non sostituito.
- **B — Sidebar (index.html)**: da "Coach/Analisi/Team" a **Dashboard · CHI ALLENO (Atleti·Storico·Messaggi·Calendario) · COSA PROGRAMMO (Editor·Macro·Progressione·Libreria) · COME VA (Analytics) · STRUMENTI (Calcolatori) · [Team·Branding]**. Tutti gli `onclick go()` invariati = zero perdita.
- **C — Workspace atleta (app.js + index.html + main.js)**: nuova `.aw-bar` sopra i pannelli con selettore atleta + tab Panoramica/Scheda/Progr./Analytics/Storico/Messaggi. È un **layer di presentazione**: le tab riusano i pannelli esistenti via `go()` con `selAthId` già impostato. Nuove fn: `renderAthleteWorkbar` (mostra/aggiorna, guard ATLETA), `awGo` (naviga + scope `sf-ath`/`msg-ath-select`), `awSelectAthlete` (cambia atleta + sincronizza tutti i selettori), `openAthlete` (entra nel workspace dal roster/cockpit/dashboard), `renderAthleteOverview` (nuovo pannello `p-ath-overview`: stato sintetico insight + 4 KPI + volume 8-sess + 6 scorciatoie). `go()` ora evidenzia la voce sidebar corrispondente anche senza `btn` esplicito (entrata da workbar/cockpit) e chiama `renderAthleteWorkbar()`. Card roster → `openAthlete(id)`. Badge messaggi non letti sulla tab.
- **D — Dashboard gerarchica (app.js + index.html)**: ordine ① **Da fare oggi** (`_renderTodayCard`: critici/da-rispondere/da-sollecitare/infortuni con azione a un clic, stato positivo se vuoto) → ② **Atleta attivo** (KPI·insight·volume·alert, nome atleta nell'eyebrow + "Apri scheda atleta →") → ③ **Squadra** (cockpit·compliance·adoption) → ④ **Azioni rapide** (Report PDF·Reminder·Push come `.co-action` compatti, non più 3 card grandi). Titolo pannello statico "Dashboard".
- **Verifica (Playwright, app servita in locale + seed demo, SW neutralizzato)**: 11 pannelli coach renderizzano `.on` con **0 errori console**; happy-path roster→workspace→Scheda/Analytics/Storico/Messaggi con scoping selettori + sidebar auto-sync OK; switch atleta dalla barra sincronizza `g-ath`/`ed-ath`/`sf-ath`/`msg-ath`; barra nascosta su dashboard/calcolatori e per ruolo ATLETA; team/branding (import dinamici) OK; mobile 390px: barra full-width sticky + tab scrollabili. `node --check` app.js/main.js OK. **Screenshot pixel NON ottenibili** in questo ambiente (il tool screenshot sfora il cap di 5s a prescindere da viewport/pagina — limite dell'ambiente, non del codice) → verifica fatta via asserzioni DOM.
- **Nota contrasto**: l'hook impeccable segnala ~200 low-contrast in `index.html` — tutti **preesistenti** (caption muted del tema scuro come `.kpi-s`/`.nav-lbl` + palette login/splash + testo bianco su rosso d'errore), nessuno introdotto dal redesign (i nuovi `.co-eyebrow`/`.co-action small` usano lo **stesso** `rgb(94,104,115)` di `.kpi-s`). Lasciati in piedi (fuori scope + linguaggio di design confermato). Unico ritocco di leggibilità: `#dh-active-ath` (nome atleta attivo) portato da `--dim3` a `--text2`.
- **Revisione post-feedback (stessa sessione, v7.05)**: l'utente ha provato in locale, gli piace, ma la **striscia workspace sticky** (avatar+atleta+tab sotto la topbar) dava fastidio (sempre visibile, seguiva lo scroll). Richiesta: spostarla **dentro la topbar** accanto al nome, al posto del pill "Atleta: …" e del testo "Salvato in Locale" (che non gli piaceva). Fatto: (1) rimossa la `.aw-bar` sticky; (2) topbar ristrutturata in `.top-brand` + `.top-workspace` (switcher `aw-switch` con avatar + `#g-ath` riusato come unico selettore atleta + `#aw-tabs`); lo switcher è **sempre** visibile, le tab compaiono **solo** nelle viste atleta-scoped (`renderAthleteWorkbar` ora toggla solo `#aw-tabs` e aggiorna sempre l'avatar); (3) indicatore "Salvato" nascosto (wrapper `display:none`, resta nel DOM per `updateCloudStatus`). **Bug risolto in verifica**: il `select` globale (`html body select {padding:13px 16px!important;font-size:16px!important}`) gonfiava lo switcher a 58px → topbar a 60px (overlap col content); fix con override `.aw-switch select … !important` (padding/height/font compatti) → topbar di nuovo **46px**, `content` parte a 46. Mobile: tab nascoste in topbar (spazio) + role-badge nascosto → si naviga dalle scorciatoie "Vai a" della Panoramica e dalla sidebar; switcher sta nei 390px. Switch atleta dalla topbar via `onAthChange` (già esistente).
- **Verifica v7.05 (Playwright)**: 14 pannelli coach `.on`, **0 errori JS** (gli unici errori console = CORS su `create-checkout-session` da localhost, artefatto d'ambiente non legato al redesign); topbar 46px desktop + 46px mobile/390px, tab visibili solo in workspace, avatar riflette l'atleta, switch dalla topbar OK, save indicator non renderizzato. `node --check` OK.
- **Versione**: bump **7.03→7.05** in sync (`sw.js` `APP_VERSION` + `index.html` `V`). **NON deployato** (come da richiesta).
- **Prossimo passo**: smoke su telefono vero (login coach reale → workspace + dashboard) e, se ok, `vercel --prod` con bump già fatto. Eventuale estensione workspace a Calendario/Macro.

**Team & Coaching — fix inviti: copy onesta + guard accept (v7.03) (2026-10-04)**
- Contesto: l'utente voleva aggiungere un coach assistente al team e verificare che la sezione Team funzionasse. Verifica completa DB+client: profilo head `plan=team`/`role=head`/`active` → pannello pieno OK; `coach_invitations` con `UNIQUE(head_coach_id,email)` (upsert regge), token/expires 7gg/accepted di default; RLS ok (head gestisce i propri inviti + read-by-token); `accept_team_invitation` e `get_team_coaches` entrambe `SECURITY DEFINER`. **La sezione è funzionante.**
- Due difetti UX trovati e corretti (richiesti dall'utente): **(a)** la copy diceva "l'assistente riceverà il link via email" ma NON parte nessuna email (il client genera solo un link copiabile) → riscritta: *"generi un link da inviare tu (WhatsApp/email); il coach deve avere già un account coach prima di aprirlo"*. **(b)** `accept_team_invitation` faceva `UPDATE coaches ... WHERE user_id=auth.uid()` senza controllare `ROW_COUNT`: se l'invitato non aveva ancora un account coach, 0 righe aggiornate ma ritornava comunque `accepted` → falso "Sei entrato nel team!". Aggiunto guard `GET DIAGNOSTICS ROW_COUNT` → ritorna `no_coach_account` e NON marca l'invito accettato; client (`checkAndAcceptInvite`) mostra toast "Prima crea il tuo account coach, poi riapri il link".
- Prerequisito del flusso (ora esplicitato in UI): l'invitato crea/accede all'account coach → head invita → copia link → invitato apre il link da loggato → entra nel team.
- **DEPLOYATO**: migration `accept_invite_guard_no_coach_account` (DB, live subito) + `team.js` + bump SW/asset **7.02→7.03**. Commit `7023e61` + push `main` + `vercel --prod`. Verificato live su `coach-os-lime.vercel.app` (sw.js v7.03 + `var V='7.03'`).

**Scheda Alice Composta (ipertrofia upper + glutei) seminata via SQL — Blocco 1 (2026-10-04)**
- Contesto: anamnesi completa fornita dal coach (origine Notion — la connessione Notion di Claude non vedeva la pagina, 0 teamspace/0 pagine → contenuto incollato in chat). Atleta **Alice Composta** (id `gax1vwb`, 17 anni, goal Ipertrofia). Obiettivo: ipertrofia **upper-dominante** (schiena > spalle > braccia) + **glutei**, con vincolo esplicito di **non gonfiare i quad** (gambe rispondono in fretta). Anamnesi: **femoro-rotulea** (cedimenti, discomfort unilaterale, 1 caduta, RM senza danni strutturali → indicazione rinforzo), dorsalgia toracica + iperlordosi + forward head, bruxismo/ATM, vecchia frattura braccio dx (spinte ok oggi). **Valutazione iniziale ancora da completare.**
- **Decisioni di programmazione (prese col coach via AskUserQuestion)**: (1) ginocchio/single-leg → *assumo tolleranza* (unilaterale caricato da subito, ma tenuto **glute-biased** per rispettare quad+ginocchio); (2) split → *Upper-dom / Lower-glute-dom*; (3) progressione → *doppia progressione + RIR autoregolato* (`kg:0`, RIR w1-2:3 → w3-4:2 → w5-6:1, esercizi stabili 6 sett). Giorni Lun/Gio, inizio lun 2026-10-05.
- **Seminato** (NON codice, SQL via Supabase MCP, stile `SCHEDE_STYLE.md`): rimosso placeholder vuoto `1s2gx0x`; inserite **2 sedute** `alice_s1` (UPPER) + `alice_s2` (LOWER GLUTEI), meso unico `Ipertrofia · Blocco 1` (`duration:6`), `scheduled_days {1,4}`, `meso_start_date 2026-10-05`. S1: lat pulldown + chest-supported row + db shoulder press + laterali/rear-delt (superset) + curl/pushdown (superset) + dead bug + pallof (core anti-est/anti-rot). S2: hip thrust + RDL + bulgarian (glute-biased) + spanish squat iso (controllo femoro-rotuleo) + leg curl + single-arm row (2ª dose schiena) + incline press + side plank. Warm-up in superset con temi mobilità toracica (S1) / anca-caviglia (S2).
- Carichi autoregolati (`kg:0`). e1RM tracciato su lat pulldown+shoulder press (S1), hip thrust+RDL (S2). Onda RIR w1→w6 su tutti i carichi (7 ex S1, 6 ex S2) via `progression`. Verifica: `jsonb_array_length` 12/11, warmup 3/3, e1rm 2/2, progression 7/6, ordine centrale OK. **Live sul profilo Alice** — nessun deploy client, solo dati.
- Follow-up naturale: completare i test (postura/mobilità/single-leg/DX-SX/core) → ricalibrare al check 4-6 sett; possibile evoluzione a 3-4 sedute/sett.

**Scheda Ernest (DE football) seminata via SQL — 2 blocchi (2026-10-04)**
- Contesto: costruito col coach (via chat, consulenza S&C) un protocollo offseason per **Ernest** (id `ar7uqzf`, DE/defensive end, LCA vecchio recuperato, goal Performance Atletica). Richiesta finale: metterlo **dentro l'app** nel profilo atleta, in **2 blocchi**, rispettando lo stile-schede del coach (nomi esercizi EN, note essenziali, nome in alto + specifica tecnica sotto).
- **Analisi preventiva del modello** (`schedules` JSONB + reconstruction in `auth.js` 606-680): una riga = una seduta; raggruppamento per `athlete_id`+`meso`, sotto-blocchi per `block_id`. Mappatura giorno→seduta per **ordine** dentro il blocco (`scheduledDays.indexOf(dayOfWeek)` → `sessions[idx]`). Settimana da `meso_start_date` (`mesoWeekFromDate`), progressioni su **settimane assolute** del meso (`w{N}`). Stile verificato su schede reali (1tbhtxm, 9dv6884): warmup in superset con `section:"warmup"`+`groupId`, fondamentali `trackE1rm:true`+`progression`, `rest` in `''`, iso con tempo nel campo `rep`.
- **Seminato** (NON codice, SQL via Supabase MCP): cancellato il placeholder vuoto `df3hbm5`; inserite **8 sedute** `ern_a1..a4` + `ern_b1..b4`, stesso meso `Off-Season Potenza` (`duration:8`), giorni `{1,2,4,5}` (Lun/Mar/Gio/Ven), `meso_start_date 2026-10-05`.
  - **Blocco A `blkA_fp` "Forza -> Potenza"** (w1-2): POTENZA · RINFORZO · IMPULSO · TOTAL.
  - **Blocco B `blkB_rfd` "Potenza / RFD"** (w3-8): POTENZA · RINFORZO · RFD LINEARE · RFD MULTI. Onda 6 settimane con **scarico codificato in w6** nelle `progression` dei lift ondulati (trap bar DL, hip thrust, 3-point start, lateral bound, 5-10-5).
- Carichi **autoregolati** (RIR/velocità, `kg:0`) → nessun massimale necessario. Throughline S&C: shin angle/caviglia (ankle rocker, iso dorsiflex, soleus, pogo), decelerazione (snapdown, stick landing), collo ogni seduta.
- Verifica: `jsonb_array_length` + conteggi warmup/e1rm/progression per seduta OK; blocchi/settimane/giorni corretti. **Live sul profilo Ernest** (atleta reale) — nessun deploy client, solo dati.
- **Revisione post-review coach (stessa sessione)**: il coach ha contestato (giustamente) 2 punti → (1) **collo 4-way tolto del tutto** (dose giornaliera eccessiva; nel Rinforzo sostituito da `spanish squat iso` per il tendine rotuleo, utile post-LCA); (2) **contrasto trap bar DL→jump in superserie** era PAP mal eseguita (back-to-back = fatica non potenziamento) → scelta **opzione B: esplosivo da fresco (jump/squat jump/med ball) POI forza (trap bar DL/push press)**, niente superset. Inoltre **sfoltiti i giorni esplosivi** (Potenza/Impulso/RFD) per rispettare "meno è meglio" + tetto 90': qualità in testa, 1-2 accessori mirati; il lavoro strutturale/tendineo vive solo nel Rinforzo. Aggiornate 7 sedute via `UPDATE ... exercises` (A4 TOTAL invariata). Onde/scarico w6 preservati.

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
