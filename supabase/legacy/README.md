# Securing the legacy Supabase objects

The old dashboard created two objects the current app **no longer uses**:

| Object | Created by (old SETUP.md) | Risk |
|---|---|---|
| `public.app_state` table | `anon full access app_state` policy (`for all to anon using (true)`), added to Realtime | Anyone with the anon key (shipped to every browser) can read, overwrite and delete every row, and subscribe to changes |
| `progress-photos` bucket | `public = true` + `anon manage progress-photos` policy (`for all to anon`) | Anyone can list, download, upload, replace and delete files |

The scripts below remove that access while **keeping every row and file**. Nothing here deletes data.
They were tested against a local Postgres (PGlite) with the legacy SQL taken from git history — see
"Tested" below — but **not** against your live project.

## Manual decisions before you start

1. **Do you need the photos?** The page that showed them (Strength HQ) was removed. If you want them,
   download them first: Supabase → Storage → `progress-photos` → select all → Download.
2. **Who owns the photos?** Files uploaded with the anon key have `owner = null`, so the database can't
   say whose they are. If only you ever used the app, they're yours; if anyone else had the link, check
   with them. You only need to decide this if you later want a signed-in account to read them again
   (step 4). Until then nobody can read them through the API — you still can in the Dashboard.
3. **Do you need `app_state`?** It held the old legacy-sync copy. Step 2 copies it into a private schema
   before anything changes; you can export it from the Table Editor too.

## Order (Supabase → SQL Editor, one file at a time)

1. `01_inspect.sql` — read-only. Save the output (policy names, row/file counts, owners).
   If a policy name differs from the old SETUP.md, that's fine — step 3 drops every policy on
   `app_state` and only storage policies that mention `progress-photos`.
2. `02_backup.sql` — copies `app_state` rows and the photo file list into schema `private`
   (not reachable by the API). Check the counts it prints match step 1.
3. Download any photos you want (decision 1).
4. `03_lockdown.sql` — one transaction: drops the `app_state` policies, revokes browser-role privileges,
   removes it from Realtime, makes the bucket private, drops the bucket's policies.
5. `05_verify.sql` — read-only; every check should show the expected result in its comment.
6. Optional, only after decision 2: edit and run `04_owner_access_TEMPLATE.sql`.

Undo (if something unexpected breaks): the rows and files are untouched, so you can recreate a policy
from the step 1 output. Don't re-create the old `anon` "for all" policies.

## Also check (active tables)

`05_verify.sql` lists the policies on `life_os_state` (4: select/insert/update/delete own row) and
`assistant_usage` (2: select/insert own rows; no update/delete so the AI limit can't be reset).

## Tested locally

`scratchpad/pgtest/policies.test.mjs` (not in the repo) ran the old SQL from `2eaec6f:SETUP.md`, then
`01`–`03` and `05`, with Supabase-style roles and grants. It showed anon could read/overwrite `app_state`
and manage the bucket before; afterwards anon and signed-in users could do neither, rows/files and other
buckets' policies were unchanged, and re-running was safe. It also checked user A cannot read, write,
change or delete user B's `life_os_state` row or AI usage, and a stale conditional update changes 0 rows.
