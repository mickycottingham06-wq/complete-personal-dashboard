# LOCK-IN HQ — Setup Guide

A static app (plain HTML/JS) with a few Vercel serverless routes in `api/`. Everything works on one
device with no setup; Supabase adds sign-in and a private cloud copy; the optional connections and AI
are switched on by environment variables. The release checklist is in [docs/LOCK_IN_HQ.md](docs/LOCK_IN_HQ.md).

---

## 1. Environment variables (every name the code reads)

Set in Vercel → Project → Settings → Environment Variables, separately for **Production** and **Preview**,
then redeploy. Values marked *public* are sent to the browser by `/api/config`; everything else stays server-side.

| Variable | Needed for | Read by |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | sign-in, Cloud Sync, protected routes (*public*) | `api/config.js`, `api/_access.js` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same (*public* anon key — never the service_role key) | `api/config.js`, `api/_access.js` |
| `ASSISTANT_ALLOWED_EMAILS` | who may use AI **and** Trading 212 (comma-separated) | `api/_access.js` |
| `ANTHROPIC_API_KEY` | AI (Assistant, Content, Workforce) | `api/assistant.js` |
| `ASSISTANT_MODEL` | optional, default `claude-haiku-5-5` | `api/assistant.js` |
| `ASSISTANT_DAILY_LIMIT` | optional, default 40 AI requests per user per 24 h | `api/assistant.js` |
| `GOOGLE_CLIENT_ID` | Google Calendar (*public*) | `api/config.js`, `api/google-calendar-*.js` |
| `GOOGLE_CLIENT_SECRET` | Google Calendar | `api/google-calendar-callback.js`, `-refresh.js` |
| `WHOOP_CLIENT_ID` | WHOOP (*public*) | `api/config.js`, `api/whoop-callback.js`, `-refresh.js` |
| `WHOOP_CLIENT_SECRET` | WHOOP | `api/whoop-callback.js`, `-refresh.js` |
| `TRADING212_API_KEY` / `TRADING212_API_SECRET` | Trading 212 read-only check | `api/trading212-data.js` |
| `TRADING212_ENV` | optional, `live` (default) or `demo` | `api/trading212-data.js` |
| `WEATHER_API_KEY` | optional — OpenWeatherMap instead of the free default (Open-Meteo, no key) | `api/weather.js` |

No longer read (safe to delete): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_LEGACY_SYNC_ENABLED`.

---

## 2. Supabase — sign-in and Cloud Sync

1. Create a project at supabase.com. **Auth → Providers → Email** on; decide whether public sign-up is allowed
   (AI and Trading 212 are allowlist-only regardless).
2. **SQL Editor**: run [`supabase/life_os_state.sql`](supabase/life_os_state.sql) (one private row per user) and
   [`supabase/assistant_usage.sql`](supabase/assistant_usage.sql) (AI request limit).
3. Copy the Project URL and anon key into the two `NEXT_PUBLIC_SUPABASE_*` variables.
4. **Auth → URL Configuration**: Site URL = your production URL. Add your preview URL(s) to Redirect URLs (§8).
5. Open **Menu → Account** and sign in. Sync settings and conflict choices are under **Menu → Settings**.

How sync stays safe: each device remembers which cloud version it last saw. Automatic saves only replace the
cloud copy if it is still that version; if another device saved in between, nothing is overwritten and
Settings asks you to choose ("Use the cloud copy" / "Keep this device's data", each confirmed first).
Credentials (sign-in sessions, connection tokens, API keys) are never included in the cloud copy or backups.

**Legacy objects:** an old `app_state` table and `progress-photos` bucket may still be publicly writable.
Follow [`supabase/legacy/README.md`](supabase/legacy/README.md) — reviewed SQL, in order, keeping all data.

---

## 3. Google Calendar (optional, read-only)

1. console.cloud.google.com → enable **Google Calendar API**.
2. Credentials → OAuth client ID → **Web application**. Authorized redirect URIs — one per domain, exact
   (Google does not accept wildcards): `https://<domain>/api/google-calendar-callback`.
3. OAuth consent screen: scope `.../auth/calendar.events.readonly`; add yourself as a test user while in Testing.
4. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, redeploy, then **Menu → Integrations → Connect**.

Used by: Today (commitments), Assistant (Morning, Weekly), Settings.

## 4. AI (optional, paid)

Stays **off** until `ANTHROPIC_API_KEY`, both Supabase variables, `ASSISTANT_ALLOWED_EMAILS` and the
`assistant_usage` table are all in place. Each request is checked on the server (valid session → allowlisted
email → under the shared daily limit) before Anthropic is contacted; 20 s timeout; temporary errors retried at
most twice on the same model; refusals never retried on another model.

