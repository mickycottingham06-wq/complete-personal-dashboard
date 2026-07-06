-- =============================================================
-- Life OS — Cloud Sync (Phase 1) table setup.
--
-- One JSON blob per signed-in user — the entire Local Storage
-- key/value map (same shape as window.Backup.buildExport().data),
-- synced manually via the Integrations page's Cloud Sync card.
--
-- Run this once in Supabase → SQL Editor → New query → Run.
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS /
-- DROP POLICY IF EXISTS).
--
-- See docs/SUPABASE_PLAN.md §17 and SETUP.md for the full context.
-- =============================================================

create table if not exists public.life_os_state (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references auth.users(id) on delete cascade,
  data         jsonb not null default '{}'::jsonb,
  data_version text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.life_os_state enable row level security;

-- Each user can only ever read/write their own row.
drop policy if exists "select own life_os_state" on public.life_os_state;
create policy "select own life_os_state" on public.life_os_state
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "insert own life_os_state" on public.life_os_state;
create policy "insert own life_os_state" on public.life_os_state
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "update own life_os_state" on public.life_os_state;
create policy "update own life_os_state" on public.life_os_state
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own life_os_state" on public.life_os_state;
create policy "delete own life_os_state" on public.life_os_state
  for delete to authenticated using (auth.uid() = user_id);
