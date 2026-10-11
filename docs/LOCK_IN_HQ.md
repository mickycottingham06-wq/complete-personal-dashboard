# LOCK-IN HQ

A calm personal app built around one day's focus. This file describes the current app; older docs in
`docs/` describe the previous dashboard and are kept for history.

## Pages and navigation (final)

| Page | File | Menu |
|---|---|---|
| Today | `index.html` | Today |
| Second Brain | `pages/second-brain.html` | Second Brain |
| Assistant | `pages/assistant.html?mode=morning\|evening\|weekly` | Morning · Evening · Weekly reset (open that view directly) |
| Content | `pages/content.html` | Content |
| Workforce | `pages/workforce.html` | Workforce |
| Settings | `pages/settings.html#sync` / `#integrations` / `#account` / `#backup` | Settings & data: Settings · Integrations · Account · Backup |

- One shared **Menu** (`scripts/menu.js`) on every page: a sticky bar with the brand (→ Today) and a Menu button that
  opens a modal panel (keyboard: Tab stays inside, Escape closes, focus returns to the button; click outside or a link
  closes it). The current page/view/section is marked `aria-current="page"`.
- One stylesheet, `styles/lock-in.css`, for every page (tokens, buttons, forms, status messages, badges, menu).
- Removed in the cleanup: the old Command Centre, AI CEO, To Do list, Daily Control Panel, Weekly Review, Streaks,
  Heatmap, Goals, Life Stats, Appearance, Hormone, Business HQ, Finance, Money HQ, Strength HQ (+ legacy backup copy),
  Boxing HQ, Health HQ, Caffeine, Water tracker, Avatar Lab, Nova, the page template, the old Integrations page (now
  Settings) and their scripts. `vercel.json` redirects old addresses to Today (and `/pages/integrations.html` to
  Settings). The WHOOP, Trading 212 and Weather adapters were later restored — see "Integrations" below.
- **Saved data was not touched.** Everything those pages stored (money, training, boxing, health, habits, reviews,
  progress-photo links…) remains in browser storage, syncs with Cloud Sync, and is included in
  **Menu → Backup → Export** (credentials excepted — see below). Budget and Training details used by Workforce are
  maintained in Workforce → **Update my information**.

## Release preparation (final pass)

### Workforce — "Update my information"
A collapsed panel inside the Budget and Training specialists. Everything is labelled as entered by you.
- **Budget** edits the inputs the calculation uses, in the existing `money` record: personal balance **and its date**,
  next payday, other payments before payday, money set aside (property / family / other) in `money.budget`, and the
  bills list in `money.bills` (each marked Personal or Business; business bills are excluded from the personal figure).
  A balance from an earlier day is confirmed, never assumed ("Your saved personal balance is £X … What is it now?").
- **Training** edits current goal, weigh-in/fight dates (or none), availability and limitations in the existing
  `boxing` record, with "Last confirmed" shown. Confirmed dates replace the built-in 16/17 Oct dates everywhere
  (Today, Assistant, Workforce). Older than 14 days → the specialist asks again.

### Integrations — where each is used
| Connection | Controls | Used by | Server routes / credentials |
|---|---|---|---|
| Google Calendar | Settings | Today, Assistant | `api/google-calendar-*`; client secret server-side; tokens on device only |
| WHOOP | Settings | Workforce → Training (latest recovery/sleep, dated, not interpreted) | `api/whoop-*` (callback returns to Settings; data proxy limited to 3 read endpoints); secret server-side |
| Weather | Settings | Settings only | `api/weather.js` (Open-Meteo, no key); failures shown, no placeholder weather |
| Trading 212 | Settings ("Check connection") | Settings only — nothing saved or traded | `api/trading212-data.js`, now behind the same session + allowlist check as AI (`api/_access.js`) |
| AI | Settings shows status | Assistant, Content, Workforce | `api/assistant.js` |
| Email | — | not connected anywhere | — |

### Credentials kept out of backups and sync
`scripts/backup-data.js` excludes credential keys — `gcal_tokens_v1`, `whoop_tokens_v1`, `nova_lite_api_key`,
Supabase `sb-*` sessions, and any key named like a token/secret/API key — from exports and the cloud copy, and skips
them when restoring or loading the cloud copy. Per-device sync bookkeeping (`cloudSyncMeta`) also stays local.
Settings → Integrations lists stored credentials **by name only** and can remove the unused Nova key.
Clean-up steps for credentials already in old backups/cloud copies: SETUP.md §9.

