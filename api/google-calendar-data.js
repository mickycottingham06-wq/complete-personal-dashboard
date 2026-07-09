// ============================================================
// GET /api/google-calendar-data?maxResults=15
// Authorization: Bearer <user's Google access_token>
// Proxies to https://www.googleapis.com/calendar/v3/calendars/primary/events
// and returns the JSON. Same proxy pattern as api/whoop-data.js — keeps
// the browser from needing a direct authenticated call to Google, and
// isolates the calendar API to this one file.
// ============================================================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing bearer token' });

  const maxResults = Math.min(Math.max(Number((req.query && req.query.maxResults) || 15), 1), 50);
  const timeMin = (req.query && req.query.timeMin) || new Date().toISOString();

  const params = new URLSearchParams({
    timeMin,
    maxResults: String(maxResults),
    singleEvents: 'true',
    orderBy: 'startTime',
  });
  const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?' + params.toString();

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
