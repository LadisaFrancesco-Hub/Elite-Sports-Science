CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id TEXT NOT NULL REFERENCES atleti(id) ON DELETE CASCADE,
    from_type TEXT NOT NULL CHECK (from_type IN ('coach', 'athlete')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS messages_athlete_idx ON messages(athlete_id, created_at DESC);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_all ON messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
