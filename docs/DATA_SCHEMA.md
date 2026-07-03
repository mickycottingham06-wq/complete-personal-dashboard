# DATA_SCHEMA.md

## Purpose

This document defines how all dashboard data should be structured.

The dashboard should separate data from the interface.

Pages display data.

Data files store information.

Never hardcode values throughout the project.

---

# Philosophy

The dashboard should work like a database.

Every page should simply read data.

Changing one value should update the entire dashboard.

---

# Data Folder

The data folder should eventually contain:

data/
│
├── dashboardData.js
├── boxing.js
├── business.js
├── finance.js
├── goals.js
├── habits.js
├── calendar.js
├── weather.js
├── quotes.js
├── lifeStats.js
└── settings.js

Never mix unrelated data.

---

# Daily Snapshot Data

Implemented. Lives in `localStorage` under the key `dailySnapshot`. The read/rollover/save logic lives in `scripts/daily-snapshot-data.js` (shared business logic, not yet split into a `data/` file) so every reader — the full page at `pages/daily-snapshot.html`, the preview card on index.html, and Streaks — sees the same rolled-over data instead of re-implementing the rollover.

Shape:

```
dailySnapshot: {
  date: string,               // YYYY-MM-DD, 6 AM rollover — same convention as goals:
  mainFocus: string,
  priorities: [
    { id: string, text: string, completed: boolean },
    { id: string, text: string, completed: boolean },
    { id: string, text: string, completed: boolean }
  ],
  habits: [
    { id: string, label: string, completed: boolean }
  ],
  trainingStatus: string,
  businessFocus: string,
  healthStatus: string,
  notes: string
}
```

Default habits: Drink water after waking, Morning sunlight, Training completed, Steps / movement, Protein target, Sleep routine, No wasted scrolling.

Resets to defaults automatically when `date` no longer matches the active day. `window.DailySnapshot.get()` returns the raw stored value (may be null or stale); `window.DailySnapshot.loadOrInit()` reads, rolls over if needed, persists, and returns today's snapshot — this is what pages should call. `window.DailySnapshot.save(snap)` persists changes.

The full interactive UI lives at `pages/daily-snapshot.html`. index.html shows a compact preview card (main focus, habit completion %, priority completion %) that links to it.

---

# Streaks Data

Implemented. Lives in `localStorage` under the key `streaks`. The recompute logic lives in `scripts/streaks-data.js` (shared business logic, depends on `scripts/daily-snapshot-data.js`), used by both the full page at `pages/streaks.html` and the preview card on index.html.

Shape:

```
streaks: {
  currentStreak: number,
  bestStreak: number,
  lastCompletedDate: string,        // YYYY-MM-DD of the most recent day that hit the threshold
  weeklyCompletions: [              // last 7 days, oldest → newest
    { date: string, completed: boolean, completionPercentage: number }
  ],
  habits: [
    { id: string, label: string, currentStreak: number, bestStreak: number, completedToday: boolean }
  ],
  history: [                        // full day-by-day log, capped at 90 entries, oldest → newest
    {
      date: string,
      completed: boolean,
      completionPercentage: number,
      habits: [ { id: string, label: string, completed: boolean } ]
    }
  ]
}
```

Source of truth for "today": `window.DailySnapshot.get().habits`. Streaks does not own habit completion — it reads it.

Logic:

