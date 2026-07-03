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