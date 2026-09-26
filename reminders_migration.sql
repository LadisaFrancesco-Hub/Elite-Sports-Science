-- ══════════════════════════════════════════════════════════════
-- Elite Sports Science — Reminder allenamento (server-side)
--
-- Aggiunge:
--   1. atleti.training_reminder     → il coach sceglie chi riceve il push (default ON)
--   2. schedules.scheduled_days     → giorni di allenamento (int[] stile getDay(): 0=Dom..6=Sab)
--      (fixa anche il bug: prima i giorni vivevano solo nel browser)
--   3. reminder_config              → tabella privata con un segreto per autenticare il cron
--   4. un job pg_cron ORARIO che invoca l'Edge Function `send-reminders`,
--      passando il segreto letto dal DB. La funzione decide se è l'ora
--      giusta (Europe/Rome) e chi va avvisato.
-- ══════════════════════════════════════════════════════════════

-- ── 1. Colonne ────────────────────────────────────────────────
ALTER TABLE atleti    ADD COLUMN IF NOT EXISTS training_reminder boolean DEFAULT true;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS scheduled_days    integer[] DEFAULT '{}';

-- ── 2. Estensioni per il cron HTTP (schemi default: cron / net) ──
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── 3. Segreto del cron (solo service role può leggerlo) ──────
CREATE TABLE IF NOT EXISTS reminder_config (
    id     boolean PRIMARY KEY DEFAULT true CHECK (id),   -- riga singola
    secret text NOT NULL
);
ALTER TABLE reminder_config ENABLE ROW LEVEL SECURITY;     -- nessuna policy → anon/authenticated esclusi
INSERT INTO reminder_config (id, secret)
VALUES (true, encode(gen_random_bytes(24), 'hex'))
ON CONFLICT (id) DO NOTHING;

-- ── 4. Job orario → Edge Function ─────────────────────────────
-- Gira ogni ora (UTC); la funzione invia solo quando in Italia sono le
-- REMINDER_HOUR (default 08:00), gestendo fuso e ora legale.
select cron.schedule(
  'training-reminders-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url     := 'https://ncvmnoaelzdmuiqrvcjl.functions.supabase.co/send-reminders',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret', (select secret from reminder_config limit 1)
               ),
    body    := '{}'::jsonb
  );
  $$
);

-- Utility:
--   select cron.unschedule('training-reminders-hourly');
--   select * from cron.job_run_details order by start_time desc limit 20;
