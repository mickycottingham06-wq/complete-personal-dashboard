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

---

## Ultimate Goal

A complete Life Operating System.