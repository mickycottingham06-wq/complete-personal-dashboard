// ============================================================
// GET /api/whoop-data?path=/recovery&limit=1
// Authorization: Bearer <user's WHOOP access_token>
// Proxies the request to https://api.prod.whoop.com/developer/v1<path>
// and returns the JSON. Needed because WHOOP's API doesn't send
// CORS headers, so the browser can't call it directly.
// Only the three read endpoints the app uses are forwarded. The bearer
// token is the user's own WHOOP token; nothing is stored server-side.
// Used by: scripts/whoop-service.js (Settings → WHOOP, Workforce Training).
// ============================================================
const ALLOWED_PATHS = ['/recovery', '/activity/sleep', '/cycle'];

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing bearer token' });

  const path = (req.query && req.query.path) || '';
  if (ALLOWED_PATHS.indexOf(path) === -1) return res.status(400).json({ error: 'unsupported path' });

  // Forward all query params except `path` itself
  const fwd = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query || {})) {
    if (k !== 'path') fwd.set(k, String(v));
  }
  const qs = fwd.toString();
  // WHOOP moved most endpoints to v2; cycle is still on v1.
  const base = path.startsWith('/cycle')
    ? 'https://api.prod.whoop.com/developer/v1'
    : 'https://api.prod.whoop.com/developer/v2';
  const url = base + path + (qs ? '?' + qs : '');

  try {
    const r = await fetch(url, {
      headers: { 'Authorization': auth, 'Accept': 'application/json' },
    });
    const text = await r.text();
    res.status(r.status).setHeader('Content-Type', 'application/json');
    return res.send(text);
  } catch (e) {
    return res.status(500).json({ error: 'proxy fetch failed: ' + (e && e.message ? e.message : String(e)) });
  }
}
