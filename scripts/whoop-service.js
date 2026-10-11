// =============================================================
// WHOOP service — OAuth connect/disconnect and a read of the latest
// recovery + sleep, via the server routes api/whoop-callback.js,
// api/whoop-refresh.js and api/whoop-data.js (client secret stays
// server-side). Tokens live in localStorage `whoop_tokens_v1`, which
// is excluded from backups and cloud sync (scripts/backup-data.js).
// The latest summary is cached in integrations.whoop.
// Used by: Settings → Integrations → WHOOP, and Workforce → Training
// (shown as a labelled, timestamped record).
// =============================================================
(function () {
  'use strict';

  var TOKEN_KEY = 'whoop_tokens_v1';
  var SCOPES = 'read:recovery read:sleep read:cycles offline';
  var justConnected = false;

  function loadTokens() { try { return JSON.parse(localStorage.getItem(TOKEN_KEY)); } catch (e) { return null; } }
  function saveTokens(t) { try { localStorage.setItem(TOKEN_KEY, JSON.stringify(t)); } catch (e) {} }
  function isConnected() { var t = loadTokens(); return !!(t && t.access); }
  function nowIso() { return new Date().toISOString(); }

  // Tokens arrive in the URL hash after api/whoop-callback.js redirects here.
  (function captureRedirect() {
    if (!location.hash || location.hash.indexOf('whoop_access') === -1) return;
    var h = new URLSearchParams(location.hash.slice(1));
    var access = h.get('whoop_access');
    if (access) {
      saveTokens({ access: access, refresh: h.get('whoop_refresh') || '', expires: Number(h.get('whoop_expires')) || Date.now() + 3500e3 });
      justConnected = true;
    }
    history.replaceState(null, '', location.pathname + location.search + '#integrations');
  })();
  function consumeJustConnected() { var v = justConnected; justConnected = false; return v; }

  function connect() {
    var clientId = window.WHOOP_CLIENT_ID || '';
    if (!clientId) return false;
    location.href = 'https://api.prod.whoop.com/oauth/oauth2/auth'
      + '?client_id=' + encodeURIComponent(clientId)
      + '&redirect_uri=' + encodeURIComponent(location.origin + '/api/whoop-callback')
      + '&response_type=code'
      + '&scope=' + encodeURIComponent(SCOPES)
      + '&state=' + Math.random().toString(36).slice(2);
    return true;
  }

  // Removes the tokens from this device. The cached summary stays (labelled
  // with its retrieval time) until replaced or the user reconnects.
  function disconnect() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
    var s = window.Integrations.load();
    s.whoop.status = 'Not connected';
    window.Integrations.save(s);
  }

  async function refreshToken(t) {
    if (!t || !t.refresh) return null;
    try {
      var r = await fetch('/api/whoop-refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: t.refresh }) });
      var j = await r.json();
      if (j.access_token) { var n = { access: j.access_token, refresh: j.refresh_token || t.refresh, expires: Date.now() + (j.expires_in || 3500) * 1000 }; saveTokens(n); return n; }
    } catch (e) {}
    return null;
  }

  async function get(path, t) {
    var r = await fetch('/api/whoop-data?path=' + encodeURIComponent(path) + '&limit=1', { headers: { Authorization: 'Bearer ' + t.access, Accept: 'application/json' } });
    if (r.status === 401) { var n = await refreshToken(t); if (n) return get(path, n); throw new Error('WHOOP session expired — reconnect'); }
    if (!r.ok) throw new Error('WHOOP ' + r.status);
    return r.json();
  }

  // Returns { ok, state, error }. Never throws.
  async function refresh() {
    var s = window.Integrations.load();
    var w = s.whoop;
    var t = loadTokens();
    if (!t || !t.access) { w.status = 'Not connected'; window.Integrations.save(s); return { ok: false, state: s, error: 'not_connected' }; }
    try {
      if (t.expires && Date.now() > t.expires - 60000) { var n = await refreshToken(t); if (n) t = n; }
      var rec = await get('/recovery', t);
      var sleep = await get('/activity/sleep', t).catch(function () { return null; });
      var r0 = rec && rec.records && rec.records[0];
      var s0 = sleep && sleep.records && sleep.records[0];
      w.recoveryScore = r0 && r0.score && r0.score.recovery_score != null ? Math.round(r0.score.recovery_score) : null;
      var st = s0 && s0.score && s0.score.stage_summary;
      w.sleepHours = st ? Math.round(((st.total_in_bed_time_milli || 0) - (st.total_awake_time_milli || 0)) / 36e5 * 10) / 10 : null;
      w.status = 'Connected';
      w.lastSync = nowIso();
      window.Integrations.save(s);
      return { ok: true, state: s };
    } catch (err) {
      w.status = 'Refresh failed — ' + ((err && err.message) || 'unknown error');
      window.Integrations.save(s);
      return { ok: false, state: s, error: err && err.message };
    }
  }

  window.WhoopService = { isConnected: isConnected, connect: connect, disconnect: disconnect, refresh: refresh, consumeJustConnected: consumeJustConnected };
})();
