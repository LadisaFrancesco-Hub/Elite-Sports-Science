-- ══════════════════════════════════════════════════════════════
-- CoachOS — Push Notifications Migration
-- Esegui nel SQL Editor di Supabase prima di deployare la
-- Edge Function send-push.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    user_type   TEXT NOT NULL CHECK (user_type IN ('coach', 'athlete')),
    athlete_id  TEXT REFERENCES atleti(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_subs_athlete_idx ON push_subscriptions(athlete_id);
CREATE INDEX IF NOT EXISTS push_subs_type_idx    ON push_subscriptions(user_type);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Ogni utente gestisce solo la propria subscription
CREATE POLICY push_self ON push_subscriptions
    FOR ALL TO authenticated
    USING      (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Trigger per aggiornare updated_at ad ogni modifica
CREATE OR REPLACE FUNCTION set_push_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER push_subs_updated_at
    BEFORE UPDATE ON push_subscriptions
    FOR EACH ROW EXECUTE FUNCTION set_push_updated_at();
