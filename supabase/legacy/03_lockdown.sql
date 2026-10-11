-- =============================================================
-- STEP 3 — Revoke public read/write on the legacy objects.
-- Run only after steps 1–2 and after downloading any photos you need.
-- One transaction: either everything below applies or nothing does.
--
-- Effect: the anon and authenticated (browser) roles can no longer read,
-- write or list app_state or the progress-photos bucket. Rows and files are
-- KEPT. You (Dashboard, SQL editor, service role) still have full access.
-- Old public photo URLs stop working — the page that used them is gone.
-- Does not touch life_os_state, assistant_usage or any other bucket.
-- =============================================================
begin;

-- 3a. app_state: drop every policy on it, revoke browser-role privileges,
--     keep RLS on (with no policies, RLS denies all non-owner access).
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'app_state' loop
    execute format('drop policy %I on public.app_state', pol.policyname);
  end loop;
end $$;
alter table public.app_state enable row level security;
revoke all on table public.app_state from anon, authenticated;

-- 3b. Stop broadcasting app_state changes over Realtime (if it was added).
do $$
begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_state') then
    execute 'alter publication supabase_realtime drop table public.app_state';
  end if;
end $$;

-- 3c. progress-photos: make the bucket private and drop only the policies
--     that mention this bucket (other buckets are untouched).
update storage.buckets set public = false where id = 'progress-photos';
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') like '%progress-photos%' or coalesce(with_check, '') like '%progress-photos%')
  loop
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;
end $$;

commit;
