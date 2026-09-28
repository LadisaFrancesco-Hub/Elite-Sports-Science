-- Cache delle sintesi IA (briefing settimanale coach): una per atleta + settimana ISO.
-- Evita di ri-pagare Claude se il coach riapre lo stesso atleta senza nuovi dati.
-- Sicurezza allineata alle tabelle esistenti: is_coach() (nessun coach_id nello schema).
-- Applicata in prod (via Supabase MCP) il 2026-09-28 come migration `ai_insight_cache`.
create table if not exists ai_insights (
  id          bigint generated always as identity primary key,
  athlete_id  text not null references atleti(id) on delete cascade,
  iso_week    text not null,                              -- es. "2026-W40"
  input_hash  text not null,                              -- hash del payload: dati cambiano -> si rigenera
  summary     text not null,                              -- briefing generato (markdown leggero)
  model       text not null default 'claude-haiku-4-5-20251001',
  created_at  timestamptz not null default now(),
  unique (athlete_id, iso_week)
);

alter table ai_insights enable row level security;

drop policy if exists coach_full_ai_insights on ai_insights;
create policy coach_full_ai_insights on ai_insights
  for all
  using (is_coach()) with check (is_coach());
