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

## Prossimo passo

Attivare e testare il flusso push notification end-to-end (permesso browser → salvataggio subscription → invio da edge function al coach/atleta).
