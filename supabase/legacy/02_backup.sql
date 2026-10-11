-- =============================================================
-- STEP 2 — Preserve the legacy table before locking it (idempotent).
-- Copies public.app_state into a private schema that the browser API
-- can never reach. Nothing is deleted. Photos are files, not rows: download
-- any you want to keep from Storage → progress-photos BEFORE step 3 (see
-- README.md) — this script does not copy or move files.
-- =============================================================
begin;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create table if not exists private.app_state_backup_20261011 as
  select * from public.app_state with no data;

-- Copy rows not already backed up (safe to re-run).
insert into private.app_state_backup_20261011
select s.* from public.app_state s
where not exists (select 1 from private.app_state_backup_20261011 b where b.key = s.key);

revoke all on private.app_state_backup_20261011 from public, anon, authenticated;

-- Record of the bucket's file list (metadata only, not the files).
create table if not exists private.progress_photos_inventory_20261011 as
  select id, name, owner, created_at, metadata from storage.objects where bucket_id = 'progress-photos';
revoke all on private.progress_photos_inventory_20261011 from public, anon, authenticated;

commit;

-- Check: both counts should match step 1.
select (select count(*) from public.app_state) as app_state_rows,
       (select count(*) from private.app_state_backup_20261011) as backed_up_rows,
       (select count(*) from private.progress_photos_inventory_20261011) as photo_files_listed;
