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

Implemented as the Life OS's daily control panel. Lives in `localStorage` under the key `dailySnapshot`. The read/rollover/upgrade/save logic lives in `scripts/daily-snapshot-data.js` (shared business logic, not yet split into a `data/` file) so every reader — the full page at `pages/daily-snapshot.html`, the Command Centre preview card on index.html, Streaks, and Heatmap — sees the same rolled-over data instead of re-implementing the rollover.

Shape:

```
dailySnapshot: {
  date: string,               // YYYY-MM-DD, 6 AM rollover — same convention as goals:
  // Morning plan
  mainFocus: string,
  successTarget: string,       // "one thing that would make today successful"
  priorities: [
    { id: string, text: string, completed: boolean },
    { id: string, text: string, completed: boolean },
    { id: string, text: string, completed: boolean }
  ],
  scheduleNotes: string,
  // Execution
  habits: [
    { id: string, label: string, completed: boolean }
  ],
  trainingCompleted: boolean,
  businessTaskCompleted: boolean,
  healthRoutineCompleted: boolean,
  spendingLogged: boolean,
  goalActionCompleted: boolean,
  // Body / mind status
  energyLevel: number,          // 0-10, 0 = not logged yet
  mood: string,                 // one of window.DailySnapshot.MOODS, or ''
  sleepQuality: number,         // 0-10
  recovery: number,             // 0-10
  stress: number,               // 0-10
  currentWeight: number,        // kg
  notes: string,
  // Evening review
  wentWell: string,
  slipped: string,
  lesson: string,
  tomorrowPriority: string,
  dayScore: number,             // 0-10 manual rating, 0 = not logged yet
}
```

Default habits: Drink water after waking, Morning sunlight, Training completed, Steps / movement, Protein target, Sleep routine, No wasted scrolling. Default moods (`window.DailySnapshot.MOODS`): Great, Good, Okay, Low, Rough.

Resets to defaults automatically when `date` no longer matches the active day. Same-day loads also upgrade in any fields missing against the current default shape (schema-upgrade pattern shared with every other section), so older saved snapshots from before this shape existed don't lose data mid-day. `window.DailySnapshot.get()` returns the raw stored value (may be null or stale); `window.DailySnapshot.loadOrInit()` reads, rolls over/upgrades if needed, persists, and returns today's snapshot — this is what pages should call. `window.DailySnapshot.save(snap)` persists changes.

**Cross-feeds (safe one-way updates, not two-way sync):** `energyLevel` and `stress` are pushed into `window.Health`'s `energyLevel`/`stressLevel` fields on change, since both use the same 0-10 scale — Health HQ's own preview card picks this up automatically with no extra code. `currentWeight` is pushed via the existing `window.Core.setCurrentWeight()` helper, which already keeps `window.Health.currentWeight` and `window.Boxing.currentWeight` in sync. `sleepQuality` and `recovery` are intentionally **not** pushed anywhere — Health HQ's own `sleepQuality` (a text category) and `recoveryScore` (a WHOOP 0-100 percentage) use different scales and would silently corrupt on overwrite, so they stay local to Daily Snapshot only. The five execution booleans (`trainingCompleted`, `businessTaskCompleted`, `healthRoutineCompleted`, `spendingLogged`, `goalActionCompleted`) are read directly by `scripts/heatmap-data.js` (replacing its old free-text-field inference) and surfaced as small read-only "✓ done today" lines on the Business HQ, Boxing HQ, Health HQ, Money HQ, and Goals preview cards on index.html — those HQ pages' own data shapes are untouched; the flags are read, never duplicated into them.

The full interactive UI lives at `pages/daily-snapshot.html`, split into four cards: Morning Plan, Execution, Body / Mind Status, Evening Review. index.html's Command Centre shows a compact preview card (main focus, daily completion %, current streak, today's score, tomorrow's priority if set) that links to it.

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

Implemented. Lives in `localStorage` under the key `boxing`. The load/save logic lives in `scripts/boxing-data.js` (shared business logic), used by both the full page at `pages/boxing-hq.html` and the preview card on index.html.

Shape:

```
boxing: {
  trainingPhase: string,
  fightDate: string,               // YYYY-MM-DD
  currentWeight: number,
  targetWeight: number,
  weeklyBoxingTarget: number,
  completedBoxingSessions: number,
  weeklyRunTarget: number,
  completedRuns: number,
  weeklyStrengthTarget: number,
  completedStrengthSessions: number,
  currentFocus: string,
  weaknesses: string[],
  nextSessionPlan: string,
  sparringNotes: string,
  coachNotes: string,
  trainingLog: [
    { id: string, date: string, type: string, duration: string, intensity: string, notes: string }
  ]
}
```

