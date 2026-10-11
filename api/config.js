// ============================================================
// GET /api/config  →  returns a tiny JS file that sets public
// configuration on `window` from Vercel env vars.
//
// 1. Supabase (scripts/supabase-status.js → sign-in + Cloud Sync):
//    NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY →
//    window.NEXT_PUBLIC_SUPABASE_URL/ANON_KEY. No hardcoded fallback —
//    if unset, the app reports "not configured" and stays local-only.
//
// 2. Google Calendar (scripts/google-calendar-service.js):
//    GOOGLE_CLIENT_ID → window.GOOGLE_CLIENT_ID. An OAuth client ID is
//    not a secret (it's sent in the browser redirect either way) — only
//    GOOGLE_CLIENT_SECRET is sensitive, and that stays server-side only
//    inside api/google-calendar-callback.js / api/google-calendar-refresh.js.
//
// Loaded via <script src="/api/config"></script> in each page's <head>.
// These are PUBLIC values. Never put the service_role key, the
// Anthropic key or any other secret here.
// ============================================================
export default function handler(req, res) {
  const nextUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const nextKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(
    'window.NEXT_PUBLIC_SUPABASE_URL=' + JSON.stringify(nextUrl) + ';' +
    'window.NEXT_PUBLIC_SUPABASE_ANON_KEY=' + JSON.stringify(nextKey) + ';' +
    'window.GOOGLE_CLIENT_ID=' + JSON.stringify(googleClientId) + ';'
  );
}
