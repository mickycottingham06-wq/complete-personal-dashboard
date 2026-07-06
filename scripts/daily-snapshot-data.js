// =============================================================
// Daily Snapshot — shared data layer.
// Owns the `dailySnapshot` localStorage key: defaults, the 6 AM
// day-rollover convention, and load/save. Any page (the Daily
// Snapshot / Daily Control Panel page itself, Streaks, Heatmap,
// preview cards, Health HQ) reads today's snapshot through this
// file instead of re-implementing the rollover logic.
//
// This is the daily control panel for the whole Life OS: morning
// plan, execution checklist, body/mind status, evening review.
// Habits stay the single source of truth for Streaks/Heatmap.
// A few status fields (energyLevel, stressLevel, currentWeight)
// are safely pushed one-way into Health HQ / Boxing HQ on save
// (see pages/daily-snapshot.html) since they share the same scale
// — sleepQuality/recovery are NOT pushed anywhere else, since
// Health HQ's own sleepQuality (text) and recoveryScore (WHOOP %)
// use different scales and would corrupt on overwrite.
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

  var MOODS = ['Great', 'Good', 'Okay', 'Low', 'Rough'];

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
      // Morning plan
      mainFocus: '',
      successTarget: '',
      priorities: [
        { id: 'p1', text: '', completed: false },
        { id: 'p2', text: '', completed: false },
        { id: 'p3', text: '', completed: false },
      ],
      scheduleNotes: '',
      // Execution
      habits: DEFAULT_HABITS.map(function (h) { return { id: h.id, label: h.label, completed: false }; }),
      trainingCompleted: false,
      businessTaskCompleted: false,
      healthRoutineCompleted: false,
      spendingLogged: false,
      goalActionCompleted: false,
      // Body / mind status
      energyLevel: 0,
      mood: '',
      sleepQuality: 0,
      recovery: 0,
      stress: 0,
      currentWeight: 0,
      notes: '',
      // Evening review
      wentWell: '',
      slipped: '',
      lesson: '',
      tomorrowPriority: '',
      dayScore: 0,
    };
  }

  // Fills in any fields missing from an existing snapshot against the
  // current default shape, so a snapshot saved before a schema upgrade
  // (or still mid-day) doesn't lose the rest of its data.
  function upgrade(snap) {
    var d = defaultSnapshot();
    Object.keys(d).forEach(function (k) { if (!(k in snap)) snap[k] = d[k]; });
    if (!Array.isArray(snap.priorities) || snap.priorities.length !== 3) snap.priorities = d.priorities;
    if (!Array.isArray(snap.habits) || snap.habits.length === 0) snap.habits = d.habits;
    return snap;
  }

  // Reads today's snapshot, rolling over to fresh defaults if the stored
  // snapshot belongs to a previous day, and persists the result so every
  // reader (this page, Streaks, Heatmap, preview cards) sees the same data.
  function loadOrInit() {
    var snap = loadJSON(SNAPSHOT_KEY, null);
    if (!snap || snap.date !== activeDateKey()) snap = defaultSnapshot();
    snap = upgrade(snap);
    saveJSON(SNAPSHOT_KEY, snap);
    return snap;
  }

  function save(snap) { saveJSON(SNAPSHOT_KEY, snap); }

  window.DailySnapshot = {
    KEY: SNAPSHOT_KEY,
    DEFAULT_HABITS: DEFAULT_HABITS,
    MOODS: MOODS,
    activeDateKey: activeDateKey,
    // Raw read — may be null or stale (kept for back-compat with the
    // original public hook documented in DATA_SCHEMA.md).
    get: function () { return loadJSON(SNAPSHOT_KEY, null); },
    // Read + rollover + upgrade + persist — what pages should call to get today's data.
    loadOrInit: loadOrInit,
    save: save,
  };
})();
