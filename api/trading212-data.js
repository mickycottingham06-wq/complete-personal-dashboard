// ============================================================
// GET /api/trading212-data
// Server-side Trading 212 read-only proxy — credentials never
// reach the browser. Reads TRADING212_API_KEY (required),
// TRADING212_API_SECRET (required), TRADING212_ENV=live|demo
// (optional, defaults to live) from Vercel env vars only.
//
// Always authenticates with HTTP Basic auth (API_KEY:API_SECRET)
// — no raw-key fallback. Read-only: only calls /equity/portfolio
// (open positions) and /equity/account/cash — never any
// order/trading endpoint. Manual refresh only — do not call this
// on page load.
// ============================================================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  const apiKey = process.env.TRADING212_API_KEY;
  const apiSecret = process.env.TRADING212_API_SECRET;
  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: 'Trading 212 not configured. Set both TRADING212_API_KEY and TRADING212_API_SECRET in Vercel env vars.' });
  }

  const authHeader = 'Basic ' + Buffer.from(apiKey + ':' + apiSecret).toString('base64');
  const env = process.env.TRADING212_ENV === 'demo' ? 'demo' : 'live';
  const base = 'https://' + env + '.trading212.com/api/v0';
  const headers = { Authorization: authHeader, Accept: 'application/json' };

  try {
    const [portfolioRes, cashRes] = await Promise.all([
      fetch(base + '/equity/portfolio', { headers }),
      fetch(base + '/equity/account/cash', { headers }),
    ]);

    if (!portfolioRes.ok) {
      const text = await portfolioRes.text();
      const msg = portfolioRes.status === 401 || portfolioRes.status === 403
        ? 'Trading 212 rejected the credentials — check TRADING212_API_KEY/TRADING212_API_SECRET.'
        : 'Trading 212 request failed (' + portfolioRes.status + '): ' + text;
      return res.status(portfolioRes.status).json({ error: msg });
    }

    const positions = await portfolioRes.json();
    const cash = cashRes.ok ? await cashRes.json() : null;

    const holdings = (Array.isArray(positions) ? positions : []).map(function (p) {
      return {
        ticker: p.ticker || '',
        name: (p.ticker || '').split('_')[0],
        quantity: Number(p.quantity) || 0,
        averagePrice: Number(p.averagePrice) || 0,
        currentPrice: Number(p.currentPrice) || 0,
        profitLoss: Number(p.ppl) || 0,
      };
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      holdings: holdings,
      cash: cash ? { free: Number(cash.free) || 0, total: Number(cash.total) || 0 } : null,
    });
  } catch (e) {
    return res.status(502).json({ error: 'Trading 212 fetch failed: ' + (e && e.message ? e.message : String(e)) });
  }
}