### Cloud sync conflicts
Each device records the cloud version it last pushed/pulled. Status: synced / local-newer (auto-save) /
cloud-newer (offer to load) / **conflict** (both changed → auto-save stops; Settings offers "Use the cloud copy" or
"Keep this device's data", each confirmed). Automatic saves are conditional updates (`… where updated_at = <seen>`),
so a stale or offline device can never silently overwrite a newer cloud copy, even in a race. Re-writing an identical
value no longer counts as a local change.

### Legacy Supabase objects
Reviewed SQL with run order and manual decisions: `supabase/legacy/README.md` (inspect → private backup → download
photos → lock down → verify; optional owner-access template). Nothing deletes data.

## Stage 1 — done

- **Today's commitments**: real Google Calendar events only via the app's own integration
  (`scripts/google-calendar-service.js` + `/api/google-calendar-*`). Shows *Not connected*,
  *Refreshing…*, *retrieved HH:MM*, or *Refresh failed* with the cached timestamp. Demo/mock events are never shown.
  Email always shows *Not connected* (no email integration exists).
  Your supplied routine (weekday work 08:00–17:30, weigh-in 16 Oct, fight 17 Oct) is listed separately and
  labelled "supplied by you, not from a calendar". Edit it in `SUPPLIED_ROUTINE` in `scripts/lockin-data.js`.
- **One main action + up to two supporting**, each with first step and realistic time; Done / Defer (to tomorrow) / Edit; Undo after Done/Defer.
- **Brain dump**: one field. Captures go to today's list and wait under "Captured today" until promoted.
- No scores, streaks, habit lists, sliders or long forms on the home screen.

### Where data lives

- Tasks use the original To Do store: localStorage keys `goals:YYYY-MM-DD` (6 AM day rollover).
  Optional fields: `id`, `role`, `firstStep`, `minutes`, timestamps.
- "Saved" appears only after the write is read back from storage. On failure the input is kept and an error is shown.
- Cloud: the existing Auto Cloud Save (`scripts/auto-sync.js`) pushes all localStorage to Supabase
  (`life_os_state`) when configured and signed in. The footer says honestly whether data is device-only or synced.

### Open it

- Deployed (Vercel): `/` — calendar refresh and cloud sync need the Vercel env vars (see SETUP.md).
- Locally: serve the folder with any static server and open `/`. `/api/*` won't exist, so calendar shows
  *Not connected* / *Refresh failed* and sync shows device-only — this is expected.

## Stage 2 — Second Brain (done)

`pages/second-brain.html` + `scripts/second-brain-data.js`.

- One search box, **Add note**, a short list (15 at a time, newest first; title matches rank first).
  Category filters (Business, Money, Property, Health, Family) stay hidden behind **Filter**.
- Note fields: title (optional — first line used if blank), content, optional category, optional link to the
  original document (http/https only). `createdAt`/`updatedAt` set automatically.
- Create, edit, delete with Undo. Search is plain text over stored title/content/category/filename/link —
  every term must appear; nothing is generated or summarised.
- Import `.txt`/`.md` (≤200 KB each): text copied into a note, filename kept in `sourceFile`.
  PDFs, photos and other files are listed as **not read** — nothing is stored for them.
- Export → `second-brain-YYYY-MM-DD.json`. Restore merges: adds missing notes, newer `updatedAt` wins, never deletes.

### Storage and sync

- One key: `secondBrain` = `{ version: 1, notes: [...] }` in localStorage. "Saved" only after a read-back check.
- Auto Cloud Save pushes **all** localStorage keys except its exclude list (`cloudSyncMeta`, `sb-*`, a few UI keys),
  so `secondBrain` is included in the Supabase `life_os_state` row. The page loads `auto-sync.js`, so each save
  marks a local change. The footer only says "Synced to cloud" after a push that finished after your last save
  (`scripts/sync-status-line.js`, shared with the home page).
- Limit: browser storage is roughly 5 MB per site, shared with the rest of the app. Fine for text notes; not for documents.

### Original documents

Keep originals in OneDrive/Google Drive (or another private store) and paste a link into the note.
Never put them in this project folder — everything here is served publicly by Vercel.

### Next step: PDF/document ingestion (not built)

