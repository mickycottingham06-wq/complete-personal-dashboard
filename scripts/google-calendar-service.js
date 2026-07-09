// =============================================================
// Google Calendar Service — reusable fetch/derive logic, kept
// separate from any page's UI. Owns the OAuth token pair in
// localStorage (gcal_tokens_v1) and talks to Google only through
// server-side proxy routes (api/google-calendar-callback.js,
// api/google-calendar-refresh.js, api/google-calendar-data.js) —
// the client secret never reaches the browser. Same pattern as
// WHOOP (pages/health.html + api/whoop-*.js).
// =============================================================
(function () {
  'use strict';

  var TOKEN_KEY = 'gcal_tokens_v1';
  var SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';
  var justConnected = false;

  function nowIso() { return new Date().toISOString(); }

  function loadTokens() { try { return JSON.parse(localStorage.getItem(TOKEN_KEY)); } catch (e) { return null; } }
  function saveTokens(t) { try { localStorage.setItem(TOKEN_KEY, JSON.stringify(t)); } catch (e) {} }
  function wipeTokens() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} }
  function isConnected() { var t = loadTokens(); return !!(t && t.access); }

  // Captures gcal_access/gcal_refresh/gcal_expires from the URL hash
  // after api/google-calendar-callback.js redirects back here — same
  // technique pages/health.html uses for whoop_access. Runs once, at
  // script load, before window.Integrations state is ever rendered.
  (function captureAuthRedirect() {
    if (!location.hash || location.hash.indexOf('gcal_access') === -1) return;
    var h = new URLSearchParams(location.hash.slice(1));
    var access = h.get('gcal_access'), refresh = h.get('gcal_refresh');
    var expires = Number(h.get('gcal_expires')) || Date.now() + 3500e3;
    if (access) {
      saveTokens({ access: access, refresh: refresh, expires: expires });
      if (window.Integrations) window.Integrations.setEnabled('googleCalendar', true);
      justConnected = true;
      history.replaceState(null, '', location.pathname + location.search);
    }
  })();

  // One-shot flag a page can check right after load to trigger an
  // immediate real fetch following a successful connect, instead of
  // making the user click Refresh a second time.
  function consumeJustConnected() {
    var v = justConnected;
    justConnected = false;
    return v;
  }

  // Local calendar date (not UTC) — matches integrations-data.js's dateInDays()
  // so event dates and today/tomorrow comparisons always agree.
  function localDateStr(d) {
    var y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function localTimeStr(d) {
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function todayStr() { return localDateStr(new Date()); }
  function tomorrowStr() { var d = new Date(); d.setDate(d.getDate() + 1); return localDateStr(d); }

  function sortByDateTime(a, b) {
    var da = a.date + ' ' + (a.time || '');
    var db = b.date + ' ' + (b.time || '');
    return da < db ? -1 : da > db ? 1 : 0;
  }

  // Pure reads — never throw on missing/empty input, so a section with
  // no events yet never breaks the page reading it.
  function getEventsForDate(events, dateStr) {
    return (events || []).filter(function (e) { return e && e.date === dateStr; }).sort(sortByDateTime);
  }
  function getToday(events) { return getEventsForDate(events, todayStr()); }
  function getTomorrow(events) { return getEventsForDate(events, tomorrowStr()); }

  // Soonest event today or later. Returns null (not undefined/throw) if none.
  function getNext(events) {
    var today = todayStr();
    var upcoming = (events || []).filter(function (e) { return e && e.date >= today; }).sort(sortByDateTime);
    return upcoming.length ? upcoming[0] : null;
  }

  // Maps Google Calendar API event objects to this app's existing event
  // shape ({ id, title, date, time, location, notes }) so every page that
  // reads integrations.googleCalendar.upcomingEvents keeps working unchanged.
  function mapGoogleEvents(items) {
    return (items || []).map(function (ev) {
      var start = ev.start || {};
      var d = start.dateTime ? new Date(start.dateTime) : (start.date ? new Date(start.date + 'T00:00:00') : null);
      return {
        id: ev.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)),
        title: ev.summary || '(no title)',
        date: d ? localDateStr(d) : '',
        time: (start.dateTime && d) ? localTimeStr(d) : '',
        location: ev.location || '',
        notes: ev.description || '',
      };
    }).filter(function (e) { return e.date; });
  }

  async function refreshToken(t) {
    if (!t || !t.refresh) return null;
    try {
      var r = await fetch('/api/google-calendar-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: t.refresh }),
      });
      var j = await r.json();
      if (j.access_token) {
        var next = { access: j.access_token, refresh: j.refresh_token || t.refresh, expires: Date.now() + (j.expires_in || 3500) * 1000 };
        saveTokens(next);
        return next;
      }
    } catch (e) {}
    return null;
  }

  async function fetchEvents(t) {
    var r = await fetch('/api/google-calendar-data?maxResults=15', {
      headers: { 'Authorization': 'Bearer ' + t.access, 'Accept': 'application/json' },
    });
    if (r.status === 401) {
      var n = await refreshToken(t);
      if (n) return fetchEvents(n);
      throw new Error('unauthorized — reconnect Google Calendar');
    }
    if (!r.ok) throw new Error('Google Calendar ' + r.status + ': ' + (await r.text()));
    var j = await r.json();
    return j.items || [];
  }

  // Starts the Google OAuth flow (redirects the browser to Google's
  // consent screen). Fails clearly — without navigating anywhere — if
  // GOOGLE_CLIENT_ID isn't configured, instead of sending the browser to
  // Google with an empty client_id.
  function connect(section) {
    section = section || 'googleCalendar';
    var clientId = window.GOOGLE_CLIENT_ID || '';
    if (!clientId) {
      var state = window.Integrations.load();
      var c = state[section];
      if (c) {
        c.status = 'Error — Google Calendar not configured (set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in Vercel, then redeploy)';
        window.Integrations.save(state);
      }
      return false;
    }
    var redirect = window.location.origin + '/api/google-calendar-callback';
    var url = 'https://accounts.google.com/o/oauth2/v2/auth'
      + '?client_id='     + encodeURIComponent(clientId)
      + '&redirect_uri='  + encodeURIComponent(redirect)
      + '&response_type=code'
      + '&access_type=offline'
      + '&prompt=consent'
      + '&scope='         + encodeURIComponent(SCOPE)
      + '&state='         + Math.random().toString(36).slice(2);
    window.location.href = url;
    return true;
  }

  // Disconnects: wipes the local token pair only. Cached upcomingEvents
  // are left as-is — they're only ever replaced by the next successful
  // real fetch, never wiped on disconnect.
  function disconnect(section) {
    section = section || 'googleCalendar';
    wipeTokens();
    var state = window.Integrations.load();
    var c = state[section];
    if (c) { c.status = 'Not connected'; window.Integrations.save(state); }
    return state;
  }

  // Refreshes the googleCalendar section from the real Google Calendar
  // API. Returns { ok, state, mock, error } — same contract the mock
  // refresh() used, so every call site (integrations.html) needed no changes.
  async function refresh(section) {
    section = section || 'googleCalendar';
    var state = window.Integrations.load();
    var c = state[section];
    if (!c) return { ok: false, state: state };
    if (!c.enabled) return { ok: false, state: state };

    var t = loadTokens();
    if (!t || !t.access) {
      c.status = 'Not connected — click Connect Google Calendar';
      window.Integrations.save(state);
      return { ok: false, state: state, error: 'not_connected' };
    }

    try {
      if (t.expires && Date.now() > t.expires - 60000) {
        var n = await refreshToken(t);
        if (n) t = n;
      }
      var items = await fetchEvents(t);
      c.upcomingEvents = mapGoogleEvents(items);
      c.status = 'Connected';
      c.lastSync = nowIso();
      window.Integrations.save(state);
      return { ok: true, state: state, mock: false };
    } catch (err) {
      c.status = 'Error — ' + ((err && err.message) || 'sync failed');
      window.Integrations.save(state);
      return { ok: false, state: state, error: err && err.message };
    }
  }

  window.GoogleCalendarService = {
    refresh: refresh,
    connect: connect,
    disconnect: disconnect,
    isConnected: isConnected,
    consumeJustConnected: consumeJustConnected,
    getEventsForDate: getEventsForDate,
    getToday: getToday,
    getTomorrow: getTomorrow,
    getNext: getNext,
    todayStr: todayStr,
    tomorrowStr: tomorrowStr,
  };
})();
