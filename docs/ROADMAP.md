# ROADMAP.md

## V1 Status — Complete (2026-07-09)

Life OS v1 is feature-complete and stable enough for daily use. Phases 1-8 below are done, plus
AutoSync/Supabase cloud sync, Google Calendar, Weather, WHOOP (available with env setup), Money HQ
Investments v1, Trading 212 read-only import, Daily Snapshot / Daily Guidance, Weekly Review, Goals,
Business HQ, Boxing HQ, and Health / Hormones / Appearance.

**Rule: use v1 daily for 7-14 days before starting any major new build.** The point of this window
is to find out which parts actually get used and which rough edges show up in real daily use, before
committing more build time. Small fixes/polish to existing v1 sections are fine during this window —
it's new v2-scale features that should wait. See "V2 Candidate Backlog" below for what's queued
after the window, and the "V2 rule" for what should actually get built from it.

---

## AI Integration Direction

Live AI API integration (OpenAI/Claude) is deferred until later.

The Life OS uses the AI CEO Prompt Builder for now: generate a prompt, copy it, paste it into ChatGPT/Claude, then save the useful advice/actions back manually.

No live API calls, no exposed keys, no server-side AI routes yet. This will change when the user is ready to wire up a real key.

---

## Phase 1 ✅

Project Structure

Documentation

Folder Organisation

Reusable Components

---

## Phase 2

Daily Dashboard

Daily Snapshot ✅

Streaks ✅

Sidebar Navigation ✅

Compact Dashboard Layout ✅

Command Centre Cleanup ✅ (Main renamed to Command Centre, Today top bar, shared `core` data foundation, old duplicate homepage cards de-prioritised)

Weather

Calendar

Quote

Search

---

## Phase 3

Boxing HQ ✅

Fight Camp ✅

Weight Tracking ✅

Recovery

Running ✅

Coach Notes ✅

Analytics

---

## Phase 4

Business HQ ✅

Multiple Businesses ✅

Revenue ✅

Leads ✅

Tasks ✅

AI Business Assistant ✅ (prompt-powered — no live API yet)

---

## Phase 5

Money HQ ✅ (pages/money-hq.html — replaces the old Finance page; own internal bottom tab bar, `money` localStorage key)

Net Worth ✅ (bank, cash, crypto, other assets, liabilities, auto-calculated total, snapshot history)

Cash ✅ (tracked as its own Net Worth category)

Investments ✅ (optional shares/currentPrice holdings model with ticker/account, auto-calculated value, gain/loss, allocation by type; Trading 212 read-only positions import ✅ — `api/trading212-data.js` + Investments tab "Preview Trading 212 holdings" → confirm-to-apply flow, plus a "Remove Trading 212 imported rows" action, manual refresh only)

Bills ✅ (Bills / Subscriptions tab — due dates, frequency, status, monthly recurring total)

Income ✅ (source, type, monthly total, income by source)

Expenses ✅ (Spending tab — manual entry, categories, monthly total, spending by category; Receipts tab adds photo-assisted manual entry, OCR left as a future upgrade)

Property (still future — no dedicated property tracking yet; log as an "Other asset" / "Liability" in Net Worth for now)

---

## Phase 6

Hormone Optimisation ✅

Appearance / Looks ✅

Goals ✅

Life Stats ✅

Heatmap ✅

Progress Tracking

---

## Phase 7

Automation

Integrations Foundation ✅ (pages/integrations.html — reusable card/data foundation, mock/demo state only)

Google Calendar ✅ (real OAuth, read-only — scripts/google-calendar-service.js + api/google-calendar-*.js)

Weather API ✅ (real connection — Open-Meteo by default, no key required; optional OpenWeatherMap via `WEATHER_API_KEY` — api/weather.js)

Finance API (superseded by Trading 212 read-only import in Phase 5 — see Money HQ)

