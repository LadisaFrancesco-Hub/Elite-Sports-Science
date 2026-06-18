-- ══════════════════════════════════════════════════════════════
-- CoachOS — Migrazione Sicurezza v1
-- Esegui questo script nel SQL Editor di Supabase
-- (Database → SQL Editor → New query → incolla → Run)
-- ══════════════════════════════════════════════════════════════

-- 1. Aggiungi colonne auth alla tabella atleti
ALTER TABLE atleti
  ADD COLUMN IF NOT EXISTS email   TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS atleti_user_id_idx ON atleti(user_id);
CREATE INDEX IF NOT EXISTS atleti_codice_idx  ON atleti(codice_accesso);

-- ──────────────────────────────────────────────────────────────
-- 2. Funzione sicura per cercare un atleta tramite codice accesso.
--    Restituisce solo campi non sensibili, accessibile da anon.
--    SECURITY DEFINER = bypassa RLS ed è eseguita come owner.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION lookup_athlete_by_code(p_code TEXT)
RETURNS TABLE(
  id                   TEXT,
  name                 TEXT,
  email                TEXT,
  has_auth             BOOLEAN,
  onboarding_completed BOOLEAN
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    id,
    name,
    email,
    (user_id IS NOT NULL) AS has_auth,
    COALESCE(onboarding_completed, FALSE) AS onboarding_completed
  FROM atleti
  WHERE codice_accesso = p_code
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION lookup_athlete_by_code TO anon, authenticated;

-- ──────────────────────────────────────────────────────────────
-- 3. Funzione per collegare un account Supabase Auth a un profilo
--    atleta esistente (usata al primo accesso / migrazione legacy).
--    Condizioni di sicurezza:
--      - Il codice deve corrispondere all'atleta indicato
--      - user_id deve essere ancora NULL (nessun account collegato)
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION link_athlete_auth(
  p_athlete_id TEXT,
  p_user_id    UUID,
  p_email      TEXT,
  p_code       TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_existing UUID;
  v_code     TEXT;
BEGIN
  SELECT user_id, codice_accesso
    INTO v_existing, v_code
    FROM atleti
   WHERE id = p_athlete_id;

  IF v_code = p_code AND v_existing IS NULL THEN
    UPDATE atleti
       SET user_id = p_user_id,
           email   = p_email
     WHERE id = p_athlete_id;
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$;
GRANT EXECUTE ON FUNCTION link_athlete_auth TO anon, authenticated;

-- ──────────────────────────────────────────────────────────────
-- 4. Funzione helper: verifica se l'utente corrente è un coach.
--    Legge raw_user_meta_data->>'role' dalla tabella auth.users.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_coach()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(
    (SELECT raw_user_meta_data->>'role' = 'coach'
       FROM auth.users
      WHERE id = auth.uid()),
    FALSE
  );
$$;

-- ──────────────────────────────────────────────────────────────
-- 5. Abilita Row Level Security — tabelle core (sempre presenti)
-- ──────────────────────────────────────────────────────────────
ALTER TABLE atleti    ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions  ENABLE ROW LEVEL SECURITY;

-- Tabelle opzionali: skip silenzioso se non ancora create
DO $$ BEGIN
  ALTER TABLE mesocycles ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE wellness ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────────
-- 6. Policy: atleti
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS coach_full_atleti  ON atleti;
DROP POLICY IF EXISTS athlete_select_own ON atleti;
DROP POLICY IF EXISTS athlete_update_own ON atleti;

-- Il coach vede e modifica tutti gli atleti
CREATE POLICY coach_full_atleti ON atleti
  FOR ALL TO authenticated
  USING (is_coach()) WITH CHECK (is_coach());

-- L'atleta vede solo il proprio profilo
CREATE POLICY athlete_select_own ON atleti
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- L'atleta può aggiornare solo il proprio profilo
CREATE POLICY athlete_update_own ON atleti
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- 7. Policy: schedules
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS coach_full_schedules    ON schedules;
DROP POLICY IF EXISTS athlete_select_schedule ON schedules;

CREATE POLICY coach_full_schedules ON schedules
  FOR ALL TO authenticated
  USING (is_coach()) WITH CHECK (is_coach());

CREATE POLICY athlete_select_schedule ON schedules
  FOR SELECT TO authenticated
  USING (athlete_id IN (SELECT id FROM atleti WHERE user_id = auth.uid()));

-- ──────────────────────────────────────────────────────────────
-- 8. Policy: sessions
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS coach_full_sessions  ON sessions;
DROP POLICY IF EXISTS athlete_own_sessions ON sessions;

CREATE POLICY coach_full_sessions ON sessions
  FOR ALL TO authenticated
  USING (is_coach()) WITH CHECK (is_coach());

-- L'atleta può leggere e scrivere solo le proprie sessioni
CREATE POLICY athlete_own_sessions ON sessions
  FOR ALL TO authenticated
  USING      (athlete_id IN (SELECT id FROM atleti WHERE user_id = auth.uid()))
  WITH CHECK (athlete_id IN (SELECT id FROM atleti WHERE user_id = auth.uid()));

-- ──────────────────────────────────────────────────────────────
-- 9. Policy: mesocycles (skip se tabella non esiste)
-- ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS coach_full_mesocycles ON mesocycles;
  DROP POLICY IF EXISTS athlete_select_meso   ON mesocycles;
  CREATE POLICY coach_full_mesocycles ON mesocycles
    FOR ALL TO authenticated
    USING (is_coach()) WITH CHECK (is_coach());
  CREATE POLICY athlete_select_meso ON mesocycles
    FOR SELECT TO authenticated
    USING (athlete_id IN (SELECT id FROM atleti WHERE user_id = auth.uid()));
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────────
-- 10. Policy: wellness (skip se tabella non esiste)
-- ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS coach_full_wellness  ON wellness;
  DROP POLICY IF EXISTS athlete_own_wellness ON wellness;
  CREATE POLICY coach_full_wellness ON wellness
    FOR ALL TO authenticated
    USING (is_coach()) WITH CHECK (is_coach());
  CREATE POLICY athlete_own_wellness ON wellness
    FOR ALL TO authenticated
    USING      (athlete_id IN (SELECT id FROM atleti WHERE user_id = auth.uid()))
    WITH CHECK (athlete_id IN (SELECT id FROM atleti WHERE user_id = auth.uid()));
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ══════════════════════════════════════════════════════════════
-- DOPO aver eseguito questo script, vai su:
-- Supabase Dashboard → Authentication → Settings → Email Auth
-- e disabilita "Enable email confirmations"
-- così signUp() crea l'utente immediatamente senza conferma email.
-- ══════════════════════════════════════════════════════════════
