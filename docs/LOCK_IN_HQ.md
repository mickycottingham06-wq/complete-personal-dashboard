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

## Later stages (not built)

2. **Second Brain** — searchable store for brain-dump notes that aren't tasks (ideas, references, property study),
   with "turn into task" back into the `goals:` store. Needs its own synced key and a simple list/search page.
3. **Assistant** — a planning helper that suggests the main action, first step and duration from today's list,
   commitments and supplied routine. Suggestions only; nothing saved without you confirming. Needs a server-side
   AI route (no keys in the browser).
4. **Content** — capture and schedule posts for MB Automotive Works (ideas → draft → posted), kept out of the home screen.
5. **Workforce** — track jobs/people/suppliers for MB Automotive Works (who's doing what, follow-ups).
   Also the place to add a verified email integration (Gmail OAuth via `/api` routes) so the home screen can show real email commitments.
