// =============================================================
// Boxing HQ — shared data layer.
// Owns the `boxing` localStorage key: defaults and load/save.
// Any page (Boxing HQ itself, the preview card on index.html)
// reads/writes through this file instead of touching localStorage
// directly, so they always agree.
//
// Include this with a plain (non-defer) <script src="..."> tag
// BEFORE any inline script that calls window.Boxing, so it is
// guaranteed to be ready by the time it's used.
// =============================================================
(function () {
  'use strict';

  var KEY = 'boxing';

  var DEFAULT_FOCUSES = [
    'Footwork', 'Defence', 'Head Movement', 'Jab', 'Combinations',
    'Conditioning', 'Power', 'Speed', 'Ring IQ', 'Mobility',
  ];

  function loadJSON(k, f) { try { return JSON.parse(localStorage.getItem(k)) || f; } catch (e) { return f; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // Monday-start week key (YYYY-MM-DD), same 6 AM rollover + Monday->Sunday
  // week convention as window.WeeklyReview, kept as its own small copy here
  // since boxing-data.js loads before weekly-review-data.js.
  function currentWeekStart() {
    var now = new Date();
    var d = new Date(now);
    if (now.getHours() < 6) d.setDate(d.getDate() - 1);
    var day = d.getDay(); // 0 = Sun ... 6 = Sat
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function defaultBoxing() {
    return {
      trainingPhase: 'Base Building',
      fightDate: '',
      currentWeight: 0,
      targetWeight: 0,
      weekStart: currentWeekStart(),
      weeklyBoxingTarget: 4,
      completedBoxingSessions: 0,
      weeklyRunTarget: 3,
      completedRuns: 0,
      weeklyStrengthTarget: 2,
      completedStrengthSessions: 0,
      currentFocus: DEFAULT_FOCUSES[0],
      weaknesses: [],
      nextSessionPlan: '',
      sparringNotes: '',
      coachNotes: '',
      trainingLog: [],
    };
  }

  // Resets the weekly completion counters (not the targets, log, or notes)
  // once the stored week has ended, using the same week-boundary convention
  // as Weekly Review. A same-week call is a no-op, so this can run on every
  // load() safely. Persists immediately so every reader (preview card,
  // Weekly Review, Daily Guidance, Heatmap) sees the reset, not just the
  // next time Boxing HQ itself is saved.
  function rolloverWeek(b) {
    var ws = currentWeekStart();
    if (b.weekStart === ws) return b;
    b.weekStart = ws;
    b.completedBoxingSessions = 0;
    b.completedRuns = 0;
    b.completedStrengthSessions = 0;
    saveJSON(KEY, b);
    return b;
  }

  // Reads boxing data, filling in any missing fields against the
  // default shape so older saved data upgrades cleanly (existing data with
  // no weekStart yet is stamped with the current week, so the upgrade
  // itself never resets a session count already in progress this week),
  // then rolls over weekly counters if the stored week has ended.
  function load() {
    var b = loadJSON(KEY, null);
    if (!b) { b = defaultBoxing(); saveJSON(KEY, b); return b; }
    var d = defaultBoxing();
    Object.keys(d).forEach(function (k) { if (!(k in b)) b[k] = d[k]; });
    if (!Array.isArray(b.weaknesses)) b.weaknesses = [];
    if (!Array.isArray(b.trainingLog)) b.trainingLog = [];
    return rolloverWeek(b);
  }

  function save(b) { saveJSON(KEY, b); }

  window.Boxing = {
    KEY: KEY,
    DEFAULT_FOCUSES: DEFAULT_FOCUSES,
    uid: uid,
    load: load,
    save: save,
  };
})();
