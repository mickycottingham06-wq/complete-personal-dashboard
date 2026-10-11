# LOCK-IN HQ

The default homepage (`index.html`). Built to show one day's focus, not everything at once.
The previous home (Command Centre) is unchanged at `command-centre.html` and linked from **More** and the sidebar.

## Stage 1 — done

- **Today's commitments**: real Google Calendar events only via the app's own integration
  (`scripts/google-calendar-service.js` + `/api/google-calendar-*`). Shows *Not connected*,
  *Refreshing…*, *retrieved HH:MM*, or *Refresh failed* with the cached timestamp. Demo/mock events are never shown.
  Email always shows *Not connected* (no email integration exists).
  Your supplied routine (weekday work 08:00–17:30, weigh-in 16 Oct, fight 17 Oct) is listed separately and
  labelled "supplied by you, not from a calendar". Edit it in `SUPPLIED_ROUTINE` in `scripts/lockin-data.js`.
- **One main action + up to two supporting**, each with first step and realistic time; Done / Defer (to tomorrow) / Edit; Undo after Done/Defer.
- **Brain dump**: one field. Captures go to today's list and wait under "Captured today" until promoted.
- **More** menu: Second Brain, Assistant (opens AI CEO), Content, Workforce, plus existing pages.
- No scores, streaks, habit lists, sliders or long forms on the home screen.

### Where data lives

- Tasks use the existing To Do store: localStorage keys `goals:YYYY-MM-DD` (6 AM day rollover), shared with
  `pages/main.html`, the top bar and Heatmap. New optional fields: `id`, `role`, `firstStep`, `minutes`, timestamps.
- "Saved" appears only after the write is read back from storage. On failure the input is kept and an error is shown.
- Cloud: the existing Auto Cloud Save (`scripts/auto-sync.js`) pushes all localStorage to Supabase
  (`life_os_state`) when configured and signed in. The footer says honestly whether data is device-only or synced.

### Open it

- Deployed (Vercel): `/` — calendar refresh and cloud sync need the Vercel env vars (see SETUP.md).
- Locally: serve the folder with any static server and open `/`. `/api/*` won't exist, so calendar shows
  *Not connected* / *Refresh failed* and sync shows device-only — this is expected.

## Stage 2 — Second Brain (done)

`pages/second-brain.html` + `scripts/second-brain-data.js`. Linked from **More** and the sidebar.

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

`pages/assistant.html` + `scripts/assistant-engine.js` + `api/assistant.js`. Linked from **More** (AI CEO kept
separately as "AI CEO (prompt builder)") and from the home page's empty main-action state.

- **Morning** — today's commitments with source + freshness (Google Calendar fresh / cached / may be out of date /
  refresh failed; supplied routine separate; email "not connected — not checked"). Estimated focus time with its
  basis shown (after work or from 09:00 until 21:30, family time kept free, ~1 h per calendar event).
  One main + ≤2 supporting from **existing open tasks** (main role → carried-over → first step set → matches week
  outcomes). A business/money task swaps in only if it fits. Missing first steps are flagged, not invented.
  Edit / untick, then **Save to today's list** (one verified write to `goals:`). Nothing changes before saving.
- **Evening** — today's main/supporting actions; you tap **Done** or **Move to tomorrow** (existing defer).
  Nothing is inferred. Optional short note (→ Daily Snapshot `notes`) and tomorrow's priority
  (→ Daily Snapshot `tomorrowPriority` + tomorrow's `goals:` list, as main if none set).
- **Weekly reset** — completed (last 7 days) and unfinished work from stored records, deduped; next 7 days'
  calendar events (only from a real fetch) and supplied dated events. Up to three outcomes for the week
  (Sat/Sun → next week), with **Review changes** → **Confirm and save**.
- **Dated events**: weigh-in 16 Oct / fight 17 Oct only shape plans in the 7 days before (fight week: ≤1 supporting),
  the day before and the day itself (≤30–45 min, no supporting). After 17 Oct they have no effect.

### New storage
- `lockInLog` (synced by Auto Cloud Save like every key): `done` — completed tasks copied out of `goals:` day
  keys before rollover deletes them (both LOCK-IN HQ and `pages/main.html` rollovers); `weeks` — weekly outcomes.
  Completion history starts with this update; older completions were never kept by the app.

### AI (optional)
- `GET/POST /api/assistant` (Vercel function, `@anthropic-ai/sdk` 0.128.0, shared by Assistant and Content via
  `scripts/ai-client.js`). Setup and costs: SETUP.md §8.
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

`pages/content.html` + `scripts/content-data.js` + `scripts/story-render.js`. Linked from **More** and the sidebar.

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

## Later stages (not built)

5. **Workforce** — track jobs/people/suppliers for MB Automotive Works (who's doing what, follow-ups).
   Also the place to add a verified email integration (Gmail OAuth via `/api` routes) so the home screen can show real email commitments.
