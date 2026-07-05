// =============================================================
// Google Calendar Service — reusable fetch/derive logic, kept
// separate from any page's UI. No Google OAuth is configured yet,
// so refresh() never calls a real API — it simulates the sync
// delay and writes clearly-labelled mock events into
// integrations.googleCalendar via window.Integrations, same as
// scripts/weather-service.js does for weather.
//
// Once real OAuth exists, only this file needs to change: swap the
// simulated wait() + buildMockCalendarEvents() below for a call to
// a server-side proxy (e.g. GET /api/google-calendar, following the
// same no-secrets-in-the-browser pattern as api/weather.js), inside
// the existing try/catch so the error state keeps working.
// =============================================================
(function () {
  'use strict';

  function nowIso() { return new Date().toISOString(); }
  function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  // Local calendar date (not UTC) — matches integrations-data.js's dateInDays()
  // so mock event dates and today/tomorrow comparisons always agree.
  function localDateStr(d) {
    var y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
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

  // Refreshes the googleCalendar section. Returns { ok, state, mock, error }
  // — mirrors WeatherService.refresh()'s contract. Never throws, so it's
  // safe to call directly from a click handler without try/catch.
  async function refresh(section) {
    section = section || 'googleCalendar';
    var state = window.Integrations.load();
    var c = state[section];
    if (!c) return { ok: false, state: state };
    if (!c.enabled) return { ok: false, state: state };

    try {
      // No live Google OAuth configured yet — simulate the network delay
      // so the UI's loading state is real, then fall back to mock events.
      await wait(400);
      c.upcomingEvents = window.Integrations.buildMockCalendarEvents();
      c.status = 'Connected (mock data)';
      c.lastSync = nowIso();
      window.Integrations.save(state);
      return { ok: true, state: state, mock: true };
    } catch (err) {
      c.status = 'Error — ' + ((err && err.message) || 'sync failed');
      window.Integrations.save(state);
      return { ok: false, state: state, error: err && err.message };
    }
  }

  window.GoogleCalendarService = {
    refresh: refresh,
    getEventsForDate: getEventsForDate,
    getToday: getToday,
    getTomorrow: getTomorrow,
    getNext: getNext,
    todayStr: todayStr,
    tomorrowStr: tomorrowStr,
  };
})();
