// =============================================================
// Daily Guidance Engine — read/compute layer, not a new source of truth.
// Owns no localStorage key of its own. computeGuidance() reads (never
// duplicates) existing Business, Boxing HQ, Goals and Health data plus
// today's Daily Snapshot and its archived history (window.DailySnapshot
// .getHistory()), and derives today's suggested plan: todayFocus,
// businessTask, trainingTask, goalAction, healthReminder, nudges. History
// is used for three light, deterministic signals: yesterday's unfinished
// priorities surface as a "Carry over" nudge, yesterday's tomorrowPriority
// can become today's focus theme, and a rough yesterday (low dayScore/
// energy or high stress) biases the focus theme toward recovery alongside
// the existing live-Health recovery check. No AI, no NLP — plain field
// reads and string joins only.
// Same defensive pattern as window.LifeStats.computeStats() — every read
// checks the section script is loaded first, falling back to '' / []
// instead of throwing.
//
// Deterministic local logic only. No AI API, no server calls.
//
// applyDefaultsToSnapshot(snap, guidance) is the only function that writes
// anything, and only into an already-loaded Daily Snapshot object passed
// in by the caller — it fills mainFocus / priorities ONLY when they are
// still blank, and never touches a field the user has already typed into.
// Callers are responsible for saving the snapshot via window.DailySnapshot
// if this returns true.
//
// Include this with a plain (non-defer) <script src="..."> tag AFTER
// scripts/business-data.js, boxing-data.js, goals-data.js, health-data.js
// and daily-snapshot-data.js, so window.DailyGuidance can read all of them.
// =============================================================
(function () {
  'use strict';

  function parseDateKey(key) {
    if (!key) return null;
    var p = key.split('-').map(Number);
    if (p.length !== 3 || p.some(isNaN)) return null;
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function daysUntil(dateKey) {
    var target = parseDateKey(dateKey);
    if (!target) return null;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
  }

  var PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };

  // Highest-priority active project name, else business.currentFocus,
  // else business.todayTask. Business HQ's own data is only ever read here.
  function computeBusinessTask(b) {
    if (!b) return '';
    var active = (b.projects || []).filter(function (p) {
      return p.status === 'Active' && p.name && p.name.trim();
    });
    if (active.length) {
      active.sort(function (a, c) {
        var pa = PRIORITY_ORDER[a.priority] != null ? PRIORITY_ORDER[a.priority] : 1;
        var pc = PRIORITY_ORDER[c.priority] != null ? PRIORITY_ORDER[c.priority] : 1;
        return pa - pc;
      });
      return 'Push forward: ' + active[0].name.trim();
    }
    if (b.currentFocus && b.currentFocus.trim()) return b.currentFocus.trim();
    if (b.todayTask && b.todayTask.trim()) return b.todayTask.trim();
    return '';
  }

  // Whichever weekly target (boxing / runs / strength) is furthest behind,
  // else nextSessionPlan, else trainingPhase.
  function computeTrainingTask(bx) {
    if (!bx) return '';
    var areas = [
      { label: 'boxing session', target: Number(bx.weeklyBoxingTarget) || 0, done: Number(bx.completedBoxingSessions) || 0 },
      { label: 'run', target: Number(bx.weeklyRunTarget) || 0, done: Number(bx.completedRuns) || 0 },
      { label: 'strength session', target: Number(bx.weeklyStrengthTarget) || 0, done: Number(bx.completedStrengthSessions) || 0 },
    ].filter(function (a) { return a.target > 0; });

    if (areas.length) {
      areas.sort(function (a, c) { return (c.target - c.done) - (a.target - a.done); });
      var worst = areas[0];
      if (worst.target - worst.done > 0) {
        return 'Get a ' + worst.label + ' in — ' + worst.done + '/' + worst.target + ' this week';
      }
    }
    if (bx.nextSessionPlan && bx.nextSessionPlan.trim()) return bx.nextSessionPlan.trim();
    if (bx.trainingPhase && bx.trainingPhase.trim()) return bx.trainingPhase.trim() + ' — stay on plan';
    return '';
  }

  // First incomplete action from the highest-priority / nearest-deadline
  // active (not yet Achieved) goal. Never marks anything complete.
  function nextGoalWithAction(g) {
    if (!g) return null;
    var active = (g.activeGoals || []).filter(function (x) { return x.status !== 'Achieved'; });
    active.sort(function (a, c) {
      var pa = PRIORITY_ORDER[a.priority] != null ? PRIORITY_ORDER[a.priority] : 1;
      var pc = PRIORITY_ORDER[c.priority] != null ? PRIORITY_ORDER[c.priority] : 1;
      if (pa !== pc) return pa - pc;
      var da = a.deadline ? parseDateKey(a.deadline) : null;
      var dc = c.deadline ? parseDateKey(c.deadline) : null;
      if (da && dc) return da - dc;
      if (da) return -1;
      if (dc) return 1;
      return 0;
    });
    for (var i = 0; i < active.length; i++) {
      var next = (active[i].actions || []).filter(function (ac) { return !ac.completed && ac.title && ac.title.trim(); })[0];
      if (next) return { goal: active[i], action: next };
    }
    return null;
  }

  function computeGoalAction(g) {
    var found = nextGoalWithAction(g);
    if (!found) return '';
    return found.action.title.trim() + ' (' + (found.goal.title || 'active goal').trim() + ')';
  }

  // Nearest goal deadline within 3 days (not yet Achieved) — used for the
  // "urgent deadlines" tier of computeTodayFocus().
  function nearestUrgentGoal(g) {
    if (!g) return null;
    var active = (g.activeGoals || []).filter(function (x) { return x.status !== 'Achieved' && x.deadline; });
    var soon = active
      .map(function (x) { return { goal: x, days: daysUntil(x.deadline) }; })
      .filter(function (x) { return x.days !== null && x.days >= 0 && x.days <= 3; });
    if (!soon.length) return null;
    soon.sort(function (a, c) { return a.days - c.days; });
    return soon[0];
  }

  // Suggests finishing whichever routine (morning/evening) is most relevant
  // to the current time of day, else today's remaining supplements. Reads
  // the same daily-instance checklists Health HQ resets at 6 AM rollover —
  // never duplicates or resets them itself.
  function computeHealthReminder(h) {
    if (!h) return '';
    var hour = new Date().getHours();
    var morningLeft = (h.morningRoutine || []).filter(function (i) { return !i.completed; }).length;
    var eveningLeft = (h.eveningRoutine || []).filter(function (i) { return !i.completed; }).length;
    var suppsLeft = (h.supplements || []).filter(function (i) { return !i.taken; }).length;

    var order = hour < 12
      ? [['morning routine', morningLeft], ['supplements', suppsLeft], ['evening routine', eveningLeft]]
      : [['evening routine', eveningLeft], ['supplements', suppsLeft], ['morning routine', morningLeft]];

    for (var i = 0; i < order.length; i++) {
      if (order[i][1] > 0) return 'Finish ' + order[i][0] + ' (' + order[i][1] + ' left)';
    }
    return '';
  }

  // Most recently archived day from Daily Snapshot's history (yesterday, in
  // the common case where the app is opened daily) — read-only, never a
  // second source of truth. Returns null if there's no history yet.
  function mostRecentHistoryDay() {
    var history = (window.DailySnapshot && window.DailySnapshot.getHistory) ? window.DailySnapshot.getHistory() : [];
    return history.length ? history[history.length - 1] : null;
  }

  // Priorities the user typed on the most recent archived day but never
  // completed — surfaced as a nudge only, never auto-filled into today's
  // priority slots (that would fight applyDefaultsToSnapshot's fixed
  // business/training/goal mapping and risk creating a second place a
  // priority "lives").
  function computeMissedPriorities(lastDay) {
    if (!lastDay) return [];
    return (lastDay.priorities || []).filter(function (p) {
      return p && p.text && p.text.trim() && !p.completed;
    }).map(function (p) { return p.text.trim(); });
  }

  // True when the most recent archived day's own numbers (not just today's
  // live Health reading) suggest the user is running down — light trend
  // signal alongside the existing Health-based recovery check.
  function historyLooksRough(lastDay) {
    if (!lastDay) return false;
    var lowScore = Number(lastDay.dayScore) > 0 && Number(lastDay.dayScore) <= 4;
    var lowEnergy = Number(lastDay.energyLevel) > 0 && Number(lastDay.energyLevel) <= 3;
    var highStress = Number(lastDay.stress) >= 8;
    return lowScore || lowEnergy || highStress;
  }

  // Priority order: urgent deadlines > health/recovery > yesterday's stated
  // tomorrow priority > business/revenue > training > goals/habits, per
  // docs/AI_ASSISTANT_BEHAVIOUR.md. Returns a broad theme for the day rather
  // than the exact businessTask/trainingTask/goalAction wording, since those
  // already fill Top 3 Priorities — repeating them verbatim here made
  // Suggested Today read as duplicated.
  function computeTodayFocus(ctx) {
    if (ctx.urgentGoal) {
      return 'Deadline: ' + (ctx.urgentGoal.goal.title || 'goal').trim() + ' — ' + ctx.urgentGoal.days + ' day' + (ctx.urgentGoal.days === 1 ? '' : 's') + ' left';
    }
    var poorRecovery = false;
    if (ctx.health) {
      poorRecovery = (Number(ctx.health.recoveryScore) > 0 && Number(ctx.health.recoveryScore) < 33) || Number(ctx.health.stressLevel) >= 8;
    }
    if (poorRecovery || ctx.historyRough) return 'Protect recovery and complete training';
    if (ctx.tomorrowFocus) return 'Continue: ' + ctx.tomorrowFocus;
    if (ctx.businessTask) return 'Move business forward today';
    if (ctx.trainingTask) return 'Protect recovery and complete training';
    if (ctx.goalAction) return 'Move your goal forward today';
    return '';
  }

  // Tonight's estimated sleep-cycle bedtime, read from window.Health's
  // Sleep Planner (scripts/health-data.js computeSleepPlan) — never a
  // second calculation. Estimated windows only, not a sleep-stage guarantee.
  function computeSleepNudge(h) {
    if (!h || !window.Health || typeof window.Health.computeSleepPlan !== 'function') return '';
    var plan = window.Health.computeSleepPlan(h);
    if (!plan) return '';
    return 'Tonight: wind down ' + plan.recommended.windDownStart + ', lights out ~' +
      plan.recommended.bedtime + ' (' + plan.recommended.hours + 'h target)';
  }

  // Short, simple call-outs already supported by existing data — never a
  // second source of truth, just a read of Daily Snapshot history / Streaks /
  // Boxing HQ fight date / Health's Sleep Planner.
  function computeNudges(ctx) {
    var nudges = [];

    // History-informed nudges go first — the most "coach remembers
    // yesterday" signals available, ahead of the streak/fight-camp call-outs.
    if (ctx.lastDay) {
      var missed = computeMissedPriorities(ctx.lastDay);
      if (missed.length) {
        nudges.push('Carry over: ' + missed[0] + (missed.length > 1 ? ' (+' + (missed.length - 1) + ' more)' : ''));
      }
      var note = (ctx.lastDay.lesson && ctx.lastDay.lesson.trim()) || (ctx.lastDay.slipped && ctx.lastDay.slipped.trim());
      if (note) nudges.push('From last time: ' + note);
    }

    var streaks = window.Streaks && window.Streaks.get ? window.Streaks.get() : null;
    if (streaks && Number(streaks.currentStreak) > 0) {
      var n = Number(streaks.currentStreak);
      nudges.push('Streak alive: ' + n + ' day' + (n === 1 ? '' : 's') + ' — keep it going');
    }
    if (ctx.boxing && ctx.boxing.fightDate) {
      var days = daysUntil(ctx.boxing.fightDate);
      if (days !== null && days >= 0 && days <= 14) {
        nudges.push('Fight camp: ' + days + ' day' + (days === 1 ? '' : 's') + ' to fight day');
      }
    }
    // Evening/late-night only, so it doesn't crowd out morning nudges —
    // pushed last so it never bumps a higher-priority nudge out of the
    // single-line preview on index.html.
    var hour = new Date().getHours();
    if (hour >= 17 || hour < 4) {
      var sleepNudge = computeSleepNudge(ctx.health);
      if (sleepNudge) nudges.push(sleepNudge);
    }
    return nudges;
  }

  function computeGuidance() {
    var business = (window.Business && window.Business.load) ? window.Business.load() : null;
    var boxing = (window.Boxing && window.Boxing.load) ? window.Boxing.load() : null;
    var goals = (window.Goals && window.Goals.load) ? window.Goals.load() : null;
    var health = (window.Health && window.Health.load) ? window.Health.load() : null;

    var lastDay = mostRecentHistoryDay();

    var businessTask = computeBusinessTask(business);
    var trainingTask = computeTrainingTask(boxing);
    var goalAction = computeGoalAction(goals);
    var healthReminder = computeHealthReminder(health);
    var urgentGoal = nearestUrgentGoal(goals);

    var todayFocus = computeTodayFocus({
      urgentGoal: urgentGoal,
      health: health,
      healthReminder: healthReminder,
      businessTask: businessTask,
      trainingTask: trainingTask,
      goalAction: goalAction,
      historyRough: historyLooksRough(lastDay),
      tomorrowFocus: lastDay && lastDay.tomorrowPriority && lastDay.tomorrowPriority.trim(),
    });

    var nudges = computeNudges({ boxing: boxing, health: health, lastDay: lastDay });

    return {
      todayFocus: todayFocus,
      businessTask: businessTask,
      trainingTask: trainingTask,
      goalAction: goalAction,
      healthReminder: healthReminder,
      nudges: nudges,
    };
  }

  // Fills today's Daily Snapshot mainFocus and Top 3 Priorities from the
  // generated suggestions — ONLY when those fields are still blank. Fixed
  // positional mapping (priority 1 = business, 2 = training, 3 = goal) so
  // which suggestion landed where stays predictable across reloads, rather
  // than compacting suggestions into whichever slots happen to be blank.
  // Returns true if it changed anything (caller saves). Never marks
  // anything complete, never touches a field that already has text.
  function applyDefaultsToSnapshot(snap, guidance) {
    if (!snap) return false;
    guidance = guidance || computeGuidance();
    var changed = false;

    if (guidance.todayFocus && (!snap.mainFocus || !snap.mainFocus.trim())) {
      snap.mainFocus = guidance.todayFocus;
      changed = true;
    }

    var suggestionsByIndex = [guidance.businessTask, guidance.trainingTask, guidance.goalAction];
    (snap.priorities || []).forEach(function (p, i) {
      var suggestion = suggestionsByIndex[i];
      if (suggestion && (!p.text || !p.text.trim())) {
        p.text = suggestion;
        changed = true;
      }
    });

    return changed;
  }

  window.DailyGuidance = {
    computeGuidance: computeGuidance,
    applyDefaultsToSnapshot: applyDefaultsToSnapshot,
  };
})();
