// ============================================================
// GET /api/config  →  returns a tiny JS file that sets the
// public Supabase config on `window` from Vercel env vars.
//
// Two independent configs are served here:
//
// 1. Legacy blob-sync (scripts/sync.js, topbar.js, gym.html):
//   SUPABASE_URL / SUPABASE_ANON_KEY → window.DASH_SUPABASE_URL/KEY
//   These pages also carry a hardcoded fallback key in their own
//   source (pre-existing, not part of this foundation cleanup —
//   see docs/SUPABASE_PLAN.md §2).
//
// 2. New Supabase foundation (scripts/supabase-status.js):
//   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY →
//   window.NEXT_PUBLIC_SUPABASE_URL/ANON_KEY. No hardcoded
//   fallback — if unset, the foundation reports "not configured"
//   and stays fully inert.
//
// Loaded via <script src="/api/config"></script> in the <head>,
// before any script that reads these values. If the env vars
// aren't set (or the site is opened locally), empty strings are
// sent and the reader falls back to its own safe default.
//
// These are PUBLIC values (they ship to the browser anyway), so
// it's fine to expose them — this just lets people configure the
// app with env vars instead of editing files. Never put the
// service_role key here or in any client-shipped file.
// ============================================================
export default function handler(req, res) {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_ANON_KEY || '';
  const nextUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const nextKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(
    'window.DASH_SUPABASE_URL=' + JSON.stringify(url) + ';' +
    'window.DASH_SUPABASE_KEY=' + JSON.stringify(key) + ';' +
    'window.NEXT_PUBLIC_SUPABASE_URL=' + JSON.stringify(nextUrl) + ';' +
    'window.NEXT_PUBLIC_SUPABASE_ANON_KEY=' + JSON.stringify(nextKey) + ';'
  );
}