Default training phases: Base Building, Strength & Power, Fight Camp, Peak Week, Fight Week, Recovery, Off Season.

Default focuses (`window.Boxing.DEFAULT_FOCUSES`, used for both `currentFocus` and `weaknesses`): Footwork, Defence, Head Movement, Jab, Combinations, Conditioning, Power, Speed, Ring IQ, Mobility.

`window.Boxing.load()` returns stored boxing data, filling in any fields missing against the default shape (upgrades older saved data). `window.Boxing.save(box)` persists changes. `window.Boxing.uid()` generates ids for new training log rows.

The full interactive UI lives at `pages/boxing-hq.html`. index.html shows a compact preview card (training phase, current vs target weight, weekly boxing session progress, current focus) that links to it.

Everything related to boxing belongs here. Future features (Whoop/Garmin recovery data, punch analytics, weight trend graphs) should extend this shape rather than creating a second boxing data source.

---

# Health Data

Implemented. Lives in `localStorage` under the key `health`. The load/save logic lives in `scripts/health-data.js` (shared business logic), used by both the full page at `pages/health.html` and the preview card on index.html.

Shape:

```
health: {
  sleepTarget: number,
  lastNightSleep: number,
  sleepQuality: string,
  recoveryScore: number,
  energyLevel: number,
  stressLevel: number,
  hydrationTarget: number,
  waterIntake: number,
  proteinTarget: number,
  caloriesTarget: number,
  currentWeight: number,
  morningRoutine: [ { id: string, label: string, completed: boolean } ],
  eveningRoutine: [ { id: string, label: string, completed: boolean } ],
  supplements: [ { id: string, name: string, taken: boolean } ],
  recoveryNotes: string,
  healthNotes: string
}
```

Default morning routine: Drink water after waking, Morning sunlight, Brush teeth, Skincare, Mobility, Protein breakfast.

Default evening routine: No phone before bed, Prepare for tomorrow, Stretch/mobility, Skincare, Sleep on time.

Default supplements checklist: Creatine, Electrolytes, Magnesium, Vitamin D, Omega 3.

`window.Health.load()` returns stored health data, filling in any fields missing against the default shape (upgrades older saved data). `window.Health.save(h)` persists changes. `window.Health.uid()` generates ids for new checklist rows.

This `supplements` checklist is a separate, simpler daily tick-list from the pre-existing "Daily Stack" system further down `pages/health.html` (localStorage keys `stack:items` / `stack:taken:<date>`, with dosing, timing windows, and search) — the two are not merged, since Daily Stack already owns a richer supplement-ordering workflow. WHOOP integration and the water tracker iframe on the same page are also untouched and remain their own systems.

