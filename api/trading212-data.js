// ============================================================
// GET /api/trading212-data
// Server-side Trading 212 read-only proxy — credentials never
// reach the browser. Reads TRADING212_API_KEY (required),
// TRADING212_API_SECRET (required), TRADING212_ENV=live|demo
// (optional, defaults to live) from Vercel env vars only.
//
// Always authenticates with HTTP Basic auth (API_KEY:API_SECRET)
// — no raw-key fallback. Read-only: only calls the current
// documented /equity/positions (open positions) and
// /equity/account/summary (cash/account totals — display only,
// never imported as a holding) endpoints — never any order/
// trading endpoint. Manual refresh only — do not call this on
// page load.
//
// Value safety: Trading 212 reports averagePricePaid/currentPrice
// per share in the INSTRUMENT's own currency (e.g. GBX pence for
// LSE-listed stocks, or USD/EUR for foreign listings). Multiplying
// that directly by quantity as if it were GBP silently inflates
// value (this was the cause of a past bad import that added tens
// of thousands of pounds of fake value). walletImpact.* is already
// converted into the account's home currency by Trading 212 itself,
// so currentValueGBP/costBasisGBP/profitLossGBP below are always
// derived from walletImpact when its currency is GBP, never from a
// raw instrument-currency price. If walletImpact isn't in GBP (or
// quantity is 0), the value is reported as unknown (valueUnknown:
// true, *GBP fields null) rather than guessed.
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
    const [positionsRes, summaryRes] = await Promise.all([
      fetch(base + '/equity/positions', { headers }),
      fetch(base + '/equity/account/summary', { headers }),
    ]);

    if (!positionsRes.ok) {
      const text = await positionsRes.text();
      const msg = positionsRes.status === 401 || positionsRes.status === 403
        ? 'Trading 212 rejected the credentials — check TRADING212_API_KEY/TRADING212_API_SECRET.'
        : 'Trading 212 request failed (' + positionsRes.status + '): ' + text;
      return res.status(positionsRes.status).json({ error: msg });
    }

    const positions = await positionsRes.json();
    const summary = summaryRes.ok ? await summaryRes.json() : null;

    const holdings = (Array.isArray(positions) ? positions : []).map(function (p) {
      const instrument = p.instrument || {};
      const wallet = p.walletImpact || {};
      const quantity = Number(p.quantity) || 0;
      const valueKnown = wallet.currency === 'GBP' && quantity > 0;
      return {
        ticker: instrument.ticker || '',
        name: instrument.name || (instrument.ticker || '').split('_')[0] || '',
        isin: instrument.isin || '',
        quantity: quantity,
        instrumentCurrency: instrument.currency || 'unknown',
        // Informational only — instrument-currency, never used for value math.
        currentPriceInstrumentCcy: Number(p.currentPrice) || 0,
        averagePricePaidInstrumentCcy: Number(p.averagePricePaid) || 0,
        // Trusted GBP figures, straight from Trading 212's own wallet
        // conversion — null (not 0) when not confirmed GBP.
        currentValueGBP: valueKnown ? (Number(wallet.currentValue) || 0) : null,
        costBasisGBP: valueKnown ? (Number(wallet.totalCost) || 0) : null,
        profitLossGBP: valueKnown ? (Number(wallet.unrealizedProfitLoss) || 0) : null,
        valueUnknown: !valueKnown,
      };
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      holdings: holdings,
      // Display/debug only — never imported as an investment row.
      cash: summary ? {
        currency: summary.currency || 'unknown',
        availableToTrade: Number(summary.cash && summary.cash.availableToTrade) || 0,
        reservedForOrders: Number(summary.cash && summary.cash.reservedForOrders) || 0,
        totalValue: Number(summary.totalValue) || 0,
      } : null,
    });
  } catch (e) {
    return res.status(502).json({ error: 'Trading 212 fetch failed: ' + (e && e.message ? e.message : String(e)) });
  }
}
