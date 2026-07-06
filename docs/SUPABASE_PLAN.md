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
