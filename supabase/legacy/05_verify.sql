-- =============================================================
-- STEP 5 — READ-ONLY checks after step 3. Expected results in comments.
-- =============================================================

-- No policies left on app_state.                          → 0 rows
select policyname from pg_policies where schemaname = 'public' and tablename = 'app_state';

-- Browser roles hold no privileges on app_state.           → 0 rows
select grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'app_state' and grantee in ('anon', 'authenticated');

-- Not in Realtime.                                         → 0 rows
select tablename from pg_publication_tables where tablename = 'app_state';

-- Bucket is private.                                       → public = false
select id, public from storage.buckets where id = 'progress-photos';

-- No policy mentions the bucket (unless you ran step 4).   → 0 rows (or only "owner reads progress-photos")
select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
  and (coalesce(qual, '') like '%progress-photos%' or coalesce(with_check, '') like '%progress-photos%');

-- Nothing deleted: these match step 1.
select (select count(*) from public.app_state) as app_state_rows,
       (select count(*) from storage.objects where bucket_id = 'progress-photos') as photo_files;

-- The current app's tables keep their per-user policies.   → 4 rows life_os_state, 2 rows assistant_usage
select tablename, policyname, cmd, roles from pg_policies
where schemaname = 'public' and tablename in ('life_os_state', 'assistant_usage') order by tablename, cmd;
