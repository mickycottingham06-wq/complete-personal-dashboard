// =============================================================
// Weekly Review — shared data layer.
// Owns the `weeklyReview` localStorage key: the current week's
// summary, reflection answers, next-week plan, and generated AI
// prompt. Used by pages/weekly-review.html and the preview card on
// index.html.
//
// computePerformance() is the analytics half: it reads (never
// duplicates) existing data from Streaks, Boxing, Business, Money,
// Health, Goals and Heatmap to build a cross-Life-OS weekly
// snapshot. Every read is defensive — if a connected section's
// script isn't loaded, or has no data yet, computePerformance()
// falls back to safe zero defaults instead of throwing.
//
// generatePrompt() is a pure function that builds copy-paste prompt
// text from the current review + a live computePerformance() read.
// No AI API is called here — same "prompt builder, not a live
// integration" pattern as window.AiCeo.
//
// Include this with a plain (non-defer) <script src="..."> tag,
// AFTER streaks-data.js / boxing-data.js / business-data.js /
// money-data.js / health-data.js / goals-data.js / heatmap-data.js
// and BEFORE any inline script that calls window.WeeklyReview.
// =============================================================
(function () {
  'use strict';

  var KEY = 'weeklyReview';

  function loadJSON(k, f) { try { return JSON.parse(localStorage.getItem(k)) || f; } catch (e) { return f; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function pad(n) { return String(n).padStart(2, '0'); }
  function keyFromDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  // Same 6 AM rollover convention used across the dashboard (Daily
  // Snapshot / Streaks / Heatmap / goals:) for deciding "today".
  function activeDate() {
    var now = new Date();
    var d = new Date(now);
    if (now.getHours() < 6) d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Monday → Sunday range containing the given date.
  function weekRangeFor(d) {
    var day = d.getDay(); // 0 = Sun ... 6 = Sat
    var diffToMonday = (day === 0 ? -6 : 1 - day);
    var monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    var sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: keyFromDate(monday), end: keyFromDate(sunday) };
  }

  function currentWeekRange() { return weekRangeFor(activeDate()); }

  function defaultWeeklyReview() {
    var range = currentWeekRange();
    return {
      weekStart: range.start,
      weekEnd: range.end,
      overallScore: 5,
      mainWin: '',
      mainLesson: '',
      mainProblem: '',
      nextWeekFocus: '',
      wentWell: '',
      slipped: '',
      learned: '',
      needsChange: '',
      stopDoing: '',
      doubleDown: '',
      priorities: [],
      targets: { business: '', boxing: '', health: '', money: '', personal: '' },
      generatedPrompt: '',
      notes: '',
    };
  }

  // Reads Weekly Review data, filling in any missing fields against
  // the default shape (schema upgrade), and starts a fresh review
  // once the stored week has ended — same rollover pattern as
  // window.DailySnapshot, just weekly instead of daily. Past answers
  // are not archived; this mirrors Daily Snapshot's single-current
  // record design rather than adding a new history concept.
  function loadOrInit() {
    var wr = loadJSON(KEY, null);
    var range = currentWeekRange();

    if (!wr) { wr = defaultWeeklyReview(); saveJSON(KEY, wr); return wr; }

    var d = defaultWeeklyReview();
    Object.keys(d).forEach(function (k) { if (!(k in wr)) wr[k] = d[k]; });
    if (!Array.isArray(wr.priorities)) wr.priorities = [];
    if (!wr.targets || typeof wr.targets !== 'object') wr.targets = d.targets;
    Object.keys(d.targets).forEach(function (k) { if (!(k in wr.targets)) wr.targets[k] = d.targets[k]; });

    if (wr.weekEnd !== range.end) {
      wr = defaultWeeklyReview();
      saveJSON(KEY, wr);
      return wr;
    }

    saveJSON(KEY, wr);
    return wr;
  }

  function save(wr) { saveJSON(KEY, wr); }

  // Cross-section analytics, computed live from other Life OS data
  // rather than duplicated here. Safe zero/empty defaults whenever a
  // connected section has no data yet.
  function computePerformance() {
    var out = {
      habitPct: 0, currentStreak: 0, weeklyHabitAvg: 0,
      boxingCompleted: 0, boxingTarget: 0, boxingPct: 0,
      revenueCurrent: 0, revenueTarget: 0, revenuePct: 0,
      netWorth: 0, monthlyIncome: 0, monthlySpending: 0, monthlySavings: 0, savingsRate: 0,
      sleepHours: 0, recoveryScore: 0, energyLevel: 0, hydrationLiters: 0,
      goalsCount: 0, goalsAvgProgress: 0,
      heatmapWeekAvg: 0, heatmapCurrentStreak: 0,
    };

    if (window.Streaks) {
      var s = window.Streaks.recompute();
      out.currentStreak = Number(s.data.currentStreak) || 0;
      out.habitPct = Math.round((Number(s.pct) || 0) * 100);
      var week = s.data.weeklyCompletions || [];
      out.weeklyHabitAvg = week.length
        ? Math.round(week.reduce(function (sum, x) { return sum + (Number(x.completionPercentage) || 0); }, 0) / week.length)
        : 0;
    }

    if (window.Boxing) {
      var box = window.Boxing.load();
      out.boxingCompleted = Number(box.completedBoxingSessions) || 0;
      out.boxingTarget = Number(box.weeklyBoxingTarget) || 0;
      out.boxingPct = out.boxingTarget > 0 ? Math.min(100, Math.round((out.boxingCompleted / out.boxingTarget) * 100)) : 0;
    }

    if (window.Business) {
      var biz = window.Business.load();
      out.revenueCurrent = Number(biz.currentRevenue) || 0;
      out.revenueTarget = Number(biz.revenueTarget) || 0;
      out.revenuePct = out.revenueTarget > 0 ? Math.min(100, Math.round((out.revenueCurrent / out.revenueTarget) * 100)) : 0;
    }

    if (window.Money && window.Money.computeSummary) {
      var m = window.Money.computeSummary();
      out.netWorth = Number(m.netWorth) || 0;
      out.monthlyIncome = Number(m.monthlyIncome) || 0;
      out.monthlySpending = Number(m.monthlySpending) || 0;
      out.monthlySavings = Number(m.monthlySavings) || 0;
      out.savingsRate = Number(m.savingsRate) || 0;
    }

    if (window.Health) {
      var h = window.Health.load();
      out.sleepHours = Number(h.lastNightSleep) || 0;
      out.recoveryScore = Number(h.recoveryScore) || 0;
      out.energyLevel = Number(h.energyLevel) || 0;
      out.hydrationLiters = Number(h.waterIntake) || 0;
    }

    if (window.Goals) {
      var g = window.Goals.load();
      var active = g.activeGoals || [];
      out.goalsCount = active.length;
      out.goalsAvgProgress = active.length
        ? Math.round(active.reduce(function (sum, x) { return sum + (Number(x.progress) || 0); }, 0) / active.length)
        : 0;
    }

    if (window.Heatmap && window.Heatmap.computeWeekStats) {
      var hm = window.Heatmap.computeWeekStats();
      out.heatmapWeekAvg = Number(hm.weekAvg) || 0;
      out.heatmapCurrentStreak = Number(hm.currentStreak) || 0;
    }

    return out;
  }

  function fmtMoney(n) {
    var v = Number(n) || 0;
    return '£' + v.toLocaleString('en-GB', { maximumFractionDigits: 0 });
  }

  // Builds the copy-paste weekly review prompt from the current
  // review state plus a live performance read. Pure function — no
  // side effects, no network request.
  function generatePrompt(wr) {
    var p = computePerformance();
    var lines = [];

    lines.push('You are my weekly reviewer and life coach. Review my week using the data below, identify patterns, give me direct honest feedback, and suggest next week\'s priorities with a simple action plan.');
    lines.push('');
    lines.push('Week: ' + (wr.weekStart || '—') + ' to ' + (wr.weekEnd || '—'));
    lines.push('Overall week score: ' + (Number(wr.overallScore) || 0) + '/10');
    lines.push('');
    lines.push('Summary:');
    lines.push('- Main win: ' + (wr.mainWin || 'Not set'));
    lines.push('- Main lesson: ' + (wr.mainLesson || 'Not set'));
    lines.push('- Main problem: ' + (wr.mainProblem || 'Not set'));
    lines.push('');
    lines.push('Reflection:');
    lines.push('- What went well: ' + (wr.wentWell || 'Not set'));
    lines.push('- What slipped: ' + (wr.slipped || 'Not set'));
    lines.push('- What I learned: ' + (wr.learned || 'Not set'));
    lines.push('- What needs to change: ' + (wr.needsChange || 'Not set'));
    lines.push('- What I should stop doing: ' + (wr.stopDoing || 'Not set'));
    lines.push('- What I should double down on: ' + (wr.doubleDown || 'Not set'));
    lines.push('');
    lines.push('Performance snapshot (live from the Life OS):');
    lines.push('- Habit completion today: ' + p.habitPct + '%, weekly average: ' + p.weeklyHabitAvg + '%, current streak: ' + p.currentStreak + ' days');
    lines.push('- Boxing/training: ' + p.boxingCompleted + ' of ' + p.boxingTarget + ' sessions this week (' + p.boxingPct + '%)');
    lines.push('- Business revenue: ' + fmtMoney(p.revenueCurrent) + ' of ' + fmtMoney(p.revenueTarget) + ' target (' + p.revenuePct + '%)');
    lines.push('- Money: net worth ' + fmtMoney(p.netWorth) + ', income ' + fmtMoney(p.monthlyIncome) + ', spending ' + fmtMoney(p.monthlySpending) + ', savings rate ' + p.savingsRate + '%');
    lines.push('- Health: last night\'s sleep ' + p.sleepHours + 'h, recovery ' + p.recoveryScore + ', energy ' + p.energyLevel + '/10, hydration ' + p.hydrationLiters + 'L');
    lines.push('- Goals: ' + p.goalsCount + ' active, average progress ' + p.goalsAvgProgress + '%');
    lines.push('- Heatmap weekly consistency average: ' + p.heatmapWeekAvg + '/100');
    lines.push('');
    lines.push('Next week:');
    lines.push('- Main focus: ' + (wr.nextWeekFocus || 'Not set'));
    var priorities = (wr.priorities || []).filter(function (x) { return x.text; });
    lines.push('- Top priorities: ' + (priorities.length ? priorities.map(function (x) { return x.text; }).join('; ') : 'None set'));
    lines.push('- Business target: ' + (wr.targets.business || 'Not set'));
    lines.push('- Boxing/training target: ' + (wr.targets.boxing || 'Not set'));
    lines.push('- Health target: ' + (wr.targets.health || 'Not set'));
    lines.push('- Money target: ' + (wr.targets.money || 'Not set'));
    lines.push('- Personal target: ' + (wr.targets.personal || 'Not set'));
    lines.push('');
    lines.push('Give me:');
    lines.push('1. The patterns you notice in this data');
    lines.push('2. Direct, honest feedback on this week');
    lines.push('3. Next week\'s top priorities (max 3)');
    lines.push('4. A simple day-by-day action plan for next week');
    lines.push('5. One thing to stop doing and one thing to double down on');

    return lines.join('\n');
  }

  window.WeeklyReview = {
    KEY: KEY,
    uid: uid,
    loadOrInit: loadOrInit,
    save: save,
    computePerformance: computePerformance,
    generatePrompt: generatePrompt,
  };
})();
