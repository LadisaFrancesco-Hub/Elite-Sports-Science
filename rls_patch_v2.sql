-- ══════════════════════════════════════════════════════════════
-- CoachOS — Security Patch v2
-- Esegui nel SQL Editor di Supabase DOPO rls_migration.sql
-- ══════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────
-- FIX 1: is_coach() — usa raw_app_meta_data invece di
--         raw_user_meta_data.
--
--   PERCHÉ: raw_user_meta_data è scrivibile dall'utente stesso
--   tramite supabase.auth.updateUser(). Qualsiasi atleta
--   autenticato può autocertificarsi coach e bypassare le RLS.
--   raw_app_meta_data è scrivibile SOLO via service_role
--   (Supabase Dashboard o backend server) — non dal client.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_coach()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(
    (SELECT raw_app_meta_data->>'role' = 'coach'
       FROM auth.users
      WHERE id = auth.uid()),
    FALSE
  );
$$;

-- ──────────────────────────────────────────────────────────────
-- FIX 2: link_athlete_auth() — rimuove i parametri p_user_id
--         e p_email accettati dal client.
--
--   PERCHÉ: un attaccante autenticato che conosce l'ID atleta
--   e il codice potrebbe passare il proprio UUID e collegare
--   il suo account al profilo di un altro atleta. La funzione
--   deve leggere auth.uid() e l'email direttamente da auth.users,
--   non fidarsi dei valori passati dal client.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION link_athlete_auth(
  p_athlete_id TEXT,
  p_code       TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_existing  UUID;
  v_code      TEXT;
  v_caller_id UUID;
  v_email     TEXT;
BEGIN
  -- Legge UUID ed email del chiamante direttamente da auth.users.
  -- auth.uid() è garantito dal JWT — non manipolabile dal client.
  SELECT id, email
    INTO v_caller_id, v_email
    FROM auth.users
   WHERE id = auth.uid();

  IF v_caller_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT user_id, codice_accesso
    INTO v_existing, v_code
    FROM atleti
   WHERE id = p_athlete_id;

  IF v_code = p_code AND v_existing IS NULL THEN
    UPDATE atleti
       SET user_id = v_caller_id,
           email   = v_email
     WHERE id = p_athlete_id;
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$;
GRANT EXECUTE ON FUNCTION link_athlete_auth(TEXT, TEXT) TO authenticated;

-- Rimuovi la vecchia firma (con p_user_id e p_email) se presente
DROP FUNCTION IF EXISTS link_athlete_auth(TEXT, UUID, TEXT, TEXT);

-- ══════════════════════════════════════════════════════════════
-- STEP MANUALE OBBLIGATORIO dopo aver eseguito questo script:
--
--   Supabase Dashboard → Authentication → Users
--   → trova il tuo account coach → clicca i tre puntini → Edit
--   → nel campo "App Metadata" inserisci:
--       {"role": "coach"}
--   → Save
--
--   Questo è l'unico modo sicuro per assegnare il ruolo coach:
--   app_metadata è scrivibile solo da te (service_role),
--   non dai client.
-- ══════════════════════════════════════════════════════════════
