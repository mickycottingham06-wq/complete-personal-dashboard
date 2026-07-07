// =============================================================
// Appearance / Looks — shared data layer.
// Owns the `appearance` localStorage key: defaults and load/save.
// Any page (Appearance / Looks itself, the preview card on
// index.html) reads/writes through this file instead of touching
// localStorage directly, so they always agree.
//
// Tracking and general appearance optimisation only — this never
// diagnoses, treats, or gives medical advice on skin, acne,
// scarring, hormones, or any health condition.
//
// Progress photos store metadata only (date, label, notes, an
// optional image URL/reference string) — never base64 image data,
// since localStorage isn't a safe place for that. Real image
// storage + AI photo analysis are future integrations.
//
// Include this with a plain (non-defer) <script src="..."> tag
// BEFORE any inline script that calls window.Appearance, so it is
// guaranteed to be ready by the time it's used.
// =============================================================
(function () {
  'use strict';

  var KEY = 'appearance';

  var DEFAULT_SKINCARE_ROUTINE = [
    'Cleanse',
    'Moisturise',
    'SPF',
    'Evening cleanse',
    'Spot treatment if used',
    'Hydration',
    'Clean pillowcase',
  ];

  var DEFAULT_GROOMING_ROUTINE = [
    'Haircut maintained',
    'Beard/facial hair maintained',
    'Eyebrows tidy',
    'Nails clean',
    'Clothes prepared',
    'Fragrance',
    'Posture check',
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

  function defaultAppearance() {
    return {
      looksScore: 5,
      skinScore: 5,
      acneStatus: 'Clear',
      acneScarringNotes: '',
      faceBloatingRating: 5,
      bodyCompositionNotes: '',
      hairstyleNotes: '',
      beardNotes: '',
      teethSmileNotes: '',
      postureNotes: '',
      styleNotes: '',
      skincareRoutine: checklistFrom(DEFAULT_SKINCARE_ROUTINE),
      groomingRoutine: checklistFrom(DEFAULT_GROOMING_ROUTINE),
      checklistDate: activeDateKey(),
      progressPhotos: [],
      weeklyNotes: '',
      nextImprovementFocus: '',
    };
  }

  // Routine item labels are the reusable template (id + label persist
  // forever, including user-added/deleted items). Only the tick state
  // (completed) is a daily instance — this resets it in place once the
  // stored checklistDate falls behind "today", same rollover moment Daily
  // Snapshot uses. Templates themselves are never touched.
  function rolloverChecklists(a) {
    a.skincareRoutine.forEach(function (i) { i.completed = false; });
    a.groomingRoutine.forEach(function (i) { i.completed = false; });
  }

  // Reads appearance data, filling in any missing fields against the
  // default shape so older saved data upgrades cleanly.
  function load() {
    var a = loadJSON(KEY, null);
    if (!a) { a = defaultAppearance(); saveJSON(KEY, a); return a; }
    var hadDate = !!a.checklistDate;
    var d = defaultAppearance();
    Object.keys(d).forEach(function (k) { if (!(k in a)) a[k] = d[k]; });
    if (!Array.isArray(a.skincareRoutine)) a.skincareRoutine = d.skincareRoutine;
    if (!Array.isArray(a.groomingRoutine)) a.groomingRoutine = d.groomingRoutine;
    if (!Array.isArray(a.progressPhotos)) a.progressPhotos = d.progressPhotos;

    var today = activeDateKey();
    if (!hadDate) {
      // Upgrading from before daily rollover existed — stamp today without
      // wiping whatever is already ticked, so in-progress state isn't lost
      // mid-upgrade. Normal daily reset takes over from tomorrow.
      a.checklistDate = today;
      saveJSON(KEY, a);
    } else if (a.checklistDate !== today) {
      rolloverChecklists(a);
      a.checklistDate = today;
      saveJSON(KEY, a);
    }
    return a;
  }

  function save(a) { saveJSON(KEY, a); }

  window.Appearance = {
    KEY: KEY,
    DEFAULT_SKINCARE_ROUTINE: DEFAULT_SKINCARE_ROUTINE,
    DEFAULT_GROOMING_ROUTINE: DEFAULT_GROOMING_ROUTINE,
    uid: uid,
    activeDateKey: activeDateKey,
    load: load,
    save: save,
  };
})();
