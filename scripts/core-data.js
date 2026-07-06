// =============================================================
// Life OS shared "core" data layer.
// Owns the `core` localStorage key: app-wide settings (currency)
// plus a read-only aggregated snapshot pulled live from every other
// section (Health, Boxing, Business, Daily Snapshot, Streaks, Goals).
// Nothing here duplicates another section's data — it only reads it,
// same pattern as window.LifeStats.computeStats() / window.Heatmap.
//
// setCurrentWeight() is the one exception: it writes weight into
// BOTH Health and Boxing so the two never drift apart, since both
// sections track the same physical value.
// =============================================================
(function () {
  'use strict';

  var KEY = 'core';

  function loadJSON(k, f) { try { return JSON.parse(localStorage.getItem(k)) || f; } catch (e) { return f; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function defaultCore() {
    return {
      currency: 'GBP',
      lastUpdated: '',
    };
  }

  // Reads core settings, filling in any missing fields against the
  // default shape so older saved data upgrades cleanly.
  function load() {
    var c = loadJSON(KEY, null);
    if (!c) { c = defaultCore(); saveJSON(KEY, c); return c; }
    var d = defaultCore();
    Object.keys(d).forEach(function (k) { if (!(k in c)) c[k] = d[k]; });
    return c;
  }

  function save(c) {
    c.lastUpdated = new Date().toISOString();
    saveJSON(KEY, c);
    return c;
  }

  // Read-only aggregated snapshot for anything that wants a single
  // "how's everything doing" view (Command Centre top bar, future
  // Money HQ, etc). Every value here is owned by another section —
  // this never persists its own copy.
  function getSnapshot() {
    var core = load();
    var health = (window.Health && window.Health.load) ? window.Health.load() : {};
    var boxing = (window.Boxing && window.Boxing.load) ? window.Boxing.load() : {};
    var business = (window.Business && window.Business.load) ? window.Business.load() : {};
    var snap = (window.DailySnapshot && window.DailySnapshot.loadOrInit) ? window.DailySnapshot.loadOrInit() : {};
    var streaks = (window.Streaks && window.Streaks.recompute) ? window.Streaks.recompute() : null;
    var goals = (window.Goals && window.Goals.load) ? window.Goals.load() : {};
    var activeGoals = goals.activeGoals || [];

    return {
      currency: core.currency || 'GBP',
      currentWeight: Number(boxing.currentWeight) || Number(health.currentWeight) || 0,
      targetWeight: Number(boxing.targetWeight) || 0,
      dailyCompletion: streaks ? Math.round(streaks.pct * 100) : 0,
      currentStreak: streaks ? streaks.data.currentStreak : 0,
      mainFocus: (snap.mainFocus || '').trim(),
      activeGoal: (activeGoals[0] && activeGoals[0].title) || '',
      businessFocus: (business.currentFocus || '').trim(),
      healthStatus: snap.healthRoutineCompleted ? 'Health routine done' : '',
      trainingStatus: snap.trainingCompleted ? 'Training done' : '',
      tomorrowPriority: (snap.tomorrowPriority || '').trim(),
      dayScore: Number(snap.dayScore) || 0,
      lastUpdated: core.lastUpdated || '',
    };
  }

  // Keeps Health.currentWeight and Boxing.currentWeight in sync — whichever
  // page the user edits weight on, the other section picks up the same
  // number on next load instead of drifting into two different numbers.
  function setCurrentWeight(kg) {
    var w = Number(kg);
    if (!(w > 0)) return;
    if (window.Health && window.Health.load && window.Health.save) {
      var h = window.Health.load();
      h.currentWeight = w;
      window.Health.save(h);
    }
    if (window.Boxing && window.Boxing.load && window.Boxing.save) {
      var b = window.Boxing.load();
      b.currentWeight = w;
      window.Boxing.save(b);
    }
    save(load());
  }

  window.Core = { load: load, save: save, getSnapshot: getSnapshot, setCurrentWeight: setCurrentWeight };
})();
