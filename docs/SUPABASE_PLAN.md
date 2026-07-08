# SUPABASE_PLAN.md

## Status: Planning only. No implementation yet.

This document plans how Supabase becomes the future cloud sync foundation for the Life OS.
It does not implement anything. No Supabase client code, auth, or database wiring should be
added as a result of this document — see [ROADMAP.md](ROADMAP.md) Phase 9, which this expands on.

---

## 1. Why Supabase is being added

- Local Storage is per-browser, per-device. There is no cross-device sync for the Life OS
  proper (Command Centre, Daily Control Panel, Money HQ, Business HQ, etc.).
- A structured Postgres schema lets each HQ's data be queried, backed up server-side, and
  eventually shared with future native/mobile clients without re-implementing the whole
  Local Storage shape.
- Supabase Storage gives a real place for progress photos and (eventually) receipt images,
  which today are metadata-only placeholders (`appearance.progressPhotos[].imageUrl`,
  `money.receipts[]`) precisely because Local Storage can't hold binary/base64 image data.

## 2. Important existing state (found during audit)

A **partial, pre-existing Supabase integration already runs in production** and this plan must
not conflict with it:

- `scripts/sync.js` (`window.initCloudSync`) mirrors specific Local Storage keys to a single
  generic `public.app_state` table (`{ key, data jsonb, updated_at }`), one row per page,
  using Supabase Realtime for live cross-tab/cross-device updates.
- It is wired into `pages/caffeine.html` (appKey `caffeine`), `pages/finance.html` (appKey
  `finance`), `pages/health.html` (appKey `health`, Daily Stack + water only), `pages/main.html`
  (appKey `goals`, the daily `goals:` prefix), `pages/po-water.html` (appKey `water`), and
  `template/template.html` as the pattern for new pages.
- Credentials (`SUPABASE_URL` / anon `SUPABASE_KEY`) are hardcoded as fallback literals directly
  in `scripts/sync.js`, with an optional override via `window.DASH_SUPABASE_URL/KEY` (populated
  from Vercel env vars through `/api/config`, see `scripts/config.js`). The anon key is safe to
  expose (RLS-gated), but **it is a live, real key already committed to the repo**, not a
  placeholder — worth being aware of, not something this plan changes.
- RLS on `app_state` grants the `anon` role full read/write with no auth check (`using (true)
  with check (true)`) — anyone with the anon key can read or overwrite any row. Acceptable for a
  single-user hobby dashboard with no login; **not** acceptable once multi-user auth exists,
  since it would leak between accounts. This is flagged again in §9 (Security/RLS).
- This blob-sync system (one JSON blob per page, keyed by `appKey`) is architecturally different
  from the structured, per-entity tables proposed in §4 below. It stays as-is for now — it is
  **not** part of this phase's migration. See §11 for how the two are reconciled long-term.

**Implication for this plan:** the new structured schema (§4) is additive. It does not replace
`sync.js`/`app_state` yet. A future phase can decide whether to migrate the existing synced pages
(caffeine, water, Daily Stack, goals ticker, finance.html legacy page) onto the structured tables
or leave them on the blob-sync pattern permanently, since they're mostly small/simple stores.

## 3. What stays Local Storage for now (no change)

Everything currently implemented stays exactly as-is and remains the active source of truth:

- Command Centre (index.html), Daily Control Panel (`dailySnapshot`), Weekly Review
  (`weeklyReview`), Streaks (`streaks`), Business HQ (`business`), AI CEO (`aiCeo`), Boxing HQ
  (`boxing`), Health HQ (`health`), Hormone Optimisation (`hormones`), Appearance/Looks
  (`appearance`), Goals (`lifeGoals`), Life Stats (`lifeStats`), Heatmap (`heatmap`), Money HQ
  (`money`), Integrations (`integrations`), Settings/`core`, Backup (`backupSettings`), the
  existing `sync.js` blob-sync pages (caffeine, water, Daily Stack, goals ticker, finance.html).
- Backup/export/import (`scripts/backup-data.js`) continues to read/write raw Local Storage
  exactly as it does today — untouched by this plan.
- All read/write logic, upgrade-on-load patterns, and `window.<Section>.load()/.save()` APIs
  stay unchanged. No section's Local Storage shape changes as part of this plan.

## 4. What moves to Supabase later (Phase 3+)