Whoop ✅ (real OAuth, read-only — api/whoop-*.js + pages/health.html; requires `WHOOP_CLIENT_ID`/`WHOOP_CLIENT_SECRET` env vars, see SETUP.md §4)

AI APIs (real connection — not yet live)

Local Storage

---

## Phase 8

Advanced Analytics

Predictions

Trend Analysis

Performance Reports

AI Coaching

Morning Briefings

Evening Reviews

Weekly Review ✅ (pages/weekly-review.html — `weeklyReview` localStorage key; pulls a live performance snapshot from Streaks, Boxing HQ, Business HQ, Money HQ, Health HQ, Goals and Heatmap, plus reflection questions, next-week planning, and an AI review prompt builder — prompt-powered, no live API yet)

Daily Guidance Engine v1 ✅ (scripts/daily-guidance-data.js — deterministic, local, no AI API; reads Business/Boxing/Goals/Health and fills blank Daily Snapshot mainFocus/priorities as defaults only; full Morning Briefings / AI Coaching below are still future work)

Daily Guidance Engine v2 ✅ (scripts/daily-guidance-data.js — now also reads Daily Snapshot's archived `history` for the most recent day: unfinished priorities become a "Carry over" nudge, yesterday's `tomorrowPriority` can become today's focus theme, and a rough yesterday biases the focus toward recovery, same rules/deterministic-only as v1)

---

## Strength HQ v1 ✅ (2026-07-10)

Built as an explicit user-requested exception to the "use v1 daily for 7-14 days first" rule above (v1 was marked complete 2026-07-09, one day prior) — noted here for the record, not as a precedent for skipping that window on future v2-scale features.

12-week periodized Boxing + Gym programme (`pages/gym.html`, retitled "Strength HQ"; `training` localStorage key via `scripts/training-data.js`) — fixed weekly schedule (boxing/mobility, Gym A Squat-Bench, Gym B Deadlift-Overhead, optional Gym C Athletic Hypertrophy), rule-based progressive overload (main-lift accept/repeat/reduce/flag, double progression, pull-up ladder, power/quality-gated), readiness-driven autoregulation, resumable in-progress workouts, personal records, mobility checklist + periodic tests, Week 12 assessment. Replaces the old orphaned, generic "Progressive Overload Coach" build (kept as a plain backup at `pages/gym-legacy-backup.html`) — its Weight Tracker and Progress Photos sections were carried over unchanged. Cross-linked into Command Centre, Weekly Review, Life Stats, Boxing HQ and Health HQ; see DATA_SCHEMA.md.

---

## Phase 9 (future — not started)

Supabase Cloud Stage

Authentication / login

Cloud database sync across devices

Migration from Local Storage to cloud storage

User data backup (cloud-side, in addition to the existing local export/import in Integrations)

Supabase Storage for receipt images / progress photos (currently metadata-only placeholders in Money HQ receipts and Appearance progress photos)

Local Storage stays as the offline/fallback storage layer where possible — this is an additive cloud stage, not a rewrite of the existing data layer. `scripts/sync.js` already mirrors a few keys (Health, Gym, Water) to Supabase as an early proof of concept; this phase generalises that pattern to the whole Life OS.

No Supabase code, auth, or database wiring is implemented as part of this roadmap entry — planning note only.

---

## V2 Candidate Backlog (not started / future)

Everything in this section is an idea, not a plan. Nothing here is scheduled, nothing here is in
progress, and none of it should be started before the v1 daily-use window above has run its course.
Each group splits **Bugs / known issues** (things already partly broken or missing that a v2 pass
would fix) from **Feature ideas** (net-new capability). See also `docs/FEATURE_REQUESTS.md`, the
existing long-form innovation backlog — the groups below are a v2-focused re-cut of that same list,
not a replacement for it.

### Daily Intelligence v2

Bugs / known issues:
- None known — v1 Daily Snapshot / Daily Guidance / Weekly Review are working as designed; log real issues here as they surface during daily use.

Feature ideas:
- AI Morning Briefing (calendar + business + weather + training + recovery + finance + goals, one generated summary)
- AI Evening Review (auto-drafted from the day's logged data, not just manual reflection)
- Richer trend view across Daily Snapshot's history archive (beyond Weekly Review's current draft-suggestions use of it)

### Money HQ v2

Bugs / known issues:
- OCR for Receipts is still a manual/photo-assisted placeholder, not real text extraction (documented as a known future upgrade since Phase 5)
- Property has no dedicated tracking yet — currently logged as a generic "Other asset" / "Liability" in Net Worth

Feature ideas:
- Net worth graph / history chart (snapshot history already exists, just not charted)
- Dividend tracking
- Cashflow analysis and savings projections
- Property portfolio module (mortgage, equity, rental income)
- Real OCR for Receipts
- Additional brokerage/bank read-only imports beyond Trading 212

### Business HQ v2

Bugs / known issues:
- None known — pipeline value roll-up and revenue tracking are working as designed.

Feature ideas:
- Lightweight CRM (clients/prospects beyond the current leads/pipeline model)
- Revenue forecasting
- Monthly auto-generated reports
- Automation tracking (which business tasks are automated vs manual)

### Boxing / Health v2

Bugs / known issues:
- None known — weekly counter rollover and Sleep Planner are working as designed.

Feature ideas:
- Performance graphs (weight trend, conditioning, training volume over time)
- Running analytics
- Recovery trend charts (beyond the current single WHOOP recovery score)
- Sleep analytics (beyond the current Sleep Planner's single-night recommendation)
- Coach feedback log tied to specific sessions

### Strength HQ v2

Bugs / known issues:
- Nova (the in-page AI chat coach) is not yet given awareness of the new `training` data — it still only reads bodyweight/photos context.
- Programme Editor supports pause/notes/reorder-by-number but not full drag-and-drop reordering.

Feature ideas:
- Nova awareness of programme week/phase/PRs for richer coaching answers
- Full drag-and-drop exercise reordering in the Programme Editor
- Deeper mobility trend analysis (currently a simple last-2-tests comparison)
- Alternate/custom programmes beyond the single fixed default 12-week block

### AI Coach layer v2

Bugs / known issues:
- None — this layer isn't built yet, so there's nothing to fix.

Feature ideas:
- Live AI API integration (OpenAI/Claude) — see "AI Integration Direction" above; still deliberately deferred
- AI Knowledge Base (AI Assistant referencing project docs, goals, businesses, training, finance, notes)
- Coaching that reads across sections automatically instead of the current copy-paste Prompt Builder workflow

### UX / mobile polish v2

Bugs / known issues:
- No dedicated mobile layout pass has been done — usability on small screens is unverified.
- Progress photos (Appearance) and Receipts (Money HQ) are metadata-only placeholders; no real image storage is wired up yet (Supabase Storage is the planned destination, per Phase 9).

Feature ideas:
- Mobile responsiveness pass across all HQ pages
- Supabase Storage wiring for receipt images / progress photos
- Global search across sections

### Data quality / tests v2

Bugs / known issues:
- Automated test coverage is limited to `tests/autosync-watchdog.test.mjs` (Auto Cloud Save only) — no coverage elsewhere.

Feature ideas:
- Data validation pass across the `-data.js` layer (defensive reads exist per-section, but there's no shared/systematic validation)
- Broader automated test coverage beyond Auto Cloud Save
- A recurring "data health" check (e.g. surfacing stale/missing fields) rather than relying on manual audits

---

## V2 rule

Only build a v2 feature once daily use has actually proven it's needed, or the user has explicitly
asked for it. No building ahead of demonstrated use — see `docs/FEATURE_REQUESTS.md`'s own rule
("never build features simply because they are possible") for the same principle applied to the
wider backlog.

---

## Ultimate Goal

A complete Life Operating System.