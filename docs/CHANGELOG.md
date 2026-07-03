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