Once implemented, Supabase becomes the cloud source of truth and Local Storage becomes the
offline/fallback cache, populated by the same shapes documented in `DATA_SCHEMA.md`. Every table
in §5 maps 1:1 to an existing Local Storage key/shape — no redesign of the data itself, only
where it's persisted.

## 5. Proposed Supabase tables

All tables include `user_id uuid references auth.users(id)` (nullable until Phase 2 auth exists)
and `updated_at timestamptz default now()`. Where the Local Storage shape is a single object
(not a list), the table holds one row per user; where it's an array, the table holds one row per
array item.

| Table | Maps to | Notes |
|---|---|---|
| `profiles` | (new) | id, display name, timezone, currency default — supports auth |
| `core_settings` | `core`, `integrations`, `backupSettings` | one row per user, thin aggregation |
| `daily_entries` | `dailySnapshot` | one row per user per `date`, full snapshot shape as jsonb or typed columns |
| `weekly_reviews` | `weeklyReview` | one row per user per `weekStart` |
| `streaks` | `streaks` | one row per user (current/best/history as jsonb) |
| `goals` | `lifeGoals.activeGoals` | one row per goal; `mainLifeGoal`/`twelveMonthGoal`/etc. live in `core_settings` or a `goals_meta` row |
| `money_accounts` | `money.accounts`, `money.assets`, `money.liabilities` | one row per account/asset/liability, `kind` column distinguishes them |
| `money_spending` | `money.spending` | one row per transaction |
| `money_income` | `money.income` | one row per income entry |
| `money_budgets` | `money.budgets` | one row per category; `spent` stays a recomputed view, not stored |
| `money_investments` | `money.investments` | one row per holding |
| `money_bills` | `money.bills` | one row per bill/subscription |
| `money_receipts` | `money.receipts` | log rows only; optional `storage_path` column added when Phase 6 lands |
| `business_projects` | `business.projects` | one row per project |
| `business_pipeline` | `business.pipeline` | one row per pipeline deal |
| `business_meta` | remaining `business` fields | currentFocus/activeProject/revenue targets, one row per user |
| `ai_ceo_advice` | `aiCeo.savedAdvice` | one row per saved advice entry |
| `ai_ceo_actions` | `aiCeo.actionPlan` | one row per action item |
| `ai_ceo_meta` | remaining `aiCeo` fields | activeMode/settings, one row per user |
| `boxing_logs` | `boxing.trainingLog` | one row per training log entry |
| `boxing_meta` | remaining `boxing` fields | phase/weights/targets, one row per user |
| `health_logs` | `health` | one row per user (mostly a daily-ish single record + checklists as jsonb) |
| `hormone_logs` | `hormones` | one row per user; `bloodwork` array as jsonb or its own child table if querying by marker becomes useful |
| `appearance_logs` | `appearance` | one row per user; `progressPhotos` metadata rows reference Storage paths once Phase 6 lands |
| `life_stats` | `lifeStats` | one row per user (manual scores + win/lesson/attention arrays as jsonb) |
| `heatmap_entries` | `heatmap.entries` | one row per user per `date` |
| `integrations_settings` | `integrations` | one row per user, per-service jsonb columns |
| `backups` | (new, optional) | server-side backup snapshots if/when automatic cloud backups are added, separate from the existing manual JSON export |

Design notes:
- Arrays-of-objects with a stable `id` (pipeline, projects, spending, bills, training log, etc.)
  become their own table with that `id` reused as the primary key — natural fit, no redesign.
  Arrays of default checklists (routines, supplements, lifestyle foundations) can stay as `jsonb`
  columns on the parent row rather than becoming tables, since they're small, fixed-shape, and
  never queried across users.
  Whole-object sections with no repeating list (`core`, `integrations`, most of `business`/
  `boxing`/`health`/`hormones`/`appearance`/`lifeStats`) become one row per user rather than a
  table per field.
- This is a plan, not a finished DDL — exact column typing (jsonb vs. typed columns) gets decided
  at implementation time per table based on what needs querying/filtering server-side.

## 6. Proposed Supabase Storage buckets

