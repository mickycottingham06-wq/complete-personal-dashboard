// =============================================================
// Health HQ — shared data layer.
// Owns the `health` localStorage key: defaults and load/save.
// Any page (Health HQ itself, the preview card on index.html)
// reads/writes through this file instead of touching localStorage
// directly, so they always agree.
//
// Include this with a plain (non-defer) <script src="..."> tag
// BEFORE any inline script that calls window.Health, so it is
// guaranteed to be ready by the time it's used.
// =============================================================
(function () {
  'use strict';

  var KEY = 'health';

  var DEFAULT_MORNING_ROUTINE = [
    'Drink water after waking',
    'Morning sunlight',
    'Brush teeth',
    'Skincare',
    'Mobility',
    'Protein breakfast',
  ];

  var DEFAULT_EVENING_ROUTINE = [
    'No phone before bed',
    'Prepare for tomorrow',
    'Stretch/mobility',
    'Skincare',
    'Sleep on time',
  ];

  var DEFAULT_SUPPLEMENTS = [
    'Creatine',
    'Electrolytes',
    'Magnesium',
    'Vitamin D',
    'Omega 3',
  ];

  function loadJSON(k, f) { try { return JSON.parse(localStorage.getItem(k)) || f; } catch (e) { return f; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // Same 6 AM rollover convention used by Daily Snapshot (scripts/daily-snapshot-data.js)
  // and the goals list (pages/main.html), so "today" means the same day everywhere.
  function activeDateKey() {
    var now = new Date();
    var d = new Date(now);
    if (now.getHours() < 6) d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function checklistFrom(labels) {
    return labels.map(function (label) { return { id: uid(), label: label, completed: false }; });
  }

  function supplementsFrom(names) {
    return names.map(function (name) { return { id: uid(), name: name, taken: false }; });
  }

  function defaultHealth() {
    return {
      sleepTarget: 8,
      lastNightSleep: 0,
      sleepQuality: 'Good',
      recoveryScore: 0,
      energyLevel: 5,
      stressLevel: 5,
      hydrationTarget: 3,
      waterIntake: 0,
      proteinTarget: 150,
      caloriesTarget: 2500,
      currentWeight: 0,
      morningRoutine: checklistFrom(DEFAULT_MORNING_ROUTINE),
      eveningRoutine: checklistFrom(DEFAULT_EVENING_ROUTINE),
      supplements: supplementsFrom(DEFAULT_SUPPLEMENTS),
      checklistDate: activeDateKey(),
      recoveryNotes: '',
      healthNotes: '',
    };
  }

  // Routine/supplement item labels are the reusable template (id + label/name
  // persist forever, including user-added/deleted items). Only the tick state
  // (completed/taken) is a daily instance — this resets it in place once the
  // stored checklistDate falls behind "today", same rollover moment Daily
  // Snapshot uses. Templates themselves are never touched.
  function rolloverChecklists(h) {
    h.morningRoutine.forEach(function (i) { i.completed = false; });
    h.eveningRoutine.forEach(function (i) { i.completed = false; });
    h.supplements.forEach(function (i) { i.taken = false; });
  }

  // Reads health data, filling in any missing fields against the
  // default shape so older saved data upgrades cleanly.
  function load() {
    var h = loadJSON(KEY, null);
    if (!h) { h = defaultHealth(); saveJSON(KEY, h); return h; }
    var hadDate = !!h.checklistDate;
    var d = defaultHealth();
    Object.keys(d).forEach(function (k) { if (!(k in h)) h[k] = d[k]; });
    if (!Array.isArray(h.morningRoutine)) h.morningRoutine = d.morningRoutine;
    if (!Array.isArray(h.eveningRoutine)) h.eveningRoutine = d.eveningRoutine;
    if (!Array.isArray(h.supplements)) h.supplements = d.supplements;

    var today = activeDateKey();
    if (!hadDate) {
      // Upgrading from before daily rollover existed — stamp today without
      // wiping whatever is already ticked, so in-progress state isn't lost
      // mid-upgrade. Normal daily reset takes over from tomorrow.
      h.checklistDate = today;
      saveJSON(KEY, h);
    } else if (h.checklistDate !== today) {
      rolloverChecklists(h);
      h.checklistDate = today;
      saveJSON(KEY, h);
    }
    return h;
  }

  function save(h) { saveJSON(KEY, h); }

  window.Health = {
    KEY: KEY,
    DEFAULT_MORNING_ROUTINE: DEFAULT_MORNING_ROUTINE,
    DEFAULT_EVENING_ROUTINE: DEFAULT_EVENING_ROUTINE,
    DEFAULT_SUPPLEMENTS: DEFAULT_SUPPLEMENTS,
    uid: uid,
    activeDateKey: activeDateKey,
    load: load,
    save: save,
  };
})();
