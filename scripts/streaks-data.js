// =============================================================
// Streaks — shared data layer.
// Owns the `streaks` localStorage key. Reads today's habits from
// window.DailySnapshot (never owns habit completion itself),
// recomputes current/best streak + weekly + per-habit history,
// and persists the result. Used by the Streaks page and by the
// compact preview card on the main dashboard.
//
// Depends on scripts/daily-snapshot-data.js — include that first.
// Include this with a plain (non-defer) <script src="..."> tag
// BEFORE any inline script that calls window.Streaks.
// =============================================================
(function () {
  'use strict';

  var STREAKS_KEY = 'streaks';
  var COMPLETION_THRESHOLD = 0.70; // >=70% of today's habits counts the day as "completed"
  var HISTORY_LIMIT = 90;          // cap stored history so localStorage never grows unbounded

  function loadJSON(k, f) { try { return JSON.parse(localStorage.getItem(k)) || f; } catch (e) { return f; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function activeDateKey() { return window.DailySnapshot.activeDateKey(); }
  function parseKey(key) { var p = key.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function keyFromDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function shiftKey(key, delta) { var d = parseKey(key); d.setDate(d.getDate() + delta); return keyFromDate(d); }

  function defaultStreaks() {
    return { currentStreak: 0, bestStreak: 0, lastCompletedDate: '', weeklyCompletions: [], habits: [], history: [] };
  }

  // Walks backwards day-by-day from today counting consecutive completed days.
  // If today isn't completed yet it's given the benefit of the doubt (the day
  // isn't over), so the streak only breaks once a day is actually missed.
  function computeStreak(dayMap, todayKey) {
    var streak = 0;
    var cursor;
    var todayEntry = dayMap.get(todayKey);
    if (todayEntry && todayEntry.completed) { streak = 1; cursor = shiftKey(todayKey, -1); }
    else { cursor = shiftKey(todayKey, -1); }
    while (true) {
      var entry = dayMap.get(cursor);
      if (entry && entry.completed) { streak++; cursor = shiftKey(cursor, -1); }
      else break;
    }
    return streak;
  }

  // Recomputes streak state from today's Daily Snapshot habits and persists
  // it. Returns { data, pct, completedToday, todayKey, isNewBest } so callers
  // (full Streaks page, preview card) can render without recalculating.
  function recompute() {
    var snap = window.DailySnapshot.loadOrInit();
    var habits = Array.isArray(snap.habits) ? snap.habits : [];
    var todayKey = activeDateKey();
    var total = habits.length;
    var done = habits.filter(function (h) { return h.completed; }).length;
    var pct = total ? done / total : 0;
    var completedToday = total > 0 && pct >= COMPLETION_THRESHOLD;

    var data = loadJSON(STREAKS_KEY, defaultStreaks());
    if (!Array.isArray(data.history)) data.history = [];
    if (!Array.isArray(data.habits)) data.habits = [];

    var todayEntry = {
      date: todayKey,
      completed: completedToday,
      completionPercentage: Math.round(pct * 100),
      habits: habits.map(function (h) { return { id: h.id, label: h.label, completed: !!h.completed }; }),
    };
    var existingIdx = data.history.findIndex(function (e) { return e.date === todayKey; });
    if (existingIdx >= 0) data.history[existingIdx] = todayEntry;
    else data.history.push(todayEntry);
    data.history.sort(function (a, b) { return a.date.localeCompare(b.date); });
    if (data.history.length > HISTORY_LIMIT) data.history = data.history.slice(-HISTORY_LIMIT);

    var dayMap = new Map(data.history.map(function (e) { return [e.date, e]; }));
    var prevBest = data.bestStreak || 0;
    var currentStreak = computeStreak(dayMap, todayKey);
    var bestStreak = Math.max(prevBest, currentStreak);

    var lastCompletedDate = '';
    for (var i = data.history.length - 1; i >= 0; i--) {
      if (data.history[i].completed) { lastCompletedDate = data.history[i].date; break; }
    }

    var weeklyCompletions = [];
    for (var d = 6; d >= 0; d--) {
      var key = shiftKey(todayKey, -d);
      var entry = dayMap.get(key);
      weeklyCompletions.push({ date: key, completed: !!(entry && entry.completed), completionPercentage: entry ? entry.completionPercentage : 0 });
    }

    var prevHabitsById = new Map(data.habits.map(function (h) { return [h.id, h]; }));
    var perHabit = habits.map(function (h) {
      var habitDayMap = new Map();
      data.history.forEach(function (e) {
        var match = Array.isArray(e.habits) ? e.habits.find(function (x) { return x.id === h.id; }) : null;
        habitDayMap.set(e.date, { completed: !!(match && match.completed) });
      });
      var prev = prevHabitsById.get(h.id);
      var hCurrent = computeStreak(habitDayMap, todayKey);
      var hBest = Math.max(prev ? prev.bestStreak || 0 : 0, hCurrent);
      return { id: h.id, label: h.label, currentStreak: hCurrent, bestStreak: hBest, completedToday: !!h.completed };
    });

    var isNewBest = currentStreak > prevBest && currentStreak > 0;

    data.currentStreak = currentStreak;
    data.bestStreak = bestStreak;
    data.lastCompletedDate = lastCompletedDate;
    data.weeklyCompletions = weeklyCompletions;
    data.habits = perHabit;
    saveJSON(STREAKS_KEY, data);

    return { data: data, pct: pct, completedToday: completedToday, todayKey: todayKey, isNewBest: isNewBest };
  }

  window.Streaks = {
    KEY: STREAKS_KEY,
    COMPLETION_THRESHOLD: COMPLETION_THRESHOLD,
    get: function () { return loadJSON(STREAKS_KEY, defaultStreaks()); },
    recompute: recompute,
  };
})();
