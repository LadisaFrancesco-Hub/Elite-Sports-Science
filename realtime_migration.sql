-- ─────────────────────────────────────────────────────────────
-- REALTIME MIGRATION
-- Abilita Postgres Changes per le tabelle chiave di CoachOS.
-- Esegui nel SQL Editor di Supabase (una volta sola).
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'schedules'
  ) THEN ALTER PUBLICATION supabase_realtime ADD TABLE schedules; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'sessions'
  ) THEN ALTER PUBLICATION supabase_realtime ADD TABLE sessions; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'atleti'
  ) THEN ALTER PUBLICATION supabase_realtime ADD TABLE atleti; END IF;
END $$;
