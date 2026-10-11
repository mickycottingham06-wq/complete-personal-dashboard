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

## Later stages (not built)

3. **Assistant** — a planning helper that suggests the main action, first step and duration from today's list,
   commitments and supplied routine. Suggestions only; nothing saved without you confirming. Needs a server-side
   AI route (no keys in the browser).
4. **Content** — capture and schedule posts for MB Automotive Works (ideas → draft → posted), kept out of the home screen.
5. **Workforce** — track jobs/people/suppliers for MB Automotive Works (who's doing what, follow-ups).
   Also the place to add a verified email integration (Gmail OAuth via `/api` routes) so the home screen can show real email commitments.
