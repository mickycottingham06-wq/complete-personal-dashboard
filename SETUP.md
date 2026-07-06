# Micky's Dashboard — Setup Guide (fork → deploy in ~5 min)

This is a static dashboard (plain HTML/JS) that deploys on **Vercel** and syncs across your
devices with **Supabase**. WHOOP is an optional add-on.

---

## 1. Fork & deploy

1. **Fork** this repo to your GitHub.
2. Go to **vercel.com → Add New → Project → Import** your fork.
3. Framework Preset: **Other**. Root Directory: **`./`**. Build/output: leave blank (static).
4. **Deploy.** You'll get a URL like `https://your-app.vercel.app`.

---

## 2. Supabase (cross-device sync) — required for sync

Create a free project at **supabase.com**, then run **both** SQL blocks in
**SQL Editor → New query → Run**.

### SQL #1 — `app_state` (all dashboard sync)
```sql
create table if not exists public.app_state (
  key        text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- The browser uses the ANON key, so allow it to read/write:
alter table public.app_state enable row level security;
create policy "anon full access app_state"
  on public.app_state for all
  to anon using (true) with check (true);

-- Instant cross-device updates:
alter publication supabase_realtime add table public.app_state;
```

### SQL #2 — progress-photo sync (Storage bucket)
Progress photos upload to a Supabase **Storage** bucket called `progress-photos` (only the
image URLs sync through `app_state`). Skip this if you don't need photos to sync across devices.
```sql
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', true)
on conflict (id) do nothing;

create policy "anon manage progress-photos"
  on storage.objects for all
  to anon
  using (bucket_id = 'progress-photos')
  with check (bucket_id = 'progress-photos');
```

### Connect YOUR Supabase
Supabase → **Project Settings → API**. Copy the **Project URL** and the **anon / publishable** key.
In Vercel → **Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | your Project URL |
| `SUPABASE_ANON_KEY` | your anon / publishable key |
| `SUPABASE_LEGACY_SYNC_ENABLED` | `true` |

Redeploy. The app reads these automatically via `/api/config`.

> This legacy blob-sync (`sync.js`/`topbar.js`/`gym.html`) has no hardcoded URL/key and stays
> fully off — Local Storage only — unless **both** `SUPABASE_URL`/`SUPABASE_ANON_KEY` are set
> **and** `SUPABASE_LEGACY_SYNC_ENABLED` is `true`. Leaving the last var unset (or `false`) keeps
> sync disabled even with a configured project. See `docs/SUPABASE_PLAN.md` §2 and §14.
>
> ⚠️ Only the **anon** key (public) is used here. **Never** put the `service_role` key in code
> or in these env vars.

### Auth foundation (sign up / sign in) — optional, separate from the legacy sync above

A newer, separate foundation (`scripts/supabase-status.js` + `scripts/supabase-auth.js`) adds
account sign up / sign in / sign out on the Command Centre and Integrations pages. It uses its
own env vars — set both in Vercel → **Settings → Environment Variables**, then redeploy:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon / publishable key |

Without these, sign up/sign in are simply unavailable — the app works exactly as before, no
crash, no login prompt. This is **auth only**: no dashboard data is stored in or synced from
Supabase yet. See `docs/SUPABASE_PLAN.md` §16.

---

## 3. Weather (works out of the box, no key needed)

The **Integrations** page's Weather card and the Daily Snapshot/dashboard previews are live —
enable it, type a location, hit **Refresh weather**. By default `/api/weather` uses
**Open-Meteo**, a free provider that needs no API key at all.

Want a different provider instead (e.g. OpenWeatherMap)? Add this in Vercel →
**Settings → Environment Variables**, then redeploy:

| Variable | Value |
|---|---|
| `WEATHER_API_KEY` | your OpenWeatherMap API key |

> This key is only ever read server-side inside `api/weather.js` — it's never sent to the
> browser. If the fetch ever fails (bad location, provider down, offline), the card falls back
> to clearly-labelled mock data instead of breaking.

---

## 4. WHOOP (optional)

1. **developer.whoop.com** → create an app.
2. Set its **Redirect URI** to exactly: `https://your-app.vercel.app/api/whoop-callback`
   (use your real Vercel domain — add every domain you'll open the site from).
3. Put your app's **Client ID** in [`health.html`](pages/health.html) (`const CLIENT_ID = '...'`),
   and add these in Vercel → **Settings → Environment Variables**, then redeploy:

| Variable | Value |
|---|---|
| `WHOOP_CLIENT_ID` | your WHOOP app's Client ID |
| `WHOOP_CLIENT_SECRET` | your WHOOP app's Client Secret (**secret**) |

4. Open the site at that exact domain → Health page → **Connect WHOOP**.

> The callback auto-detects the domain, so you do **not** need a `WHOOP_REDIRECT_URI` env var.

---

## 5. Nova (AI mentor / gym coach) — optional

No setup or key in the repo. Each user **pastes their own Anthropic API key** on the
**Nova** tile; it's stored only in their browser and sent straight to Anthropic. Get a key at
console.anthropic.com.

---

## TL;DR
1. Fork → import to Vercel → deploy.
2. New Supabase → run the **SQL** above → set `SUPABASE_URL` + `SUPABASE_ANON_KEY` +
   `SUPABASE_LEGACY_SYNC_ENABLED=true` in Vercel env vars.
3. Weather works immediately (no key needed) — enable it on the Integrations page.
4. (Optional) WHOOP: Client ID in `health.html` + the two env vars in Vercel. Done.