The full interactive UI lives at `pages/health.html`, above the existing WHOOP / Daily Stack / Water Tracker sections. index.html shows a compact preview card (last night's sleep, recovery score, water intake, energy level) that links to it.

Tracking and general wellbeing only — this app never gives medical advice.

Everything related to health command-centre tracking belongs here. Future features (Hormone Optimisation, Appearance/Looks, AI coaching) should read this shape rather than duplicating sleep/recovery/hydration data.

---

# Hormone Optimisation Data

Implemented. Lives in `localStorage` under the key `hormones`. The load/save logic lives in `scripts/hormone-data.js` (shared business logic), used by both the full page at `pages/hormone-optimisation.html` and the preview card on index.html.

Shape:

```
hormones: {
  hormoneScore: number,          // 1-10 manual overall rating
  energyLevel: number,           // 1-10
  mood: string,
  vitalityRating: number,        // 1-10, libido/vitality
  sleepConsistency: number,      // 1-10
  stressLevel: number,           // 1-10
  trainingRecovery: number,      // 1-10
  sunlightExposure: boolean,
  nutritionQuality: string,
  avoidedProcessedFood: boolean,
  avoidedAlcohol: boolean,
  lifestyleFoundations: [ { id: string, label: string, completed: boolean } ],
  supplements: [ { id: string, name: string, taken: boolean } ],
  bloodwork: [ { id: string, marker: string, value: string, unit: string, date: string, notes: string } ],
  weeklyNotes: string,
  redFlagNotes: string
}
```

Default lifestyle foundations: 7-9 hours sleep, Morning sunlight, Strength training, Boxing/conditioning balanced with recovery, Whole foods, Enough calories/protein, Hydration/electrolytes, Low alcohol, Low processed food, Manage stress.

Default supplements checklist: Vitamin D, Magnesium, Zinc, Omega 3, Creatine, Electrolytes. This is a separate checklist from Health HQ's supplements list — the two are not merged, since Hormone Optimisation's stack is specifically testosterone/lifestyle-support focused.

Default bloodwork markers (placeholders only, values left blank for the user to fill in from their own labs): Total Testosterone, Free Testosterone, SHBG, LH, FSH, Oestradiol, Prolactin, Vitamin D, Thyroid Markers, Cortisol.

`window.Hormones.load()` returns stored hormone data, filling in any fields missing against the default shape (upgrades older saved data). `window.Hormones.save(h)` persists changes. `window.Hormones.uid()` generates ids for new checklist/bloodwork rows.

The full interactive UI lives at `pages/hormone-optimisation.html`. index.html shows a compact preview card (hormone score, energy level, sleep consistency, stress level) that links to it.

Tracking and general wellbeing support only — this app never diagnoses, treats, or prescribes anything, and gives no dosage advice. The Red Flags section is a personal notes field reminding the user to speak to a professional; it is not a symptom checker.

Everything related to hormone-optimisation lifestyle tracking belongs here. Future features (Appearance/Looks, Life Stats, AI coaching) should read this shape rather than duplicating energy/sleep/recovery data.

---

# Appearance / Looks Data

Implemented. Lives in `localStorage` under the key `appearance`. The load/save logic lives in `scripts/appearance-data.js` (shared business logic), used by both the full page at `pages/appearance.html` and the preview card on index.html.

Shape:

```
appearance: {
  looksScore: number,             // 1-10 manual overall rating
  skinScore: number,              // 1-10
  acneStatus: string,
  acneScarringNotes: string,
  faceBloatingRating: number,     // 1-10
  bodyCompositionNotes: string,
  hairstyleNotes: string,
  beardNotes: string,
  teethSmileNotes: string,
  postureNotes: string,
  styleNotes: string,
  skincareRoutine: [ { id: string, label: string, completed: boolean } ],
  groomingRoutine: [ { id: string, label: string, completed: boolean } ],
  progressPhotos: [
    { id: string, date: string, label: string, notes: string, imageUrl: string }
  ],
  weeklyNotes: string,
  nextImprovementFocus: string
}
```

Default skincare routine: Cleanse, Moisturise, SPF, Evening cleanse, Spot treatment if used, Hydration, Clean pillowcase.

Default grooming routine: Haircut maintained, Beard/facial hair maintained, Eyebrows tidy, Nails clean, Clothes prepared, Fragrance, Posture check.

`progressPhotos` is metadata only — date, label, notes, and an optional `imageUrl` reference string. No base64 or binary image data is ever written to `localStorage`; the UI renders a placeholder "image slot" instead of an actual photo. Full AI photo analysis and real image storage are a future integration and are not implemented.

`window.Appearance.load()` returns stored appearance data, filling in any fields missing against the default shape (upgrades older saved data). `window.Appearance.save(a)` persists changes. `window.Appearance.uid()` generates ids for new checklist/photo rows.

The full interactive UI lives at `pages/appearance.html`. index.html shows a compact preview card (looks score, skin score, skincare completion %, grooming completion %, current improvement focus) that links to it.

Tracking and general appearance optimisation only — this app never diagnoses or treats acne, scarring, hormones, or any health condition.

Everything related to appearance/looks tracking belongs here. Future features (Health HQ cross-links, Life Stats, real image storage, AI photo analysis) should read this shape rather than duplicating score/routine data.

---

# Life Goals Data

Implemented. Lives in `localStorage` under the key `lifeGoals`. The load/save logic lives in `scripts/goals-data.js` (shared business logic), used by both the full page at `pages/goals.html` and the preview card on index.html.

This is separate from the per-day `goals:YYYY-MM-DD` keys used by the Main page's daily goal ticker (`pages/main.html`, `scripts/topbar.js`) — that system is a simple daily to-do list; `lifeGoals` is the long-term life-direction / active-goal command centre. The two intentionally do not share data.

Shape:

```
lifeGoals: {
  mainLifeGoal: string,
  twelveMonthGoal: string,
  ninetyDayGoal: string,
  monthlyGoal: string,
  weeklyGoal: string,
  activeGoals: [
    {
      id: string,
      title: string,
      category: string,       // one of CATEGORIES
      priority: string,       // one of PRIORITIES
      status: string,         // one of STATUSES
      progress: number,       // 0-100
      deadline: string,       // YYYY-MM-DD
      milestones: [ { id: string, title: string, completed: boolean } ],
      actions: [ { id: string, title: string, completed: boolean } ],
      notes: string
    }
  ]
}
```

Default categories (`window.Goals.CATEGORIES`): Business / Money, Boxing, Health, Appearance, Career / Skills, Personal.

Priorities (`window.Goals.PRIORITIES`): High, Medium, Low. Statuses (`window.Goals.STATUSES`): Not Started, In Progress, On Track, At Risk, Achieved.

`activeGoals` starts empty — no seeded goals, since these are personal and specific to the user.

`window.Goals.load()` returns stored goals data, filling in any fields missing against the default shape (upgrades older saved data, including per-goal fields and milestone/action arrays). `window.Goals.save(g)` persists changes. `window.Goals.uid()` generates ids for new goal/milestone/action rows. `window.Goals.defaultActiveGoal()` returns a blank active goal (used by "+ Add Active Goal").

The full interactive UI lives at `pages/goals.html`. index.html shows a compact preview card (main life goal, 90-day goal, active goal count, average progress) that links to it.

Everything related to long-term goal tracking belongs here. Future features (Daily Snapshot, Streaks, Business HQ, Boxing HQ, Health HQ, Appearance/Looks, Life Stats, Heatmap, AI coaching) should read this shape rather than duplicating goal data.

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

# Money HQ Data

Implemented. Lives in `localStorage` under the key `money`. The load/save/calculation logic lives in `scripts/money-data.js` (shared business logic), used by both the full page at `pages/money-hq.html` and the Command Centre preview card on index.html. Supersedes the old `pages/finance.html` build (kept on disk, de-prioritised, no longer linked from navigation) and the stub below.

Shape:

```
money: {
  currency: 'GBP',                 // always GBP — this app never uses CHF
  accounts: [ { id, name, type: 'bank'|'cash', balance } ],
  assets: [ { id, name, type: 'crypto'|'other', value } ],
  liabilities: [ { id, name, type, balance } ],
  spending: [ { id, date, merchant, category, amount, paymentMethod, notes, source } ],  // source: 'manual'|'receipt'
  income: [ { id, date, source, type, amount, notes } ],
  budgets: [ { id, category, monthlyLimit, spent } ],   // spent is a recomputed cache, not a second source of truth
  budgetTarget: number,             // overall monthly budget target
  investments: [ { id, name, type, currentValue, contributed, notes } ],
  bills: [ { id, name, amount, dueDate, frequency, category, status } ],
  receipts: [ { id, date, merchant, amount, category, status, notes } ],  // log only — no image data ever stored here
  netWorthHistory: [ { date, value } ],  // capped at 90 entries, oldest → newest, one snapshot per day
  notes: string,
}
```

Default budget categories (`window.Money` seeds these into `budgets` on first load / upgrade): Food, Transport, Training/Health, Clothes/Appearance, Business, Subscriptions, Savings/Investments, Other. The same list is `window.Money.SPENDING_CATEGORIES`, reused by the Spending, Bills, and Receipts category dropdowns so spending always maps onto a budget category.

`window.Money.load()` / `.save(m)` follow the same upgrade-on-load pattern as every other section. `save()` also refreshes two derived caches so they can never drift from the arrays that actually own the data: each budget's `spent` (recomputed from `spending` for the current calendar month) and today's `netWorthHistory` snapshot (replaces today's entry if one already exists, otherwise appends). `window.Money.uid()` generates ids. Pure calculation reads — `netWorth()`, `totalAccounts()`, `totalAssets()`, `totalLiabilities()`, `totalInvestmentsValue()`, `totalInvestmentsContributed()`, `monthlyIncome()`, `monthlySpending()`, `monthlySavings()`, `savingsRate()`, `spendingByCategory()`, `incomeBySource()`, `upcomingBills()`, `monthlyRecurringTotal()`, `recentTransactions()` — never persist and never duplicate the underlying arrays. `window.Money.computeSummary()` bundles the headline numbers (net worth, monthly income/spending/savings, savings rate, total invested, next upcoming bill) for the Command Centre preview card.

The full interactive UI lives at `pages/money-hq.html`: a header + back button (same suppressed-chrome pattern as the old finance.html) and its own internal bottom tab bar for Overview / Net Worth / Spending / Income / Budget / Investments / Bills / Receipts (active tab persisted under `money_active_tab`). index.html shows a compact preview card (net worth, monthly savings line, income/spending/savings-rate mini-stats, next upcoming bill) that links to it.

Receipts tab: the photo is read client-side with `FileReader` into a data URL held only in a page-level JS variable / `<img>` preview — it is never written to `localStorage` and is discarded (cleared from the `<img>` and the file input) as soon as the entry is confirmed or cancelled. No OCR is implemented (no paid API, no client-side text extraction) — merchant/amount/date/category are always typed in by hand; this is clearly labelled in the UI as manual entry with OCR as a future upgrade. Confirming only ever persists a `spending` entry (`source: 'receipt'`) plus a `receipts` log row — never the image.

Overview tab reads (never duplicates) `window.Goals` — active goals with `category === 'Business / Money'` — for the "financial goal progress" rollup.

Everything related to net worth, spending, income, budgeting, investments, bills/subscriptions, and receipt-based spending entry belongs here. Future features (real bank connections, real OCR/AI extraction, property tracking, multi-currency) should extend this shape rather than creating a second finance data source.

---

# Finance Data (superseded)

This was the original planning stub, superseded by the implemented "Money HQ Data" section above (`money` key, `scripts/money-data.js`, `pages/money-hq.html`). Kept here only for history.

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

# Goal Data (superseded)

This was the original planning stub, superseded by the implemented "Life Goals Data" section above (`lifeGoals` key, `scripts/goals-data.js`). Kept here only for history.

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

Implemented. Lives in `localStorage` under the key `lifeStats`. The load/save/compute logic lives in `scripts/life-stats-data.js` (shared business logic), used by both the full page at `pages/life-stats.html` and the preview card on index.html.

Shape:

```
lifeStats: {
  overallScore: number,           // 1-10 manual overall rating
  productivityScore: number,      // 1-10
  healthScore: number,            // 1-10
  boxingScore: number,            // 1-10
  businessScore: number,          // 1-10
  goalsScore: number,             // 1-10
  appearanceScore: number,        // 1-10
  weeklyWins: [ { id: string, text: string } ],
  weeklyLessons: [ { id: string, text: string } ],
  areasNeedingAttention: [ { id: string, text: string } ],
  notes: string
}
```

The seven scores are manual/subjective ratings the user edits with sliders — they are not derived from other sections, since "how good do I feel this is going" is a judgement call, not a calculation.

Everything else on the page is computed live rather than stored, via `window.LifeStats.computeStats()`, which reads (never duplicates):

- `window.Streaks` → current streak, best streak, today's habit completion %
- `window.Goals` → active goal count, average progress
- `window.Business` → revenue current/target/percentage
- `window.Boxing` → weekly boxing session completion, current/target weight
- `window.Health` → last night's sleep, recovery score, water intake, energy level
- `window.Appearance` → looks score, skin score

Any section without data yet (e.g. its localStorage key has never been touched) still returns its own safe defaults, so `computeStats()` never throws — it just shows zeros until that section has real data.

`window.LifeStats.load()` returns stored manual data, filling in any fields missing against the default shape (upgrades older saved data). `window.LifeStats.save(ls)` persists changes. `window.LifeStats.uid()` generates ids for new win/lesson/attention rows. `window.LifeStats.computeStats()` is a pure read — it owns no state and can be called as often as needed.

The full interactive UI lives at `pages/life-stats.html`. index.html shows a compact preview card (overall score, current streak, goals average progress, first area needing attention) that links to it.

Everything related to cross-Life-OS analytics belongs here. Future features (Heatmap, API integrations) should read this shape and `computeStats()` rather than duplicating scores or recalculating section data separately.

---

# Heatmap

Implemented. Lives in `localStorage` under the key `heatmap`. The derive/recompute/save logic lives in `scripts/heatmap-data.js` (shared business logic), used by both the full page at `pages/heatmap.html` and the preview card on index.html.

Shape:

```
heatmap: {
  entries: [
    {
      id: string,
      date: string,               // YYYY-MM-DD, 6 AM rollover — same convention as goals: / dailySnapshot
      completionScore: number,    // 0-100
      habitsCompleted: number,
      habitsTotal: number,
      trainingCompleted: boolean,
      businessTaskCompleted: boolean,
      healthRoutineCompleted: boolean,
      goalsWorkedOn: boolean,
      notes: string
    }
  ],
  selectedDate: string,
  viewMode: string               // '30' | '60' | '90'
}
```

`entries` is capped at 120 rows (covers the 90-day view plus buffer), oldest → newest, same pattern as `streaks.history`.

Today's entry is derived live rather than duplicated, reading (never owning):

- `window.DailySnapshot` → habit completion (`habitsCompleted`/`habitsTotal`), and its `trainingCompleted`/`businessTaskCompleted`/`healthRoutineCompleted` execution flags (primary signals, with habit/Boxing/Business fallbacks preserved for older data)
- `window.Boxing` → `trainingLog` entries dated today (extra signal for `trainingCompleted` alongside the Daily Snapshot "training" habit)
- `window.Business` → `todayTask` (fallback signal for `businessTaskCompleted`)
- `window.Goals` → active goals with `status: 'In Progress'` and `progress > 0` (fallback signal for `goalsWorkedOn`)
- the `goals:YYYY-MM-DD` daily to-do list keys → any goal marked done that day (primary signal for `goalsWorkedOn`)

`completionScore` is `round((habitPct + activityPct) / 2)`, where `habitPct` is habit completion % and `activityPct` is the percentage of the four boolean flags that are true. Kept intentionally simple rather than a weighted model.

Past days the Heatmap was never opened for still show something meaningful instead of a blank cell: `window.Heatmap.getEntry(date)` falls back to `window.Streaks.history` for that date (habit completion only) before falling back to a safe all-zero default. Once a day has its own `heatmap` entry (because today's recompute ran, or a note was added), that entry is frozen and never rewritten — same rule as `streaks.history`.

`window.Heatmap.get()` returns the raw stored value. `window.Heatmap.recompute()` recomputes and persists today's entry (preserving any notes already saved for today) and should be called on every page load. `window.Heatmap.getEntry(date)` is a pure read for any date. `window.Heatmap.getRange(days)` returns oldest→newest `{ date, entry }` pairs for the grid without writing to storage. `window.Heatmap.setNotes(date, text)`, `.setSelectedDate(date)` and `.setViewMode('30'|'60'|'90')` persist their respective fields. `window.Heatmap.computeWeekStats()` returns `{ todayScore, weekAvg, bestDay: { date, score }, currentStreak }` for the preview card and the full page's overview row.

The full interactive UI lives at `pages/heatmap.html`: a 30/60/90-day intensity grid (10 columns, GitHub-style color levels), a selected-day detail panel (score, activity chips, notes), and an overview row (today's score, current streak, week average, best day this week). index.html shows a compact preview card (today's score, current streak, week average, best day) that links to it.

No API integrations are wired up yet — this is local-only, matching every other section. Future features (real Daily Snapshot/Streaks history depth, Business/Health/Boxing per-day completion flags, API integrations) should extend this shape and its derivation rather than creating a second consistency-tracking system.

---

# Weekly Review

Implemented. Lives in `localStorage` under the key `weeklyReview`. The load/save/compute/prompt logic lives in `scripts/weekly-review-data.js` (shared business logic), used by both the full page at `pages/weekly-review.html` and the preview card on index.html.

Shape:

```
weeklyReview: {
  weekStart: string,             // YYYY-MM-DD, Monday of the current week
  weekEnd: string,               // YYYY-MM-DD, Sunday of the current week
  overallScore: number,          // 1-10 manual overall rating
  mainWin: string,
  mainLesson: string,
  mainProblem: string,
  nextWeekFocus: string,
  wentWell: string,
  slipped: string,
  learned: string,
  needsChange: string,
  stopDoing: string,
  doubleDown: string,
  priorities: [ { id: string, text: string, completed: boolean } ],  // capped at 3 in the UI
  targets: { business: string, boxing: string, health: string, money: string, personal: string },
  generatedPrompt: string,
  notes: string
}
```

Uses the same 6 AM day-rollover convention as Daily Snapshot / Streaks / Heatmap / goals: to decide "today" when computing the Monday–Sunday week range. `window.WeeklyReview.loadOrInit()` reads stored data, upgrades any fields missing against the default shape, and starts a fresh blank review once the stored `weekEnd` no longer matches the current week — same single-current-record rollover pattern as `window.DailySnapshot`, just weekly instead of daily (past weeks are not archived). `window.WeeklyReview.save(wr)` persists changes. `window.WeeklyReview.uid()` generates ids for priority rows.

`window.WeeklyReview.computePerformance()` is a pure read (owns no state) that pulls a live cross-Life-OS snapshot rather than duplicating it, reading (never owning):

- `window.Streaks` → current streak, today's habit %, weekly habit completion average
- `window.Boxing` → completed vs target weekly training sessions
- `window.Business` → current vs target revenue
- `window.Money` → `computeSummary()` for net worth, monthly income/spending/savings, savings rate
- `window.Health` → last night's sleep, recovery score, energy level, hydration
- `window.Goals` → active goal count, average progress
- `window.Heatmap` → `computeWeekStats()` weekly consistency average

Any section without data yet returns its own safe defaults, so `computePerformance()` never throws.

`window.WeeklyReview.generatePrompt(wr)` is a pure function (no network request) that builds a copy-paste prompt combining the manual review answers with a live `computePerformance()` read, asking the pasted-in AI to review the week, identify patterns, give direct feedback, and suggest next week's priorities with a simple action plan — same "prompt builder, not a live API" pattern as `window.AiCeo`. No AI API is called from this file or the page.

**Cross-feed:** `nextWeekFocus` is exposed (read-only) through `window.Core.getSnapshot()` as `nextWeekFocus`, the same safe one-way pattern `getSnapshot()` already uses for Daily Snapshot's `mainFocus`. Core never persists or owns this value — it only reads it live.

The full interactive UI lives at `pages/weekly-review.html`, split into five areas: This Week (week range, overall score, main win/lesson/problem), Performance (live stats/progress bars pulled from the sections above), Reflection (went well / slipped / learned / needs to change / one main priority / stop doing / double down), Next Week Plan (main focus, top 3 priorities, business/boxing/health/money/personal targets), and AI Review Prompt (generate/copy). index.html shows a compact preview card (week range, next week's focus, week score, weekly habit average, priority count, main problem) that links to it.

Everything related to weekly reflection and next-week planning belongs here. Future features (review history/archive, AI coaching trend analysis) should extend this shape rather than creating a second weekly-review data source.

---

# Integrations

Implemented as a **foundation only** — no live API calls, credentials, or OAuth flows. Lives in `localStorage` under the key `integrations`. The load/save/mock-sync logic lives in `scripts/integrations-data.js` (shared business logic), used by both the full page at `pages/integrations.html` and the preview card on index.html.

Shape:

```
integrations: {
  weather: {
    enabled: boolean,
    status: string,        // 'Not connected' | 'Enabled — not synced yet' | 'Connected (live)' | 'Connected (mock data)' | 'Error — …'
    location: string,
    lastSync: string,       // ISO timestamp, '' if never synced
    temperature: string,
    condition: string,
    high: string,
    low: string,
    rainChance: string,
    wind: string,
    notes: string
  },
  googleCalendar: {
    enabled: boolean,
    status: string,
    lastSync: string,
    upcomingEvents: [ { id: string, title: string, date: string, time: string, location: string, notes: string } ],
    notes: string
  },
  aiApi: {
    enabled: boolean,
    status: string,
    provider: string,       // free-text label, e.g. 'Anthropic (Claude)'
    lastUsed: string,        // ISO timestamp, '' if never used
    notes: string
  },
  cloudSync: {
    enabled: boolean,
    status: string,
    provider: string,       // free-text label, e.g. 'Supabase'
    lastSync: string,
    notes: string
  }
}
```

`window.Integrations.load()` returns stored state, filling in any missing fields or whole sections against the default shape so older saved data upgrades cleanly — including upgrading each `googleCalendar.upcomingEvents` entry with `location`/`notes` if an older save doesn't have them. `window.Integrations.save(state)` persists the whole object. `window.Integrations.setEnabled(section, enabled)` flips a section's toggle — disabling always resets `status` to `'Not connected'` and clears `lastSync`/`lastUsed`, but never touches `notes`. `window.Integrations.setField(section, field, value)` persists a single editable field (location, provider, notes). `window.Integrations.mockSync(section)` simulates a "Sync now" action: it never makes a network request, only ever writing safe demo data pulled from a small fixed pool, and demonstrates a safe error path (e.g. weather syncing with no location set returns `status: 'Error — add a location first'` instead of throwing). `window.Integrations.buildMockCalendarEvents()` is the single shared mock-event pool used by both `mockSync('googleCalendar')` and `google-calendar-service.js`, so there's one source of demo data instead of two drifting copies.

The full interactive UI lives at `pages/integrations.html`: one card per service (Weather, Google Calendar, AI API, Cloud Sync), each with an on/off toggle, status badge, last-sync time, editable fields, notes, and a refresh/sync button. index.html shows a compact preview card (On/Off/Demo/Error per service, plus a weather detail line and a calendar detail line) that links to it.

No real API key, secret, or OAuth token is ever stored in this key or shipped in client code. When a real integration is wired up:

- **Weather** is implemented. `api/weather.js` is a server-side proxy (`GET /api/weather?location=...`) that defaults to Open-Meteo (free, no key required) and switches to OpenWeatherMap if a `WEATHER_API_KEY` env var is set in Vercel — the key never reaches the browser either way. `scripts/weather-service.js` (`window.WeatherService.refresh('weather')`) calls that proxy and writes the result into `integrations.weather`, falling back to safe mock data (status `'Connected (mock data)'`) if the fetch fails for any reason instead of throwing. The Integrations page's "Refresh weather" button and index.html's preview card both just read the `integrations.weather` shape — swapping providers only ever means editing `api/weather.js`.
- **Google Calendar** is foundation-only (no OAuth configured yet). `scripts/google-calendar-service.js` (`window.GoogleCalendarService`) owns calendar-specific logic separately from the generic `integrations-data.js`: `refresh('googleCalendar')` simulates the sync delay and writes mock events (wrapped in a try/catch that sets `status: 'Error — …'` on failure instead of throwing, so the error-state UI path is already wired up for a real fetch later), and `getToday(events)` / `getTomorrow(events)` / `getNext(events)` are pure local-date-aware reads used by the Integrations card, the dashboard preview, and the Daily Snapshot "Next event" chip. When real OAuth is wired up, only `refresh()`'s body needs to change — swap the simulated wait for a server-side `/api/*` proxy call (same pattern as `api/whoop-callback.js`, so the token never reaches the browser). Suggested env var names (not yet used by any code): `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`.
- **AI API** can follow the existing Nova pattern (`pages/nova-lite.html`) — the user pastes their own Anthropic key, stored only in their browser, sent directly to Anthropic — or a server-side `ANTHROPIC_API_KEY` env var behind an `/api/*` route if a shared/non-BYO-key mode is ever built.
- **Cloud Sync** already has a real implementation elsewhere: `scripts/sync.js` mirrors specific localStorage keys to Supabase per-page (Health, Gym, Water) using `SUPABASE_URL`/`SUPABASE_ANON_KEY` (see SETUP.md). The `cloudSync` card here is a placeholder for a possible future *whole-Life-OS* sync toggle, not a duplicate of the existing per-page sync.

Future features (real weather/calendar fetches, AI API request/response logging, unified cloud sync) should extend this shape rather than creating a second connections system.

---

# Backup / Data Management

Implemented as a **local-first foundation** — no server, no database, no auth. Lives in `localStorage` under the key `backupSettings`. The export/import/validate logic lives in `scripts/backup-data.js` (shared business logic), used by the "Data & Backup" card on `pages/integrations.html`.

Shape:

```
backupSettings: {
  dataVersion: string,        // e.g. '1.0.0' — bumped if the export/import shape changes
  lastBackupDate: string,     // ISO timestamp of the last successful export, '' if never
  cloudSyncProvider: string,  // free-text, unused until real cloud sync exists
  cloudSyncStatus: string,    // free-text, unused until real cloud sync exists
  backupNotes: string
}
```

`window.Backup.buildExport()` captures every key currently in `localStorage` as raw strings (no re-encoding) into `{ meta: { app, dataVersion, exportedAt, keyCount }, data: { ...key: rawValue } }` — this is the entire Life OS dataset (every HQ page, Daily Snapshot, Streaks, Integrations, Settings profile, the daily `goals:YYYY-MM-DD` keys, water tracker, WHOOP tokens). `window.Backup.validate(payload)` never throws — it checks the file is an object with a `data` object of string values before anything is applied, rejecting corrupt/foreign JSON with a clear error instead of crashing. `window.Backup.apply(payload)` writes only the keys present in the backup into `localStorage` (it never clears keys the backup doesn't mention) and returns `{ ok, error, keyCount }`. `window.Backup.markBackupDone()` stamps `lastBackupDate` after a successful export.

The full UI lives in the "Data & Backup" card at the top of `pages/integrations.html`: Export downloads a `life-os-backup-YYYY-MM-DD.json` file via a Blob; Import reads a chosen file, validates it, asks for confirmation before overwriting anything, then reloads the page so every script picks up the restored state. Invalid JSON or a malformed/foreign backup file shows an inline error and never touches existing data.

`cloudSyncProvider` / `cloudSyncStatus` are placeholder fields only — no cloud sync is implemented here. The existing `integrations.cloudSync` card (see Integrations below) is the actual future-cloud-sync placeholder; this key exists so a later real sync integration has a place to record which provider/state it's using without a schema change.

Everything related to backup/export/import belongs here. A future real cloud sync should read `buildExport()`'s payload shape as its upload format rather than inventing a second one.

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

# Core / Shared Data

Implemented as a **thin aggregation layer, not a new source of truth**. Lives in `localStorage` under the key `core`. The load/save/aggregate logic lives in `scripts/core-data.js`, included on index.html, `pages/health.html`, and `pages/boxing-hq.html`.

Shape:

```
core: {
  currency: string,       // 'GBP' by default — the whole app defaults to £, not CHF
  lastUpdated: string,    // ISO timestamp, set whenever window.Core.save() runs
}
```

`window.Core.load()` / `.save(core)` follow the same upgrade-on-load pattern as every other section. `window.Core.getSnapshot()` is a pure read (never persists) that aggregates the cross-section values described in this task's brief — `currentWeight`, `targetWeight`, `dailyCompletion`, `currentStreak`, `mainFocus`, `activeGoal`, `businessFocus`, `healthStatus`, `trainingStatus`, `nextWeekFocus` — by reading `window.Health`, `window.Boxing`, `window.Business`, `window.DailySnapshot`, `window.Streaks`, `window.Goals`, and `window.WeeklyReview` live, the same pattern as `window.LifeStats.computeStats()`. It never duplicates or owns any of those values itself.

The one exception is weight: `window.Health.currentWeight` and `window.Boxing.currentWeight` are two separate fields (Health HQ and Boxing HQ each need their own record), so `window.Core.setCurrentWeight(kg)` writes the same number into **both** on every save from either page's weight field. This keeps the two in sync without merging the two sections' data models. `pages/health.html` and `pages/boxing-hq.html` both call it from their own `save()` wrapper.

Future features that want a single "how's everything doing" view (a rebuilt Command Centre widget) should read `getSnapshot()` rather than re-reading every section's data directly. Money HQ's summary (`window.Money.computeSummary()`) follows the same read-only pattern but lives in `scripts/money-data.js` since it's finance-specific, not general cross-section state.

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