- A day counts as "completed" once habit completion reaches 70% (`COMPLETION_THRESHOLD`).
- Every page load, and every time a habit checkbox changes (Daily Snapshot dispatches a `dailySnapshot:habitsChanged` window event), Streaks recomputes and overwrites today's entry in `history`. Past days are never rewritten.
- `currentStreak` walks backward day-by-day from today. Today is given a grace period: if today isn't at threshold yet, the streak still shows yesterday's count rather than resetting early (the day isn't over). A missing or incomplete day anywhere else in the chain breaks it.
- `bestStreak` only ever increases (`Math.max(previousBest, currentStreak)`).
- Individual habit streaks use the same walk-backward logic against that habit's own daily history.
- `weeklyCompletions` is a derived last-7-days convenience view rebuilt from `history` on every save.

Uses the same 6 AM day-rollover convention as Daily Snapshot / goals.

`window.Streaks.get()` returns the raw stored value. `window.Streaks.recompute()` reruns the calculation against today's habits and persists it, returning `{ data, pct, completedToday, todayKey, isNewBest }` — this is what pages should call. Both are public hooks so Life Stats and the future Heatmap can read streak/history data without reimplementing the calculation.

The full interactive UI lives at `pages/streaks.html`. index.html shows a compact preview card (current streak, best streak, today's %) that links to it.

---

# Dashboard Data

dashboardData should contain:

Today's Date

Sleep

Weight

Calories

Water

Steps

Mood

Recovery

Tasks Completed

Training Status

Daily Score

Current Focus

---

# Boxing Data

boxing.js

Should contain:

Current Weight

Fight Weight

Weight Difference

Weeks Until Fight

Current Camp Phase

Today's Session

Running Pace

Recovery Score

Conditioning Score

Coach Notes

Sparring Notes

Strength Numbers

Training Volume

Weekly Sessions

Monthly Sessions

Fight Countdown

Everything related to boxing belongs here.

---

# Business Data

Implemented. Lives in `localStorage` under the key `business`. The load/save logic lives in `scripts/business-data.js` (shared business logic), used by both the full page at `pages/business-hq.html` and the preview card on index.html.

Shape:

```
business: {
  currentFocus: string,
  activeProject: string,
  todayTask: string,
  weeklyTarget: string,
  revenueTarget: number,
  currentRevenue: number,
  pipeline: [
    { id: string, name: string, stage: string, value: number, notes: string }
  ],
  projects: [
    { id: string, name: string, status: string, priority: string }
  ],
  notes: string,
  aiCeoPrompt: string
}
```

Default projects: AI automation agency, Digital products, Reselling / Whatnot, Property sourcing, Content / faceless TikTok.

`window.Business.load()` returns stored business data, filling in any fields missing against the default shape (upgrades older saved data). `window.Business.save(biz)` persists changes. `window.Business.uid()` generates ids for new pipeline/project rows.

The full interactive UI lives at `pages/business-hq.html`. index.html shows a compact preview card (current focus, active project, revenue progress, today's task) that links to it.

`aiCeoPrompt` is a legacy free-text placeholder field, kept for backwards compatibility. The full AI CEO (below) supersedes it.

---

# AI CEO / Business Assistant Data

Implemented. Lives in `localStorage` under the key `aiCeo`. The load/save/prompt-generation logic lives in `scripts/ai-ceo-data.js` (shared business logic), used by both the full page at `pages/ai-ceo.html` and the preview card on index.html. It reads (never duplicates) context from `window.Business`, `window.DailySnapshot` and `window.Streaks` — it owns none of that data itself.

Shape:

```
aiCeo: {
  activeMode: string,          // one of MODES ids — see below
  currentQuestion: string,
  currentBlocker: string,
  nextBestAction: string,
  generatedPrompt: string,
  savedAdvice: [
    { id: string, title: string, summary: string, decision: string, nextAction: string, dueDate: string, status: string, createdAt: string }
  ],
  actionPlan: [
    { id: string, task: string, priority: string, status: string, linkedProject: string, notes: string }
  ],
  settings: { tone: string, adviceStyle: string }
}
```

Assistant modes (`window.AiCeo.MODES`): Daily CEO Brief, Business Strategy, Offer / Product Ideas, Sales & Outreach, Content Ideas, Weekly Review, Decision Coach, Problem Solver. Each carries an `instruction` line folded into the generated prompt.

`window.AiCeo.load()` / `.save()` follow the same upgrade-on-load pattern as `window.Business`. `window.AiCeo.buildContext()` re-reads Business HQ / Daily Snapshot / Streaks live (never cached) so a generated prompt always reflects current state. `window.AiCeo.generatePrompt(ceo)` is a pure function that returns the copy-paste prompt text — no network request is made anywhere in this file.

No AI API is called. This is a prompt-generation and advice/action tracking tool only — the user copies the generated prompt into Claude/ChatGPT by hand. Wiring a real API later means adding a `fetch` call in `pages/ai-ceo.html` that sends `window.AiCeo.generatePrompt(ceo)`'s output; the data shape does not need to change.

The full interactive UI lives at `pages/ai-ceo.html`. index.html shows a compact preview card (active mode, current blocker, next best action, count of open action items) that links to it.

---

# Finance Data

finance.js

Should contain:

Cash

Bank Accounts

Emergency Fund

Investments

Crypto

Monthly Income

Monthly Expenses

Monthly Savings

Net Worth

Property Equity

Business Revenue

Debt

Bills

Subscriptions

Financial Goals

---

# Goal Data

goals.js

Each goal should contain:

Name

Category

Target

Current Progress

Percentage

Deadline

Priority

Status

Notes

Categories

Health

Business

Finance

Boxing

Learning

Personal

---

# Habit Data

habits.js

Each habit should contain:

Name

Current Streak

Best Streak

Today's Status

Weekly Status

Monthly Status

Completion Percentage

Habits

Gym

Boxing

Running

Reading

Business

Diet

Sleep

Water

---

# Calendar Data

calendar.js

Should contain:

Today's Events

Meetings

Training

Appointments

Deadlines

Business Tasks

Personal Tasks

---

# Weather Data

weather.js

Should contain:

Temperature

Conditions

Wind

Rain Chance

Sunrise

Sunset

Forecast

API Ready

---

# Quote Data

quotes.js

Should contain:

Quote

Author

Category

Rotation

Favourite

Categories

Stoicism

Warriors

Business

Discipline

Leadership

Mindset

Original Quotes

---

# Life Stats

lifeStats.js

Should contain:

Days Alive

Gym Sessions

Boxing Sessions

Runs Completed

Hours Trained

Books Read

Money Saved

Revenue Generated

Hours Worked

Hours Slept

Calories Burned

---

# AI Assistant Data

aiAssistant.js

Should contain:

Today's Focus

Top Priorities

Money Task

Learning Task

Admin Task

Reminder

Warnings

Recommendations

Generated Briefing

Future API Integration

---

# Settings

settings.js

Should contain:

Theme

Accent Colour

Units

Notification Settings

Dashboard Preferences

Default Landing Page

Widget Preferences

Future AI Settings

---

# Rules

Never duplicate data.

One source of truth.

UI reads data.

UI does not own data.

Every editable value should exist in exactly one place.

---

# Future Database

Eventually this schema should map directly to a real database if required.

The transition should require minimal code changes.

Design the data structure with scalability in mind.

---

# Final Rule

When adding new features:

First ask:

Which data file should own this information?

Never store data inside UI components unless absolutely necessary.