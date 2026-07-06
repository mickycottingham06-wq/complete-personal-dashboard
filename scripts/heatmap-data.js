// =============================================================
// Heatmap — shared data layer.
// Owns the `heatmap` localStorage key: a capped day-by-day history
// of completion scores plus per-day notes, keyed by date. Used by
// the full page at pages/heatmap.html and the preview card on
// index.html.
//
// Today's entry is derived live (never duplicated) from:
//   window.DailySnapshot  — habit completion, execution checklist flags
//   window.Streaks        — current streak
//   window.Boxing         — training log entries dated today
//   window.Business       — today's task
//   window.Goals          — active goal progress
//   the `goals:YYYY-MM-DD` daily to-do list keys
// Past days a user never opened the app for still show something
// meaningful — falls back to window.Streaks' own capped history
// (habit completion only) instead of a blank cell.
//
// Include this with a plain (non-defer) <script src="..."> tag,
// after scripts/daily-snapshot-data.js and scripts/streaks-data.js,
// BEFORE any inline script that calls window.Heatmap.
// =============================================================
(function () {
  'use strict';

  var KEY = 'heatmap';
  var HISTORY_LIMIT = 120; // covers the 90-day view plus buffer
  var VIEW_MODES = ['30', '60', '90'];
  var HEALTH_HABIT_IDS = ['water', 'sunlight', 'steps', 'protein', 'sleep'];

  function loadJSON(k, f) { try { return JSON.parse(localStorage.getItem(k)) || f; } catch (e) { return f; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // Same 6 AM rollover convention used across the dashboard.
  function activeDateKey() {
    var now = new Date();
    var d = new Date(now);
    if (now.getHours() < 6) d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function parseKey(key) { var p = key.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function keyFromDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function shiftKey(key, delta) { var d = parseKey(key); d.setDate(d.getDate() + delta); return keyFromDate(d); }

  function defaultHeatmap() {
    return { entries: [], selectedDate: activeDateKey(), viewMode: '30' };
  }

  function load() {
    var hm = loadJSON(KEY, null);
    if (!hm) { hm = defaultHeatmap(); saveJSON(KEY, hm); return hm; }
    if (!Array.isArray(hm.entries)) hm.entries = [];
    if (!hm.selectedDate) hm.selectedDate = activeDateKey();
    if (VIEW_MODES.indexOf(hm.viewMode) === -1) hm.viewMode = '30';
    return hm;
  }
  function save(hm) { saveJSON(KEY, hm); }

  function emptyDerived() {
    return { completionScore: 0, habitsCompleted: 0, habitsTotal: 0, trainingCompleted: false, businessTaskCompleted: false, healthRoutineCompleted: false, goalsWorkedOn: false };
  }

  // Reads today's state from every connected section defensively —
  // a missing section or empty data just contributes its zero/false
  // default rather than throwing.
  function computeTodayDerived(dateKey) {
    var snap = (window.DailySnapshot && window.DailySnapshot.loadOrInit) ? window.DailySnapshot.loadOrInit() : { habits: [], trainingCompleted: false, businessTaskCompleted: false, healthRoutineCompleted: false };
    var habits = Array.isArray(snap.habits) ? snap.habits : [];
    var habitsTotal = habits.length;
    var habitsCompleted = habits.filter(function (h) { return h.completed; }).length;

    var trainingCompleted = !!snap.trainingCompleted || habits.some(function (h) { return h.id === 'training' && h.completed; });
    if (!trainingCompleted && window.Boxing) {
      var box = window.Boxing.load();
      trainingCompleted = (box.trainingLog || []).some(function (t) { return t.date === dateKey; });
    }

    var businessTaskCompleted = !!snap.businessTaskCompleted;
    if (!businessTaskCompleted && window.Business) {
      var biz = window.Business.load();
      businessTaskCompleted = !!(biz.todayTask && biz.todayTask.trim());
    }

    var healthRoutineCompleted = !!snap.healthRoutineCompleted;
    if (!healthRoutineCompleted) {
      var healthHabits = habits.filter(function (h) { return HEALTH_HABIT_IDS.indexOf(h.id) !== -1; });
      if (healthHabits.length) {
        var doneCount = healthHabits.filter(function (h) { return h.completed; }).length;
        healthRoutineCompleted = (doneCount / healthHabits.length) >= 0.6;
      }
    }

    var goalsWorkedOn = false;
    var todayGoals = loadJSON('goals:' + dateKey, []);
    if (Array.isArray(todayGoals)) goalsWorkedOn = todayGoals.some(function (g) { return g && g.done; });
    if (!goalsWorkedOn && window.Goals) {
      var g = window.Goals.load();
      goalsWorkedOn = (g.activeGoals || []).some(function (x) { return (Number(x.progress) || 0) > 0 && x.status === 'In Progress'; });
    }

    var habitPct = habitsTotal ? (habitsCompleted / habitsTotal) * 100 : 0;
    var flags = [trainingCompleted, businessTaskCompleted, healthRoutineCompleted, goalsWorkedOn];
    var activityPct = (flags.filter(Boolean).length / flags.length) * 100;
    var completionScore = Math.round((habitPct + activityPct) / 2);

    return {
      completionScore: completionScore,
      habitsCompleted: habitsCompleted,
      habitsTotal: habitsTotal,
      trainingCompleted: trainingCompleted,
      businessTaskCompleted: businessTaskCompleted,
      healthRoutineCompleted: healthRoutineCompleted,
      goalsWorkedOn: goalsWorkedOn,
    };
  }

  // Best-effort fallback for a past day the Heatmap never captured —
  // reads Streaks' own capped history instead of showing a blank cell.
  function deriveFromStreaksHistory(dateKey) {
    if (!window.Streaks) return null;
    var s = window.Streaks.get();
    var hist = (s.history || []).find(function (e) { return e.date === dateKey; });
    if (!hist) return null;
    var habitsArr = Array.isArray(hist.habits) ? hist.habits : [];
    return {
      completionScore: Math.round(Number(hist.completionPercentage) || 0),
      habitsCompleted: habitsArr.filter(function (h) { return h.completed; }).length,
      habitsTotal: habitsArr.length,
      trainingCompleted: habitsArr.some(function (h) { return h.id === 'training' && h.completed; }),
      businessTaskCompleted: false,
      healthRoutineCompleted: false,
      goalsWorkedOn: false,
    };
  }

  function capHistory(hm) {
    hm.entries.sort(function (a, b) { return a.date.localeCompare(b.date); });
    if (hm.entries.length > HISTORY_LIMIT) hm.entries = hm.entries.slice(-HISTORY_LIMIT);
  }

  // Pure read for any date — checks stored entries first, then falls
  // back to a live derivation (today) or Streaks history (past days),
  // then a safe empty default. Never writes to storage.
  function getEntry(dateKey) {
    var hm = load();
    var existing = hm.entries.find(function (e) { return e.date === dateKey; });
    if (existing) return existing;

    var derived = dateKey === activeDateKey() ? computeTodayDerived(dateKey) : deriveFromStreaksHistory(dateKey);
    if (!derived) derived = emptyDerived();
    var out = { id: '', date: dateKey, notes: '' };
    Object.keys(derived).forEach(function (k) { out[k] = derived[k]; });
    return out;
  }

  // Recomputes and persists today's entry, preserving any notes
  // already saved for today. Past entries are never rewritten.
  function recompute() {
    var hm = load();
    var todayKey = activeDateKey();
    var idx = hm.entries.findIndex(function (e) { return e.date === todayKey; });
    var derived = computeTodayDerived(todayKey);

    if (idx >= 0) {
      var notes = hm.entries[idx].notes || '';
      var id = hm.entries[idx].id || uid();
      hm.entries[idx] = { id: id, date: todayKey, notes: notes };
      Object.keys(derived).forEach(function (k) { hm.entries[idx][k] = derived[k]; });
    } else {
      var entry = { id: uid(), date: todayKey, notes: '' };
      Object.keys(derived).forEach(function (k) { entry[k] = derived[k]; });
      hm.entries.push(entry);
    }
    capHistory(hm);
    save(hm);
    return getEntry(todayKey);
  }

  // Saves/updates the note for any date, backfilling derived stats
  // from getEntry() if that date has no stored entry yet.
  function setNotes(dateKey, text) {
    var hm = load();
    var idx = hm.entries.findIndex(function (e) { return e.date === dateKey; });
    if (idx >= 0) {
      hm.entries[idx].notes = text;
    } else {
      var base = getEntry(dateKey);
      base.id = uid();
      base.notes = text;
      hm.entries.push(base);
    }
    capHistory(hm);
    save(hm);
  }

  function setSelectedDate(dateKey) {
    var hm = load();
    hm.selectedDate = dateKey;
    save(hm);
  }

  function setViewMode(mode) {
    if (VIEW_MODES.indexOf(mode) === -1) return;
    var hm = load();
    hm.viewMode = mode;
    save(hm);
  }

  // Oldest → newest list of { date, entry } for the last `days` days
  // (inclusive of today). Pure read — does not persist anything, so
  // rendering a wide grid never spams localStorage writes.
  function getRange(days) {
    var todayKey = activeDateKey();
    var out = [];
    for (var i = days - 1; i >= 0; i--) {
      var key = shiftKey(todayKey, -i);
      out.push({ date: key, entry: getEntry(key) });
    }
    return out;
  }

  // Convenience stats for the compact preview card: today's score,
  // this week's average, and the best day this week.
  function computeWeekStats() {
    var week = getRange(7);
    var todayScore = week[week.length - 1].entry.completionScore;
    var weekAvg = Math.round(week.reduce(function (sum, d) { return sum + d.entry.completionScore; }, 0) / week.length);
    var best = week.reduce(function (b, d) { return d.entry.completionScore > b.entry.completionScore ? d : b; }, week[0]);
    var currentStreak = window.Streaks ? (Number(window.Streaks.get().currentStreak) || 0) : 0;
    return { todayScore: todayScore, weekAvg: weekAvg, bestDay: { date: best.date, score: best.entry.completionScore }, currentStreak: currentStreak };
  }

  window.Heatmap = {
    KEY: KEY,
    VIEW_MODES: VIEW_MODES,
    activeDateKey: activeDateKey,
    uid: uid,
    get: function () { return load(); },
    recompute: recompute,
    getEntry: getEntry,
    getRange: getRange,
    setNotes: setNotes,
    setSelectedDate: setSelectedDate,
    setViewMode: setViewMode,
    computeWeekStats: computeWeekStats,
  };
})();
