-- =============================================================
-- STEP 1 — READ-ONLY inventory of the legacy objects (changes nothing).
-- Run in Supabase → SQL Editor and keep the output for your records.
-- Prints names, counts, sizes and dates only — never row contents.
-- =============================================================

-- 1a. Every policy on the legacy table, the bucket's objects, and the two
--     tables the current app uses. Look for roles {anon} / {public} with
--     qual 'true' — that means anyone holding the public anon key.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in ('app_state', 'life_os_state', 'assistant_usage'))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

-- 1b. Row-level security switched on?
select n.nspname as schema, c.relname as table, c.relrowsecurity as rls_on, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('app_state', 'life_os_state', 'assistant_usage');

-- 1c. Table privileges granted to the browser roles.
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('app_state', 'life_os_state', 'assistant_usage')
  and grantee in ('anon', 'authenticated')
group by table_name, grantee order by table_name, grantee;

-- 1d. Is app_state broadcast over Realtime? (Realtime + an anon policy
--     streams every change to anyone subscribed.)
select pubname, schemaname, tablename from pg_publication_tables where tablename = 'app_state';

-- 1e. What app_state holds: keys, sizes, last update — not the data itself.
select key, pg_column_size(data) as bytes, updated_at
from public.app_state order by updated_at desc;

-- 1f. The bucket and its files.
select id, name, public, created_at from storage.buckets where id = 'progress-photos';
select count(*) as files, sum(coalesce((metadata->>'size')::bigint, 0)) as total_bytes,
       min(created_at) as oldest, max(created_at) as newest
from storage.objects where bucket_id = 'progress-photos';

-- 1g. Ownership: files uploaded with the anon key have NO owner (null),
--     so they cannot be attributed to a user automatically.
select owner, count(*) as files from storage.objects
where bucket_id = 'progress-photos' group by owner order by files desc;