1. Add a server route (e.g. `api/extract-text.js`) that accepts an upload, extracts text from text-based PDFs
   with an open-source parser (e.g. `pdf-parse`), and returns the text — the file itself is not stored or served.
2. The page saves the returned text as a normal note with `sourceFile` set, and says "text extracted" vs
   "no text found (scanned image)". Scanned PDFs/photos would need OCR (e.g. Tesseract) — a separate, optional step.
3. Large documents need storage outside localStorage: a Supabase table (`notes`, RLS per user) with Postgres
   full-text search, and originals in a **private** Supabase Storage bucket. Plain keyword search is still enough;
   no paid embeddings or AI API needed.

## Stage 3 — Assistant (done)

`pages/assistant.html` + `scripts/assistant-engine.js` + `api/assistant.js`. Opened from the Menu's
Morning / Evening / Weekly reset (`?mode=`), and from Today's empty main-action state.

- **Morning** — today's commitments with source + freshness (Google Calendar fresh / cached / may be out of date /
  refresh failed; supplied routine separate; email "not connected — not checked"). Estimated focus time with its
  basis shown (after work or from 09:00 until 21:30, family time kept free, ~1 h per calendar event).
  One main + ≤2 supporting from **existing open tasks** (main role → carried-over → first step set → matches week
  outcomes). A business/money task swaps in only if it fits. Missing first steps are flagged, not invented.
  Edit / untick, then **Save to today's list** (one verified write to `goals:`). Nothing changes before saving.
