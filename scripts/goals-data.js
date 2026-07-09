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
      progressMode: 'auto',   // 'auto' = derived from milestones/actions when any exist, 'manual' = user override wins
      deadline: '',
      milestones: [],
      actions: [],
      notes: '',
    };
  }

  // Ratio of completed milestones+actions, 0-100. Returns null when a goal
  // has none (nothing to derive from — caller should fall back to the
  // manually-set progress in that case).
  function computeAutoProgress(goal) {
    var milestones = goal.milestones || [];
    var actions = goal.actions || [];
    var total = milestones.length + actions.length;
    if (total === 0) return null;
    var done = milestones.filter(function (m) { return m.completed; }).length +
      actions.filter(function (a) { return a.completed; }).length;
    return Math.round((done / total) * 100);
  }

  // Keeps goal.progress in sync with milestone/action completion for goals
  // still in 'auto' mode. Goals with progressMode 'manual', or with no
  // milestones/actions yet, are left exactly as the user set them.
  function recomputeGoal(goal) {
    if (goal.progressMode !== 'manual') {
      var auto = computeAutoProgress(goal);
      if (auto !== null) goal.progress = auto;
    }
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
    var dirty = false;
    g.activeGoals.forEach(function (goal) {
      Object.keys(blank).forEach(function (k) {
        if (k === 'id') return;
        if (!(k in goal)) goal[k] = (k === 'milestones' || k === 'actions') ? [] : blank[k];
      });
      if (!Array.isArray(goal.milestones)) goal.milestones = [];
      if (!Array.isArray(goal.actions)) goal.actions = [];
      var before = goal.progress;
      recomputeGoal(goal);
      if (goal.progress !== before) dirty = true;
    });
    if (dirty) saveJSON(KEY, g);
    return g;
  }

  function save(g) {
    (g.activeGoals || []).forEach(recomputeGoal);
    saveJSON(KEY, g);
  }

  window.Goals = {
    KEY: KEY,
    CATEGORIES: CATEGORIES,
    PRIORITIES: PRIORITIES,
    STATUSES: STATUSES,
    uid: uid,
    load: load,
    save: save,
    defaultActiveGoal: defaultActiveGoal,
    computeAutoProgress: computeAutoProgress,
    recomputeGoal: recomputeGoal,
  };
})();
