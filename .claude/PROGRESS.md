# PROGRESS

> Storia completa fino al 2026-10-30 → `.claude/PROGRESS_ARCHIVE.md`

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

> Dettaglio completo delle sessioni **2026-10-14 → 2026-10-30** (Focus Mode atleta,
> redesign estetico coach pannello-per-pannello, round data-durability) →
> `.claude/PROGRESS_ARCHIVE.md`. Sintesi delle ultime sessioni qui sotto.

**Loop atleta — "Ultima volta" + storico per-set (v7.41, 2026-10-30)** — DEPLOYATO.
Riferimento sovraccarico progressivo preso dal cloud: (1) **"Ultima volta" inline** sotto
la riga serie×reps della card (anteprima+Focus) con freccia ↑/↓/= vs il carico di oggi, da
`DB.sessions[].donePerExercise[nome]` (top set, durabile da v7.31) — helper `_lastTimeFor` +
`_daysAgoLabel`. (2) **Storico per-set** nel modale di log (colonna "Previous" di Hevy):
aprendo una serie vedi cosa hai fatto in *quella* serie la volta scorsa + tap "usa" per
pre-compilare — nuova colonna `sessions.sets_per_exercise jsonb`, helper `_lastTimeSetsFor`,
accumulo `setsPerExercise` in `updateLiveTotals`, fallback al top set per serie oltre il numero
della volta scorsa. Entrambi non retroattivi. Commit `670b1e9`.

**Focus Mode — superserie come "pagina-giro" (v7.40, 2026-10-30)** — DEPLOYATO.
Il gruppo superset diventa **una sola pagina Focus** con esercizi impilati, header "↳ SUPERSET A
· N giri" e un unico timer di recupero a fine giro. Wrapper `.ax-group` come unità-pagina,
trasparente in anteprima (riuso massimo: pallini/`_focusCardDone`/resume invariati). Elementi
superset resi **viola** (`--purple`, come editor coach) + **connettore a catena** (pastiglia
viola con icona link) tra membri consecutivi in Focus. Tutto CSS puro + `loadLive`/`_focusCards`.

**Estetica coach — redesign pannello-per-pannello "console dati raffinata" (v7.36→v7.39)**
Il profilo coach era rimasto sugli stili base (carte piatte, monospace ovunque) mentre l'atleta
ha il design system "v4"; i token v4 sono già globali in `:root` → riusabili scoped sul coach.
Deployati in sequenza: **Dashboard** (v7.36), **Lista atleti** (v7.37), **Nav chrome
sidebar+topbar** (v7.38), **Editor schede** (v7.39). Ricetta: carte profonde (sheen+`--e1`+
`--sh-card`), accento arancione + semantica (verde/ambra/corallo), focus ring arancione, motion
a cascata `ax-in` (gated `prefers-reduced-motion`), border-left colorato per tipo/rischio
preservato. Niente glow "da IA" (bordi netti). **Follow-up** (stesso sistema): Storico, Macro,
Calendario, Messaggi, Progressione, Panoramica atleta, Team/Branding.

**Triage coach — readiness visibile + trend + feedback atleta (v7.34, v7.35, 2026-10-26)** —
DEPLOYATO. (1) Banner readiness dell'atleta nel cruscotto + chip readiness per-atleta nel
cockpit (soglie ≥75 green/≥50 amber/<50 coral); `_reloadWellness` a focus/online (la tabella
`wellness` non ha realtime). (2) Sparkline trend readiness 30gg (`wellnessHistByAthlete`, SVG a
mano, nessuna query nuova), ultimo feedback atleta nel cruscotto (`_renderFeedbackCard`, badge
risposto/da-rispondere), inattività specifica (nomi+giorni). Commit `3a940f6`.

**Dati durabili — 3 round (v7.31, v7.32, v7.33, 2026-10-25/26)** — v7.31/v7.32 DEPLOYATI,
v7.33 NON deployato (attende ok coach). Stessa classe di bug chiusa 3 volte: dati calcolati/
salvati solo in locale, persi su nuovo device e invisibili al coach. **Round 1 (v7.31)**:
`donePerExercise` durabile (colonna `sessions.done_per_exercise`), **badge** durabili
(`atleti.badges`, merge local+cloud tiene la data più vecchia), flag `_synced` +
`reconcileUnsyncedSessions`. **Round 2 (v7.32)**: `e1rmPerExercise` durabile
(`sessions.e1rm_per_exercise`), **infortuni** durabili (`atleti.injuries` +
`rebuildInjuriesFromAthletes` idempotente). **Round 3 (v7.33, non deployato)**: quick wellness
check-in ora scrive su cloud (`saveWellnessCloud`), reconcile wellness, `cns_score` durabile.
Pattern verifica: `information_schema` + round-trip DB non distruttivo + e2e JWT atleta reale
(signUp autoconfirm, cleanup SQL); colonne nuove ereditano le policy RLS già validate.

**Focus Mode atleta — allenamento "un esercizio alla volta" (v7.21→v7.29, 2026-10-24/25)** —
DEPLOYATO. Vista full-screen stile TrainHeroic/Hevy sopra le card già renderizzate da
`loadLive()`: pager CSS scroll-snap (`startFocus` sposta `#lv-exs` in `#focus-stage`), pallini
progresso globali + timer durata totale, nav Indietro/Avanti (ultimo = Fine Allenamento).
Riuso totale (log/timer/e1RM/PR invariati). Iterazioni successive su richiesta coach: card
arricchita (video inline→poi rimosso, reps nei pallini, mini-grafico carichi reali
`_weeklyLoadChart` SVG), layout definito dal coach (ordine card + centratura + RIR/TUT/RPE su
una riga, valori arancioni), countdown "3-2-1·VIA" all'avvio fresco (v7.26/27), barra atleta
nascosta + font più grandi (v7.22), icona cronometro SVG + "START REST" (v7.23), pallini warm-up
rimossi + nav solo frecce SVG centrate (v7.24/28/29). Skill `mobile-native`.

**Schermata Sessione → SOLA anteprima (2026-10-25)** — NON deployato. L'anteprima pre-START
mostra solo "cosa farò" (via pallini/KPI/grafico/Fine, via RAMPING); l'allenamento vero avviene
in Focus Mode. Toggle CSS: default=anteprima nascosta, `.focus-stage …`=ripristino. Recupero
accorpato alla riga serie×reps (`· Rec m:ss`). Nodi KPI tenuti nel DOM (letti da `endWorkout`).

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
