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

Valutare: PDF report mensile (jsPDF) oppure food database nutrizione (Open Food Facts API).
Poi: deploy su Vercel con i video aggiornati.
Poi lancio verso primi coach beta.
