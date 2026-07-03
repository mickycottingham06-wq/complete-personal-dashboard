# Micky's Personal Dashboard

A set of small, self-contained HTML apps that share a top bar.

## Deploy your own copy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmickycottingham06-wq%2Fcomplete-personal-dashboard)

One click → Vercel signs you in, copies the repo to your GitHub, and deploys it. ~30 seconds to a live URL.

## How to use

Open any `.html` file directly in your browser — no build step, no install.

| File | What it is |
|---|---|
| [index.html](index.html) | Goals tracker (Day Ring, Goal Ticker, To Do list) — the home page |
| [pages/health.html](pages/health.html) | Supplement / daily stack tracker |
| [pages/po-water.html](pages/po-water.html) | Water intake tracker |
| [pages/finance.html](pages/finance.html) | Finances |
| [pages/gym.html](pages/gym.html) | Progressive overload gym tracker |
| [scripts/topbar.js](scripts/topbar.js) | Shared top bar — auto-injected into pages that `<script src="topbar.js">` |

Each app stores its own state in browser `localStorage`. No accounts, no server.

## Building from scratch

[BUILD_DASHBOARD.md](BUILD_DASHBOARD.md) is the prompt I gave Claude to generate `index.html` — paste it into Claude if you want to rebuild that page yourself.
