# LOCK-IN HQ

A calm personal app: today's focus, notes, briefings, MB Automotive content and specialist help — built
from plain HTML/JS with a few Vercel serverless routes.

## Deploy your own copy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmickycottingham06-wq%2Fcomplete-personal-dashboard)

Setup (Supabase sign-in/sync, Google Calendar, optional AI): [SETUP.md](SETUP.md). How the app works and the
deployment checklist: [docs/LOCK_IN_HQ.md](docs/LOCK_IN_HQ.md).

## Pages

Every page has the same **Menu** button.

| Page | File |
|---|---|
| Today | [index.html](index.html) |
| Second Brain | [pages/second-brain.html](pages/second-brain.html) |
| Morning / Evening / Weekly reset | [pages/assistant.html](pages/assistant.html) (`?mode=morning`, `evening`, `weekly`) |
| Content | [pages/content.html](pages/content.html) |
| Workforce | [pages/workforce.html](pages/workforce.html) |
| Settings · Integrations · Account · Backup | [pages/settings.html](pages/settings.html) |

Data is saved in the browser (`localStorage`; Content photos in IndexedDB on the device). Signing in adds a
private cloud copy via Supabase. **Menu → Backup** exports everything, including records from older pages
that have since been removed.
