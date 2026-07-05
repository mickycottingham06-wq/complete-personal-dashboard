// =============================================================
// Weather Service — reusable fetch/fallback logic, kept separate
// from any page's UI. Calls the server-side /api/weather proxy
// (api/weather.js) so no provider API key ever reaches the browser.
// Writes results into integrations.weather via window.Integrations
// so every reader (Integrations page, dashboard preview, Daily
// Snapshot widget) sees the same state.
//
// On any failure — network error, bad location, offline — falls
// back to safe, clearly-labelled mock data instead of throwing, so
// a broken fetch never breaks the page it's called from.
// =============================================================
(function () {
  'use strict';

  var MOCK_POOL = [
    { temperature: '18°C', condition: 'Partly cloudy', high: '21°C', low: '13°C', rainChance: '20%', wind: '14 km/h' },
    { temperature: '22°C', condition: 'Clear', high: '25°C', low: '16°C', rainChance: '5%', wind: '9 km/h' },
    { temperature: '14°C', condition: 'Light rain', high: '16°C', low: '11°C', rainChance: '70%', wind: '19 km/h' },
  ];

  function nowIso() { return new Date().toISOString(); }
  function pickMock() { return MOCK_POOL[Math.floor(Math.random() * MOCK_POOL.length)]; }

  async function fetchLive(location) {
    var res = await fetch('/api/weather?location=' + encodeURIComponent(location));
    var body = null;
    try { body = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error((body && body.error) || ('weather request failed (' + res.status + ')'));
    return body;
  }

  // Refreshes a given Integrations section (defaults to 'weather').
  // Returns { ok, state, mock, error }. Never throws — safe to call
  // directly from a click handler without try/catch.
  async function refresh(section) {
    section = section || 'weather';
    var state = window.Integrations.load();
    var w = state[section];
    if (!w) return { ok: false, state: state };
    if (!w.enabled) return { ok: false, state: state };

    var location = (w.location || '').trim();
    if (!location) {
      w.status = 'Error — add a location first';
      window.Integrations.save(state);
      return { ok: false, state: state };
    }

    try {
      var data = await fetchLive(location);
      w.location = data.location || location;
      w.temperature = data.temperature || '';
      w.condition = data.condition || '';
      w.high = data.high || '';
      w.low = data.low || '';
      w.rainChance = data.rainChance || '';
      w.wind = data.wind || '';
      w.status = 'Connected (live)';
      w.lastSync = nowIso();
      window.Integrations.save(state);
      return { ok: true, state: state, mock: false };
    } catch (err) {
      var mock = pickMock();
      w.temperature = mock.temperature;
      w.condition = mock.condition;
      w.high = mock.high;
      w.low = mock.low;
      w.rainChance = mock.rainChance;
      w.wind = mock.wind;
      w.status = 'Connected (mock data)';
      w.lastSync = nowIso();
      window.Integrations.save(state);
      return { ok: true, state: state, mock: true, error: err && err.message };
    }
  }

  window.WeatherService = { refresh: refresh };
})();
