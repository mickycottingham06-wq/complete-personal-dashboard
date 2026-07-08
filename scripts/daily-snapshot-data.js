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
  var HISTORY_LIMIT = 60; // cap archived reflection days, same capped-array-in-owner-key pattern as streaks.history/heatmap.entries

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
      updatedAt: '', // ISO timestamp, stamped by save() — same pattern as core.lastUpdated, lets CloudSync.latestLocalTimestamp() detect edits (the plain YYYY-MM-DD `date` field doesn't match its ISO scan)
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
      // Archived reflection/review data from past days, oldest -> newest,
      // capped at HISTORY_LIMIT. Written only on rollover (see archiveDay
      // below) — never touched mid-day, so this is not a second source of
      // truth for today's live fields.
      history: [],
    };
  }

  // A day with none of its reflection/review fields touched isn't worth an
  // archive entry — keeps history free of noisy empty rows.
  function isWorthArchiving(snap) {
    var text = [snap.mainFocus, snap.successTarget, snap.scheduleNotes, snap.notes,
      snap.wentWell, snap.slipped, snap.lesson, snap.tomorrowPriority];
    if (text.some(function (t) { return t && String(t).trim(); })) return true;
    if (snap.dayScore > 0 || snap.energyLevel > 0 || snap.stress > 0) return true;
    if (snap.trainingCompleted || snap.businessTaskCompleted || snap.healthRoutineCompleted ||
        snap.spendingLogged || snap.goalActionCompleted) return true;
    if (Array.isArray(snap.priorities) && snap.priorities.some(function (p) { return (p.text && p.text.trim()) || p.completed; })) return true;
    return false;
  }

  function buildHistoryEntry(snap) {
    return {
      date: snap.date,
      mainFocus: snap.mainFocus,
      successTarget: snap.successTarget,
      priorities: Array.isArray(snap.priorities)
        ? snap.priorities.map(function (p) { return { id: p.id, text: p.text, completed: !!p.completed }; })
        : [],
      trainingCompleted: !!snap.trainingCompleted,
      businessTaskCompleted: !!snap.businessTaskCompleted,
      healthRoutineCompleted: !!snap.healthRoutineCompleted,
      spendingLogged: !!snap.spendingLogged,
      goalActionCompleted: !!snap.goalActionCompleted,
      energyLevel: snap.energyLevel,
      stress: snap.stress,
      notes: snap.notes,
      scheduleNotes: snap.scheduleNotes,
      wentWell: snap.wentWell,
      slipped: snap.slipped,
      lesson: snap.lesson,
      tomorrowPriority: snap.tomorrowPriority,
      dayScore: snap.dayScore,
    };
  }

  // Archives outgoingSnap (yesterday's, or older if the app was closed for a
  // few days) into history before the day rolls over. Skips blank days, and
  // replaces rather than duplicates an existing entry for the same date.
  function archiveDay(outgoingSnap, history) {
    if (!Array.isArray(history)) history = [];
    if (!outgoingSnap || !outgoingSnap.date || !isWorthArchiving(outgoingSnap)) return history;
    var entry = buildHistoryEntry(outgoingSnap);
    var idx = history.findIndex(function (e) { return e.date === entry.date; });
    if (idx >= 0) history[idx] = entry; else history.push(entry);
    history.sort(function (a, b) { return a.date.localeCompare(b.date); });
    if (history.length > HISTORY_LIMIT) history = history.slice(-HISTORY_LIMIT);
    return history;
  }

  // Fills in any fields missing from an existing snapshot against the
  // current default shape, so a snapshot saved before a schema upgrade
  // (or still mid-day) doesn't lose the rest of its data.
  function upgrade(snap) {
    var d = defaultSnapshot();
    Object.keys(d).forEach(function (k) { if (!(k in snap)) snap[k] = d[k]; });
    if (!Array.isArray(snap.priorities) || snap.priorities.length !== 3) snap.priorities = d.priorities;
    if (!Array.isArray(snap.habits) || snap.habits.length === 0) snap.habits = d.habits;
    if (!Array.isArray(snap.history)) snap.history = [];
    return snap;
  }

  // Reads today's snapshot, rolling over to fresh defaults if the stored
  // snapshot belongs to a previous day, and persists the result so every
  // reader (this page, Streaks, Heatmap, preview cards) sees the same data.
  // Before rolling over, the outgoing day's reflection/review fields are
  // archived into `history` so Weekly Review / future coaching can read
  // past days — a same-day reload never hits this branch, so it can't
  // create duplicate entries.
  function loadOrInit() {
    var snap = loadJSON(SNAPSHOT_KEY, null);
    if (!snap || snap.date !== activeDateKey()) {
      var history = archiveDay(snap, snap && snap.history);
      snap = defaultSnapshot();
      snap.history = history;
    }
    snap = upgrade(snap);
    saveJSON(SNAPSHOT_KEY, snap);
    return snap;
  }

  function save(snap) {
    snap.updatedAt = new Date().toISOString();
    saveJSON(SNAPSHOT_KEY, snap);
  }

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
    // Archived past days' reflection/review data, oldest -> newest (capped at HISTORY_LIMIT).
    // For Weekly Review / Daily Guidance / future coaching to read — never mutate this array.
    getHistory: function () {
      var snap = loadJSON(SNAPSHOT_KEY, null);
      return snap && Array.isArray(snap.history) ? snap.history : [];
    },
  };
})();
