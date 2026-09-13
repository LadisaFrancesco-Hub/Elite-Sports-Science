-- ══════════════════════════════════════════════════════════════
-- COACHOS — team_migration.sql
-- White-label branding + Multi-coach (Team tier)
-- Esegui nel Supabase SQL Editor DOPO billing_migration.sql
-- ══════════════════════════════════════════════════════════════

-- ── 1. WHITE-LABEL: aggiungi colonne branding alla tabella coaches ──
ALTER TABLE coaches
    ADD COLUMN IF NOT EXISTS brand_name     TEXT,
    ADD COLUMN IF NOT EXISTS brand_color    TEXT DEFAULT '#f97316',
    ADD COLUMN IF NOT EXISTS brand_logo_url TEXT;

-- ── 2. MULTI-COACH: relazioni tra coach head e assistenti ──────────

-- Tabella inviti coach assistenti
CREATE TABLE IF NOT EXISTS coach_invitations (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    head_coach_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email          TEXT NOT NULL,
    role           TEXT NOT NULL DEFAULT 'assistant' CHECK (role IN ('assistant', 'viewer')),
    token          TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
    accepted       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    UNIQUE(head_coach_id, email)
);

CREATE INDEX IF NOT EXISTS invitations_head_idx  ON coach_invitations(head_coach_id);
CREATE INDEX IF NOT EXISTS invitations_token_idx ON coach_invitations(token);

ALTER TABLE coach_invitations ENABLE ROW LEVEL SECURITY;

-- Head coach vede e gestisce i propri inviti
CREATE POLICY "invitations_head_coach" ON coach_invitations
    FOR ALL USING (auth.uid() = head_coach_id);

-- Chiunque può leggere un invito tramite token (per accettarlo)
CREATE POLICY "invitations_read_by_token" ON coach_invitations
    FOR SELECT USING (TRUE);

-- ── 3. TEAM LINK: collega assistant coach al head coach ─────────────
ALTER TABLE coaches
    ADD COLUMN IF NOT EXISTS head_coach_user_id UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS coach_role          TEXT DEFAULT 'head' CHECK (coach_role IN ('head', 'assistant', 'viewer'));

CREATE INDEX IF NOT EXISTS coaches_head_idx ON coaches(head_coach_user_id)
    WHERE head_coach_user_id IS NOT NULL;

-- ── 4. FUNZIONE: get_team_coaches — restituisce i coach del team ────
CREATE OR REPLACE FUNCTION get_team_coaches()
RETURNS TABLE(
    user_id        UUID,
    email          TEXT,
    coach_role     TEXT,
    plan           TEXT,
    created_at     TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    my_head_id UUID;
BEGIN
    -- Trova l'head coach (se io sono un assistant, torno al head)
    SELECT COALESCE(c.head_coach_user_id, c.user_id)
    INTO my_head_id
    FROM coaches c WHERE c.user_id = auth.uid();

    RETURN QUERY
    SELECT c.user_id, c.email, c.coach_role, c.plan, c.created_at
    FROM coaches c
    WHERE c.user_id = my_head_id
       OR c.head_coach_user_id = my_head_id
    ORDER BY c.created_at;
END;
$$;

-- ── 5. FUNZIONE: accept_team_invitation — accetta invito via token ──
CREATE OR REPLACE FUNCTION accept_team_invitation(p_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    inv coach_invitations%ROWTYPE;
BEGIN
    SELECT * INTO inv FROM coach_invitations
    WHERE token = p_token AND accepted = FALSE AND expires_at > NOW();

    IF NOT FOUND THEN
        RETURN 'invalid_or_expired';
    END IF;

    -- Aggiorna il profilo coach corrente come assistant
    UPDATE coaches SET
        head_coach_user_id = inv.head_coach_id,
        coach_role         = inv.role
    WHERE user_id = auth.uid();

    -- Marca invito come accettato
    UPDATE coach_invitations SET accepted = TRUE WHERE id = inv.id;

    RETURN 'accepted';
END;
$$;