| Bucket | Purpose | Notes |
|---|---|---|
| `progress-photos` | Appearance/Looks progress photos | Already referenced in `SETUP.md` §2 SQL block as a proof of concept (public bucket, anon-writable) — this plan formalises it, tightens RLS once auth exists |
| `receipt-images` | Optional user-chosen receipt image retention | Off by default — see §7, images are discarded unless the user opts in |
| `exported-backups` | Server-side copies of Local Storage JSON exports | Optional, for cloud backup history beyond the local manual download |
| `documents` | Future general document storage (ID docs, contracts, misc PDFs) | Not tied to a current feature — reserved for later |

## 7. Receipt image flow (future, Phase 6)

Receipt images must **never** be written to Local Storage (already true today — see
`DATA_SCHEMA.md` Money HQ Data, "the photo is read client-side with `FileReader`... never
written to `localStorage`... discarded"). The future flow, once Supabase Storage exists:

1. User uploads/captures a receipt image (client-side only, as today).
2. If OCR/an extraction API exists by then, extract merchant/amount/date/category.
3. User confirms/edits the resulting spending entry (manual entry remains the fallback, as today).
4. Save the `money_spending` record (Supabase) / `money.spending` entry (Local Storage cache).
5. **Discard the image** unless the user explicitly opts to keep it — only then upload it to the
   `receipt-images` bucket and store its path on the `money_receipts` row. Default behaviour is
   no image persisted anywhere, cloud or local.

## 8. Authentication plan (Phase 2, not built yet)

- Supabase Auth, email+password and/or magic link to start — this is a single-user personal
  dashboard, so OAuth providers are a later nice-to-have, not a requirement.
- One authenticated user owns all their rows via `user_id`. No multi-tenant/sharing features are
  in scope for this plan.
- Until auth is built, the app has **no login** — this matches today's reality (`sync.js`'s
  `app_state` table already has no auth gate). Auth is what turns the existing wide-open anon RLS
  policy in §2 into something safe for a public deployment.
- Session handling, protected routes, and login UI are all deferred to Phase 2 implementation —
  not designed in detail here.

## 9. Security / RLS notes

- Every new table in §5 gets RLS enabled with a policy scoped to `auth.uid() = user_id` for
  select/insert/update/delete, once auth exists (Phase 2+). No table should ever use the
  `anon`-full-access pattern that `app_state` currently uses, except deliberately during a
  no-auth bootstrap period equivalent to today's.
- The Supabase anon/publishable key is safe to ship client-side (it's designed to be public) as
  long as RLS is correctly scoped — never use the `service_role` key in any client-shipped file.
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, e.g. inside a Vercel `/api/*` function) is only
  needed if a server-side admin task ever exists (bulk migration script, scheduled backup job).
  Not needed for normal client sync.
- Storage buckets should not default to `public: true` once auth exists — `progress-photos` is
  currently public per the existing SETUP.md SQL block, acceptable for a single-user hobby
  deployment today, but should move to authenticated-read/write once multiple users are possible.

## 10. Offline / fallback plan

- Local Storage remains fully functional standalone (no Supabase project configured = app works
  exactly as it does today — this is already true of every existing HQ page).
  Same pattern `sync.js` already follows: `if (!window.supabase) return;` / missing env vars =
  silently no-op, never throws.
  - Cloud is the source of truth once logged in and synced; Local Storage is the write-through
  cache, so the app keeps working offline and pushes/pulls on reconnect — same
  optimistic-local-write, async-remote-sync pattern `sync.js` already implements (`schedulePush`,
  `applyRemote`), just generalised across the structured tables instead of one `app_state` blob.
- If a Supabase request fails, the section's existing `window.<Section>.load()/.save()` Local
  Storage read/write keeps working unchanged — cloud sync is additive, never blocking.

## 11. Data migration plan (Local Storage → Supabase, Phase 4)

1. **Detect local data** — on first login, check for existing populated Local Storage keys
   (reuse `window.Backup.buildExport()`'s existing key enumeration, since it already knows every
   Life OS key).
2. **User logs in** (Phase 2 auth).
3. **Ask the user to migrate** — explicit opt-in prompt, never automatic/silent overwrite.
4. **Keep a backup before migration** — trigger the existing export flow
   (`window.Backup.buildExport()` → downloaded JSON) automatically before any upload, so there's
   always a pre-migration snapshot on the user's machine.
5. **Upload local dashboard data** — map each Local Storage key to its table(s) per §5 and insert/
   upsert rows scoped to the new `user_id`.
