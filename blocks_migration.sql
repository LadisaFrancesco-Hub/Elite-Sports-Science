-- ═══════════════════════════════════════════════════════════════
-- MESOCICLO A BLOCCHI (fasi) — 2026-09-27
--
-- Un mesociclo diventa una sequenza di blocchi. Ogni riga-seduta della
-- tabella `schedules` porta i metadati del proprio blocco (denormalizzati,
-- come già avviene per meso/duration/phase). Al caricamento il client
-- sotto-raggruppa le sedute per block_id ricostruendo i blocchi.
--
--   block_id         → id del blocco a cui appartiene la seduta
--   block_name       → nome del blocco (es. "Test", "Casa base", "Carico")
--   block_week_start → prima settimana del mesociclo coperta dal blocco
--   block_week_end   → ultima settimana coperta dal blocco
--   meso_start_date  → data d'inizio mesociclo (schedule-level, ripetuta
--                      su ogni riga) da cui si deriva la settimana corrente
--   session_type     → tipo seduta (Palestra/Casa/Corsa…): non era mai
--                      stato persistito su cloud, serve al round-trip dei
--                      blocchi casa vs palestra
--
-- Idempotente: le schede legacy (block_id NULL) restano un blocco unico
-- implicito lato client. Nessun backfill necessario.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE schedules ADD COLUMN IF NOT EXISTS block_id         text;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS block_name       text;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS block_week_start integer;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS block_week_end   integer;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS meso_start_date  date;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS session_type     text;
