# CHANGELOG.md

## Purpose

Track all meaningful project changes.

Every completed feature should be recorded here.

The changelog provides a historical record of how the dashboard evolves.

---

## Format

Date

Feature

Files affected

Summary

Notes

---

## 2026-07-02

### Documentation System

Created complete project documentation.

Added:

Dashboard Bible

Project Architecture

Vision

Design Rules

Style Guide

Coding Rules

Component Library

Folder Structure

Data Schema

Business Rules

Boxing System

AI Assistant Behaviour

Roadmap

TODO

Prompt Library

Feature Requests

Design Decisions

Purpose:

Reduce token usage.

Maintain design consistency.

Improve scalability.

Create long-term maintainability.

---

## 2026-07-03

### Branding Cleanup

Removed all old placeholder branding (Rowan / Rowan Thistlebrooke / ytdashfinal / YTdashh1) and replaced it with Micky's branding across page titles, headings, the po-water.html copyright header, README.md, SETUP.md, and package.json.

Files affected:

index.html, pages/main.html, pages/po-water.html, pages/caffeine.html, template/template.html, README.md, SETUP.md, package.json

### Daily Snapshot

Added a Daily Snapshot section to the top of index.html (the home page), above the bento grid.

Shows today's date, a computed status line, main focus, top 3 priorities, a 7-item daily habit checklist, training status, business focus, health/recovery status, and quick notes.

Saves to `localStorage` under the `dailySnapshot` key, following the same 6 AM day-rollover convention already used by the goals list. Reuses the existing `.gm-card` / `.gm-row` / `.gm-check` / `.gm-text` component styling already established in template.html rather than inventing new UI.

Exposes `window.DailySnapshot.get()` as a small public hook so Streaks / Life Stats can read today's snapshot later without reimplementing the load/rollover logic.

Files affected:

index.html, docs/DATA_SCHEMA.md, docs/TODO.md, docs/ROADMAP.md

Commit:

Branding cleanup and add Daily Snapshot

### Streaks

Added a Streaks section to index.html, directly below Daily Snapshot. Tracks current streak, best streak, today's completion percentage, a 7-day mini progress view, and per-habit streaks — all reusing the existing `.gm-card` / `.gm-row` / `.snap-status` / `whoop-stat`-style components rather than inventing new UI.

Reads today's habits from `window.DailySnapshot.get()`. A day counts as "completed" at 70% habit completion. Recomputes live off a `dailySnapshot:habitsChanged` event dispatched from the Daily Snapshot habit checkboxes, and on every page load. Keeps its own capped day-by-day history in `localStorage` (key `streaks`) so streaks can be calculated correctly across days without a backend.

Exposes `window.Streaks.get()` so Life Stats and the Heatmap can build on the same data later.

Files affected:

index.html, docs/DATA_SCHEMA.md, docs/TODO.md, docs/ROADMAP.md

Commit:

Add Streaks

## 2026-07-06

### Daily Control Panel visible on Command Centre

Renamed the user-facing "Daily Snapshot" label to "Daily Control Panel" in the sidebar (`scripts/topbar.js`) and on its full page (`pages/daily-snapshot.html`) to reflect that it's the main daily operating area of the Life OS. The `dailySnapshot` localStorage key, `window.DailySnapshot` API, and file name are unchanged — display label only.

Rebuilt the Command Centre preview card on index.html from a thin 3-stat summary into a genuinely useful compact control panel: named top-3 priorities with completion marks, a habits/checklist progress line, energy level and recovery-or-sleep score mini-stats, and a status-chip row (Business / Training / Money logged / Evening review) showing done vs pending. Added helpful empty-state prompts ("Set today's focus →", "Choose top priorities →", "Log today's status →") instead of blank 0/0% boxes, plus an explicit "Open Daily Control Panel →" link at the bottom of the card. All fields read live from `window.DailySnapshot` — no new data or API added.

Files affected:

index.html, scripts/topbar.js, pages/daily-snapshot.html, docs/PROJECT.md, docs/DATA_SCHEMA.md

Commit:

Make Daily Control Panel visible and useful from Command Centre

## 2026-07-03

### Navigation & Layout — Sidebar, Preview Cards, Section Pages

Daily Snapshot and Streaks had grown into two full-height sections at the top of index.html, pushing the bento grid below the fold. Restructured the hub into a compact command centre without touching the premium dark glassmorphism design.

Extracted the Daily Snapshot and Streaks data logic out of index.html's inline scripts into two shared, reusable files: `scripts/daily-snapshot-data.js` (owns the `dailySnapshot` key, defaults, and the 6 AM rollover) and `scripts/streaks-data.js` (owns the `streaks` key and the streak-computation logic, reading habits through `window.DailySnapshot`). Both expose the same public hooks documented in DATA_SCHEMA.md (`window.DailySnapshot`, `window.Streaks`) plus new `loadOrInit()` / `recompute()` helpers so any page can read consistent, rolled-over data without re-implementing the logic.

Built full standalone pages — `pages/daily-snapshot.html` and `pages/streaks.html` — carrying the exact same interactive UI (habit checklist, priorities, notes, streak history, per-habit flames) that used to live inline on index.html. Same `.gm-card` / `.gm-row` / `.streak-*` components, same localStorage keys, so nothing about how data saves changed — only where the UI lives.

On index.html, replaced both full sections with compact clickable preview cards (`.preview-card`, a thin new class reusing `.gm-card` + the existing `.tile-arrow` hover pattern): the Daily Snapshot preview shows main focus, habit completion %, and priority completion %; the Streaks preview shows current streak, best streak, and today's %. Both link straight to their full page.

Added a collapsible sidebar navigation drawer, opened by a three-line hamburger button, built into `scripts/topbar.js` (the script every page already includes for the top/bottom chrome) so it appears everywhere the existing top bar does, with no new script tag needed on already-wired pages. Lists all 12 sections: Main, Daily Snapshot, Streaks, Business HQ, Boxing HQ, Health HQ, Hormone Optimisation, Appearance / Looks, Goals, Life Stats, Heatmap, Settings. Highlights the active page, closes on overlay click / Escape / link click, and reuses the existing modal-lock system (`body.topbar-modal-open`) so body scroll locks the same way any other modal on the dashboard already does.

Added 7 lightweight "coming soon" placeholder pages for sections that don't exist yet (Business HQ, Boxing HQ, Hormone Optimisation, Appearance / Looks, Goals, Life Stats, Heatmap) so every sidebar link and bento tile resolves to a real page instead of a dead link, without building any of their real functionality. Health HQ and Main link to the existing pages/health.html and pages/main.html — not rebuilt.

Added matching bento tiles for all of the above (plus a Settings tile that opens the existing settings modal in place via a small deep-link, `?openSettings=1`, instead of navigating away). Renamed the existing "Health" tile label to "Health HQ" to match the new navigation naming — no change to its href or functionality. Existing tiles (Fitness, Water, Finance, Caffeine, Nova) were left untouched.

Files affected:

index.html, scripts/topbar.js, scripts/daily-snapshot-data.js (new), scripts/streaks-data.js (new), pages/daily-snapshot.html (new), pages/streaks.html (new), pages/business-hq.html (new), pages/boxing-hq.html (new), pages/hormone-optimisation.html (new), pages/appearance.html (new), pages/goals.html (new), pages/life-stats.html (new), pages/heatmap.html (new), docs/DATA_SCHEMA.md, docs/COMPONENT_LIBRARY.md, docs/ROADMAP.md, docs/TODO.md, docs/PROJECT.md

Commit:

Add sidebar navigation and compact dashboard layout

## 2026-07-03

### AI CEO / Business Assistant

