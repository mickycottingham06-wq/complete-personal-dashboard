// =============================================================
// Goals — shared data layer.
// Owns the `lifeGoals` localStorage key: defaults and load/save.
// Any page (Goals itself, the preview card on index.html) reads/
// writes through this file instead of touching localStorage
// directly, so they always agree.
//
// This is separate from the per-day `goals:YYYY-MM-DD` keys used
// by the Main page's daily goal ticker (pages/main.html,
// scripts/topbar.js) — that system is a simple daily to-do list;
// this one is the long-term life-direction / active-goal tracker.
// The two intentionally do not share data.
//
// Include this with a plain (non-defer) <script src="..."> tag
// BEFORE any inline script that calls window.Goals, so it is
// guaranteed to be ready by the time it's used.
// =============================================================
(function () {
  'use strict';

  var KEY = 'lifeGoals';

  var CATEGORIES = ['Business / Money', 'Boxing', 'Health', 'Appearance', 'Career / Skills', 'Personal'];
  var PRIORITIES = ['High', 'Medium', 'Low'];
  var STATUSES = ['Not Started', 'In Progress', 'On Track', 'At Risk', 'Achieved'];

  function loadJSON(k, f) { try { return JSON.parse(localStorage.getItem(k)) || f; } catch (e) { return f; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function defaultGoals() {
    return {
      mainLifeGoal: '',
      twelveMonthGoal: '',
      ninetyDayGoal: '',
      monthlyGoal: '',
      weeklyGoal: '',
      activeGoals: [],
    };
  }

  function defaultActiveGoal() {
    return {
      id: uid(),
      title: '',
      category: CATEGORIES[0],
      priority: PRIORITIES[1],
      status: STATUSES[0],
      progress: 0,
      deadline: '',
      milestones: [],
      actions: [],
      notes: '',
    };
  }

  // Reads goals data, filling in any missing fields against the
  // default shape so older saved data upgrades cleanly.
  function load() {
    var g = loadJSON(KEY, null);
    if (!g) { g = defaultGoals(); saveJSON(KEY, g); return g; }
    var d = defaultGoals();
    Object.keys(d).forEach(function (k) { if (!(k in g)) g[k] = d[k]; });
    if (!Array.isArray(g.activeGoals)) g.activeGoals = [];
    var blank = defaultActiveGoal();
    g.activeGoals.forEach(function (goal) {
      Object.keys(blank).forEach(function (k) {
        if (k === 'id') return;
        if (!(k in goal)) goal[k] = (k === 'milestones' || k === 'actions') ? [] : blank[k];
      });
      if (!Array.isArray(goal.milestones)) goal.milestones = [];
      if (!Array.isArray(goal.actions)) goal.actions = [];
    });
    return g;
  }

  function save(g) { saveJSON(KEY, g); }

  window.Goals = {
    KEY: KEY,
    CATEGORIES: CATEGORIES,
    PRIORITIES: PRIORITIES,
    STATUSES: STATUSES,
    uid: uid,
    load: load,
    save: save,
    defaultActiveGoal: defaultActiveGoal,
  };
})();
