// =============================================================
// Daily Snapshot — shared data layer.
// Owns the `dailySnapshot` localStorage key: defaults, the 6 AM
// day-rollover convention, and load/save. Any page (the Daily
// Snapshot page itself, Streaks, preview cards, future Life
// Stats / Heatmap) reads today's snapshot through this file
// instead of re-implementing the rollover logic.
//
// Include this with a plain (non-defer) <script src="..."> tag
// BEFORE any inline script that calls window.DailySnapshot, so
// it is guaranteed to be ready by the time it's used.
// =============================================================
(function () {
  'use strict';

  var SNAPSHOT_KEY = 'dailySnapshot';

  var DEFAULT_HABITS = [
    { id: 'water',    label: 'Drink water after waking' },
    { id: 'sunlight', label: 'Morning sunlight' },
    { id: 'training', label: 'Training completed' },
    { id: 'steps',    label: 'Steps / movement' },
    { id: 'protein',  label: 'Protein target' },
    { id: 'sleep',    label: 'Sleep routine' },
    { id: 'noscroll', label: 'No wasted scrolling' },
  ];

  function loadJSON(k, f) { try { return JSON.parse(localStorage.getItem(k)) || f; } catch (e) { return f; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // Same 6 AM rollover convention used by the goals list (pages/main.html),
  // so "today" means the same day everywhere in the dashboard.
  function activeDateKey() {
    var now = new Date();
    var d = new Date(now);
    if (now.getHours() < 6) d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function defaultSnapshot() {
    return {
      date: activeDateKey(),
      mainFocus: '',
      priorities: [
        { id: 'p1', text: '', completed: false },
        { id: 'p2', text: '', completed: false },
        { id: 'p3', text: '', completed: false },
      ],
      habits: DEFAULT_HABITS.map(function (h) { return { id: h.id, label: h.label, completed: false }; }),
      trainingStatus: '',
      businessFocus: '',
      healthStatus: '',
      notes: '',
    };
  }

  // Reads today's snapshot, rolling over to fresh defaults if the stored
  // snapshot belongs to a previous day, and persists the result so every
  // reader (this page, Streaks, preview cards) sees the same data.
  function loadOrInit() {
    var snap = loadJSON(SNAPSHOT_KEY, null);
    if (!snap || snap.date !== activeDateKey()) snap = defaultSnapshot();
    if (!Array.isArray(snap.priorities) || snap.priorities.length !== 3) snap.priorities = defaultSnapshot().priorities;
    if (!Array.isArray(snap.habits) || snap.habits.length === 0) snap.habits = defaultSnapshot().habits;
    saveJSON(SNAPSHOT_KEY, snap);
    return snap;
  }

  function save(snap) { saveJSON(SNAPSHOT_KEY, snap); }

  window.DailySnapshot = {
    KEY: SNAPSHOT_KEY,
    DEFAULT_HABITS: DEFAULT_HABITS,
    activeDateKey: activeDateKey,
    // Raw read — may be null or stale (kept for back-compat with the
    // original public hook documented in DATA_SCHEMA.md).
    get: function () { return loadJSON(SNAPSHOT_KEY, null); },
    // Read + rollover + persist — what pages should call to get today's data.
    loadOrInit: loadOrInit,
    save: save,
  };
})();
