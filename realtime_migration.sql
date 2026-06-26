-- ─────────────────────────────────────────────────────────────
-- REALTIME MIGRATION
-- Abilita Postgres Changes per le tabelle chiave di CoachOS.
-- Esegui nel SQL Editor di Supabase (una volta sola).
-- ─────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE atleti;
