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
      progressPhotos: [],
      weeklyNotes: '',
      nextImprovementFocus: '',
    };
  }

  // Reads appearance data, filling in any missing fields against the
  // default shape so older saved data upgrades cleanly.
  function load() {
    var a = loadJSON(KEY, null);
    if (!a) { a = defaultAppearance(); saveJSON(KEY, a); return a; }
    var d = defaultAppearance();
    Object.keys(d).forEach(function (k) { if (!(k in a)) a[k] = d[k]; });
    if (!Array.isArray(a.skincareRoutine)) a.skincareRoutine = d.skincareRoutine;
    if (!Array.isArray(a.groomingRoutine)) a.groomingRoutine = d.groomingRoutine;
    if (!Array.isArray(a.progressPhotos)) a.progressPhotos = d.progressPhotos;
    return a;
  }

  function save(a) { saveJSON(KEY, a); }

  window.Appearance = {
    KEY: KEY,
    DEFAULT_SKINCARE_ROUTINE: DEFAULT_SKINCARE_ROUTINE,
    DEFAULT_GROOMING_ROUTINE: DEFAULT_GROOMING_ROUTINE,
    uid: uid,
    load: load,
    save: save,
  };
})();
