// =============================================================
// Weather Service — calls the server-side /api/weather proxy
// (api/weather.js; Open-Meteo by default, no key) and stores the
// latest real reading in integrations.weather.
// Used by: Settings → Integrations → Weather only.
//
// Honest failures: if a refresh fails, the last real reading and its
// retrieval time are kept and the status says the refresh failed —
// no mock or invented weather is ever written.
// =============================================================
(function () {
  'use strict';

  function nowIso() { return new Date().toISOString(); }

  async function fetchLive(location) {
    var res = await fetch('/api/weather?location=' + encodeURIComponent(location));
    var body = null;
    try { body = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error((body && body.error) || ('weather request failed (' + res.status + ')'));
    return body;
  }

  // Returns { ok, state, error }. Never throws.
  async function refresh(location) {
    var state = window.Integrations.load();
    var w = state.weather;
    location = String(location == null ? w.location : location).trim();
    if (!location) return { ok: false, state: state, error: 'Add a town or postcode first.' };
    w.location = location;
    w.enabled = true;
    try {
      var data = await fetchLive(location);
      w.location = data.location || location;
      ['temperature', 'condition', 'high', 'low', 'rainChance', 'wind'].forEach(function (k) { w[k] = data[k] || ''; });
      w.status = 'Connected';
      w.lastSync = nowIso();
      window.Integrations.save(state);
      return { ok: true, state: state };
    } catch (err) {
      w.status = 'Refresh failed — ' + ((err && err.message) || 'unknown error');
      window.Integrations.save(state);
      return { ok: false, state: state, error: err && err.message };
    }
  }

  window.WeatherService = { refresh: refresh };
})();
