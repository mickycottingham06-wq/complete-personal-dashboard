# LOCK-IN HQ — Setup Guide

A static app (plain HTML/JS) with a few Vercel serverless routes in `api/`. Everything works on one
device with no setup; Supabase adds sign-in and a private cloud copy, Google Calendar adds real
events, and an Anthropic key adds optional AI wording. The deployment checklist is in
[docs/LOCK_IN_HQ.md](docs/LOCK_IN_HQ.md).

---

## 1. Deploy

1. Import the repo in **Vercel → Add New → Project**. Framework preset **Other**, root `./`, no build command.
2. Vercel installs `package.json` dependencies (`@supabase/supabase-js`, `@anthropic-ai/sdk`) for the API routes.
3. Deploy to a **Preview** first. Add env vars to Preview as well as Production, and **redeploy** after changing them.

Locally, serve the folder with any static server and open `/`. The `/api/*` routes don't run locally, so
the app shows "local only", "calendar not connected" and "AI off" — that's expected.

---

## 2. Supabase — sign-in and Cloud Sync

1. Create a project at **supabase.com**. Confirm **Auth → Providers → Email** is enabled and decide whether
   public sign-up should be allowed.
2. In **SQL Editor**, run:
   - [`supabase/life_os_state.sql`](supabase/life_os_state.sql) — one private row per user holding this
     device's saved data (row-level security: each user only sees their own row).
   - [`supabase/assistant_usage.sql`](supabase/assistant_usage.sql) — the per-user AI request limit (§4).
3. **Project Settings → API**: copy the Project URL and the anon/publishable key into Vercel:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key (public) |

4. Redeploy, open **Menu → Account**, sign in. Cloud sync settings and manual save/load are under
   **Menu → Settings**. Auto cloud save pushes this device's data when signed in.

⚠️ Only the anon key goes in env vars. Never use the `service_role` key anywhere in this project.

### Older Supabase objects — check before deploying
Earlier versions of this guide created two objects the app **no longer uses**:
- `public.app_state` table with an `anon` policy allowing **all** reads and writes (legacy blob sync).
- `progress-photos` Storage bucket, `public = true`, with an `anon` policy for **all** operations
  (old Strength HQ progress photos).

Anyone holding the anon key — which ships to every browser — can read or change these. Check what's
actually applied in your project (Table editor / Storage → Policies) and restrict them as described in
the deployment checklist. Don't delete them without exporting what's inside first.

---

## 3. Google Calendar (optional, read-only)

1. **console.cloud.google.com** → enable the **Google Calendar API**.
2. **Credentials** → OAuth client ID → **Web application**. Authorized redirect URI:
   `https://your-app.vercel.app/api/google-calendar-callback` (one per domain you use).
3. **OAuth consent screen**: scope `.../auth/calendar.events.readonly`; add yourself as a test user if in Testing.
4. Vercel env vars, then redeploy:

| Variable | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID (public — also sent to the browser via `/api/config`) |
| `GOOGLE_CLIENT_SECRET` | Client Secret (**secret**, server-side only) |

5. **Menu → Integrations → Connect Google Calendar.** Google returns you to that page.

Read-only scope: the app can never create, edit or delete events.

---

## 4. AI (optional, server-side)

Assistant, Content and Workforce work without AI (labelled Basic / Template modes). All three share the
one `/api/assistant` endpoint and one per-user daily limit. It is a **paid** endpoint, so it stays **off**
until every protection below is in place:

| Requirement | Value |
|---|---|
| `ANTHROPIC_API_KEY` | from console.anthropic.com — server-side only |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from §2 — used to verify your session on the server |
| `ASSISTANT_ALLOWED_EMAILS` | comma-separated emails allowed to use AI (signing up alone is not enough) |
| `supabase/assistant_usage.sql` | run once (§2) — requests are refused if it's missing |
| `ASSISTANT_DAILY_LIMIT` | optional, default 40 requests per user per rolling 24 h |
| `ASSISTANT_MODEL` | optional, default `claude-haiku-5-5` |

Every request is checked on the server — valid Supabase session → allowlisted email → under the limit —
**before** Anthropic is contacted. Requests time out after 20 s; temporary errors are retried at most twice
on the same model; a refusal is never retried on another model.

**Cost (Anthropic list prices, Oct 2026):** Haiku 5.5 is $0.10 per million input tokens and $0.50 per
million output tokens. A request sends roughly 1,500–3,000 tokens and is capped at 2,000 output tokens, so
about **$0.0005–$0.0013 per press** (≈ £0.001); at the default 40 a day, at most about $0.05/day. Sonnet 5.5
costs 20× and Opus 5.5 40× the per-token price. Set a monthly spend limit in the Anthropic Console too.

---

## 5. Removed integrations

WHOOP, Trading 212, Weather and the browser-key "Nova" coach were removed with their pages. Their saved data
(tokens, imported holdings, cached readings) stays in browser storage and in **Menu → Backup → Export**.
You can delete these Vercel env vars if set: `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `TRADING212_API_KEY`,
`TRADING212_API_SECRET`, `TRADING212_ENV`, `WEATHER_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_LEGACY_SYNC_ENABLED`. Also remove the WHOOP redirect URI from your WHOOP developer app.