- **Evening** — today's main/supporting actions; you tap **Done** or **Move to tomorrow** (existing defer).
  Nothing is inferred. Optional short note (→ Daily Snapshot `notes`, shown back in the Evening view) and tomorrow's
  priority (→ Daily Snapshot `tomorrowPriority` + tomorrow's `goals:` list, as main if none set).
- **Weekly reset** — completed (last 7 days) and unfinished work from stored records, deduped; next 7 days'
  calendar events (only from a real fetch) and supplied dated events. Up to three outcomes for the week
  (Sat/Sun → next week), with **Review changes** → **Confirm and save**.
- **Dated events**: weigh-in 16 Oct / fight 17 Oct only shape plans in the 7 days before (fight week: ≤1 supporting),
  the day before and the day itself (≤30–45 min, no supporting). After 17 Oct they have no effect.

### New storage
- `lockInLog` (synced by Auto Cloud Save like every key): `done` — completed tasks copied out of `goals:` day
  keys before rollover deletes them; `weeks` — weekly outcomes.
  Completion history starts with this update; older completions were never kept by the app.

### AI (optional)
- `GET/POST /api/assistant` (Vercel function, `@anthropic-ai/sdk` 0.128.0, shared by Assistant and Content via
  `scripts/ai-client.js`). Setup and costs: SETUP.md §4.
- **Access protection (all required, otherwise the endpoint is off):** the server verifies the caller's Supabase
  session (`auth.getUser` with the bearer token), checks `ASSISTANT_ALLOWED_EMAILS`, then records/counts usage in
  `assistant_usage` (RLS, per-user rolling 24 h limit, fails closed) — all **before** Anthropic is contacted.
  A 3-second per-user burst guard runs per serverless instance on top.
- **Bounds:** model `claude-haiku-5-5` (override `ASSISTANT_MODEL`), effort low, `max_tokens` 2000, 20 s timeout,
  ≤2 SDK retries of temporary errors on the same model, request body ≤12 KB, ≤3 notes × 600 chars.
  No model switching: a refusal is returned as an error and the page shows its basic briefing / template.
- **Untrusted notes:** keyword matching only filters relevance — it is not a safety measure. Retrieved notes are
  sent as separate `document` content blocks titled `note:<id>` with a context saying they are untrusted reference
  data; they never appear in the instruction text. The output is a JSON schema validated on the server and again in
  the page: an unknown task id is rejected (never re-mapped), a "new" action matching an existing task is rejected
  as ambiguous, genuine new actions are shown as **New** and left unticked until you tick them, and only note ids
  sent in that request can be shown as used. Nothing changes until you press Save.
- If AI is off or fails, the page says so and shows the basic briefing.

### Scheduled delivery (not built)
Briefings are manual only. A scheduled morning/evening message would need:
1. **Server-side data access** — today data lives in the browser (and the Supabase `life_os_state` blob when signed
   in). A Vercel Cron job would read that row with a Supabase service-role key (server-only) and run the same
   engine logic server-side (it's currently browser code).
2. **Calendar on the server** — Google refresh tokens are stored in the browser; they'd need storing server-side.
3. **A delivery channel** — e.g. web push (service worker + VAPID keys) or email via a provider (Resend, etc.),
   plus opt-in settings and quiet hours.
4. **Vercel Cron** schedule in `vercel.json` (e.g. 06:30 Europe/London — Cron runs in UTC, so handle BST).

## Stage 4 — Content (done)

`pages/content.html` + `scripts/content-data.js` + `scripts/story-render.js`.

- One job-details box, optional vehicle/year and photos, optional call-out price (under More options — only shown
  if typed), Post caption / Instagram Story, **Create draft**. Result: editable caption, **Copy caption**,
  **Save draft**; for Stories an editable headline/lines, live preview, **Download Story (PNG)**.
  Saved drafts sit behind the secondary **Saved drafts** button (open, delete with Undo, export, restore).
- **Text:** AI (if the protected endpoint is on and you're signed in) receives only the typed facts, vehicle,
  price and photo count — never photos. Its draft is rejected in favour of **Template mode** if it adds a price you
  didn't supply or a claim not in your notes (guarantee, warranty, qualified, reviews, years, fixed/repaired,
  diagnosed, replaced, unknown numbers…), and the contact line is appended if missing. Template mode uses only your
  words plus the business name, area, phone and email. Nothing is published or sent.
- **Stories:** real 1080 × 1920 PNG drawn from your photo (or a plain branded background — never a fake photo).
  Text stays within x 90–990, y 270–1650 (clear of Instagram's bars), shrinks to fit and reports anything shortened.
  Drag to reposition, ± zoom, and **Hide an area** pixelates plates/identifying details; hidden areas follow the photo.
  Exported PNGs carry no photo metadata (EXIF/GPS is not copied by the canvas). Video files are refused.
  There are no brand image assets in the repo, so the mark is text ("MB AUTOMOTIVE"); drop a logo into
  `story-render.js` later if one exists.
- **Storage:** draft text/metadata in `contentDrafts` (localStorage → synced by Auto Cloud Save, no image data).
  Photos in IndexedDB `lockin-content-photos` on this device only — not synced, not in backups, not in the project.
  If IndexedDB isn't available the page says photos are session-only and keeps the text draft.
  The existing Supabase `progress-photos` bucket is public with anon write access, so it is **not** used for
  customer photos. Cross-device photo sync would need a private bucket with per-user RLS (not built).

## Stage 5 — Workforce (done)

`pages/workforce.html` + `scripts/workforce-engine.js` + `scripts/workforce-calc.js`.

- One box ("What do you need help with?") and **Help me**. A keyword router picks **one** specialist and shows it with
  a small **Change**. If the request fits none (or two equally), it asks one question: "Which area is this about?".
- Each specialist asks for missing essentials **one question at a time**, then shows one result with a next action,
  the inputs/assumptions, and a **Used** list (your request, your answers, app records, matching notes).
- **Save to Second Brain** and **Add action to today** each open an editable preview; nothing is written until
  **Confirm**. The page reads app data raw (never through loaders that create defaults), so using it changes nothing.

| Specialist | Basic mode (always available) | AI (if protected endpoint on) |
|---|---|---|
| MB Automotive Business | Quote from your parts / labour hours × rate / travel, asks VAT status, draft reply with the figures; reply template from your facts; job checklist; one customer-generation action → Content | Wording on top; figures must match the app's |
| Personal Budget | Balance (saved Money HQ value, if any, offered as "entered by you, not live"), payday, saved Money HQ bills due before payday (business bills excluded, paid ones ignored, monthly dates rolled forward), other payments, money set aside (property / family / other) → available until payday and per day, or shortfall. Missing input = no figure | Commentary only; any £/% not calculated is rejected |
| Property Analyst | Flip / rent-to-rent / serviced accommodation from your figures: profit, return, break-even sale price / rooms / occupancy, missing costs (counted £0, add & recalculate), "verify with a current source" list. Never assumes occupancy, rents, comparables or rules | Commentary only, same figure check |
| Content Marketing | Hands off to the Content page with details / vehicle / format prefilled (nothing created until Create draft) | Not used here — Content has its own checks |
| Training and Recovery | Confirms dated goals (16/17 Oct, Boxing HQ fight date) and injuries first; plans around work hours and family time using saved Boxing HQ targets / Strength HQ week (if any); no diagnosis; refuses extreme cuts | Wording on top |

**Runtime:** AI goes through the same `/api/assistant` (mode `workforce`), so it shares the session check, allowlist,
the one daily limit (`assistant_usage` counts Assistant + Content + Workforce together), timeout and bounded retries.
The browser sends only a `roleId`; the server rejects unknown ids and builds the system prompt from
`api/_specialists.js` — any prompt text from the browser is ignored. Notes go as untrusted `document` blocks. Output is
schema-validated on the server; the page then rejects AI text containing £/% figures the app didn't calculate or
claims of research/account access, limits note/record references to those sent, and allows at most one AI
clarifying question. AI off or failing → labelled **Basic mode**.

## Claude Code subagents

- Canonical instructions: `api/_specialists.js` (`SPECIALISTS`, `SHARED_RULES`). The website uses `webSystemPrompt()`;
  `tools/sync-agents.mjs` renders `agentBody()` into `.claude/agents/<id>.md` with `name`, `description`, `tools`
  frontmatter. Edit the source, run `npm run agents:sync`; `npm run agents:check` fails if files drift.
- Tools are read-only: `Read, Grep, Glob` (Property Analyst also `WebSearch, WebFetch` so it can cite a current
  source). No personal records or secrets are in the files.
- **Discovery:** Claude Code loads project agents from `.claude/agents/` when a session starts (a session already running
  won't see new ones — restart it). Use them via `/agents`, by asking e.g. "use the property-analyst subagent to …", or
  let Claude delegate based on the description.
- **Verified 11 Oct 2026** with Claude Code 2.1.193: a fresh `claude -p` session in this folder listed all five and
  invoked `personal-budget`, which reported its tools as Read, Grep, Glob.
- **Separate systems:** the website runs its own specialist API workflows (`/api/assistant`); Claude Code runs its own
  subagents. The website does **not** call Claude Code subagents. A bridge (e.g. a server running the Claude Agent SDK
  with these definitions) would be remaining work, with its own auth, sandboxing and cost controls.

## Deployment readiness checklist (in order)

1. **Export a backup on every device you've used** (Menu → Backup) before anything else — your records live in
   browser storage. Old backup files from before this release may contain credentials (SETUP.md §9).
2. **Inspect the live Supabase project**: run `supabase/legacy/01_inspect.sql` (read-only) and keep the output.
3. **Secure the legacy objects**: follow `supabase/legacy/README.md` — `02_backup.sql`, download any progress photos
   you want, `03_lockdown.sql`, `05_verify.sql`. Decide photo ownership only if you'll ever need them in the app (step 4 template).
4. Confirm Supabase Auth settings: Email provider on; decide on public sign-up; Site URL + preview Redirect URLs (SETUP.md §8).
5. Run `supabase/life_os_state.sql` (if not already) and `supabase/assistant_usage.sql`.
6. Decide whether Preview uses the production Supabase project (shares your real data) or a separate one (SETUP.md §8).
7. Set Vercel env vars for Preview (SETUP.md §1); register the branch-alias callbacks with Google and WHOOP.
8. Set a monthly spend limit in the Anthropic Console.
9. Review and merge/push the `lock-in-hq-stage-1` branch to get a preview deployment (not done yet).
10. On the preview: sign in; `GET /api/assistant` shows `enabled: true`; one Morning, one caption and one Workforce
    request succeed; a non-allowlisted account gets 403 (AI and Trading 212); usage rows appear.
11. Sign in on two devices; make an edit on each in turn; confirm the second device is offered the newer copy and that a
    deliberate offline edit produces the "both changed" choice rather than an overwrite.
12. Connect Google Calendar and WHOOP on the preview (callbacks return to Settings); check Weather and Trading 212.
13. Follow SETUP.md §9 to clear credentials from old cloud copies/backups and revoke anything exposed.
14. Only then promote to production and repeat steps 7, 10 and 12 on the production domain.

## Remaining work

- Email integration (none exists; every page says "not connected").
- Scheduled briefings (see Stage 3 notes).
- Private cross-device photo storage for Content (needs a private bucket with per-user RLS).
- Website ↔ Claude Code subagent bridge (not built; see above).
- Brand logo asset for Stories (none in the repo).
