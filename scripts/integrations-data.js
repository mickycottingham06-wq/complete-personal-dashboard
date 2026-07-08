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
        high: '',
        low: '',
        rainChance: '',
        wind: '',
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
        // Auto Cloud Save default — on for everyone once Supabase is
        // configured (auto-sync.js no-ops until it is). `userSet` tracks
        // whether this device's owner has ever explicitly touched the
        // toggle; until then, load() below keeps forcing this true so
        // old/new data both default on, and only an explicit user choice
        // (via setEnabled) can turn it off and have that choice stick.
        enabled: true,
        userSet: false,
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
    // Auto Cloud Save default-on migration: any stored cloudSync.enabled
    // that hasn't been explicitly set by this device's owner (old data
    // predates `userSet` entirely, so it's always false here) is forced
    // back to true on every load. The moment setEnabled() is called by
    // the user, userSet flips true and their choice — on or off — is
    // respected from then on.
    if (!stored.cloudSync.userSet) stored.cloudSync.enabled = true;
    if (!Array.isArray(stored.googleCalendar.upcomingEvents)) stored.googleCalendar.upcomingEvents = [];
    // Upgrade older saved events (title/date/time only) with the richer
    // location/notes fields so older localStorage data never throws.
    stored.googleCalendar.upcomingEvents.forEach(function (e) {
      if (typeof e.location !== 'string') e.location = '';
      if (typeof e.notes !== 'string') e.notes = '';
    });
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
    // Auto Cloud Save: this is the "clear explicit user-disabled flag"
    // load()'s default-on migration checks for — once set, the user's
    // choice (on or off) sticks and is never overridden again.
    if (section === 'cloudSync') state[section].userSet = true;
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
    { title: 'Team sync', daysFromNow: 0, time: '10:00', location: 'Google Meet', notes: 'Weekly check-in' },
    { title: 'Gym session', daysFromNow: 0, time: '18:00', location: 'Home gym', notes: '' },
    { title: 'Coaching call', daysFromNow: 1, time: '15:30', location: 'Phone', notes: 'Bring last week\'s numbers' },
    { title: 'Dentist appointment', daysFromNow: 3, time: '09:15', location: 'High Street Dental', notes: '' },
  ];

  // Local calendar date (not UTC) so "today"/"tomorrow" comparisons match
  // the device's actual day regardless of timezone.
  function dateInDays(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    var y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  // Simulates a "Sync now" action for a given section. This never makes
  // a network request — it only writes safe, clearly-labelled demo data.
  // Returns { ok, state } so the UI can show an inline error without throwing.
  function mockSync(section) {
    var state = load();
    var s = state[section];
    if (!s) return { ok: false, state: state };
    if (!s.enabled) return { ok: false, state: state };
    // Cloud Sync outgrew this demo path — it's real now (scripts/auto-sync.js
    // + scripts/cloud-sync.js), so there's nothing left for mockSync to do here.
    if (section === 'cloudSync') return { ok: false, state: state };

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
      s.upcomingEvents = buildMockCalendarEvents();
      s.status = 'Connected (demo data)';
      s.lastSync = nowIso();
    } else if (section === 'aiApi') {
      s.status = 'Connected (mock mode)';
      s.lastUsed = nowIso();
    }

    save(state);
    return { ok: true, state: state };
  }

  // Shared mock event builder so google-calendar-service.js's refresh()
  // and this file's own mockSync() never drift into two different pools.
  function buildMockCalendarEvents() {
    return MOCK_EVENTS.map(function (e) {
      return { id: uid(), title: e.title, date: dateInDays(e.daysFromNow), time: e.time, location: e.location || '', notes: e.notes || '' };
    });
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
    buildMockCalendarEvents: buildMockCalendarEvents,
  };
})();
