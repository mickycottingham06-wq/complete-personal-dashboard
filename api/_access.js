// ============================================================
// Shared server-side access check for private/paid API routes
// (/api/assistant, /api/trading212-data). Not a route itself — the
// leading underscore keeps Vercel from exposing it.
//
// A request passes only if ALL of:
//   1. NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are set,
//   2. ASSISTANT_ALLOWED_EMAILS lists at least one email,
//   3. the Authorization: Bearer token is a valid Supabase session
//      (verified with Supabase, not trusted from the browser), and
//   4. that user's email is on the allowlist.
// Anything missing fails closed.
// ============================================================
import { createClient } from '@supabase/supabase-js';

export function accessConfig() {
  const env = process.env;
  const c = {
    sbUrl: env.NEXT_PUBLIC_SUPABASE_URL || '',
    sbAnon: env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    allowed: String(env.ASSISTANT_ALLOWED_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
  };
  c.missing = [];
  if (!c.sbUrl || !c.sbAnon) c.missing.push('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!c.allowed.length) c.missing.push('ASSISTANT_ALLOWED_EMAILS');
  return c;
}

// Returns { ok, user, sb } or { ok:false, code, error }. sb is a Supabase
// client acting as the caller (row-level security applies).
export async function checkAccess(req, c) {
  c = c || accessConfig();
  if (c.missing.length) return { ok: false, code: 503, error: 'Access protection not configured: missing ' + c.missing.join(', ') + '.' };
  const auth = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || '');
  const m = /^Bearer\s+(.+)$/.exec(auth);
  if (!m) return { ok: false, code: 401, error: 'Sign in first.' };
  const token = m[1].trim();
  const sb = createClient(c.sbUrl, c.sbAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: 'Bearer ' + token } },
  });
  let user = null;
  try {
    const { data, error } = await sb.auth.getUser(token);
    if (!error) user = data && data.user;
  } catch (e) { /* treated as invalid */ }
  if (!user) return { ok: false, code: 401, error: 'Session not valid — sign in again.' };
  if (c.allowed.indexOf(String(user.email || '').toLowerCase()) === -1) return { ok: false, code: 403, error: 'This account is not allowed to use this.' };
  return { ok: true, user, sb };
}
