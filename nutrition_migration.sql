-- ══════════════════════════════════════════════════════════════
-- COACHOS — nutrition_migration.sql
-- Tabella nutrition per log giornaliero macro atleta
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nutrition (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id  TEXT NOT NULL REFERENCES atleti(id) ON DELETE CASCADE,
    date        DATE NOT NULL DEFAULT CURRENT_DATE,
    kcal        INTEGER,
    proteine    NUMERIC(6,1),
    carboidrati NUMERIC(6,1),
    grassi      NUMERIC(6,1),
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(athlete_id, date)
);

CREATE INDEX IF NOT EXISTS nutrition_athlete_date_idx ON nutrition(athlete_id, date DESC);

ALTER TABLE nutrition ENABLE ROW LEVEL SECURITY;

-- L'atleta gestisce la propria nutrizione
CREATE POLICY "nutrition_athlete_own" ON nutrition
    FOR ALL USING (
        EXISTS (SELECT 1 FROM atleti WHERE atleti.id = athlete_id AND atleti.user_id = auth.uid())
    );

-- Il coach vede tutti i propri atleti
CREATE POLICY "nutrition_coach_all" ON nutrition
    FOR ALL USING (
        (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'coach'
    );
