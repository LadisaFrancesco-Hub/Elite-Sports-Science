-- Form-check v2 — annotazioni video (overlay vettoriale sincronizzato ai timestamp)
-- Applicata in prod via Supabase MCP (migration: form_check_annotations), 2026-09-29.
-- L'annotazione è un nuovo messaggio del coach che riusa lo stesso media_url del
-- video dell'atleta; annotations = { v:1, shapes:[ {id,t,type,color,...} ] }.
-- Retro-compatibile (nullable). RLS invariata (messages: USING(true), mono-coach).

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS annotations jsonb;
