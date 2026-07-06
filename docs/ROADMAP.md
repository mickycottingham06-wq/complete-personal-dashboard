# ROADMAP.md

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

Investments ✅ (accounts with contributed vs current value, gain/loss)

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

Google Calendar (mock/demo foundation built — scripts/google-calendar-service.js; real OAuth connection not yet live)

Weather API (real connection — not yet live)

Finance API

Whoop

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

## Ultimate Goal

A complete Life Operating System.