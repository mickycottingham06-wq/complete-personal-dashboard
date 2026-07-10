// =============================================================
// Life Stats — shared data layer.
// Owns the `lifeStats` localStorage key: manual scores, weekly
// wins/lessons, areas needing attention, and notes. Any page (Life
// Stats itself, the preview card on index.html) reads/writes
// through this file instead of touching localStorage directly, so
// they always agree.
//
// computeStats() is the analytics half: it reads (never duplicates)
// existing data from Streaks, Goals, Business, Boxing, Health and
// Appearance to build a cross-Life-OS snapshot. Every read is
// defensive — if a connected section's script isn't loaded on the
// page, or has no data yet, computeStats() falls back to safe zero
// defaults instead of throwing.
//
// Include this with a plain (non-defer) <script src="..."> tag
// BEFORE any inline script that calls window.LifeStats, so it is
// guaranteed to be ready by the time it's used.
// =============================================================
(function () {
  'use strict';

  var KEY = 'lifeStats';

  function loadJSON(k, f) { try { return JSON.parse(localStorage.getItem(k)) || f; } catch (e) { return f; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function defaultLifeStats() {
    return {
      overallScore: 5,
      productivityScore: 5,
      healthScore: 5,
      boxingScore: 5,
      businessScore: 5,
      goalsScore: 5,
      appearanceScore: 5,
      weeklyWins: [],
      weeklyLessons: [],
      areasNeedingAttention: [],
      notes: '',
    };
  }

  // Reads Life Stats manual data, filling in any missing fields
  // against the default shape so older saved data upgrades cleanly.
  function load() {
    var ls = loadJSON(KEY, null);
    if (!ls) { ls = defaultLifeStats(); saveJSON(KEY, ls); return ls; }
    var d = defaultLifeStats();
    Object.keys(d).forEach(function (k) { if (!(k in ls)) ls[k] = d[k]; });
    if (!Array.isArray(ls.weeklyWins)) ls.weeklyWins = d.weeklyWins;
    if (!Array.isArray(ls.weeklyLessons)) ls.weeklyLessons = d.weeklyLessons;
    if (!Array.isArray(ls.areasNeedingAttention)) ls.areasNeedingAttention = d.areasNeedingAttention;
    return ls;
  }

  function save(ls) { saveJSON(KEY, ls); }

  // Cross-section analytics, computed live from other Life OS data
  // rather than duplicated here. Safe zero/empty defaults whenever a
  // connected section has no data yet.
  function computeStats() {
    var out = {
      currentStreak: 0, bestStreak: 0, habitPct: 0,
      goalsAvgProgress: 0, goalsCount: 0,
      revenueCurrent: 0, revenueTarget: 0, revenuePct: 0,
      boxingCompleted: 0, boxingTarget: 0, boxingPct: 0,
      sleepHours: 0, recoveryScore: 0, hydrationLiters: 0, energyLevel: 0,
      weightCurrent: 0, weightTarget: 0,
      looksScore: 0, skinScore: 0,
      netWorth: 0, monthlySavings: 0, savingsRate: 0,
    };

    if (window.Streaks) {
      var s = window.Streaks.get();
      out.currentStreak = Number(s.currentStreak) || 0;
      out.bestStreak = Number(s.bestStreak) || 0;
      var history = s.history || [];
      var today = history.length ? history[history.length - 1] : null;
      out.habitPct = today ? Math.round(Number(today.completionPercentage) || 0) : 0;
    }

    if (window.Goals) {
      var g = window.Goals.load();
      var active = g.activeGoals || [];
      out.goalsCount = active.length;
      out.goalsAvgProgress = active.length
        ? Math.round(active.reduce(function (sum, x) { return sum + (Number(x.progress) || 0); }, 0) / active.length)
        : 0;
    }

    if (window.Business) {
      var biz = window.Business.load();
      out.revenueCurrent = Number(biz.currentRevenue) || 0;
      out.revenueTarget = Number(biz.revenueTarget) || 0;
      out.revenuePct = out.revenueTarget > 0 ? Math.min(100, Math.round((out.revenueCurrent / out.revenueTarget) * 100)) : 0;
    }

    if (window.Boxing) {
      var box = window.Boxing.load();
      out.boxingCompleted = Number(box.completedBoxingSessions) || 0;
      out.boxingTarget = Number(box.weeklyBoxingTarget) || 0;
      out.boxingPct = out.boxingTarget > 0 ? Math.min(100, Math.round((out.boxingCompleted / out.boxingTarget) * 100)) : 0;
      out.weightCurrent = Number(box.currentWeight) || 0;
      out.weightTarget = Number(box.targetWeight) || 0;
    }

    if (window.Health) {
      var h = window.Health.load();
      out.sleepHours = Number(h.lastNightSleep) || 0;
      out.recoveryScore = Number(h.recoveryScore) || 0;
      out.hydrationLiters = Number(h.waterIntake) || 0;
      out.energyLevel = Number(h.energyLevel) || 0;
    }

    if (window.Appearance) {
      var a = window.Appearance.load();
      out.looksScore = Number(a.looksScore) || 0;
      out.skinScore = Number(a.skinScore) || 0;
    }

    if (window.Money && window.Money.computeSummary) {
      var m = window.Money.computeSummary();
      out.netWorth = Number(m.netWorth) || 0;
      out.monthlySavings = Number(m.monthlySavings) || 0;
      out.savingsRate = Number(m.savingsRate) || 0;
    }

    if (window.Training && window.Training.computeLifeStatsSummary) {
      var tr = window.Training.computeLifeStatsSummary();
      out.trainingConsistency = Number(tr.trainingConsistency) || 0;
      out.strengthTrend = tr.strengthTrend;
      out.mobilityTrend = tr.mobilityTrend;
    }

    return out;
  }

  window.LifeStats = {
    KEY: KEY,
    uid: uid,
    load: load,
    save: save,
    computeStats: computeStats,
  };
})();