**Cost (Anthropic list prices, Oct 2026):** Haiku 5.5 is $0.10 per million input tokens and $0.50 per million
output tokens. A request is ~1,500–3,000 tokens in, capped at 2,000 out: about **$0.0005–$0.0013 per press**
(≈ £0.001); at 40 a day at most ~$0.05/day. Sonnet 5.5 is 20× and Opus 5.5 40× the per-token price.
Set a monthly spend limit in the Anthropic Console.

## 5. WHOOP (optional)

1. developer.whoop.com → your app → Redirect URI: `https://<domain>/api/whoop-callback` (one per domain).
   Scopes used: `read:recovery read:sleep read:cycles offline`.
2. Set `WHOOP_CLIENT_ID` / `WHOOP_CLIENT_SECRET`, redeploy, **Menu → Integrations → Connect WHOOP**.

Used by: Settings (status) and Workforce → Training (latest recovery/sleep shown as a dated reading, not interpreted).
Tokens stay on the device; disconnecting removes them (also remove the app in your WHOOP account to revoke fully).

## 6. Weather (optional)

Works without a key (Open-Meteo). Enter a town in **Menu → Integrations → Weather**. Used by: Settings only.
A failed refresh says so and keeps the last real reading with its time — no placeholder weather.

## 7. Trading 212 (optional, read-only)

Create an API key + secret in Trading 212 (read-only permissions), set `TRADING212_API_KEY` / `TRADING212_API_SECRET`
(and `TRADING212_ENV=demo` for a practice account). **Menu → Integrations → Check connection** shows a summary;
nothing is saved or traded. The route requires a signed-in, allowlisted account — without `ASSISTANT_ALLOWED_EMAILS`
and the Supabase variables it refuses every request. Used by: Settings only. Older imported holdings remain in your
saved records (Backup).

---

## 8. Vercel branch preview

- Every push to a branch gets a preview at a per-deployment URL plus a stable **branch alias**:
  `https://<project>-git-<branch>-<team-slug>.vercel.app` (for this branch: `…-git-lock-in-hq-stage-1-…`). Use the
  branch alias for all callback registrations — the per-deployment URLs change every push.
- **Env vars:** add them under the **Preview** environment (optionally scoped to the branch). Without them the preview
  is local-only, calendar not connected, AI off.
- **Does the preview share the production database?** Yes — if the Preview variables point at the same Supabase
  project as Production, the preview reads and writes the **same** `life_os_state` row (per account) and shares the
  same AI usage limit. Sync is conflict-safe, but a preview build can still change your real data. For isolation,
  create a second Supabase project for Preview (run the same two SQL files) and use its URL/key there.
- **Supabase:** Auth → URL Configuration → Redirect URLs: add `https://<project>-git-*-<team-slug>.vercel.app/**`
  (wildcards are allowed here). Password sign-in works on the preview; sign-up confirmation emails link to the Site URL.
- **Google:** add `https://<branch-alias>/api/google-calendar-callback` as an Authorized redirect URI (exact, no wildcard).
- **WHOOP:** add `https://<branch-alias>/api/whoop-callback` as a Redirect URI.
- Vercel Deployment Protection (on by default for previews) requires you to be logged in to Vercel when opening the
  preview; OAuth callbacks work because they return through your own logged-in browser.

---

## 9. Credentials: clean-up after this release

Earlier versions copied **all** browser storage into backups and the cloud copy — including your Supabase sign-in
session, Google Calendar / WHOOP tokens and any Anthropic key pasted into the old Nova page. From this release they
are excluded and are never written back by restores or cloud loads. To finish the clean-up:

1. After deploying, sign in on each device and let it save once (or **Settings → Save this device to cloud**) — the
   cloud copy is replaced without credentials.
2. Delete or securely store old backup files (`life-os-backup-*.json`) made before this release.
3. If you ever pasted an Anthropic key into Nova: **Settings → Credentials → Remove**, then revoke that key in the
   Anthropic Console.
4. Google: optionally revoke the old grant at myaccount.google.com → Security → Third-party access, then reconnect.
5. WHOOP: disconnect and reconnect (or revoke in your WHOOP account).
6. Supabase sessions from old backups: **Sign out** on each device (revokes its refresh token); in Supabase you can
   also sign a user out from Authentication → Users.
7. Run `supabase/legacy/01_inspect.sql` and check the old `app_state` keys for anything sensitive before locking it.
