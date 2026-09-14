-- ════════════════════════════════════════════════════════════════
-- CoachOS — Wearable Integration Migration
-- Eseguire nel SQL Editor di Supabase (progetto ncvmnoaelzdmuiqrvcjl)
-- ════════════════════════════════════════════════════════════════

create table if not exists public.wearable_connections (
    id                  text primary key,
    athlete_id          text        not null references public.atleti(id) on delete cascade,
    platform            text        not null check (platform in ('whoop','polar','garmin','apple_health','google_fit')),
    access_token        text,
    refresh_token       text,
    token_expiry        timestamptz,
    platform_user_id    text,
    last_sync           timestamptz,
    connected_at        timestamptz default now(),
    unique(athlete_id, platform)
);

alter table public.wearable_connections enable row level security;

-- Coach: vede e gestisce tutte le connessioni (usa is_coach() come le altre tabelle)
create policy "coach_wearable_rw" on public.wearable_connections
    for all using (is_coach()) with check (is_coach());

-- Atleta: accede solo alle proprie (atleti.user_id = auth.uid() dell'atleta loggato)
create policy "athlete_wearable_rw" on public.wearable_connections
    for all using (
        athlete_id in (
            select id from public.atleti where user_id = auth.uid()
        )
    );
