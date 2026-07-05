// =============================================================
// Integrations — shared data layer.
// Owns the `integrations` localStorage key: connection state for
// Weather, Google Calendar, AI API and Cloud Sync. No live API
// calls or credentials live here — every "Sync now" action just
// writes safe mock/demo data, clearly labelled as such, so the
// foundation can be swapped for a real fetch later without any
// page or component needing to change shape.
//
// Any page (the full page at pages/integrations.html, the preview
// card on index.html) reads/writes through this file instead of
// touching localStorage directly, so they always agree.
// =============================================================
(function () {
  'use strict';

  var KEY = 'integrations';

  function loadJSON(k, f) { try { return JSON.parse(localStorage.getItem(k)) || f; } catch (e) { return f; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function nowIso() { return new Date().toISOString(); }

  function defaultIntegrations() {
    return {
      weather: {
        enabled: false,
        status: 'Not connected',
        location: '',
        lastSync: '',
        temperature: '',
        condition: '',
        notes: '',
      },
      googleCalendar: {
        enabled: false,
        status: 'Not connected',
        lastSync: '',
        upcomingEvents: [],
        notes: '',
      },
      aiApi: {
        enabled: false,
        status: 'Not connected',
        provider: 'Anthropic (Claude)',
        lastUsed: '',
        notes: '',
      },
      cloudSync: {
        enabled: false,
        status: 'Not connected',
        provider: 'Supabase',
        lastSync: '',
        notes: '',
      },
    };
  }

  // Reads stored integrations, filling in any missing fields (or whole
  // sections) against the default shape so older saved data upgrades
  // cleanly instead of throwing when a page reads a field that isn't there.
  function load() {
    var stored = loadJSON(KEY, null);
    var d = defaultIntegrations();
    if (!stored) { saveJSON(KEY, d); return d; }
    Object.keys(d).forEach(function (section) {
      if (!stored[section] || typeof stored[section] !== 'object') { stored[section] = d[section]; return; }
      Object.keys(d[section]).forEach(function (field) {
        if (!(field in stored[section])) stored[section][field] = d[section][field];
      });
    });
    if (!Array.isArray(stored.googleCalendar.upcomingEvents)) stored.googleCalendar.upcomingEvents = [];
    return stored;
  }

  function save(state) { saveJSON(KEY, state); }

  // Flip a section's enabled flag. Disabling always resets status to
  // "Not connected" and clears transient sync fields — it never deletes
  // notes, since those are the user's own text.
  function setEnabled(section, enabled) {
    var state = load();
    if (!state[section]) return state;
    state[section].enabled = !!enabled;
    if (!enabled) {
      state[section].status = 'Not connected';
      state[section].lastSync = '';
      if (section === 'aiApi') state[section].lastUsed = '';
    } else if (state[section].status === 'Not connected') {
      state[section].status = 'Enabled — not synced yet';
    }
    save(state);
    return state;
  }

  // Small deterministic mock pools so demo data feels alive without
  // being random/flaky between renders.
  var MOCK_CONDITIONS = [
    { temperature: '18°C', condition: 'Partly cloudy' },
    { temperature: '22°C', condition: 'Clear' },
    { temperature: '14°C', condition: 'Light rain' },
  ];
  var MOCK_EVENTS = [
    { title: 'Team sync', daysFromNow: 0, time: '10:00' },
    { title: 'Coaching call', daysFromNow: 1, time: '15:30' },
    { title: 'Dentist appointment', daysFromNow: 3, time: '09:15' },
  ];

  function dateInDays(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  // Simulates a "Sync now" action for a given section. This never makes
  // a network request — it only writes safe, clearly-labelled demo data.
  // Returns { ok, state } so the UI can show an inline error without throwing.
  function mockSync(section) {
    var state = load();
    var s = state[section];
    if (!s) return { ok: false, state: state };
    if (!s.enabled) return { ok: false, state: state };

    if (section === 'weather' && !s.location.trim()) {
      s.status = 'Error — add a location first';
      save(state);
      return { ok: false, state: state };
    }

    if (section === 'weather') {
      var pick = MOCK_CONDITIONS[Math.floor(Math.random() * MOCK_CONDITIONS.length)];
      s.temperature = pick.temperature;
      s.condition = pick.condition;
      s.status = 'Connected (demo data)';
      s.lastSync = nowIso();
    } else if (section === 'googleCalendar') {
      s.upcomingEvents = MOCK_EVENTS.map(function (e) {
        return { id: uid(), title: e.title, date: dateInDays(e.daysFromNow), time: e.time };
      });
      s.status = 'Connected (demo data)';
      s.lastSync = nowIso();
    } else if (section === 'aiApi') {
      s.status = 'Connected (demo mode)';
      s.lastUsed = nowIso();
    } else if (section === 'cloudSync') {
      s.status = 'Connected (demo data)';
      s.lastSync = nowIso();
    }

    save(state);
    return { ok: true, state: state };
  }

  function setField(section, field, value) {
    var state = load();
    if (!state[section]) return state;
    state[section][field] = value;
    save(state);
    return state;
  }

  window.Integrations = {
    KEY: KEY,
    uid: uid,
    defaultIntegrations: defaultIntegrations,
    load: load,
    save: save,
    setEnabled: setEnabled,
    setField: setField,
    mockSync: mockSync,
  };
})();
