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

  function defaultBoxing() {
    return {
      trainingPhase: 'Base Building',
      fightDate: '',
      currentWeight: 0,
      targetWeight: 0,
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

  // Reads boxing data, filling in any missing fields against the
  // default shape so older saved data upgrades cleanly.
  function load() {
    var b = loadJSON(KEY, null);
    if (!b) { b = defaultBoxing(); saveJSON(KEY, b); return b; }
    var d = defaultBoxing();
    Object.keys(d).forEach(function (k) { if (!(k in b)) b[k] = d[k]; });
    if (!Array.isArray(b.weaknesses)) b.weaknesses = [];
    if (!Array.isArray(b.trainingLog)) b.trainingLog = [];
    return b;
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
