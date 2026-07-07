// =============================================================
// Hormone Optimisation — shared data layer.
// Owns the `hormones` localStorage key: defaults and load/save.
// Any page (Hormone Optimisation itself, the preview card on
// index.html) reads/writes through this file instead of touching
// localStorage directly, so they always agree.
//
// Tracking and general wellbeing support only — this is not a
// medical app and never diagnoses, treats, or prescribes anything.
//
// Include this with a plain (non-defer) <script src="..."> tag
// BEFORE any inline script that calls window.Hormones, so it is
// guaranteed to be ready by the time it's used.
// =============================================================
(function () {
  'use strict';

  var KEY = 'hormones';

  var DEFAULT_LIFESTYLE_FOUNDATIONS = [
    '7-9 hours sleep',
    'Morning sunlight',
    'Strength training',
    'Boxing/conditioning balanced with recovery',
    'Whole foods',
    'Enough calories/protein',
    'Hydration/electrolytes',
    'Low alcohol',
    'Low processed food',
    'Manage stress',
  ];

  var DEFAULT_SUPPLEMENTS = [
    'Vitamin D',
    'Magnesium',
    'Zinc',
    'Omega 3',
    'Creatine',
    'Electrolytes',
  ];

  var DEFAULT_BLOODWORK_MARKERS = [
    'Total Testosterone',
    'Free Testosterone',
    'SHBG',
    'LH',
    'FSH',
    'Oestradiol',
    'Prolactin',
    'Vitamin D',
    'Thyroid Markers',
    'Cortisol',
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

  function bloodworkFrom(markers) {
    return markers.map(function (marker) {
      return { id: uid(), marker: marker, value: '', unit: '', date: '', notes: '' };
    });
  }

  function defaultHormones() {
    return {
      hormoneScore: 5,
      energyLevel: 5,
      mood: 'Neutral',
      vitalityRating: 5,
      sleepConsistency: 5,
      stressLevel: 5,
      trainingRecovery: 5,
      sunlightExposure: false,
      nutritionQuality: 'Good',
      avoidedProcessedFood: false,
      avoidedAlcohol: false,
      lifestyleFoundations: checklistFrom(DEFAULT_LIFESTYLE_FOUNDATIONS),
      supplements: supplementsFrom(DEFAULT_SUPPLEMENTS),
      bloodwork: bloodworkFrom(DEFAULT_BLOODWORK_MARKERS),
      checklistDate: activeDateKey(),
      weeklyNotes: '',
      redFlagNotes: '',
    };
  }

  // Checklist item labels are the reusable template (id + label/name persist
  // forever, including user-added/deleted items). Only the tick state
  // (completed/taken) is a daily instance — this resets it in place once the
  // stored checklistDate falls behind "today", same rollover moment Daily
  // Snapshot uses. Templates themselves are never touched.
  function rolloverChecklists(h) {
    h.lifestyleFoundations.forEach(function (i) { i.completed = false; });
    h.supplements.forEach(function (i) { i.taken = false; });
  }

  // Reads hormone data, filling in any missing fields against the
  // default shape so older saved data upgrades cleanly.
  function load() {
    var h = loadJSON(KEY, null);
    if (!h) { h = defaultHormones(); saveJSON(KEY, h); return h; }
    var hadDate = !!h.checklistDate;
    var d = defaultHormones();
    Object.keys(d).forEach(function (k) { if (!(k in h)) h[k] = d[k]; });
    if (!Array.isArray(h.lifestyleFoundations)) h.lifestyleFoundations = d.lifestyleFoundations;
    if (!Array.isArray(h.supplements)) h.supplements = d.supplements;
    if (!Array.isArray(h.bloodwork)) h.bloodwork = d.bloodwork;

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

  window.Hormones = {
    KEY: KEY,
    DEFAULT_LIFESTYLE_FOUNDATIONS: DEFAULT_LIFESTYLE_FOUNDATIONS,
    DEFAULT_SUPPLEMENTS: DEFAULT_SUPPLEMENTS,
    DEFAULT_BLOODWORK_MARKERS: DEFAULT_BLOODWORK_MARKERS,
    uid: uid,
    activeDateKey: activeDateKey,
    load: load,
    save: save,
  };
})();
