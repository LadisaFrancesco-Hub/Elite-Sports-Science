-- ══════════════════════════════════════════════════════════════
-- COACHOS — billing_migration.sql
-- Tabella coaches + RLS + funzione ensure_coach_profile
-- ══════════════════════════════════════════════════════════════

-- 1. Tabella coaches
CREATE TABLE IF NOT EXISTS coaches (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email                   TEXT NOT NULL,
    stripe_customer_id      TEXT,
    plan                    TEXT NOT NULL DEFAULT 'free'
                                CHECK (plan IN ('free', 'pro', 'team')),
    athlete_limit           INTEGER NOT NULL DEFAULT 3,
    subscription_status     TEXT NOT NULL DEFAULT 'inactive',
    current_period_ends_at  TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indici
CREATE INDEX IF NOT EXISTS coaches_user_id_idx  ON coaches(user_id);
CREATE INDEX IF NOT EXISTS coaches_stripe_idx    ON coaches(stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

-- 3. RLS
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coaches_own_all" ON coaches
    FOR ALL USING (auth.uid() = user_id);

-- 4. Trigger updated_at
CREATE OR REPLACE FUNCTION _coaches_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER coaches_updated_at_trg
    BEFORE UPDATE ON coaches
    FOR EACH ROW EXECUTE FUNCTION _coaches_set_updated_at();

-- 5. ensure_coach_profile — crea record al primo login, restituisce piano corrente
--    SECURITY DEFINER: bypassa RLS per l'INSERT iniziale
CREATE OR REPLACE FUNCTION ensure_coach_profile(p_email TEXT)
RETURNS TABLE(
    plan                   TEXT,
    athlete_limit          INTEGER,
    subscription_status    TEXT,
    current_period_ends_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO coaches (user_id, email)
    VALUES (auth.uid(), p_email)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN QUERY
    SELECT c.plan, c.athlete_limit, c.subscription_status, c.current_period_ends_at
    FROM coaches c
    WHERE c.user_id = auth.uid();
END;
$$;

-- Esegui questo file nel Supabase SQL Editor oppure con:
--   supabase db push  (se usi migrations locali)