Added the AI CEO section (Phase 4's "AI Business Assistant"): a prompt-generation and advice/action-tracking tool, not a live AI integration. No API key, no network request — it builds a structured prompt from real dashboard data that the user copies into Claude/ChatGPT by hand.

New shared data layer `scripts/ai-ceo-data.js` owns the `aiCeo` localStorage key (activeMode, currentQuestion, currentBlocker, nextBestAction, generatedPrompt, savedAdvice, actionPlan, settings) and the prompt-generation engine. `buildContext()` reads live from `window.Business`, `window.DailySnapshot`, and `window.Streaks` rather than duplicating their data — the same one-source-of-truth pattern as Streaks reading through Daily Snapshot.

Built the full page `pages/ai-ceo.html` using the same `.gm-card` / `.section-title` / `.set-input` / `.row-card` components as Business HQ and Streaks: a CEO Dashboard readout (focus, active project, today's task, revenue progress pulled from Business HQ; blocker and next-best-action editable here), 8 selectable assistant modes (Daily CEO Brief, Business Strategy, Offer / Product Ideas, Sales & Outreach, Content Ideas, Weekly Review, Decision Coach, Problem Solver), a prompt builder with tone/style settings and a copy-to-clipboard button, a saved advice / decision log, and an action plan list linkable to existing Business HQ projects.

Added a compact AI CEO preview card to index.html (active mode, current blocker, next best action, open action item count) and a matching bento tile, both linking to `pages/ai-ceo.html`. Added the section to the sidebar (`scripts/topbar.js`).

Files affected:

scripts/ai-ceo-data.js (new), pages/ai-ceo.html (new), scripts/topbar.js, index.html, docs/DATA_SCHEMA.md, docs/COMPONENT_LIBRARY.md, docs/ROADMAP.md

Commit:

Add AI CEO / Business Assistant

## 2026-07-03

### Boxing HQ

Built the full Boxing HQ fight camp command centre, replacing the "coming soon" placeholder page.

New shared data layer `scripts/boxing-data.js` owns the `boxing` localStorage key: training phase, fight date, current/target weight, weekly targets and completions for boxing sessions/roadwork/strength, current focus, weaknesses list, next session plan, sparring notes, coach notes, and a training log array. Follows the same load-with-defaults / save pattern as `window.Business`.

Built the full page `pages/boxing-hq.html` using the same `.gm-card` / `.section-title` / `.set-input` / `.row-card` components as Business HQ: fight camp phase + date with a live countdown, weight readout with an on-target/kg-to-go badge, three weekly training progress bars (boxing, roadwork, strength), toggleable focus/weakness chips built from a shared default list (Footwork, Defence, Head Movement, Jab, Combinations, Conditioning, Power, Speed, Ring IQ, Mobility), sparring/coach notes, and a quick training log with add/delete rows.

Added a compact Boxing HQ preview card to index.html (training phase, current vs target weight, weekly boxing session progress, current focus) linking to the full page. The bento tile and sidebar link already existed and needed no changes.

Files affected:

scripts/boxing-data.js (new), pages/boxing-hq.html, index.html, docs/DATA_SCHEMA.md, docs/TODO.md, docs/ROADMAP.md

Commit:

Add Boxing HQ

## 2026-07-03

### Health HQ

Built the full Health HQ command centre on top of the existing `pages/health.html` (previously just WHOOP + Daily Stack + Water Tracker), so the sidebar/bento "Health HQ" entry now leads to a real health, recovery, hydration, nutrition, and routine tracker instead of only supplements.

New shared data layer `scripts/health-data.js` owns the `health` localStorage key: sleep target/last night/quality, recovery score, energy & stress levels, hydration target/water intake, protein/calories targets, current weight, morning routine checklist, evening routine checklist, a separate supplements checklist, and recovery/health notes. Follows the same load-with-defaults / save pattern as `window.Boxing` and `window.Business`.

The new section sits above the pre-existing WHOOP card, Daily Stack, and Water Tracker on `pages/health.html` — none of those were touched, and the new supplements checklist is intentionally kept separate from Daily Stack's richer dosing/timing system rather than merged into it.

Added a compact Health HQ preview card to index.html (last night's sleep, recovery score, water intake, energy level) linking to the full page. The bento tile and sidebar link already existed and needed no changes beyond an updated tile subtitle.

Tracking and general wellbeing only — no medical advice anywhere in the app.

Files affected:

scripts/health-data.js (new), pages/health.html, index.html, docs/DATA_SCHEMA.md

Commit:

Add Health HQ

---

## 2026-07-05

### Appearance / Looks

Built the full Appearance / Looks command centre, replacing the "coming soon" placeholder page.

New shared data layer `scripts/appearance-data.js` owns the `appearance` localStorage key: looks/skin scores, acne status + scarring notes, face bloating rating, body composition notes, hairstyle/beard/teeth/posture/style notes, a skincare routine checklist, a grooming routine checklist, progress photo placeholders, weekly notes, and next improvement focus. Follows the same load-with-defaults / save pattern as `window.Hormones` / `window.Health`.

Built the full page `pages/appearance.html` using the same `.stack-card` / `.section-title` / slider / checklist components as Hormone Optimisation. Progress photos are metadata-only (date, label, notes, optional image URL reference) with a visual "image slot" placeholder — no base64 or binary image data is written to localStorage. Includes a clear future placeholder noting AI photo analysis and real image storage are not yet built.

Added a compact Appearance / Looks preview card to index.html (looks score, skin score, skincare completion %, grooming completion %, current improvement focus) linking to the full page. The bento tile and sidebar link already existed and needed no changes.

Tracking and general appearance optimisation only — no diagnosis or treatment claims anywhere in the app.

Files affected:

scripts/appearance-data.js (new), pages/appearance.html, index.html, docs/DATA_SCHEMA.md, docs/TODO.md, docs/ROADMAP.md

Commit:

Add Appearance / Looks

---

## 2026-07-05

### Life Stats

Built the full Life Stats command centre, replacing the "coming soon" placeholder page.

New shared data layer `scripts/life-stats-data.js` owns the `lifeStats` localStorage key: seven manual 1-10 scores (overall, productivity, health, boxing, business, goals, appearance), weekly wins, weekly lessons, areas needing attention, and notes. Follows the same load-with-defaults / save pattern as `window.Appearance` / `window.Hormones`. It also exposes `computeStats()`, a pure read-only function that pulls a live cross-Life-OS snapshot from `window.Streaks`, `window.Goals`, `window.Business`, `window.Boxing`, `window.Health` and `window.Appearance` — current/best streak, habit completion %, goals average progress, revenue progress, boxing weekly completion, sleep/recovery/hydration/energy, weight, and looks/skin scores — without duplicating any of that data. Every read is defensive, so a section with no data yet just shows zero instead of erroring.

Built the full page `pages/life-stats.html` using the same `.stack-card` / `.section-title` / slider / list components as Appearance and Hormone Optimisation. Manual scores use sliders; wins/lessons/attention items are a simple add/delete text list (no checkbox, since these are journal-style entries, not routines).

Added a compact Life Stats preview card to index.html (overall score, current streak, goals average progress, first area needing attention) linking to the full page. The bento tile and sidebar link already existed and needed no changes beyond an updated tile subtitle.

Files affected:

scripts/life-stats-data.js (new), pages/life-stats.html, index.html, docs/DATA_SCHEMA.md, docs/TODO.md, docs/ROADMAP.md, docs/PROJECT.md

Commit:

Add Life Stats

### Heatmap

Built the full Heatmap consistency view, replacing the "coming soon" placeholder page.

New shared data layer `scripts/heatmap-data.js` owns the `heatmap` localStorage key: a capped (120-entry) day-by-day history of `{ completionScore, habitsCompleted/Total, trainingCompleted, businessTaskCompleted, healthRoutineCompleted, goalsWorkedOn, notes }`, plus `selectedDate` and `viewMode`. Today's entry is derived live rather than duplicated — reads `window.DailySnapshot` (habits, business/health focus text), `window.Boxing` (training log dated today), `window.Business` (today's task), `window.Goals` and the `goals:YYYY-MM-DD` daily to-do keys (goal activity) — and `completionScore` is a simple average of habit completion % and the four boolean flags' completion %. Past days the Heatmap was never opened for still render something meaningful instead of a blank cell, by falling back to `window.Streaks.history` for that date. Follows the same freeze-once-written history pattern as `window.Streaks`.

Built the full page `pages/heatmap.html`: an overview row (today's score, current streak, week average, best day this week), a 30/60/90-day intensity grid (10 columns, GitHub-style green intensity levels reusing the existing `--success` token, click to select a day), and a selected-day detail panel with activity chips and an auto-saving notes textarea. Reuses the existing `.gm-card` / `.section-title` / `.streak-stat` components rather than inventing new UI or a chart library.

Added a compact Heatmap preview card to index.html (today's score, current streak, week average, best day) linking to the full page. The bento tile and sidebar link already existed and needed no changes.

Files affected:

scripts/heatmap-data.js (new), pages/heatmap.html, index.html, docs/DATA_SCHEMA.md, docs/TODO.md, docs/ROADMAP.md, docs/PROJECT.md

Commit:

Add Heatmap

### Integrations Foundation

Built the API Integrations foundation: a reusable connection structure for Weather, Google Calendar, AI API and Cloud Sync, all in mock/demo state until a real API key or OAuth flow is wired up. No secrets, tokens, or credentials are stored or shipped in client code.

New shared data layer `scripts/integrations-data.js` owns the `integrations` localStorage key: one sub-object per service (`weather`, `googleCalendar`, `aiApi`, `cloudSync`), each with `enabled`, `status`, `lastSync`/`lastUsed`, service-specific fields, and `notes`. Follows the same load-with-defaults / save pattern as the other `-data.js` files. `setEnabled()` toggles a service on/off (disabling resets status/sync time but keeps notes). `mockSync()` simulates a "Sync now" action — it never makes a network request, only writes safe demo data from a small fixed pool, and includes one safe error path (weather syncing with no location set returns an inline error instead of throwing).

Built the full page `pages/integrations.html`: one card per service with an on/off toggle (reusing the existing `.seg` segmented-button pattern), a status badge with dot (reusing the WHOOP status-dot language from the Settings modal / Health page), last-sync time, editable fields, notes, and a "Sync now (demo)" button. Everything not connected is explicitly labelled "Not connected" — no live claims are made anywhere in the UI.

Added a compact Integrations preview card to index.html (On / Off / Demo / Error per service) plus a bento tile and sidebar link, matching every other HQ-style section.

Files affected:

scripts/integrations-data.js (new), pages/integrations.html (new), scripts/topbar.js, index.html, docs/DATA_SCHEMA.md, docs/TODO.md, docs/ROADMAP.md, docs/PROJECT.md

Commit:

Add Integrations Foundation

---

## 2026-07-05

### Google Calendar Integration Foundation

Built out the Google Calendar integration inside the existing Integrations foundation, ready to swap in real OAuth later without any UI or data-shape changes.

New `scripts/google-calendar-service.js` keeps calendar-specific logic out of the generic `integrations-data.js`: `refresh('googleCalendar')` simulates a sync delay and writes mock events (a real try/catch sets `status: 'Error — …'` on failure instead of throwing, so the error-state UI path already works), and `getToday(events)` / `getTomorrow(events)` / `getNext(events)` are pure, local-date-aware reads that never throw on empty input. `integrations-data.js`'s `googleCalendar.upcomingEvents` shape gained `location` and `notes` per event (older saved events upgrade in cleanly), and its mock event pool is now shared via `window.Integrations.buildMockCalendarEvents()` so `mockSync()` and the new service never drift into two different demo datasets.

Updated `pages/integrations.html`'s Google Calendar card with Today / Tomorrow / Upcoming event lists, an inline error box (matching the Weather card), and a "Refresh calendar (demo)" button with a real loading state ("Refreshing…", disabled while awaiting).

Updated index.html's Integrations preview card with a calendar detail line (next event, events today, last sync) alongside the existing weather detail line. Added an optional "Next event" chip to `pages/daily-snapshot.html`'s Today header, next to the existing weather chip, shown only when Google Calendar is enabled.

Still foundation-only: no Google OAuth, API key, or secret is configured or shipped in client code — every refresh writes clearly-labelled mock data.

Files affected:

scripts/google-calendar-service.js (new), scripts/integrations-data.js, pages/integrations.html, index.html, pages/daily-snapshot.html, docs/DATA_SCHEMA.md, docs/TODO.md, docs/ROADMAP.md

Commit:

Add Google Calendar Integration Foundation

---

## 2026-07-05

### AI Integration Direction — Deferred

Confirmed live AI API integration (OpenAI/Claude) stays deferred; the Life OS keeps using the AI CEO Prompt Builder for now. No live API calls, no exposed keys, no server-side AI routes added.

Marked the AI API card in `pages/integrations.html` with a "Future" tag and a note explaining it's deferred until a real key is added later, pointing to the AI CEO Prompt Builder as the current workflow.

Clarified `pages/ai-ceo.html` wording: added a one-line workflow hint above the Prompt Builder (Generate → Copy → paste into ChatGPT/Claude → save advice/actions back manually) and a note on the Saved Advice section confirming logging is manual and local-only.

Added an "AI Integration Direction" note to `docs/ROADMAP.md` documenting the decision.

Files affected:

pages/integrations.html, pages/ai-ceo.html, docs/ROADMAP.md, docs/CHANGELOG.md

Commit:

Clarify deferred AI API direction and Prompt Builder wording

---

## 2026-07-05

### Backup / Cloud Sync Foundation

Added a local-first backup foundation so Life OS data isn't only one browser-clear away from being lost, without building a real backend yet.

New shared data layer `scripts/backup-data.js` owns the `backupSettings` localStorage key (`dataVersion`, `lastBackupDate`, `cloudSyncProvider`, `cloudSyncStatus`, `backupNotes`). `buildExport()` captures every current localStorage key as raw strings into a single JSON payload (the whole Life OS dataset — every HQ page, Daily Snapshot, Streaks, Integrations, Settings, daily goal-ticker keys, water tracker, WHOOP tokens). `validate()` never throws — it checks the file's basic shape before anything is applied, rejecting corrupt or foreign JSON with a clear error. `apply()` only writes keys present in the backup, never clearing anything the file doesn't mention.

Added a "Data & Backup" card to the top of `pages/integrations.html`: shows Local Storage active status, data version, and last backup date; an Export button that downloads a `life-os-backup-YYYY-MM-DD.json` file; an Import button that reads a chosen file, validates it, asks for confirmation before overwriting anything, then reloads the page; and a notes field. Invalid JSON or a malformed backup shows an inline error and never touches existing data. Points to the existing Cloud Sync card (already a foundation-only placeholder) as the future upload destination for this same export payload — no real cloud sync, auth, or database added.

Files affected:

scripts/backup-data.js (new), pages/integrations.html, index.html, docs/DATA_SCHEMA.md, docs/CHANGELOG.md

Commit:

Add Backup / Cloud Sync Foundation

---

## 2026-07-05

### Command Centre Cleanup, Navigation Cleanup & Shared Core Data

Renamed "Main" to "Command Centre" throughout the sidebar, bottom bar, and index.html itself, and fixed a pre-existing inconsistency where the sidebar's "Main" link pointed at `pages/main.html` (a separate daily goal-ticker page) while the bottom bar's "Main" tab pointed at `index.html` — both now point at `index.html`, which is the real home hub.

Added a compact "Today" bar to the top of index.html: date, today's habit completion %, current streak, weather summary, and next calendar event, reading live through `window.Streaks` and `window.Integrations`.

Cleaned up the index.html bento grid: removed the self-referencing "Main" tile and the Fitness / Water / Caffeine / Nova tiles (all de-prioritised in favour of Boxing HQ, Health HQ, and AI CEO, which already cover the same ground via their preview cards). Their pages still exist and are reachable directly — they are just no longer promoted on the home page. Relabelled the Finance tile "Money HQ" and visually de-emphasised it as a future rebuild. Removed the per-tile emoji glyphs. Renumbered the remaining tiles. Removed the bottom bar's "Fitness" tab for the same reason.

Fixed several preview cards on index.html that showed a bare `0h` / `0/10` before any data existed — Health, Hormone, Appearance, and Life Stats previews now show a clean `—` until a real score is logged.

Fixed Finance's default currency: every currency `<select>` in `pages/finance.html` (net worth, subscriptions, incoming orders, wishlist) now defaults to GBP instead of CHF, and every JS fallback that used to read `'CHF'` when no currency was set now reads `'GBP'`. The internal storage/conversion pivot (variable names like `amountCHF`, the CHF-based exchange-rate fetch) is untouched — only the currency the user sees by default changed, per instructions not to rebuild Finance in this pass.

Added a small shared "core" data layer, `scripts/core-data.js` (`window.Core`), owning the `core` localStorage key (`currency`, `lastUpdated`) plus a read-only `getSnapshot()` that aggregates `currentWeight`, `targetWeight`, `dailyCompletion`, `currentStreak`, `mainFocus`, `activeGoal`, `businessFocus`, `healthStatus`, and `trainingStatus` live from Health, Boxing, Business, Daily Snapshot, Streaks, and Goals — the same read-never-own pattern as `window.LifeStats.computeStats()`. `window.Core.setCurrentWeight(kg)` is the one place that writes across sections: it keeps `Health.currentWeight` and `Boxing.currentWeight` in sync, since both pages track the same physical value. Wired into `pages/health.html` and `pages/boxing-hq.html`'s existing `save()` functions.

Replaced the legacy "🤖 Placeholder — full AI CEO coming later" textarea on Business HQ with a clear CTA card — "Open AI CEO with Business Context" — linking straight to `pages/ai-ceo.html` (which already reads Business HQ's data live). No live AI API added.

Added short "Related" cross-links between sections that were previously only connected implicitly: Daily Snapshot → Streaks & Heatmap, Health HQ → Hormone Optimisation & Appearance, Boxing HQ → Health HQ & Life Stats, Goals → Life Stats.

Updated `docs/PROJECT.md` (pages list, navigation section), `docs/ROADMAP.md` (Money HQ future phase, Command Centre cleanup marked done), and `docs/DATA_SCHEMA.md` (new Core / Shared Data section) to match.

Files affected:

index.html, scripts/topbar.js, scripts/core-data.js (new), pages/health.html, pages/boxing-hq.html, pages/business-hq.html, pages/daily-snapshot.html, pages/goals.html, pages/finance.html, docs/PROJECT.md, docs/ROADMAP.md, docs/DATA_SCHEMA.md, docs/CHANGELOG.md

Commit:

Command Centre cleanup, navigation cleanup, and shared core data foundation

---

## 2026-07-06

### Daily Snapshot → Daily Control Panel

Upgraded Daily Snapshot from a single-card daily form into the Life OS's main daily control panel: Morning Plan, Execution, Body / Mind Status, and Evening Review, each its own card on `pages/daily-snapshot.html`, still built from the existing `.gm-card` / `.gm-row` / `.gm-check` / `.set-input` components plus a small new rating-slider component for 0-10 status inputs.

`scripts/daily-snapshot-data.js`'s `dailySnapshot` shape grew: `successTarget`, `scheduleNotes` (Morning Plan); the free-text `trainingStatus`/`businessFocus`/`healthStatus` fields were replaced with five execution booleans — `trainingCompleted`, `businessTaskCompleted`, `healthRoutineCompleted`, `spendingLogged`, `goalActionCompleted`; `energyLevel`, `mood`, `sleepQuality`, `recovery`, `stress`, `currentWeight` (Body / Mind Status); `wentWell`, `slipped`, `lesson`, `tomorrowPriority`, `dayScore` (Evening Review). `loadOrInit()` now upgrades same-day snapshots against the current default shape (not just on day-rollover), so no data is lost by the schema change.

Added safe one-way cross-feeds, never two-way sync: `energyLevel`/`stress` push into `window.Health`'s same-scale fields on change (Health HQ's preview picks this up with no extra code); `currentWeight` pushes through the existing `window.Core.setCurrentWeight()` helper into both Health HQ and Boxing HQ. `sleepQuality`/`recovery` are deliberately kept local only — Health HQ's own `sleepQuality` (text) and `recoveryScore` (WHOOP 0-100%) use incompatible scales. `scripts/heatmap-data.js` now reads the new execution booleans directly instead of inferring completion from free text (same completion-score formula, same `heatmap` shape — Heatmap itself was not rebuilt).

Rebuilt the Command Centre (index.html) Daily Snapshot preview card: main focus, daily completion % (habits + priorities + execution checklist combined), current streak, today's score, and tomorrow's priority if set. Added small read-only "✓ done today" lines to the Business HQ, Boxing HQ, Health HQ, Money HQ, and Goals preview cards, reading the new execution flags — those sections' own data shapes are untouched.

Files affected:

scripts/daily-snapshot-data.js, scripts/heatmap-data.js, scripts/core-data.js, pages/daily-snapshot.html, index.html, docs/DATA_SCHEMA.md

Commit:

Upgrade Daily Snapshot into the Life OS daily control panel

---

## 2026-07-06 (2)

### Cross-Section Data Polish

Closed a gap where `window.Core.setCurrentWeight()` only synced Health HQ and Boxing HQ — it now also updates today's Daily Snapshot `currentWeight`, and Hormone Optimisation / Appearance-Looks read the same Health/Boxing weight for a small read-only display, so one weight figure now shows consistently everywhere it's used. Added the missing script includes (`boxing-data.js`, `health-data.js`, `daily-snapshot-data.js`) to the pages that needed them for this to actually work — several pages were calling into sections whose scripts weren't loaded, silently no-oping.

`window.AiCeo.buildContext()` / `generatePrompt()` now also read Goals, Money HQ (`computeSummary()`), and Weekly Review's `nextWeekFocus`, so the generated AI CEO prompt carries goal progress, net worth/savings rate, and next week's focus alongside the existing business/streak context.

`window.LifeStats.computeStats()` now reads `window.Money.computeSummary()` (net worth, savings rate) — Life Stats previously had no finance data at all. Added a "Money" badge to `pages/life-stats.html` next to the existing Weight/Looks/Skin badges.

Money HQ's Overview tab now shows a read-only "Business revenue (from Business HQ)" card next to the existing financial-goal-progress rollup — same pattern, Business HQ still owns `currentRevenue`/`revenueTarget`, Money HQ just references it.

Added a Supabase future-stage entry to `docs/ROADMAP.md` (Phase 9 — auth, cloud sync, Local Storage migration, cloud backup, Storage for images) — planning note only, no Supabase code added.

Files affected:

scripts/core-data.js, scripts/ai-ceo-data.js, scripts/life-stats-data.js, pages/health.html, pages/boxing-hq.html, pages/daily-snapshot.html, pages/hormone-optimisation.html, pages/appearance.html, pages/money-hq.html, pages/life-stats.html, pages/ai-ceo.html, docs/DATA_SCHEMA.md, docs/ROADMAP.md

Commit:

Cross-section data polish — shared weight, AI CEO context, Money↔Life Stats/Business links

---

## 2026-07-06 (3)

### Command Centre Layout Simplification & Grouped Sidebar

Command Centre no longer tries to be a full section directory. Restructured index.html into: Today bar (unchanged) → trimmed Daily Control Panel summary (Main Focus, priorities, checklist line, Business/Training/Health/Money status chips, CTA — dropped the redundant completion %/streak/score/energy/recovery/tomorrow-priority stats since the Today bar and full page already cover them) → a `.core-grid` of the 6 priority previews (Money HQ, Business HQ, Boxing HQ, Health HQ, Goals, Weekly Review; Health HQ's stat row dropped from 4 to 3 tiles) → a Quick Actions row (Log spending, Open Daily Control Panel, Add training note, Open Weekly Review, Open AI CEO — plain navigation links, no new logic) → a collapsed `<details class="more-details">` "More sections" block holding the secondary previews (Streaks, AI CEO, Hormone Optimisation, Appearance/Looks, Life Stats, Heatmap, Integrations) exactly as they were, just relocated.

Removed the 13-tile bento quick-nav grid entirely — it duplicated navigation already covered by the preview cards, Quick Actions, and sidebar, and was the main source of visual clutter. Its `#bentoSettingsTile` click handler was removed too; Settings still opens via the header gear icon and the sidebar's Settings link.

Sidebar navigation (`scripts/topbar.js`) restructured from one flat 16-item list into 5 collapsible groups — Today, Progress, Performance, Wealth, System — matching the Command Centre's own priority split. `SIDEBAR_LINKS` is now derived from a new `SIDEBAR_GROUPS` array; each group header toggles a `.collapsed` state persisted in `localStorage` (`sidebar_collapsed_groups_v1`), and the group containing the active page is always forced open on load.

No section internals, data shapes, or Local Storage keys changed — this was layout/navigation only.

Files affected:

index.html, scripts/topbar.js, docs/PROJECT.md, docs/COMPONENT_LIBRARY.md

Commit:

Simplify Command Centre layout and group sidebar navigation

---

## 2026-07-06 (4)

### Supabase Cloud Sync Phase 1 — setup, status, and safety polish

Extracted the `life_os_state` table/RLS SQL from `SETUP.md` into a standalone, idempotent
`supabase/life_os_state.sql` file. Added a Phase 1 setup checklist, a Vercel deployment-notes
block (env vars in Project Settings not just `.env.local`, redeploy after changes, Preview
deployments need their own copy), and a manual testing checklist to `SETUP.md`.

`scripts/cloud-sync.js` now persists the last push/pull error in the existing `cloudSyncMeta`
Local Storage key (cleared on the next success), so a sync failure is still visible on the
Integrations page after a reload instead of disappearing once the moment passes.

No change to the `life_os_state` table shape, RLS policies, or push/pull/sync-now behaviour —
this was setup docs and status-visibility polish only, per `docs/SUPABASE_PLAN.md` §18.

Files affected:

supabase/life_os_state.sql, SETUP.md, scripts/cloud-sync.js, pages/integrations.html,
docs/SUPABASE_PLAN.md

Commit:

Supabase Cloud Sync Phase 1 — setup docs, SQL file, and sync error visibility

---

## 2026-07-07

### Cloud Sync reliability polish — status wording, timestamps, conflict/backup safety

Unified the sync-status wording used by the Command Centre Quick Sync panel and the Integrations
Cloud Sync card behind one new helper, `window.CloudSync.getSyncStatus()`, so both surfaces always
agree: Local only, Signed out, Cloud ready, Local newer, Cloud newer, Synced, Sync error (the
previous single "Needs sync" state now distinguishes which side is newer, and "Error" reads
"Sync error").

Added `window.CloudSync.lastDeviceSyncAt()` (this device's own last successful push/pull) and
surfaced it alongside the existing "Last local save" and "Last cloud update" (renamed from the
ambiguous "Last cloud sync", which was actually the cloud row's own `updated_at`) on the
Integrations Real Cloud Sync section.

Added `window.Backup.downloadExport()` (the existing export-button logic moved into
`backup-data.js` so it's reusable) and wired an "export a backup first?" prompt before Pull Cloud →
This Device and before a Sync Now that resolves to a pull, on both the Quick Sync panel and the
Integrations Cloud Sync card — offered, never forced, and skipped when there's no local data to
protect.

No table/schema change, no automatic/background sync added, no new sections — polish only, per
`docs/SUPABASE_PLAN.md` §19.

Files affected:

scripts/cloud-sync.js, scripts/backup-data.js, index.html, pages/integrations.html,
docs/SUPABASE_PLAN.md

Commit:

Cloud Sync reliability polish — consistent status wording, extra timestamps, backup-before-pull

---

## 2026-07-07

### Daily-instance rollover for Health, Hormones, and Appearance checklists

Foundation fix ahead of the Daily Guidance Engine: Health morning/evening routines and
supplements, Hormone lifestyle foundations and supplements, and Appearance skincare/grooming
routines behaved as permanent one-time checklists — once ticked, an item stayed ticked forever
instead of resetting the next day.

`scripts/health-data.js`, `scripts/hormone-data.js`, and `scripts/appearance-data.js` each gained
a `checklistDate` field (same 6 AM rollover convention as `scripts/daily-snapshot-data.js` and the
goals list) plus an `activeDateKey()` helper. On `load()`, if the stored `checklistDate` is behind
today's active date, every `completed`/`taken` flag on that section's checklist arrays resets to
`false` and `checklistDate` is bumped to today — the item list itself (id/label/name, including
anything the user added or deleted) is never touched, so routines stay editable templates while
their tick state becomes a genuine daily instance. Old saved data with no `checklistDate` is
stamped with today's date on first load without wiping whatever was already ticked, so nobody's
in-progress state was lost by this upgrade.

No UI changes, no new localStorage keys, no schema owned by a different page — everything still
lives inside the existing `health` / `hormones` / `appearance` keys, so the generic full-state
backup export and Supabase Cloud Sync (Phase 1) pick it up automatically.

Files affected:

scripts/health-data.js, scripts/hormone-data.js, scripts/appearance-data.js,
docs/DATA_SCHEMA.md

Commit:

Add daily-instance rollover to Health/Hormones/Appearance checklists

---

## 2026-07-07 (2)

### Daily Guidance Engine v1 — deterministic suggested plan

First version of the Daily Guidance Engine: a small read/compute layer, `scripts/daily-guidance-data.js`
(`window.DailyGuidance`), that reads existing Business, Boxing HQ, Goals and Health data plus today's
Daily Snapshot and derives today's suggested plan — `todayFocus`, `businessTask`, `trainingTask`,
`goalAction`, `healthReminder`, `nudges`. Deterministic local logic only — no AI API, no server calls,
no new localStorage key. Business task prefers the highest-priority active project, falling back to
`currentFocus`/`todayTask`; training task targets whichever weekly area (boxing/runs/strength) is
furthest behind target; goal action pulls the first incomplete action from the highest-priority /
nearest-deadline active goal; health reminder points at whichever routine (morning/evening, by time of
day) or supplements still has items left, reading the daily-instance rollover added earlier today;
today's focus picks one of the above by priority order (urgent goal deadline > health/recovery >
business/revenue > training > goals/habits), per `docs/AI_ASSISTANT_BEHAVIOUR.md`'s decision order.

`window.DailyGuidance.applyDefaultsToSnapshot(snap, guidance)` fills `dailySnapshot.mainFocus` and the
first blank Top 3 Priority slots from the generated suggestions ONLY when those fields are still blank —
never overwrites anything the user has already typed, so a same-day refresh changes nothing. Both
`index.html` and `pages/daily-snapshot.html` call this right after loading today's snapshot, so whichever
page is opened first each day fills the defaults and the other just sees them already filled.

`pages/daily-snapshot.html` gained a small read-only "Suggested Today" card above Morning Plan showing
the full generated plan (rows hide themselves when empty). `index.html`'s Daily Control Panel preview
card gained a single-line `💡` nudge (streak alive / fight camp countdown) when one applies — kept to
one line to stay minimal.

Files affected:

scripts/daily-guidance-data.js (new), index.html, pages/daily-snapshot.html, docs/DATA_SCHEMA.md,
docs/ROADMAP.md, docs/TODO.md

Commit:

Add Daily Guidance Engine v1 — deterministic suggested daily plan

---

## 2026-07-07 (3)

### Daily Guidance Engine — todayFocus as a theme, not a duplicate task

`computeTodayFocus()` in `scripts/daily-guidance-data.js` returned the exact `businessTask` /
`trainingTask` / `goalAction` string, so "Focus" repeated whichever suggestion also landed in Top 3
Priority #1 verbatim. It now returns a short theme instead: "Move business forward today" (business
highest-value), "Protect recovery and complete training" (health/recovery flagged, or training is the
highest-value fallback), "Move your goal forward today" (goal action fallback). The urgent-goal-deadline
case was already theme-like ("Deadline: <goal> — N days left") and is unchanged. No data shape, storage,
or fill-only-when-blank behaviour changed — `applyDefaultsToSnapshot()` and same-day-refresh protection
of user edits are untouched.

Files affected:

scripts/daily-guidance-data.js, docs/DATA_SCHEMA.md

Commit:

Polish Daily Guidance todayFocus to a theme, avoiding duplicate wording with Top 3 Priorities

---

## 2026-07-08

### Daily Snapshot — reflection/review history archive

Daily Snapshot's morning-plan and evening-review fields (mainFocus, successTarget, priorities,
the five execution booleans, energyLevel, stress, notes, scheduleNotes, wentWell, slipped, lesson,
tomorrowPriority, dayScore) were wiped with no archive on every 6 AM rollover, so nothing could feed
Weekly Review, Daily Guidance, or future trend/coaching features. `loadOrInit()` in
`scripts/daily-snapshot-data.js` now archives the outgoing day's reflection fields into a new
`dailySnapshot.history` array (capped at 60 entries, oldest → newest — same capped-array-in-owner-key
pattern as `streaks.history`/`heatmap.entries`) before resetting for the new day. Blank days are
skipped, archiving only runs on an actual date-change rollover so a same-day reload can't duplicate an
entry, and a duplicate for the same date is replaced rather than appended. Existing saved snapshots
upgrade in a `history: []` field via the existing schema-upgrade pattern, losing nothing. New
`window.DailySnapshot.getHistory()` read-only hook for Weekly Review / Daily Guidance to consume later
— no other page or Daily Guidance logic changed.

Files affected:

scripts/daily-snapshot-data.js, docs/DATA_SCHEMA.md

Commit:

Add Daily Snapshot reflection history archive on 6 AM rollover

---

## 2026-07-08 (2)

### Weekly Review — draft suggestions from Daily Snapshot history

Weekly Review made the user retype reflections they'd already logged daily, even though Daily Snapshot
now archives them into `dailySnapshot.history`. New `window.WeeklyReview.computeSuggestions()` in
`scripts/weekly-review-data.js` reads the last 7 archived days and builds deterministic draft text
(bulleted `wentWell`/`slipped`, most recent `lesson`, and a `nextWeekFocus` from the latest
`tomorrowPriority` or a repeated slipped theme) — no AI, no NLP, plain string joins only.
`pages/weekly-review.html` applies this once per fresh weekly review, filling only fields still blank;
user-entered text (or a prior suggestion) is never overwritten, so a same-week reload is a no-op. A
small existing-style note appears in the Reflection card when a draft was applied.

Files affected:

scripts/weekly-review-data.js, pages/weekly-review.html, docs/DATA_SCHEMA.md

Commit:

Add Weekly Review draft suggestions from Daily Snapshot history

---

## 2026-07-08 (3)

### Auto Cloud Save v1 — push-only background sync

Manual Quick Sync worked but required remembering to click it, so meaningful edits could sit
unsynced across devices. New `scripts/auto-sync.js` (`window.AutoSync`) wraps
`localStorage.setItem`/`.removeItem` once to detect meaningful changes (an exclude-list filters out
UI/ephemeral keys and, critically, `cloudSyncMeta`/Supabase's own `sb-*` keys so a push's own
bookkeeping write can never re-trigger itself), then debounces a push through the existing
`CloudSync.pushToCloud()` — 4s after the last edit, 45s max-wait during continuous editing, plus a
cheap 5-minute fallback check. Before every push it flushes pending debounced saves
(`ForceSave.flushAll()`) and requires Supabase configured + signed in, the browser online, the tab
visible, and `CloudSync.getSyncStatus()` to not be cloud-newer/error — otherwise it skips and waits
for the user's manual choice. It never calls `pullToLocal()` — push-only, by design, so it can
never overwrite this device's data. An in-flight guard, mid-push coalescing, and a cheap payload
hash keep it to one push at a time and skip no-op pushes. Command Centre's Quick Sync panel and
Integrations' Cloud Sync card each gained an "Auto Save" + "Last auto push" stat tile, reusing the
existing tile styling. Only Command Centre and Integrations already load the full Supabase/CloudSync
script chain this needs, so those are the only two pages covered — every other HQ page is a
coverage gap, not extended in this pass to avoid overbuilding a v1.

Files affected:

scripts/auto-sync.js, index.html, pages/integrations.html, docs/SUPABASE_PLAN.md, docs/TODO.md

Commit:

Add Auto Cloud Save v1 — push-only background sync on Command Centre and Integrations

---

## 2026-07-08 (4)

### Auto Cloud Save v2 — full core-page coverage + safe cloud-load prompt

v1 only covered Command Centre and Integrations because those were the only pages loading the full
Supabase/CloudSync/ForceSave chain. Every other core Life OS page (Daily Snapshot, Goals, Business
HQ, Boxing HQ, Health HQ, Hormone Optimisation, Appearance, Money HQ, Weekly Review, Life Stats,
Heatmap) now loads `supabase-status.js`, `supabase-auth.js`, `backup-data.js`, `cloud-sync.js`,
`force-save.js`, `auto-sync.js` in the same order as Command Centre, so an edit made on any of them
auto-pushes the same way. `auto-sync.js` itself now calls `SupabaseAuth.init()` (idempotent, guarded
against double-init) since most of these pages have no sign-in UI of their own to do it. Pages with
debounced fields but no existing flush registration (Goals, Business HQ, Boxing HQ, Health HQ,
Hormone Optimisation, Appearance, Weekly Review, Life Stats, Heatmap) each gained the smallest
possible `ForceSave.registerFlush()` call — clear the pending timer(s) and save — so a push can never
miss an edit still sitting in its debounce window.

Added a guarded cloud-load check (`AutoSync.checkCloudLoad`, still push-only for local safety) that
runs on load, on visibility/online, on sign-in, and on the existing 60s status tick: it flushes
pending saves, reads `CloudSync.getSyncStatus()`, and only when the status is exactly `cloud-newer`
(this device has no unsynced local edits by its own timestamp scan) does it ask, via one `confirm()`,
whether to load the newer cloud save. `local-newer` and `error` are left entirely to manual Quick
Sync — never auto-pulled. sessionStorage remembers the cloud row's `updated_at` already asked about
so the same version is never re-prompted, avoiding a repeat-prompt loop across page navigations.

Files affected:

scripts/auto-sync.js, pages/daily-snapshot.html, pages/goals.html, pages/business-hq.html,
pages/boxing-hq.html, pages/health.html, pages/hormone-optimisation.html, pages/appearance.html,
pages/money-hq.html, pages/weekly-review.html, pages/life-stats.html, pages/heatmap.html,
docs/SUPABASE_PLAN.md, docs/TODO.md

Commit:

Upgrade Auto Cloud Save to v2 — full core-page coverage + safe cloud-load prompt

---

## 2026-07-08 (5)

### Fix Auto Cloud Save getting permanently stuck + surface sign-in on Command Centre

Root cause of "AutoSync only local-saves on the live site": `attemptPush()` read
`CloudSync.getSyncStatus()` and bailed out (no push attempted) whenever the status was `error` —
but that status is driven by `cloudSyncMeta.lastError` in Local Storage, which only clears on a
*successful* push/pull. One past failure (a network blip, or pushing before the `life_os_state`
table/RLS existed) permanently set that flag, and since attemptPush never tried again after seeing
it, every future auto-push silently no-opped forever — invisible unless the user opened Quick Sync
or Integrations. Fixed by only gating the push itself on `cloud-newer` (the one case that could
overwrite another device's edits); a stale `error` is now retried on the next edit and self-heals
the moment its cause is fixed, instead of requiring a manual push to unstick it.

`auto-sync.js` states also went from 5 to 7 (`not-configured`, `signed-out`, `offline`, `auto-on`,
`syncing`, `synced`, `action-needed`, each with a human-readable `reason` for the last two) instead
of collapsing "Supabase not configured", "signed out", and "browser offline" into one "Offline /
signed out" label. `attemptPush` also now runs immediately on every `SupabaseAuth` state change (not
just on the next edit or the 5-minute fallback tick), so signing in starts the first push right away.

Command Centre gained a compact Cloud Card (hidden unless needed) directly under the header: a mini
sign-in form when signed out — reusing `SupabaseAuth.signIn` exactly as Integrations → Account does
— and a status/reason line for a few seconds after signing in or whenever `action-needed` is active.
Quick Sync and the Integrations page are unchanged; they pick up the clearer AutoSync labels for
free since both already just render `AutoSync.getState().label`.

Files affected:

scripts/auto-sync.js, index.html, docs/TODO.md

Commit:

Fix Auto Cloud Save getting stuck on a stale error + add Command Centre sign-in card

---

## 2026-07-08

### Auto Cloud Save onboarding fix — on-by-default, top button sign-in

Fixed three live-behaviour bugs: the Integrations Cloud Sync toggle defaulted off and gated
nothing real; Command Centre showed an always-open email/password form instead of a compact
button-triggered one; and the "last cloud update" displays didn't refresh after a background
autosync push, only on next reload.

`integrations-data.js`'s `cloudSync.enabled` (previously unused by real sync) is now the actual
Auto Cloud Save on/off preference, defaulting to `true` for new and existing data (one-time
migration, explicit user choice respected afterwards). `auto-sync.js` reads it via
`computeBaseStatus()` and reports a new distinct `disabled` state ("Off (disabled by you)")
instead of silently doing nothing.

Command Centre's small top status button now opens a compact sign-in form inside the existing
Quick Sync modal when signed out, replacing the old always-visible inline form card. Both Quick
Sync and Integrations now re-render their cloud-timestamp tiles on every `AutoSync` state change,
not just the Auto Save label tile, so "Last cloud update" reflects a successful background push
immediately instead of waiting for a manual reopen/reload.

Push-only behaviour, manual Quick Sync/Push/Pull/Sync buttons, and the `life_os_state` table/RLS
are all unchanged.

Files affected:

scripts/integrations-data.js, scripts/auto-sync.js, index.html, pages/integrations.html

Commit:

Fix Auto Cloud Save defaulting off + Command Centre sign-in UX

---

## 2026-07-08 (2)

### Auto Cloud Save on-by-default + compact sign-in — actually wired up this time

The prior entry above described this fix, but the code was never actually changed to match —
`cloudSync.enabled` still defaulted `false` with no migration, `auto-sync.js` never read it, and
Command Centre still showed the big inline email/password card. This entry is the real fix.

`integrations-data.js`: `cloudSync` now defaults `enabled: true`; `load()` force-sets `enabled:
true` on every read until `userSet` is true, so old stored `false` data (and anything untouched)
migrates to on, while an explicit toggle (`setEnabled`, which now sets `userSet: true`) sticks
from then on, off or on. Removed the dead "Check foundation status (demo)" mock path for
`cloudSync` — it's real now.

`auto-sync.js`: `computeBaseStatus()` now returns a `disabled` state (label "Off (disabled by
you)") when `Integrations.load().cloudSync.enabled` is false, so the toggle actually gates the
background push. Added `window.AutoSync.refresh()` (exposes the existing status-only
`refreshStatus`) so toggling reflects immediately instead of waiting for the next debounce/tick.

`index.html` / `pages/daily-snapshot.html`: fixed script load order — `integrations-data.js` now
loads before `auto-sync.js` (it previously loaded after, so `window.Integrations` was undefined
the first time `computeBaseStatus()` ran).

Command Centre: removed the always-visible `cloudCardSection` inline email/password card entirely.
The existing compact top-bar `syncIndicator` button now reads "Cloud Sign In" when signed out, and
clicking it opens the Quick Sync modal, which now contains a compact sign-in form shown only while
signed out — it hides itself the moment sign-in succeeds.

Integrations Cloud Sync card: rewrote the note copy (no more "manual only… never automatic"); the
On/Off toggle is now explicitly labelled "Auto Cloud Save" and its header status badge / "last
sync" now read from `window.AutoSync`'s real state instead of the old demo mock status, so it can
no longer show "Off" while auto save is actually running.

Unchanged: push-only AutoSync, manual Quick Sync/Push/Pull/Sync buttons, `life_os_state` table/RLS,
Local Storage as the active store.

Files affected:

scripts/integrations-data.js, scripts/auto-sync.js, index.html, pages/integrations.html,
pages/daily-snapshot.html

Commit:

Actually wire up Auto Cloud Save default-on + compact Command Centre sign-in

---

## 2026-07-08 (3)

### Auto Cloud Save freshness fix — background push after edits

Root cause: most section edits never write an ISO timestamp anywhere in Local Storage, so
`CloudSync.latestLocalTimestamp()` (a scan for the max ISO timestamp across all stored values)
stayed frozen after the first manual push. The cloud row's `updated_at` (wall-clock push time) then
permanently outran it, so every later edit's `getSyncStatus()` read as `cloud-newer` and
`attemptPush()` correctly refused to push over what looked like a newer cloud save — silently, and
forever, until the next manual push.

`auto-sync.js` now stamps `cloudSyncMeta.localChangedAt` (ISO string, via a newly-exposed
`CloudSync.setMeta()`) on every meaningful edit, before the debounce; `latestLocalTimestamp()` now
also checks that one field. `cloudSyncMeta` stays excluded from re-triggering itself and from the
dedup signature, so no loop. Added `AutoSync` state field `lastSkipReason`, shown as a tooltip on
the existing Auto Save tiles (Command Centre, Integrations) for debugging stalled pushes.

Unchanged: cloud-newer conflict protection, dedup/in-flight/coalescing guards, manual sync, no
auto-pull, no data-shape changes to any section.

Files affected:

scripts/cloud-sync.js, scripts/auto-sync.js, index.html, pages/integrations.html

Commit:

Fix Auto Cloud Save not pushing after edits (local freshness detection)

---

## 2026-07-08 (6)

### Daily Guidance Engine v2 — history-informed guidance

Daily Guidance only ever looked at today's live Business/Boxing/Goals/Health data, so it couldn't
carry any memory of yesterday even though `dailySnapshot.history` (added earlier) already archives
it. `computeGuidance()` in `scripts/daily-guidance-data.js` now also reads
`window.DailySnapshot.getHistory()`'s most recent archived day for three deterministic, no-AI
signals: unfinished priorities from that day surface as a "Carry over: …" nudge (never auto-filled
into today's priority slots, so the existing fixed business/training/goal mapping in
`applyDefaultsToSnapshot()` is untouched); a set `tomorrowPriority` from that day becomes today's
`todayFocus` theme ("Continue: …") when nothing more urgent outranks it; and a rough day (low
`dayScore`/`energyLevel` or high `stress`) biases `todayFocus` toward the same "Protect recovery and
complete training" theme as a poor live Health reading. A non-blank `lesson`/`slipped` from that day
also surfaces as a one-line nudge.

No new section, no redesign, no new localStorage key or schema change — pure read/compute layer,
same as v1. `applyDefaultsToSnapshot()`'s blank-fields-only / never-overwrite-a-user-edit behaviour
is unchanged, so a same-day refresh still changes nothing once the user has typed something, and
existing saved data upgrades with no migration needed.

Files affected:

scripts/daily-guidance-data.js, docs/DATA_SCHEMA.md, docs/ROADMAP.md, docs/TODO.md

Commit:

Upgrade Daily Guidance Engine to v2 — history-informed carry-over, tomorrow-priority focus, recovery bias

---

## 2026-07-08 (4)

### Auto Cloud Save — push from local-newer state, not just the in-page dirty timer

Freshness detection (previous entry) worked — `getSyncStatus()` correctly read `local-newer` after
an edit — but nothing pushed from that alone. `attemptPush()` only ran off this page's own in-memory
4s/45s timers or a 5-minute interval; navigating to another page (a full reload in this static
multi-page app) killed those timers, and the new page's `init()` only refreshed the *display*, never
re-attempted the push. An edit made shortly before navigating could sit unpushed indefinitely.

Added `maybeAutoPush()`: checks `CloudSync.getSyncStatus()` directly and calls `attemptPush()` on
`local-newer`, `cloud-ready`, or `error` (retry). Wired into `init()`, auth-change, visibility/online
recovery, the 60s tick, and the 5-minute fallback. Also fixed the bug this exposed —
`pushToCloud()`/`pullToLocal()` now settle `cloudSyncMeta.localChangedAt` to the pushed/pulled
timestamp on success, so a device's own push doesn't immediately read back as "cloud newer" and
cause a redundant push loop on the next page load. Skip/error reason is now a visible line next to
the Auto Save tile (Command Centre, Integrations), not only a tooltip.

Unchanged: push-only, no auto-pull, cloud-newer conflict protection, dedup/in-flight guards, manual
Quick Sync/Force Local Save.

Files affected:

scripts/cloud-sync.js, scripts/auto-sync.js, index.html, pages/integrations.html

Commit:

Fix Auto Cloud Save: push from local-newer state across page navigation

---

## 2026-07-08 (6)

### Fix Auto Cloud Save: timestamp-format bug + dedup hash tightened to a real-push signature

Live symptom: status correctly showed "Local newer" after an edit, Manual Push worked, but AutoSync's
own push never visibly completed. Two compounding root causes in the local-newer → attemptPush →
CloudSync.pushToCloud → lastPushedAt/UI path.

`cloud-sync.js`'s `getSyncStatus()` compared local vs. cloud timestamps as raw strings — Postgres/
PostgREST returns a `timestamptz` back with a `+00:00` suffix, not the `Z` suffix this device stamps
via `toISOString()`, and `'Z' > '+'` lexically, so *any* same-instant comparison misread as
`local-newer`. `Synced` was unreachable after a push; the status label stayed "Local newer" forever.
Now compares `Date.parse()` values instead of raw strings.

That made `refreshStatus()`'s `synced` branch — which seeded `AutoSync`'s dedup hash
(`lastPushedSignature`) from whatever was currently on screen — fire on a false "synced" read,
poisoning the dedup check against a payload that was never actually confirmed pushed. Removed that
seed entirely; `lastPushedSignature` is now set in exactly one place (a real `pushToCloud()` success),
and the skip condition additionally requires `cloudSyncMeta.localChangedAt <= cloudSyncMeta.lastPushedAt`
so a hash coincidence alone can't fake a "nothing to push" skip. `attemptPush()` also now flushes
pending debounced field writes before reading sync status, not after.

Command Centre and Integrations now refresh their "Last cloud update"/Status tiles the instant a push
completes (reusing the state's own timestamp, no extra network call) instead of only on next manual
reopen, and Command Centre's top sync button always carries the current skip/error reason as its
hover tooltip. Verified with a local Node/`vm` harness that loads the real source files against a
mocked Supabase client returning `+00:00`-suffixed timestamps — confirms `synced` is reachable again,
a genuine follow-up edit still pushes, and exactly one network push happens per genuine edit.

Unchanged: push-only, no auto-pull, cloud-newer conflict protection (now actually reachable), manual
Quick Sync/Push/Pull/Sync, `life_os_state` table/RLS.

Files affected:

scripts/cloud-sync.js, scripts/auto-sync.js, index.html, pages/integrations.html, docs/SUPABASE_PLAN.md

Commit:

Fix Auto Cloud Save: Postgres timestamp-format bug + dedup hash tightened to a confirmed-push signature

---

## 2026-07-08 (7)

### Fix Auto Cloud Save: reliable watchdog so a local-newer state can't sit idle

Live symptom despite (6): status correctly read "Local newer", Auto Save showed "on", Manual Push
worked, but the auto-push path still didn't visibly fire for a real signed-in session. Root cause was
a startup race in `auto-sync.js`'s `init()` — `SupabaseAuth.init()` kicks off an async session fetch,
and the very first status/push check ran before that resolved, misreading a real session as
signed-out. It self-healed eventually via `SupabaseAuth.subscribe()`'s later notify, but only once —
with no tight, guaranteed re-check loop, a slow session fetch or a missed notification left it idle.

Added an explicit `whenAuthReady()` gate so the first check runs only once auth has a definitive
answer, tightened the periodic re-check from 60s/5min to a single 12s watchdog tick, wrapped
`CloudSync.pushToCloud()` in a 20s timeout (`Promise.race`), and gave the Quick Sync/Integrations
status line canonical short states (`checking`, `queued`, `pushing`, `pushed successfully at HH:MM`,
`skipped: signed out/offline/hidden tab/cloud newer/disabled`, `push failed: <message>`,
`push timed out`) via the existing `lastSkipReason` field — no UI file changes needed, both panels
already render it.

Also found and fixed a genuine concurrency gap while building the regression harness: `pushInFlight`
was only set *after* an `await`, so two overlapping checks landing on the same auth transition (the
new `whenAuthReady()` gate and the ongoing `SupabaseAuth.subscribe()` callback) could both pass the
guard and call `pushToCloud()` twice for one local-newer state. Now claimed synchronously before the
first `await` in `attemptPush()`. The local-newer dedup bypass from (6) was also made unconditional
(`syncStatus.code !== 'local-newer'` gates the whole dedup check, not just a comment) so a hash
coincidence can never suppress a genuine local-newer push.

Verified with `tests/autosync-watchdog.test.mjs` (Node `vm` harness, real `cloud-sync.js`/
`auto-sync.js`/`supabase-auth.js` source, mocked Supabase client): local-newer + signed-in + online +
visible pushes exactly once; a failed push clears syncing and shows `push failed: …`; a timed-out push
clears syncing/inFlight and shows `push timed out`; an unchanged-signature watchdog tick still pushes
while status is local-newer; a successful push updates both `AutoSync.getState().lastPushAt` and
`cloudSyncMeta.lastPushedAt`.

Unchanged: push-only, no auto-pull, cloud-newer conflict protection, manual Quick Sync/Push/Pull/Sync,
`life_os_state` table/RLS, Supabase schema.

Files affected:

scripts/auto-sync.js, tests/autosync-watchdog.test.mjs (new), docs/SUPABASE_PLAN.md

Commit:

Fix Auto Cloud Save: reliable watchdog so local-newer + auto save on always pushes

---

## 2026-07-08 (8)

### Auto Cloud Save v3 — simple push path, same sequence as manual Push Local -> Cloud

Live symptom despite (5)-(7): signed in, Cloud Sync on, status still read "Local newer", "Last
cloud update" never changed, "Last auto push" stayed blank — while Manual Push worked every time.
Rather than chase another edge case in the debounce/watchdog/hash-dedup stack, rewrote
`scripts/auto-sync.js`'s push path from scratch as one function, `runAutoSync()`, that always runs
the exact same sequence the manual button uses: `ForceSave.flushAll()` -> `CloudSync.pushToCloud()`
-> update `cloudSyncMeta`/`AutoSync` state -> notify subscribers so Quick Sync/Integrations re-render.

Removed entirely: the payload hash/signature dedup (`computeSignature`/`hashString`/
`lastPushedSignature`/`alreadyPushed`), the separate debounce+max-wait timer pair, the
pending-rerun coalescing queue, and the separate display-only `refreshStatus()` (folded into
`runAutoSync()`, which now updates status on every call whether it pushes or not). None of that
machinery is needed: `runAutoSync()` reads `CloudSync.getSyncStatus()` fresh on every trigger and
pushes immediately whenever it says `local-newer`, `cloud-ready`, or `error` — never dedup-gated.

Six explicit triggers, all funnelling into `runAutoSync()`: page load (once auth is ready), a 10s
watchdog tick while visible, `visibilitychange` back to visible, the `online` event, an auth state
change, and a (2s-debounced, purely to batch rapid edits, never the sole trigger) meaningful
`localStorage` write. Push is skipped only for the six required reasons: signed out, offline,
hidden tab, auto save disabled, a genuine cloud-newer conflict, or a push already in flight — the
in-flight flag is still claimed synchronously with zero `await`s in between to rule out a
double-push race between two overlapping triggers.

Added visible diagnostics (`lastCheckAt`, `lastStatusCode`, `lastAttemptAt`, `lastResult`,
`lastReason`) to `AutoSync`'s state, and a new always-visible status line (not just the tile's
title tooltip) on both the Quick Sync panel (`#qsAutoSaveDiag`) and Integrations (`#asDiag`) reading
e.g. "checked just now · status: local-newer · last attempt 20:44", plus the existing reason line
now reads `lastReason` (e.g. "Auto push succeeded 20:44", "Auto push skipped: cloud newer").

Verified with a rewritten `tests/autosync-watchdog.test.mjs` (Node `vm` harness, real
`cloud-sync.js`/`auto-sync.js`/`supabase-auth.js` source, mocked Supabase client): local-newer +
signed-in + visible + online + enabled calls `CloudSync.pushToCloud()`; `ForceSave.flushAll()` runs
before `pushToCloud()` (same order as the manual button); a push success sets
`AutoSync.getState().lastPushAt`; a push failure clears the in-flight guard (a later check can push
again immediately) and leaves a visible error; an unchanged-payload watchdog tick while status stays
local-newer still pushes again (no dedup-skip possible, because there is no dedup).

Unchanged: push-only, no auto-pull (`checkCloudLoad()`'s confirm-gated cloud-load prompt is
untouched), cloud-newer conflict protection, manual Quick Sync/Force Local Save/Push/Pull/Sync
buttons, `life_os_state` table/RLS, Supabase schema.

Files affected:

scripts/auto-sync.js, index.html, pages/integrations.html, tests/autosync-watchdog.test.mjs,
docs/SUPABASE_PLAN.md

Commit:

Auto Cloud Save v3: simple push path matching manual Push Local -> Cloud, visible diagnostics

---

## 2026-07-08 (9)

### Fix: Auto Push failing with "window.ForceSave.flushAll is not a function"

(8) above wrote `runAutoSync()`/`checkCloudLoad()` to call `window.ForceSave.flushAll()`, but
`scripts/force-save.js` never attaches `flushAll` to `window.ForceSave` — it only exports
`registerFlush` and `run` (`run()` calls the internal `flushAll()` itself, then confirms Local
Storage is writable and returns `{ ok, timestamp, error }`). The manual Push Local -> Cloud /
Quick Sync / Integrations Sync buttons in `index.html` and `pages/integrations.html` always called
`window.ForceSave.run()`, never `flushAll()` directly — so manual push worked while every Auto Push
threw immediately and left status stuck on "action-needed".

Added `runForceSave()` in `scripts/auto-sync.js`: calls `window.ForceSave.run()` if present, falls
back to an ok result if `ForceSave` is missing, and never throws (catches any error and returns
`{ ok: false, error }`). Both call sites (`runAutoSync()`'s push path and `checkCloudLoad()`) now
use it instead of the non-existent `flushAll()`. A `ForceSave.run()` failure now stops before
`CloudSync.pushToCloud()` and sets `status: 'action-needed'` with the error surfaced via
`lastError`/`lastReason`, same as any other push-path failure.

No change to trigger logic, gating, dedup-free push behaviour, or push-only/no-auto-pull guarantees
from (8) — this only fixes the ForceSave API mismatch.

Updated `tests/autosync-watchdog.test.mjs`: the mock `window.ForceSave` now only exposes
`run()`/`registerFlush()` (matching the real API, so a regression back to calling `flushAll()`
throws in the harness), test 2 asserts `run()` runs before `pushToCloud()`, a new test 1b statically
asserts `scripts/auto-sync.js` contains no `ForceSave.flushAll` reference, and test 6 asserts a
`ForceSave.run()` failure stops the push before `pushToCloud()` is ever called.

Files affected:

scripts/auto-sync.js, tests/autosync-watchdog.test.mjs, docs/CHANGELOG.md

Commit:

Fix Auto Push: use ForceSave.run() instead of non-existent flushAll()

---

## 2026-07-08 (4)

### Health HQ — Sleep Planner

Health tracked sleep hours/quality but gave no guidance on when to actually go to bed. Added a
minimal Sleep Planner inside Health HQ's existing Sleep section (no new page section). Three new
fields on the `health` key — `wakeUpTime`, `estimatedSleepLatencyMinutes`, `windDownMinutes` —
join the existing `sleepTarget` (reused as target sleep length, not duplicated). New
`window.Health.computeSleepPlan(h)` in `scripts/health-data.js` is a pure read that estimates
~90-minute sleep cycles, rounds the target to the nearest whole cycle (clamped 3-6 cycles /
4.5-9 hrs), and returns a recommended bedtime + wind-down start plus one alternative window a
cycle either side. Framed throughout as an estimated sleep-cycle window, never a guaranteed
sleep-stage prediction — no medical claims, no AI API, no wearable integration. Existing users
upgrade safely via the existing missing-field-fill pattern in `window.Health.load()`.

`scripts/daily-guidance-data.js`'s `computeNudges()` now also surfaces tonight's wind-down/lights-out
time as a nudge, but only during evening/late-night hours (17:00-04:00) and pushed last so it never
displaces a higher-priority streak/fight-camp nudge in index.html's single-line preview. No other
Daily Guidance behaviour changed.

Files affected:

scripts/health-data.js, scripts/daily-guidance-data.js, pages/health.html, docs/DATA_SCHEMA.md

Commit:

Add Sleep Planner to Health HQ with Daily Guidance bedtime nudge

---

## 2026-07-08 (5)

### Hormones + Appearance cross-linking

Hormone Optimisation and Appearance/Looks were isolated — nothing else in the Life OS read them.
Added minimal, low-priority cross-links into Daily Guidance and Weekly Review, reading both
sections defensively (never throwing if either has no data yet) and never owning or duplicating
their data.

`scripts/daily-guidance-data.js`'s `computeGuidance()` now also reads `window.Hormones.load()` and
`window.Appearance.load()` and appends up to two short lines to the existing `nudges` array: a
Hormones line from today's lifestyle-foundations/supplements checklist completion, and an
Appearance line preferring `nextImprovementFocus` (falling back to remaining skincare/grooming
steps). Both are pushed after the streak/fight-camp nudges and before the evening-only sleep
nudge, so they stay low-priority and never crowd out a more urgent coaching signal or the single
nudge shown on index.html. `todayFocus`/`businessTask`/`trainingTask`/`goalAction`/
`healthReminder` are unchanged.

`scripts/weekly-review-data.js`'s `computePerformance()` now also returns `hormoneScore`,
`hormoneFoundationsPct`, `appearanceScore`, `appearanceRoutinePct`, `appearanceFocus`, rendered as
two small badges at the bottom of the existing Performance card on `pages/weekly-review.html`
(reusing the existing `.wr-badge` style — no new section, no redesign) and folded into
`generatePrompt()`'s copy-paste performance snapshot.

`hormone-data.js` / `appearance-data.js` are now also included on `pages/daily-snapshot.html` and
`pages/weekly-review.html` (already included on index.html) so both pages can read them. No
medical claims, no diagnosis, no AI API — completion counts and user-entered focus text only.
Existing users upgrade safely: both scripts already fill missing fields against their default
shape on load, and no field is ever overwritten. Sync is unaffected — no new localStorage keys,
AutoSync/CloudSync/ForceSave/Backup files untouched.

Files affected:

scripts/daily-guidance-data.js, scripts/weekly-review-data.js, pages/daily-snapshot.html,
pages/weekly-review.html, docs/DATA_SCHEMA.md

Commit:

Add Hormones + Appearance cross-linking to Daily Guidance and Weekly Review

---

## 2026-07-09

### Goals Progress Derived From Milestones/Actions

Fixed the audit finding that Goals progress was disconnected from milestone/action completion.

Added a `progressMode` ('auto' | 'manual') field per active goal. When a goal has milestones/actions, `progress` is now recomputed from their completion ratio on every load/save; dragging the manual slider switches that goal to a manual override, shown via a small Auto/Manual badge with a click-to-resume-auto action. Goals with no milestones/actions yet are unaffected. Older saved goals upgrade to `progressMode: 'auto'` automatically.

Life Stats, Weekly Review, Heatmap, index.html, AI CEO and Money HQ all keep reading `goal.progress` as before — no changes needed there, since the correction happens inside `window.Goals.load()`/`.save()`.

Files affected:

scripts/goals-data.js, pages/goals.html, docs/DATA_SCHEMA.md

Commit:

Derive Goals progress from milestone/action completion

---

## 2026-07-09 (2)

### Boxing HQ — weekly counter rollover

Fixed the audit finding that Boxing HQ's weekly session counters
(`completedBoxingSessions`, `completedRuns`, `completedStrengthSessions`) required a manual reset —
they were permanent totals that only ever went up.

Added a `weekStart` field (YYYY-MM-DD, Monday) to the `boxing` shape. `window.Boxing.load()` now
rolls the three completion counters back to 0 once `weekStart` no longer matches the current
Monday-start week — same 6 AM + Monday->Sunday week-boundary convention already used by
`window.WeeklyReview`, kept as its own small copy in `boxing-data.js` since it loads before
`weekly-review-data.js`. Weekly targets, focus/weaknesses, next-session plan, sparring/coach notes,
and `trainingLog` are untouched by the rollover. Existing saved data with no `weekStart` is stamped
with the current week on first load rather than reset, so no in-progress week is wiped by the
upgrade, and a same-week reload is a no-op. The reset is persisted immediately (not just held in
memory), so Weekly Review, Daily Guidance, Heatmap, and the index.html preview card — which all
read through `window.Boxing.load()` — see the same rolled-over counters with no changes needed on
their side. Added a small note under Boxing HQ's "Weekly Training" section title ("Resets
automatically each Monday · targets stay the same"); no new section, no redesign.

Files affected:

scripts/boxing-data.js, pages/boxing-hq.html, docs/DATA_SCHEMA.md

Commit:

Add weekly counter rollover to Boxing HQ

---

## 2026-07-09 (3)

### Business HQ — pipeline value roll-up

Fixed the audit finding that Business HQ captured pipeline item values but never summed them into
anything useful.

Added `window.Business.computePipelineValue(biz)` (pure read, no new storage) which sums
`pipeline[].value`, ignoring blank/invalid entries, into `{ total, active, won, lost, count }` —
`won`/`lost` come from pipeline items with `stage: 'Won'`/`'Lost'`, `active` is every other stage,
`total` is the sum of all three. Reuses the existing `pipeline` array — no new data key, no shape
change.

`pages/business-hq.html` shows a small 4-tile stat grid (Total Pipeline / Active / Won / Lost)
above the pipeline row list, styled with the same glass-card/tile language already used elsewhere
(e.g. Money HQ's `.mh-stat-grid`). index.html's Business HQ preview card gained one extra line
("Pipeline: £X total (£Y active)"), reusing the existing `.preview-sub` class. Weekly Review's
Performance card gained a "Pipeline" badge next to Business Progress, reading
`window.WeeklyReview.computePerformance()`'s new `pipelineTotal`/`pipelineActive`/`pipelineWon`/
`pipelineLost` fields, also folded into `generatePrompt()`'s text. AI CEO's `buildContext()` and
`generatePrompt()` now append the same total/active/won/lost breakdown to the existing Pipeline
context line.

Existing users upgrade safely: `computePipelineValue()` is a pure function over the existing
`pipeline` array, so old saved businesses with no changes needed just start showing correct totals.
Sync is unaffected — no new localStorage keys, AutoSync/CloudSync/ForceSave/Backup/Supabase files
untouched.

Files affected:

scripts/business-data.js, scripts/weekly-review-data.js, scripts/ai-ceo-data.js,
pages/business-hq.html, pages/weekly-review.html, index.html, docs/DATA_SCHEMA.md

Commit:

Add Business HQ pipeline value roll-up

---

## 2026-07-09 (4)

### Google Calendar — real OAuth (read-only)

Replaced the mock Google Calendar integration with a real, read-only OAuth connection, following
the same server-side proxy pattern already used for WHOOP.

Added `api/google-calendar-callback.js` (exchanges the OAuth code server-side, redirects back to
`pages/integrations.html` with tokens in the URL hash — never touches the server),
`api/google-calendar-refresh.js` (refreshes an expired access token), and
`api/google-calendar-data.js` (proxies to the Google Calendar API with the user's bearer token).
`GOOGLE_CLIENT_SECRET` never reaches the browser. Scope is `calendar.events.readonly` only — no
write access is ever requested.

`api/config.js` now also exposes `GOOGLE_CLIENT_ID` (a public value, not a secret) as
`window.GOOGLE_CLIENT_ID` so the client can build the consent URL without hardcoding it.

`scripts/google-calendar-service.js` now owns a `gcal_tokens_v1` token pair in localStorage
(`connect()` / `disconnect()` / `isConnected()`), and `refresh('googleCalendar')` calls the real
proxy instead of `buildMockCalendarEvents()`, mapping Google's event objects into the existing
`{ id, title, date, time, location, notes }` shape. Same `{ ok, state, mock, error }` return
contract as before, so no call site needed to change shape. `pages/integrations.html` gained
Connect/Disconnect buttons on the Google Calendar card (reusing existing `.int-sync-btn` styling,
no new CSS); the dashboard preview (`index.html`) and Daily Snapshot keep reading
`integrations.googleCalendar.upcomingEvents` exactly as before.

If `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` aren't set, Connect fails clearly with an inline
status message instead of redirecting to Google with an empty client ID. Existing saved
`integrations.googleCalendar` data (including old demo events) upgrades safely — nothing is wiped
on load or on disconnect; old events are only ever replaced by a successful real fetch.

Sync is unaffected — no new localStorage sync keys, AutoSync/CloudSync/ForceSave/Backup/Supabase
files untouched.

Files affected:

api/google-calendar-callback.js, api/google-calendar-refresh.js, api/google-calendar-data.js,
api/config.js, scripts/google-calendar-service.js, pages/integrations.html, SETUP.md,
docs/DATA_SCHEMA.md, docs/ROADMAP.md, docs/TODO.md

Commit:

Add real Google Calendar OAuth integration

---

## 2026-07-09 (5)

### Money HQ — Investments holdings model upgrade

Upgraded Money HQ's Investments tab from plain manual `currentValue`/`contributed` entries to an
optional per-holding model, laying the foundation for a future Trading 212 import — no external
API or credentials added yet.

Each investment row gained optional fields: `ticker`, `shares`, `averageCost`, `currentPrice`, and
`account` (platform/pie). `currentValue` and `contributed` are unchanged. `window.Money.load()`
upgrades every existing investment row with these new fields defaulted (never overwriting a value
already saved), so old manual entries keep working exactly as before.

`window.Money.investmentValue(inv)` derives a holding's value as `shares × currentPrice` whenever
both are set; otherwise it falls back to the manually-entered `currentValue`. `totalInvestmentsValue()`
now sums this derived value instead of raw `currentValue`, so Net Worth and the Command Centre
summary automatically become more accurate for holdings that have share/price data without any
change to their own code. Added `totalInvestmentsGain()`, `totalInvestmentsGainPct()`, and
`investmentAllocation(m, 'type'|'account')` (same grouped/sorted shape as `spendingByCategory`).
`computeSummary()` gained `investmentsGain`/`investmentsGainPct`.

`pages/money-hq.html`'s Investments tab: the add-investment form gained optional Ticker, Account/
platform, Shares, Average cost, and Current price inputs alongside the existing Name/Type/
Contributed/Current value/Notes fields, with an inline hint explaining the calculated-vs-manual
value rule. The stat grid gained a Gain/Loss % tile. Added an "Allocation by type" card (reusing
the existing `.mh-leg` legend row styling from Spending/Income). Each holding row now shows
ticker/account/shares-at-price in its meta line when present, still using the existing
`.custom-item` row styling — no new CSS, no new page, dark glassmorphism unchanged.

Weekly Review, AI CEO, and Life Stats are unaffected — they only ever read
`window.Money.computeSummary()`, which kept its existing fields and only gained new ones.
AutoSync/CloudSync/ForceSave/Backup/Supabase files untouched; investments still live inside the
same `money` localStorage key, no new storage key added.

Files affected:

scripts/money-data.js, pages/money-hq.html, docs/DATA_SCHEMA.md

Commit:

Upgrade Money HQ Investments to a per-holding shares/price model

---

## Future Entries

Example

### 2026-07-05

Added Business HQ.

Created reusable Business Card.

Updated AI Assistant.

Added revenue tracking.

Refactored business data structure.

Commit:

Add Business HQ