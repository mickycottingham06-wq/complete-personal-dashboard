# Micky's Dashboard — Setup Guide (fork → deploy in ~5 min)

This is a static dashboard (plain HTML/JS) that deploys on **Vercel** and syncs across your
devices with **Supabase**. WHOOP and Google Calendar are optional add-ons.

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

### Real Cloud Sync (Phase 1) — requires auth above, run one more SQL block

Uses the same `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` as auth above — no
extra env vars. Run **[`supabase/life_os_state.sql`](supabase/life_os_state.sql)** in Supabase
**SQL Editor → New query → Run** to create the table (safe to re-run, every statement is
idempotent):

```sql
create table if not exists public.life_os_state (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references auth.users(id) on delete cascade,
  data         jsonb not null default '{}'::jsonb,
  data_version text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.life_os_state enable row level security;

create policy "select own life_os_state" on public.life_os_state
  for select to authenticated using (auth.uid() = user_id);
create policy "insert own life_os_state" on public.life_os_state
  for insert to authenticated with check (auth.uid() = user_id);
create policy "update own life_os_state" on public.life_os_state
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own life_os_state" on public.life_os_state
  for delete to authenticated using (auth.uid() = user_id);
```

Once this table exists, the Integrations page's **Cloud Sync** card gets a "Real Cloud Sync
(Phase 1)" section: Push local → cloud, Pull cloud → this device, and Sync now, all manual
(nothing runs automatically) and all requiring you to be signed in. Local Storage remains the
active/offline storage system either way — see `docs/SUPABASE_PLAN.md` §17.

### Setup checklist (Phase 1 cloud sync)

- [ ] Create a Supabase project at supabase.com
- [ ] Run [`supabase/life_os_state.sql`](supabase/life_os_state.sql) in Supabase SQL Editor
- [ ] Add `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` locally (e.g. a `.env.local`
      picked up by however you run the site) if you test outside Vercel
- [ ] Add the same two env vars in Vercel → Project Settings → Environment Variables
- [ ] Confirm Supabase Auth → Providers → **Email** is enabled (on by default for new projects)
- [ ] Redeploy on Vercel
- [ ] Open Integrations page → Account card → sign up, then sign in
- [ ] Push local data to the cloud (Cloud Sync card → "Push local → cloud")
- [ ] On a second browser/device, sign in with the same account and pull cloud data down

### Vercel deployment notes

- Env vars must be added under Vercel → **Project Settings → Environment Variables**, not just
  `.env.local` — `.env.local` only affects local dev, never what's deployed.
- **Redeploy** after adding or changing env vars — Vercel does not hot-reload existing deployments
  when you save new environment variables.
- If you use Vercel **Preview** deployments (PRs, branches), add the env vars to the Preview
  environment too, not just Production — otherwise previews will report "Supabase not configured".

### Testing checklist (Phase 1 cloud sync)

- [ ] **No env vars set** — app works local-only; Integrations Cloud Sync card reports "Supabase
      not configured"; no crash, no login prompt
- [ ] **Env vars added + redeployed** — Cloud Sync card reports "Supabase configured"
- [ ] **Sign up / sign in** works from the Account card
- [ ] **Push** local data to cloud succeeds and shows a last-cloud-sync time
- [ ] **Pull** cloud data down succeeds on the same device (after making a local change, to confirm
      it actually overwrites)
- [ ] **Second browser or device**, same account, signed in → **Pull** restores the data
- [ ] **Backup/export/import** (Integrations → Data & Backup) still works unchanged, independent of
      any of the above

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

## 5. Google Calendar (optional, read-only)

1. **console.cloud.google.com** → create/select a project → **APIs & Services → Library** →
   enable the **Google Calendar API**.
2. **APIs & Services → Credentials** → Create Credentials → **OAuth client ID** → type **Web application**.
3. Under **Authorized redirect URIs** add exactly: `https://your-app.vercel.app/api/google-calendar-callback`
   (use your real Vercel domain — add every domain you'll open the site from).
4. **OAuth consent screen**: add the scope `.../auth/calendar.events.readonly` and add yourself as
   a test user if the app is in Testing mode.
5. Add these in Vercel → **Settings → Environment Variables**, then redeploy:

| Variable | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | your OAuth client's Client ID (public — also sent to the browser via `/api/config`) |
| `GOOGLE_CLIENT_SECRET` | your OAuth client's Client Secret (**secret** — server-side only) |

6. Open the site at that exact domain → Integrations page → **Connect Google Calendar**.

> Only the read-only `calendar.events.readonly` scope is requested — this integration can never
> create, edit, or delete events. If either env var is missing, Connect fails with a clear inline
> error instead of redirecting to Google.

---

## 6. Nova (AI mentor / gym coach) — optional

No setup or key in the repo. Each user **pastes their own Anthropic API key** on the
**Nova** tile; it's stored only in their browser and sent straight to Anthropic. Get a key at
console.anthropic.com.

---

## 7. Trading 212 (optional, read-only portfolio import)

1. In the Trading 212 app: **Settings → API (Beta)** → generate an API key **and** its paired
   secret.
2. Add both in Vercel → **Settings → Environment Variables**, then redeploy:

| Variable | Value |
|---|---|
| `TRADING212_API_KEY` | your Trading 212 API key (**secret**, required) |
| `TRADING212_API_SECRET` | your Trading 212 API secret (**secret**, required) |
| `TRADING212_ENV` | optional — `live` (default) or `demo` |

3. Open the site → Money HQ → **Investments tab** → **Import / Refresh Trading 212**.

> Read-only: only `/equity/portfolio` (open positions) and `/equity/account/cash` are called —
> never an order/trading endpoint. Both env vars are required — requests always authenticate
> with HTTP Basic auth (`API_KEY:API_SECRET`); there is no raw-key fallback. Credentials are
> read only inside `api/trading212-data.js` and never reach the browser, Local Storage, or any
> page. Manual refresh only — there is no auto-refresh, to respect Trading 212's rate limits.
> Imported rows are tagged `account: 'Trading 212'` / `source: 'trading212'` and are matched by
> ticker on re-import, so refreshing updates existing rows instead of duplicating them; your
> manually-entered investments are never touched. If either env var is missing or the
> credentials are rejected, the button shows a clear inline error instead of failing silently.

---

## TL;DR
1. Fork → import to Vercel → deploy.
2. New Supabase → run the **SQL** above → set `SUPABASE_URL` + `SUPABASE_ANON_KEY` +
   `SUPABASE_LEGACY_SYNC_ENABLED=true` in Vercel env vars.
3. Weather works immediately (no key needed) — enable it on the Integrations page.
4. (Optional) WHOOP: Client ID in `health.html` + the two env vars in Vercel. Done.
5. (Optional) Google Calendar: OAuth client in Google Cloud + `GOOGLE_CLIENT_ID` +
   `GOOGLE_CLIENT_SECRET` in Vercel → Connect on the Integrations page. Done.
6. (Optional) Trading 212: `TRADING212_API_KEY` + `TRADING212_API_SECRET` in Vercel → Money HQ →
   Investments tab → Import / Refresh Trading 212. Done.