6. **Handle conflicts** — first migration for a fresh account is a pure upload (no conflicts
   possible). Re-migration or a second device logging in later compares `updated_at`; the plan is
   last-write-wins by timestamp, matching `sync.js`'s existing conflict approach, with the
   pre-migration backup as the safety net if that's ever wrong.
7. **Keep Local Storage as fallback** — migration copies data to Supabase, it does not delete or
   stop maintaining the Local Storage copy. Local Storage keeps being written by existing
   `window.<Section>.save()` calls; a sync layer mirrors those writes to Supabase in the
   background (same shape as `sync.js` today).
- Reconciling with the existing `sync.js` blob-sync pages (§2): out of scope for this migration
  pass. Those pages can keep using `app_state` indefinitely, or be migrated onto structured
  tables in a later cleanup phase — not required for the Life OS core migration to work.

## 12. Environment variables (future — names only, no real values)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   # only if a server-side admin task is ever needed; never shipped client-side
```

Note: the existing `sync.js` proof-of-concept uses differently-named vars (`SUPABASE_URL`,
`SUPABASE_ANON_KEY`, read via `/api/config` into `window.DASH_SUPABASE_URL/KEY` — see
`scripts/config.js` and `SETUP.md` §2). Whether the structured-schema implementation reuses
those exact names or adopts the `NEXT_PUBLIC_*` convention above is an implementation-time
decision, not decided by this planning doc.

## 13. Implementation phases (not started — planning only)

- **Phase 1** — Supabase project setup, env vars, no schema yet beyond what already exists.
- **Phase 2** — Auth/login (Supabase Auth), protected app shell.
- **Phase 3** — Cloud database sync for core dashboard data (tables in §5 for Daily Snapshot,
  Streaks, Weekly Review, Goals, Boxing, Health, Hormones, Appearance, Life Stats, Heatmap,
  Business, AI CEO).
- **Phase 4** — Migration from Local Storage (§11), including the pre-migration backup step.
- **Phase 5** — Money HQ sync (accounts, spending, income, budgets, investments, bills, receipts
  log) — split out from Phase 3 since Money HQ is the largest/most sensitive data surface.
- **Phase 6** — Receipt/progress photo Storage (§6, §7) — `progress-photos` and `receipt-images`
  buckets, opt-in image retention.
- **Phase 7** — Offline/fallback improvements — conflict resolution polish, background retry
  queue, sync status indicators in Integrations' Cloud Sync card (the `integrations.cloudSync`
  section already exists as a UI placeholder for this — see `DATA_SCHEMA.md` Integrations).

No phase beyond Phase 1's env-var setup should begin without a separate go-ahead — this document
is the audit/plan only.

## 14. Foundation audit & cleanup (2026-07-06)

A follow-up audit pass reviewed the codebase against this plan and made small, additive
foundation changes. No existing behaviour changed.

**What already existed (confirmed unchanged):**
- The `sync.js`/`topbar.js`/`gym.html` blob-sync system described in §2, including its hardcoded
  fallback URL/anon key. Left as-is — still out of scope for this plan, still working.
- `SETUP.md`'s `SUPABASE_URL` / `SUPABASE_ANON_KEY` env vars, read by `api/config.js` into
  `window.DASH_SUPABASE_URL/KEY`. Unchanged.
- No dedicated Supabase "client foundation" file existed before this pass — only the ad-hoc
  clients inlined in the three blob-sync files above.

**What was added (foundation only, nothing wired to any page's data):**
- `scripts/supabase-status.js` — a new, separate foundation module. Reads only
  `window.NEXT_PUBLIC_SUPABASE_URL` / `window.NEXT_PUBLIC_SUPABASE_ANON_KEY`, no hardcoded
  fallback. Exposes `window.SupabaseFoundation.isConfigured()`, `.getClient()` (returns `null`,
  never throws, if env vars or the supabase-js script are missing), and `.getStatus()` (reports
  `configured` / `authEnabled` / `readyForFutureSync`).
- `api/config.js` now also passes through `NEXT_PUBLIC_SUPABASE_URL` /
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the §12 naming) alongside the existing legacy vars — kept as
  two separate configs so the new foundation never touches the live blob-sync key.
- Integrations page Cloud Sync card now states plainly that Local Storage is active, Supabase is
  foundation-only, no login/database sync exists, and no data has been migrated — plus a live
  "Env status" line from `SupabaseFoundation.getStatus()`. The existing demo "Sync now" mock no
  longer claims "Connected"; it now reports "Foundation only — not connected".

**What remains before real sync can be enabled:**
- Phase 1: create/confirm the Supabase project and set `NEXT_PUBLIC_SUPABASE_URL` /
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel (currently unset — the foundation reports
  "not configured" until then).
- Phase 2: auth/login (nothing built yet — `getStatus().authEnabled` is hardcoded `false`).
- Phase 3+: the structured tables in §5, and actually reading/writing through
  `SupabaseFoundation.getClient()` from any page.

**Next implementation step:** Phase 1 only — set the two `NEXT_PUBLIC_*` env vars against a real
(or throwaway test) Supabase project and confirm `SupabaseFoundation.getStatus().configured`
flips to `true` on Integrations, with no other behaviour change. Do not start Phase 2+ without a
separate go-ahead.

## 15. Legacy blob-sync security cleanup (2026-07-06)

A second follow-up pass secured the §2 legacy blob-sync system ahead of any real auth/database
work. No data migrated, no new tables, no login UI, no change to any page's data shape.

**Removed:**
- The hardcoded fallback Supabase URL/anon key literals in `scripts/sync.js`, `scripts/topbar.js`,
  and `pages/gym.html` (the live key noted in §2). All three now read only from
  `window.DASH_SUPABASE_URL/KEY` (via `/api/config`), defaulting to `''` — no literal credential
  remains anywhere in the repo.

**Added — explicit enable gate:**
- A new env var, `SUPABASE_LEGACY_SYNC_ENABLED`, passed through `api/config.js` as
  `window.DASH_SYNC_ENABLED`. The three legacy files now no-op (Local Storage only) unless
  **both** the URL/key are set **and** this flag is explicitly `true` — being configured is no
  longer sufficient on its own to turn sync on. See `SETUP.md` §2.
- All three files gained a short "LEGACY" header comment pointing back to this doc and to
  `SupabaseFoundation` as the pattern for any future sync work — nothing new should be built
  against `sync.js`'s pattern.

**Integrations page:** the Cloud Sync card's env-status line now reports four things plainly:
Local Storage active, Supabase configured or not, legacy blob-sync enabled or disabled (and why),
and that full auth/database sync is not built and no migration has happened.

**Still true, unchanged:** everything in §2 and §14 about the blob-sync architecture itself
(one JSON blob per page in `app_state`, RLS wide open to `anon`) — this pass only removed the
hardcoded credential and added the enable gate, it did not change how sync works once enabled or
touch RLS. That remains future work, not required before Phase 1.

**Next step unchanged from §14:** Phase 1 env var setup, then Phase 2 auth before RLS can be
tightened.

## 16. Auth foundation added (2026-07-06)

Phase 2 (§13) built: sign up / sign in / sign out, on top of the existing `SupabaseFoundation`
client (§14). No dashboard data reads/writes through this — auth only.

**Added:**
- `scripts/supabase-auth.js` — new module, `window.SupabaseAuth`. Wraps
  `SupabaseFoundation.getClient()`'s `auth.signUp` / `auth.signInWithPassword` / `auth.signOut` /
  `auth.getSession` / `auth.onAuthStateChange`. Exposes `getState()` (`{ configured, loading,
  error, user, session }`), `subscribe(fn)`, and the three action methods. Every method resolves
  `{ error }` instead of throwing when Supabase isn't configured — same fail-safe pattern as
  `SupabaseFoundation.getClient()`.
- Integrations page — new **Account** card (above Cloud Sync): shows configured/not-configured,
  sign in/sign up forms when logged out, email + sign out button when logged in, and a fixed note
  that this does not move any dashboard data. Cloud Sync card's env-status line now also reports
  auth enabled/not and signed-in/signed-out.
- Command Centre (`index.html`) — small subtle indicator next to the settings gear: **Local
  only** (not configured) / **Not signed in** (configured, logged out) / **Signed in** (logged
  in). Purely a status readout, no click behaviour.
- `scripts/supabase-status.js`'s `getStatus().authEnabled` now reflects reality (`true` once
  configured, since sign in actually works) instead of the previous hardcoded `false`.

**What auth does now:**
- Creates/signs in/out of a real Supabase Auth user (email + password) when
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set.
- Persists the Supabase session (via supabase-js's own storage) across reloads on Command Centre
  and Integrations, the two pages that load `supabase-auth.js`.

**What it does not do yet:**
- No dashboard data (any HQ page) is read from or written to Supabase — Local Storage remains the
  only active storage system, unchanged, per §3.
- No `user_id` scoping, no RLS changes, no structured tables (§5) — those are Phase 3+.
- No data migration (§11) has run or been triggered from this UI.
- Auth isn't required to use the app — every page works exactly as before with no one signed in.
- Not wired into every page — only Command Centre and Integrations load `supabase-auth.js` today;
  the rest of the Life OS doesn't reference auth state at all.

**Next phase:** Local Storage → Supabase migration/sync (§11, Phase 3+) — still not started, and
should not start without a separate go-ahead per §13.

## 17. Phase 1 cloud sync added (2026-07-06)

A manual cloud sync foundation was built on top of §14's `SupabaseFoundation` and §16's
`SupabaseAuth` — the first real cross-device sync in the Life OS. This is a deliberate
simplification of §4/§5's full per-section table plan: **one JSON blob per user**, not the ~25
structured tables in §5. Those tables are still the eventual destination (§13 Phase 3+); this is
the safe, minimal first step.

**Single JSON state approach:**
- Table `public.life_os_state`: `id` (uuid PK), `user_id` (uuid, unique, FK to `auth.users`),
  `data` (jsonb — the entire Local Storage key/value map, same shape as
  `window.Backup.buildExport().data`), `data_version`, `updated_at`, `created_at`.
- One row per user. RLS scoped to `auth.uid() = user_id` for select/insert/update/delete — this
  is the pattern §9 said every new table should use, and the first table to actually use it
  (unlike `app_state` in §2, which stays wide-open `anon` access, untouched).
- Full SQL is in `SETUP.md` under "Real Cloud Sync (Phase 1)".

**Added:**
- `scripts/cloud-sync.js` — new module, `window.CloudSync`. Wraps `SupabaseFoundation.getClient()`
  and reuses `window.Backup.buildExport()` / `.apply()` for the actual data shape (no new
  export/import format — cloud sync moves the exact same payload backup/export already uses,
  to/from one Supabase row instead of a downloaded file). Exposes `isAvailable()`,
  `getCloudStatus()` (row exists? last updated?), `pushToCloud()`, `pullToLocal()`, and a
  best-effort `latestLocalTimestamp()` (scans Local Storage for the newest ISO timestamp found,
  since no single "last modified" field is tracked across every HQ section yet).
- Integrations page — Cloud Sync card gained a "Real Cloud Sync (Phase 1)" section below the
  existing demo controls (untouched): signed-in user, Local Storage active/empty, last local
  update, last cloud sync time, and three buttons — Push local → cloud, Pull cloud → this device,
  Sync now. All three are disabled unless Supabase is configured and the user is signed in.

**What sync does now:**
- Push: uploads the full current Local Storage dataset to the user's `life_os_state` row
  (upsert, overwrites whatever was there).
- Pull: downloads the user's row and applies it via `window.Backup.apply()` (same
  validate/overwrite path as restoring a backup file), then reloads the page.
- Sync now: checks cloud status first; if no cloud row exists yet, offers to push; otherwise
  compares `latestLocalTimestamp()` against the cloud row's `updated_at` and recommends a
  direction (push if local looks newer, pull if cloud looks newer) — the user still confirms
  before anything happens.
- Every action shows both timestamps and requires an explicit confirm dialog before overwriting
  either side — no silent overwrite in either direction, per §10's offline/fallback principle.
- Local Storage keeps working exactly as before regardless of any of this — not configured, not
  signed in, or a Supabase request fails, and every page's existing `load()/save()` calls are
  completely unaffected.

**What remains future (unchanged from §13):**
- Full relational tables (§5) — the ~25 structured, per-entity tables (`daily_entries`,
  `money_spending`, `business_pipeline`, etc.) instead of one JSON blob. Still Phase 3+.
- Supabase Storage (§6) — no bucket created or wired up by this pass.
- Receipt images / progress photos — still never written anywhere but discarded client-side
  metadata, per §7. Not part of the `life_os_state` blob.
- Offline conflict resolution beyond "ask the user and show both timestamps" — no automatic
  merge, no operational-transform/CRDT logic, no retry queue (§7 of the roadmap, formerly labelled
  Phase 7).
- Multi-device automatic background sync — everything above is manual/button-triggered only, on
  purpose. No realtime channel, no interval polling, no sync-on-save hook.
- Migrating the legacy `sync.js`/`app_state` blob-sync pages (§2) onto this or the future
  structured schema — still explicitly out of scope, per §2 and §11.

**Next step:** none required — Phase 1 manual sync is usable as soon as the SQL in `SETUP.md` is
run and the user is signed in. Any further phase (structured tables, Storage, background sync)
needs a separate go-ahead per §13.

## 18. Phase 1 setup/status polish (2026-07-06)

A follow-up pass made Phase 1 (§17) easier to configure, verify, and use safely. No new tables,
no background sync, no Storage — setup, status, and sync-safety polish only.

**Added:**
- `supabase/life_os_state.sql` — the §17 table/RLS SQL extracted into its own idempotent file
  (safe to re-run). `SETUP.md` now links to it instead of only inlining the SQL.
- `SETUP.md` gained a Phase 1 setup checklist, a Vercel deployment-notes block (env vars belong in
  Project Settings not just `.env.local`; redeploy after changing them; Preview deployments need
  their own copy), and a manual testing checklist covering the not-configured / configured / sign
  in / push / pull / second-device / backup-still-works paths.
- `scripts/cloud-sync.js` now persists the last push/pull failure (`lastError`/`lastErrorAt` in the
  existing `cloudSyncMeta` Local Storage key), cleared automatically on the next success. Previously
  a sync error only appeared in the moment; it's now visible again after a reload until the next
  successful push/pull.
- Integrations page's Real Cloud Sync section now reads that persisted error on render and shows
  it, so a stale/forgotten sync error is never silently lost.

**Unchanged:** the `life_os_state` table shape, RLS policies, push/pull/sync-now behaviour,
confirm-before-overwrite dialogs, and env var names — all exactly as §17 left them.

**Next step:** none required. Still Phase 1 only — no further phase without a separate go-ahead
per §13.

## 19. Cloud Sync reliability polish (2026-07-07)

A reliability/clarity pass over Phase 1 (§17–§18). No new tables, no Storage, no background sync —
wording, timestamp, and conflict-safety polish only, since cross-device use makes correctness and
clarity more important than new features at this stage.

**Added:**
- `window.CloudSync.getSyncStatus()` — the single source of truth for the seven status states
  (Local only, Signed out, Cloud ready, Local newer, Cloud newer, Synced, Sync error), used by both
  the Quick Sync panel (Command Centre) and the Integrations Cloud Sync card so they can never
  disagree. Replaces each surface's own copy of this logic, and splits the old single "Needs sync"
  state into "Local newer" / "Cloud newer" so the user always sees which side is ahead before
  choosing a direction.
- `window.CloudSync.lastDeviceSyncAt()` — this device's own last successful push/pull, distinct
  from the cloud row's `updated_at` (which may reflect a different device's last write). Shown on
  the Integrations Real Cloud Sync section alongside "Last local save" and "Last cloud update"
  (renamed from "Last cloud sync", which was actually the row's `updated_at`, not this device's).
- `window.Backup.downloadExport()` — the Data & Backup export button's download logic, moved into
  `backup-data.js` so it can be reused. Both Pull Cloud → This Device and a Sync Now that resolves
  to a pull now offer (never force) exporting a backup first, on both the Quick Sync panel and the
  Integrations Cloud Sync card. Skipped automatically when there's no local data to protect.

**Unchanged:** the `life_os_state` table shape, RLS policies, and the underlying
push/pull/sync-now/confirm-before-overwrite behaviour from §17–§18 — still manual, still
button-triggered only, still never silently overwrites either side.

**Next step:** none required. Still Phase 1 only — no further phase without a separate go-ahead
per §13.

## 20. Auto Cloud Save v1 (2026-07-08)

The first background sync in the Life OS, built directly on §17's `CloudSync.pushToCloud()` —
**push-only, by design**. It never calls `pullToLocal()`, so it can never overwrite this device's
Local Storage; pulling remains a manual, confirmed action via Quick Sync / Integrations exactly as
in §17–§19.

**Added:**
- `scripts/auto-sync.js` — new module, `window.AutoSync`. Wraps `localStorage.setItem`/
  `.removeItem` once to detect meaningful writes (an exclude-list filters out UI/ephemeral keys —
  `sidebar_collapsed_groups_v1`, the WHOOP demo timestamp, ForceSave's write probe — and, critically,
  `cloudSyncMeta` and Supabase's own `sb-*` session-token keys, so a push's own bookkeeping write can
  never re-trigger itself). Each meaningful change debounces a push 4s after the last edit, with a
  45s max-wait ceiling during continuous editing, plus a cheap 5-minute fallback check. Before every
  push it calls `ForceSave.flushAll()`, then requires Supabase configured + signed in, the browser
  online, and the tab visible; it reads `CloudSync.getSyncStatus()` and skips if cloud is newer or
  in error (those states need the user's manual choice, never an automatic overwrite). An in-flight
  guard means only one push runs at a time; a change that lands mid-push coalesces into one
  follow-up push instead of a second concurrent one; and a cheap hash of the exportable payload
  (same exclude-list applied) skips the network call entirely when nothing meaningful changed.
- Command Centre's Quick Sync panel and Integrations' Cloud Sync card each gained two small stat
  tiles — Auto Save (one of: Auto save on / Syncing / Synced / Action needed / Offline / signed
  out) and Last auto push — reusing the existing `qs-stat`/`int-stat` tile styling exactly, no new
  UI pattern introduced.

**Coverage:** only Command Centre (`index.html`) and Integrations (`pages/integrations.html`)
loaded the full `SupabaseFoundation` + `SupabaseAuth` + `Backup` + `CloudSync` + `ForceSave` chain
`auto-sync.js` needs — those were the only two pages wired up. Extended to full core-page coverage
in v2, see §21.

## 21. Auto Cloud Save v2 — full core-page coverage + safe cloud-load prompt (2026-07-08)

**Added:**
- Every core editable Life OS page (Daily Snapshot, Goals, Business HQ, Boxing HQ, Health HQ,
  Hormone Optimisation, Appearance, Money HQ, Weekly Review, Life Stats, Heatmap) now loads
  `supabase-status.js` → `supabase-auth.js` → `backup-data.js` → `cloud-sync.js` → `force-save.js` →
  `auto-sync.js`, same order and script tags as Command Centre/Integrations. No new script content
  per page — just the existing chain.
- `auto-sync.js`'s `init()` now calls `window.SupabaseAuth.init()` itself (idempotent — `SupabaseAuth`
  already guards against double-init), since most of these pages have no sign-in UI of their own to
  trigger the session fetch. Command Centre/Integrations already called it from their own settings/
  sign-in UI, so no change in behaviour there.
- Pages with debounced fields but no existing `ForceSave.registerFlush()` call (Goals, Business HQ,
  Boxing HQ, Health HQ, Hormone Optimisation, Appearance, Weekly Review, Life Stats, Heatmap) each
  gained the smallest possible flush registration — clear the pending debounce timer(s) and call the
  page's existing `save()` — following the exact pattern Daily Snapshot already used. Money HQ has no
  debounced fields, so none was needed.
- New guarded cloud-load check, `checkCloudLoad()` inside `auto-sync.js` — the only place this module
  ever calls `CloudSync.pullToLocal()`, and only after an explicit `confirm()`. Runs on load, on
  visibility/online, on sign-in change, and on the existing 60s status tick. It flushes pending saves
  first, then only proceeds when `CloudSync.getSyncStatus()` is exactly `cloud-newer` — meaning this
  device's own latest-timestamp scan is behind the cloud row, i.e. no unsynced local edits by the
  same logic §17's Quick Sync already relies on. `local-newer` and `error` are untouched — still
  manual Quick Sync only, never auto-pulled. A `sessionStorage` key remembers the cloud row's
  `updated_at` already asked about, so the same cloud version is never prompted for twice — no
  repeated-prompt loop across page navigations or the periodic tick.

**Unchanged:** the push path (still push-only, still dedup/coalesce/in-flight-guarded as in §20), the
`life_os_state` table shape and RLS policies, and manual Quick Sync/Force Local Save/Push/Pull/Sync
buttons on Command Centre and Integrations.

**Next step:** none required. Still Phase 1 only.

**Unchanged:** manual Quick Sync (push/pull/sync now), Force Local Save, the `life_os_state` table,
RLS, and every existing push/pull confirm-before-overwrite dialog — all exactly as §17–§19 left
them. No new Local Storage key, no Supabase schema change.

**Next step:** none required. Still push-only background save — no auto-pull, no conflict
auto-resolution, no further phase without a separate go-ahead per §13.
