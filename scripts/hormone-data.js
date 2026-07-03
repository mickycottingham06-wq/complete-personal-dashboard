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
      weeklyNotes: '',
      redFlagNotes: '',
    };
  }

  // Reads hormone data, filling in any missing fields against the
  // default shape so older saved data upgrades cleanly.
  function load() {
    var h = loadJSON(KEY, null);
    if (!h) { h = defaultHormones(); saveJSON(KEY, h); return h; }
    var d = defaultHormones();
    Object.keys(d).forEach(function (k) { if (!(k in h)) h[k] = d[k]; });
    if (!Array.isArray(h.lifestyleFoundations)) h.lifestyleFoundations = d.lifestyleFoundations;
    if (!Array.isArray(h.supplements)) h.supplements = d.supplements;
    if (!Array.isArray(h.bloodwork)) h.bloodwork = d.bloodwork;
    return h;
  }

  function save(h) { saveJSON(KEY, h); }

  window.Hormones = {
    KEY: KEY,
    DEFAULT_LIFESTYLE_FOUNDATIONS: DEFAULT_LIFESTYLE_FOUNDATIONS,
    DEFAULT_SUPPLEMENTS: DEFAULT_SUPPLEMENTS,
    DEFAULT_BLOODWORK_MARKERS: DEFAULT_BLOODWORK_MARKERS,
    uid: uid,
    load: load,
    save: save,
  };
})();
