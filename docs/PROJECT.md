# PROJECT.md

## Project Name

Micky's Personal Dashboard

---

# Overview

This project is a premium Life Operating System designed to help manage every major area of my life from a single dashboard.

It is intended to become the only dashboard I need to open every day.

The dashboard should always prioritise:

- Simplicity
- Speed
- Maintainability
- Scalability
- Premium user experience

---

# Primary Objectives

The dashboard should help me:

- Manage my health
- Improve boxing performance
- Build multiple businesses
- Grow investments
- Increase productivity
- Track habits
- Organise finances
- Reduce mental clutter
- Make better daily decisions

---

# Technology

Current stack:

- HTML
- CSS
- JavaScript

Deployment:

- GitHub
- Vercel

Development:

- VS Code
- Claude Code
- ChatGPT

Future integrations may include:

- Google Calendar
- Weather API
- Finance APIs
- AI APIs
- Local storage
- Database (if needed)

---

# Folder Structure

The project uses the following structure:

```
api/
assets/
components/
data/
docs/
pages/
scripts/
templates/
utils/
```

Each folder has a single responsibility.

Never place files in the wrong location.

---

# Components

The project should become component-based.

Examples include:

- Stat Card
- Progress Card
- Widget Card
- Goal Card
- Business Card
- Boxing Card
- Calendar Card
- Quote Card
- Heatmap
- Search Bar
- Navigation
- Modal

Reuse components whenever possible.

Never duplicate code unnecessarily.

---

# Data Philosophy

All editable values should live in central data files.

Examples:

- Dashboard data
- Goals
- Businesses
- Boxing
- Finance
- Quotes
- Calendar
- Weather

Pages should display data rather than hardcoding values.

---

# Pages

Current and planned pages include:

Command Centre (index.html — the home page: Today top bar, compact preview cards, bento quick-nav grid. Formerly labelled "Main" in the sidebar/bottom bar; that label is retired)

Daily Snapshot (pages/daily-snapshot.html)

Streaks (pages/streaks.html)

Business HQ (pages/business-hq.html)

AI CEO (pages/ai-ceo.html)

Boxing HQ (pages/boxing-hq.html)

Health HQ (pages/health.html)

Hormone Optimisation (pages/hormone-optimisation.html)

Appearance / Looks (pages/appearance.html)

Goals (pages/goals.html)

Life Stats (pages/life-stats.html)

Heatmap (pages/heatmap.html)

Integrations (pages/integrations.html — foundation only: Weather, Google Calendar, AI API, Cloud Sync cards, mock/demo state until real keys are wired up)

Settings (modal on Command Centre)

Money HQ (pages/finance.html — the existing Finance build, kept functional but de-prioritised on the Command Centre and labelled "future finance hub" until this becomes its own phase; see ROADMAP.md Phase 5)

De-prioritised / merged, not in the primary sidebar (still reachable directly, not deleted): Fitness (pages/gym.html) → folds into Boxing HQ / Health HQ; Water (pages/po-water.html) → folds into Health HQ; Caffeine (pages/caffeine.html) → folds into Health HQ; Nova (pages/nova-lite.html) → folds into AI CEO; pages/main.html (old daily goal ticker) → no longer linked from the sidebar now that Command Centre owns that role.

Calendar and Weather are read through Integrations rather than as standalone pages.

Future pages should follow the same design language.

---

# Navigation

Navigation should remain simple.

Users should always know where they are.

Do not redesign navigation unless specifically requested.

A collapsible sidebar (three-line hamburger button) lists every primary page above and lives in `scripts/topbar.js`, so any page that already includes the top/bottom chrome gets it automatically. The sidebar's first entry is "Command Centre" (links to index.html) — the old "Main" label and its link to pages/main.html were retired. See COMPONENT_LIBRARY.md for the Sidebar Navigation and Preview Card components.

---

# Performance

Optimise performance wherever possible.

Avoid unnecessary libraries.

Keep animations lightweight.

Minimise duplicate JavaScript.

Lazy load only if required.

---

# Mobile

The dashboard should work well on:

Desktop

Laptop

Tablet

Mobile

Layouts should adapt naturally.

---

# Styling

The design language must remain consistent.

Every new page should look like it belongs with the original dashboard.

Never introduce inconsistent colours, spacing or typography.

---

# Coding Standards

Keep functions small.

Use meaningful names.

Comment only where useful.

Prefer readability over clever code.

Avoid deeply nested logic.

---

# AI Development Rules

Claude should:

Read documentation first.

Inspect existing code.

Reuse existing components.

Modify only necessary files.

Avoid rewriting entire files.

Explain only important changes.

---

# Future Scalability

The project should be built so that future modules can be added easily.

Examples:

Property Dashboard

Investment Dashboard

CRM

Meal Planner

Journal

Morning Briefing

Document Vault

Knowledge Base

AI Coach

---

# Build Process

For every feature:

1. Plan
2. Build
3. Test
4. Verify
5. Commit
6. Push
7. Deploy

Never skip testing.

---

# Version Control

Commit frequently.

Each commit should represent one logical feature.

Example commits:

- Add Boxing Dashboard
- Add Business HQ
- Improve Goal Tracking
- Refactor Components
- Fix Navigation

---

# Success Criteria

The dashboard should eventually answer these questions instantly:

How am I performing today?

What should I work on next?

What is making me money?

What habits are slipping?

What goals are closest?

How is my boxing progressing?

How are my finances?

What needs my attention?

If the dashboard answers those questions clearly, it is succeeding.