-- =============================================================
-- Assistant AI usage log — durable per-user request limit for the
-- paid /api/assistant endpoint (api/assistant.js).
--
-- The server inserts one row per AI request using the caller's own
-- Supabase session (RLS), and counts the last 24 h before calling the
-- AI. Users can read/insert only their own rows and cannot update or
-- delete them, so the limit can't be reset from the browser.
-- If this table is missing, the endpoint refuses every request.
--
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- =============================================================

create table if not exists public.assistant_usage (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mode       text not null,
  created_at timestamptz not null default now()
);

create index if not exists assistant_usage_user_time on public.assistant_usage (user_id, created_at desc);

alter table public.assistant_usage enable row level security;

drop policy if exists "select own assistant_usage" on public.assistant_usage;
create policy "select own assistant_usage" on public.assistant_usage
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "insert own assistant_usage" on public.assistant_usage;
create policy "insert own assistant_usage" on public.assistant_usage
  for insert to authenticated with check (auth.uid() = user_id);

-- No update/delete policies on purpose.
