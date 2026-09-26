# PROGRESS ARCHIVE
Storia completa delle sessioni di sviluppo fino a v6.74.

---

**Design System v2 (Coach Console redesign)**
- Importati Archivo + IBM Plex Mono da Google Fonts
- Token CSS in `:root`: palette più fredda/scura, nuove variabili `--s4`, `--nav-bg`, `--input-bg`, `--text2`, `--dim2`, `--dim3`, `--mono-dim`, `--green`, `--fmono`, `--radius-btn`
- Border-radius card: 18px → 9px; button: 12px → 6px
- Topbar: gradient `#14181E→#0F1318` + border-bottom + ombra profonda
- Sidebar: `#0D1014`, nav items Archivo 12.5px/500, left-border inset su `.on`
- Tabelle: header `#171C23`, IBM Plex Mono, border-bottom `.10`, row separator `.04`
- Bottone primario: gradient arancio con inset highlight + shadow

**Design System v3 — Redesign visivo completo Coach Console**
- Token `:root` migrati a oklch: `--teal oklch(0.76 0.16 52)`, `--coral oklch(0.66 0.20 22)`, `--amber oklch(0.82 0.13 88)`, `--green oklch(0.74 0.11 175)`
- Card header gradient su tutti i pannelli coach tranne Editor schede
- Nav active: `inset 3px 0 0 var(--teal)`, background quasi trasparente
- Grafici Chart.js tutti con IBM Plex Mono su assi e tooltip scuro `rgba(12,15,19,.95)`
- Alert dashboard, triage, LSI, monotonia Foster: background e border in oklch semantico

**Fix UI Profilo Atleta (2026-09-16)**
- Badge topbar "ATLETA" nella vista atleta (id `role-badge`, gestito via JS in `main.js`)
- Nascosti `save-dot` e `save-txt` nella vista atleta
- Bottom bar atleta: icone geometriche a tutti i tab (⊞/◎/▲/◇/⊙/▶)

**Focus Mode (2026-09-16)**
- Overlay full-screen `#mo-focus` con un esercizio alla volta, navigazione prev/next, progress bar
- Sezione ANALISI: e1RM stimato + trend + storico + progressione carichi
- Dot set interattivi sincronizzati, timer REST autonomo, campo "Prossimo Carico"
- `refreshFocusIfOpen()` chiamato dopo ogni toggle/log

**Video Exercise Library (2026-09-16)**
- Completati tutti i `ytUrl` in `EXERCISE_LIBRARY` (100%)
- Fix: link video editor coach aprono modal in-app
- Nuovo modulo `library.js`: 9 categorie filtrabili, ricerca live, grid con thumbnail YouTube, bottone "+" coach-only
- Deploy v6.59

**Fix Video Libreria Esercizi (2026-09-17)**
- Verificati con oEmbed API tutti i 121 video — trovati 70 morti → sostituiti con URL funzionanti
- Deploy v6.59.1 (patch inline)

**Espansione Exercise Library v1 (2026-09-17)**
- Aggiunti 83 nuovi esercizi (da 122 a 206 totali), CAT_MAP allineato, tutti video live
- Deploy v6.60

**Fix Realtime storico/calendario (2026-09-17)**
- `_onSessionChange` in `auth.js`: aggiunto ri-render di `ath-storico` e `calendario`
- Deploy v6.60.1

**Espansione Exercise Library v2 (2026-09-17)**
- Aggiunti 56 esercizi (da 206 a 262 totali), 4 nuovi URL verificati oEmbed
- Deploy v6.61

**Espansione Exercise Library v3 (2026-09-18)**
- Aggiunti 56 esercizi (da 262 a 318 totali), tutti video verificati, 0 duplicati
- Deploy v6.62

**Dataset demo realistico — first-login "wow" (2026-09-18)**
- Riscritta `seed()`: 4 atleti demo con 8 settimane di storico (PRNG deterministico mulberry32)
  - Niccolò Trentin (tennis, sano): ACWR ottimali, e1RM in salita
  - Marco Bianchi (powerlifting, peak): 3 fondamentali in progressione
  - Elena Riva (calcio, a rischio): ACWR campo 1.62 DANGER, rischio 160, infortunio ginocchio VAS 6
  - Giulia Fontana (a4, lapsed): aggiunta in v6.66, storico fermo ~18gg fa
- Banner "Dati demo attivi" + `clearDemoData()` con flag `coachOS_noDemo`
- Deploy v6.63

**Empty-states + invito WhatsApp (2026-09-18)**
- Bottone "Invia invito via WhatsApp" nel modal codice atleta → `wa.me/?text=...`
- Empty-state lista atleti con CTA "+ Aggiungi il primo atleta"
- Deploy v6.64

**Smoke test visivo + fix badge (2026-09-18)**
- Fix: `clearDemoData` ora chiama `populateSelects()` → badge nav azzerati
- Aggiunto `node_modules/` a `.gitignore`
- Deploy v6.65

**Motore di adozione atleta (2026-09-18)**
- Card "Attività atleti" con semaforo 3 livelli (Attivo/A rischio/Silente)
- Nudge singolo + bulk → messaggio coach + push
- Deploy v6.66

**Analisi automatica settimanale — engine locale (2026-09-18)**
- `generateWeeklyInsight(athId)`: aderenza, ACWR, monotonia Foster, e1RM trend, HRV, readiness, LSI, infortuni
- Card dashboard `#dh-insight` con verdetto POSITIVO/DA MONITORARE/CRITICO + raccomandazione
- Deploy v6.67

**PDF Report mensile — white-label (2026-09-18)**
- `exportAthleteReport()` potenziato: white-label (brandName/Color/Logo), sezione "Analisi del coach" (riusa insight engine), PR del mese (top 6 e1RM), composizione corporea
- Deploy v6.68

**Qualità percepita — empty states pannelli coach (2026-09-18)**
- Storico, Calendario, Messaggi, Macro: empty state coerenti con testo adattivo
- Deploy v6.69

**Qualità percepita — mobile pass Coach Console (2026-09-18)**
- Topbar mobile: nascosto wordmark + testo save (collisione); resta solo pallino
- Decisione: skeleton rimandato (boot già gestito dallo splash)
- Deploy v6.70

**Qualità percepita — empty states lato atleta (2026-09-18)**
- Fix `renderAthWeek` senza programma: banner "Scheda non ancora assegnata" + giorni neutri
- Deploy v6.71

**Gamification riattivata (2026-09-19)**
- Bacheca trofei decommentata in `analytics.js`
- `badgeStripHtml()` in `badges.js`: striscia compatta in home atleta (trofei + streak + ultimo badge)
- Deploy v6.72

**Time-to-value coach — template programmi + duplica (2026-09-19)**
- 6 template in `PROGRAM_TEMPLATES` (state.js): Full Body 3×, Upper/Lower 4×, PPL, Forza 5×5, Atletica, Ricomposizione
- `applyProgramTemplate` + `_expandTemplateEx` in `app.js`
- `duplicateScheduleFrom` + `duplicateCurrentSession`
- Deploy v6.73

**Verifica + fix realtime coach (2026-09-19)**
- Verifica end-to-end Supabase: realtime funziona; gap = eventi persi con tab in background
- Fix `auth.js`: `_reloadSessions()` agganciato a `visibilitychange`, `online`, riconnessione canale
- Deploy v6.74
