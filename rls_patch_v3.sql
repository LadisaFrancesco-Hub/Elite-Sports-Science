-- ══════════════════════════════════════════════════════════════
-- CoachOS — Security Patch v3
-- Fix: atleta non riusciva a salvare la progressione pesi
-- (campo "Prossimo Carico") tra una sessione e l'altra.
--
-- CAUSA: RLS su schedules non aveva policy UPDATE per gli atleti.
-- Il coach imposta la scheda (INSERT/UPDATE via coach_full_schedules),
-- ma quando l'atleta salva la progressione dal vivo, il client
-- chiama .update({ exercises: ... }) che veniva bloccato silenziosamente.
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS athlete_update_schedule ON schedules;

CREATE POLICY athlete_update_schedule ON schedules
  FOR UPDATE TO authenticated
  USING      (athlete_id IN (SELECT id FROM atleti WHERE user_id = auth.uid()))
  WITH CHECK (athlete_id IN (SELECT id FROM atleti WHERE user_id = auth.uid()));
