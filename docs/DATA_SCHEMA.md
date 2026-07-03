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

business.js

Must support multiple businesses.

Each business should contain:

Name

Description

Status

Priority

Monthly Revenue

Revenue Target

Current Goal

Current Task

Next Action

Progress

Monthly Expenses

Notes

Example Businesses

AI Automation

Amazon FBA

Digital Products

Property

Faceless Content

Future businesses should be easy to add.

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