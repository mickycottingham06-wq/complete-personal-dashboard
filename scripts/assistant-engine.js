// =============================================================
// Assistant engine — gathers real data and builds briefings for
// pages/assistant.html. Read-only except through LockIn (task store).
//
// Sources, each labelled in the UI:
//   - tasks:        LockIn (`goals:` store) + `lockInLog` completion history
//   - calendar:     Google Calendar via GoogleCalendarService, only when
//                   connected and only from a real fetch (never demo data)
//   - supplied:     LockIn.SUPPLIED_ROUTINE — the user's own routine and
//                   dated events (weigh-in/fight apply on their date only)
//   - notes:        Second Brain, keyword-matched, max 3 excerpts
//   - email:        none — no email integration exists
//
// Basic (no-AI) briefings are deterministic. AI is optional, server-side
// (/api/assistant) and its reply is re-validated here against what was sent.
// =============================================================
(function () {
  'use strict';

  var L = window.LockIn;
  var TZ = 'Europe/London';
  var STALE_MS = 6 * 3600e3;
  var DEFAULT_MINUTES = 25;
  // Planning assumptions — shown to the user wherever they affect a number.
  var EVENING_END = 21 * 60 + 30;   // stop planning focused work after 21:30
  var WEEKEND_START = 9 * 60;
  var AFTER_WORK_GAP = 15;          // minutes after work ends
  var FAMILY_MINUTES = { weekday: 60, weekend: 120 };
  var EVENT_BLOCK = 60;             // calendar events have start times only
  var BIZ_RE = /\b(mb automotive|business|quote|invoice|customer|client|job card|supplier|parts|marketing|website|money|pay|bill|budget|invest|property|tax|bank|mortgage|pension|savings|£)/i;
  var STOP = { the: 1, and: 1, for: 1, with: 1, that: 1, this: 1, from: 1, have: 1, what: 1, when: 1, about: 1, into: 1, your: 1, should: 1, today: 1, tomorrow: 1, week: 1, need: 1, does: 1, will: 1, there: 1, which: 1, then: 1, them: 1, they: 1, also: 1, just: 1, more: 1, some: 1, call: 1, send: 1, make: 1, book: 1 };

  function pad2(n) { return String(n).padStart(2, '0'); }
  function dateKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function addDays(key, n) { var d = new Date(key + 'T12:00:00'); d.setDate(d.getDate() + n); return dateKey(d); }
  function dow(key) { return new Date(key + 'T12:00:00').getDay(); }
  function minutesOf(hhmm) { var p = String(hhmm || '').split(':'); return p.length === 2 ? Number(p[0]) * 60 + Number(p[1]) : NaN; }
  function hm(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ }); }
  function dayLabel(key) { return new Date(key + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); }
  function norm(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9£]+/g, ' ').trim(); }
  function fmtMin(m) { return m >= 60 ? (Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '')) : m + ' min'; }

  // ---------- Commitments ----------
  function suppliedFor(key) {
    var r = L.SUPPLIED_ROUTINE, out = [];
    if (r.weekdayWork.days.indexOf(dow(key)) !== -1) {
      out.push({ source: 'supplied', kind: 'routine', date: key, time: r.weekdayWork.start + '–' + r.weekdayWork.end, start: r.weekdayWork.start, end: r.weekdayWork.end, text: r.weekdayWork.label });
    }
    r.dates.forEach(function (d) { if (d.date === key) out.push({ source: 'supplied', kind: 'dated', date: key, time: '', text: d.label }); });
    return out;
  }
  function suppliedDatedBetween(from, to) {
    return L.SUPPLIED_ROUTINE.dates.filter(function (d) { return d.date >= from && d.date <= to; })
      .map(function (d) { return { source: 'supplied', kind: 'dated', date: d.date, time: '', text: d.label }; });
  }

  // Returns { state, events (all real cached), retrievedAt, error }.
  // state: 'not-connected' | 'fresh' | 'cached' | 'stale' | 'failed'
  async function loadCalendar(refresh) {
    var gc = window.Integrations ? window.Integrations.load().googleCalendar : null;
    var svc = window.GoogleCalendarService;
    if (!gc || !gc.enabled || !svc || !svc.isConnected()) return { state: 'not-connected', events: [], retrievedAt: '' };
    // Real cache = written by a successful fetch ('Connected'); a later failed
    // refresh flips status to 'Error — …' but leaves that cache in place.
    // Demo data ('Connected (demo data)') never counts.
    var real = gc.lastSync && (gc.status === 'Connected' || String(gc.status).indexOf('Error') === 0);
    var cached = { events: real ? gc.upcomingEvents.slice() : [], retrievedAt: real ? gc.lastSync : '' };
    if (refresh) {
      var res = await svc.refresh('googleCalendar');
      if (res.ok) return { state: 'fresh', events: res.state.googleCalendar.upcomingEvents.slice(), retrievedAt: res.state.googleCalendar.lastSync };
      return { state: 'failed', events: cached.events, retrievedAt: cached.retrievedAt, error: res.error || 'refresh failed' };
    }
    if (!cached.retrievedAt) return { state: 'failed', events: [], retrievedAt: '', error: 'never retrieved' };
    return { state: Date.now() - Date.parse(cached.retrievedAt) > STALE_MS ? 'stale' : 'cached', events: cached.events, retrievedAt: cached.retrievedAt };
  }

  function calendarLabel(cal) {
    if (cal.state === 'not-connected') return 'Calendar not connected — no events shown.';
    var when = cal.retrievedAt ? dayLabel(dateKey(new Date(cal.retrievedAt))) + ' ' + hm(cal.retrievedAt) : '';
    if (cal.state === 'fresh') return 'Google Calendar · retrieved ' + hm(cal.retrievedAt);
    if (cal.state === 'cached') return 'Google Calendar · cached, retrieved ' + when;
    if (cal.state === 'stale') return 'Google Calendar · may be out of date, retrieved ' + when;
    return 'Calendar refresh failed' + (when ? ' · showing events retrieved ' + when : ' · no events available');
  }

  function eventsOn(cal, key) {
    return cal.events.filter(function (e) { return e && e.date === key; })
      .sort(function (a, b) { return (a.time || '') < (b.time || '') ? -1 : 1; })
      .map(function (e) { return { source: 'calendar', date: e.date, time: e.time || '', text: e.title }; });
  }

  // ---------- Time available today ----------
  function availability(today, cal, now) {
    now = now || new Date();
    var weekday = L.SUPPLIED_ROUTINE.weekdayWork.days.indexOf(dow(today)) !== -1;
    var nowMin = dateKey(now) === today ? now.getHours() * 60 + now.getMinutes() : 24 * 60; // after midnight → day is over
    var winStart = weekday ? minutesOf(L.SUPPLIED_ROUTINE.weekdayWork.end) + AFTER_WORK_GAP : WEEKEND_START;
    var start = Math.max(nowMin, winStart);
    var open = Math.max(0, EVENING_END - start);
    var evts = eventsOn(cal, today).filter(function (e) { var m = minutesOf(e.time); return !isNaN(m) && m >= start && m < EVENING_END; });
    var family = Math.min(open, weekday ? FAMILY_MINUTES.weekday : FAMILY_MINUTES.weekend);
    var focus = Math.max(0, open - family - evts.length * EVENT_BLOCK);

    var flags = [];
    var dated = L.SUPPLIED_ROUTINE.dates;
    var todayEvt = dated.filter(function (d) { return d.date === today; });
    var tomorrowEvt = dated.filter(function (d) { return d.date === addDays(today, 1); });
    var weekEvt = dated.filter(function (d) { return d.date > today && d.date <= addDays(today, 7); });
    var maxSupport = L.MAX_SUPPORT;
    if (todayEvt.length) { flags.push(todayEvt.map(function (d) { return d.label; }).join(' & ') + ' today — essentials and recovery only.'); focus = Math.min(focus, 30); maxSupport = 0; }
    else if (tomorrowEvt.length) { flags.push(tomorrowEvt.map(function (d) { return d.label; }).join(' & ') + ' tomorrow — keep today light and protect sleep.'); focus = Math.min(focus, 45); maxSupport = 0; }
    else if (weekEvt.length) { flags.push(weekEvt.map(function (d) { return d.label + ' ' + dayLabel(d.date); }).join(', ') + ' — fight week: training and recovery come first.'); maxSupport = 1; }

    var basis = (weekday ? 'after work (' + L.SUPPLIED_ROUTINE.weekdayWork.end + ', your routine)' : 'from ' + pad2(WEEKEND_START / 60) + ':00') +
      ' until 21:30, keeping ' + fmtMin(family) + ' free for family' + (evts.length ? ' and ~1 h per calendar event' : '') + '. No training times are stored — fit actions around your session.';
    return { weekday: weekday, openMinutes: open, focusMinutes: focus, maxSupport: maxSupport, flags: flags, basis: basis };
  }

  // ---------- Tasks ----------
  // Today's open tasks, de-duplicated by text, best first.
  function candidates(outcomes) {
    var today = L.activeDate();
    var outcomeWords = keywords((outcomes || []).join(' '));
    var seen = {}, out = [];
    L.loadToday().forEach(function (g, idx) {
      if (!g || g.done || !g.text) return;
      var k = norm(g.text);
      if (seen[k]) return;
      seen[k] = true;
      var created = String(g.createdAt || '').slice(0, 10);
      var carried = g.deferredFrom || (created && created < today ? created : '');
      var score = (g.role === 'main' ? 100 : g.role === 'support' ? 50 : 0) + (carried ? 20 : 0) + (g.firstStep ? 5 : 0) +
        (keywords(g.text).some(function (w) { return outcomeWords.indexOf(w) !== -1; }) ? 15 : 0);
      out.push({ task: g, carried: carried, score: score, idx: idx, isBiz: BIZ_RE.test(g.text) });
    });
    out.sort(function (a, b) { return b.score - a.score || a.idx - b.idx; });
    return out;
  }

  function toAction(c, role, reason) {
    var g = c.task;
    return {
      id: g.id, text: g.text, role: role, isNew: false, isBiz: c.isBiz,
      firstStep: g.firstStep || '', firstStepNeeded: !g.firstStep,
      minutes: Number(g.minutes) > 0 ? Number(g.minutes) : DEFAULT_MINUTES, minutesEstimated: !(Number(g.minutes) > 0),
      reason: reason,
    };
  }

  function reasonFor(c) {
    if (c.task.role === 'main') return 'Already your main action.';
    if (c.task.role === 'support') return 'Already a supporting action.';
    if (c.carried) return 'Unfinished since ' + dayLabel(c.carried) + '.';
    return 'On today\'s list.';
  }

  // Deterministic morning plan from existing tasks only — never invents work.
  function morningPlan(avail, outcomes) {
    var cands = candidates(outcomes);
    if (!cands.length) return { actions: [], note: 'No unfinished tasks on today\'s list. Capture what matters on LOCK-IN HQ, then run Morning again.' };
    var actions = [toAction(cands[0], 'main', reasonFor(cands[0]))];
    var used = actions[0].minutes;
    var notes = [];
    if (avail.focusMinutes === 0) notes.push('By your routine there\'s no free focus time left today — treat this as the first thing tomorrow, or just do the first step.');
    else if (used > avail.focusMinutes) notes.push('The main action (' + fmtMin(used) + ') is longer than today\'s free time (' + fmtMin(avail.focusMinutes) + ') — aim for the first step only.');

    var rest = cands.slice(1);
    for (var i = 0; i < rest.length && actions.length - 1 < avail.maxSupport; i++) {
      var a = toAction(rest[i], 'support', reasonFor(rest[i]));
      if (used + a.minutes <= avail.focusMinutes) { actions.push(a); used += a.minutes; }
    }
    // Business/money action only if one fits and none is already chosen.
    if (avail.maxSupport > 0 && !actions.some(function (a) { return a.isBiz; })) {
      var biz = rest.find(function (c) { return c.isBiz && !actions.some(function (a) { return a.id === c.task.id; }); });
      if (biz) {
        var b = toAction(biz, 'support', 'Business/money action that fits today.');
        var supports = actions.length - 1;
        var drop = supports >= avail.maxSupport ? actions[actions.length - 1] : null;
        var budget = avail.focusMinutes - used + (drop ? drop.minutes : 0);
        if (b.minutes <= budget) { if (drop) actions.pop(); actions.push(b); }
      }
    }
    return { actions: actions, note: notes.join(' ') };
  }

  // ---------- Second Brain retrieval ----------
  function keywords(text) {
    var seen = {};
    return norm(text).split(' ').filter(function (w) { if (w.length < 4 || STOP[w] || seen[w]) return false; seen[w] = true; return true; });
  }

  // Up to `limit` notes, ranked by distinct keyword hits (question words
  // count double). A note needs 2+ distinct matching keywords — or the
  // question's only keyword — so one shared common word isn't enough.
  function relevantNotes(question, taskTexts, limit) {
    if (!window.SecondBrain) return [];
    var q = keywords(question), t = keywords((taskTexts || []).join(' ')).filter(function (w) { return q.indexOf(w) === -1; });
    if (!q.length && !t.length) return [];
    var scored = [];
    window.SecondBrain.load().notes.forEach(function (n) {
      var hay = norm(n.title + ' ' + n.content + ' ' + n.category);
      var hits = [], score = 0;
      q.forEach(function (w) { if (hay.indexOf(w) !== -1) { score += 2; hits.push(w); } });
      t.forEach(function (w) { if (hay.indexOf(w) !== -1) { score += 1; hits.push(w); } });
      if (hits.length >= 2 || (q.length === 1 && hits[0] === q[0])) scored.push({ note: n, score: score, hits: hits });
    });
    scored.sort(function (a, b) { return b.score - a.score || (b.note.updatedAt > a.note.updatedAt ? 1 : -1); });
    return scored.slice(0, limit || 3).map(function (s) {
      var text = s.note.content.replace(/\s+/g, ' ').trim();
      var at = Math.max(0, text.toLowerCase().indexOf(s.hits[0]) - 120);
      return { id: s.note.id, title: s.note.title, matched: s.hits, excerpt: (at ? '…' : '') + text.slice(at, at + 400) + (at + 400 < text.length ? '…' : '') };
    });
  }

  // ---------- Weekly ----------
  function weekStartFor(today) {
    var d = dow(today); // Sat/Sun → plan the coming week; otherwise this week
    if (d === 6) return addDays(today, 2);
    if (d === 0) return addDays(today, 1);
    return addDays(today, 1 - d);
  }

  function weeklyData(cal) {
    var today = L.activeDate();
    var from = addDays(today, -6);
    var seen = {};
    var completed = L.completedBetween(from, today).filter(function (d) { var k = norm(d.text); if (seen[k]) return false; seen[k] = true; return true; });
    var useen = {}, unfinished = [];
    candidates([]).forEach(function (c) { useen[norm(c.task.text)] = true; unfinished.push({ text: c.task.text, where: c.carried ? 'today · since ' + dayLabel(c.carried) : 'today' }); });
    L.readTomorrow().forEach(function (g) {
      if (!g || g.done || !g.text || useen[norm(g.text)]) return;
      useen[norm(g.text)] = true;
      unfinished.push({ text: g.text, where: 'tomorrow' + (g.deferredFrom ? ' · deferred' : '') });
    });
    var to = addDays(today, 7);
    var upcoming = cal.events.filter(function (e) { return e && e.date >= today && e.date <= to; })
      .map(function (e) { return { source: 'calendar', date: e.date, time: e.time || '', text: e.title }; })
      .concat(suppliedDatedBetween(today, to))
      .sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; });
    var started = L.historyStartedAt();
    var historyNote = !started ? 'No completion history yet — the app only started keeping it with this update. Today\'s completed items are shown.'
      : started.slice(0, 10) > from ? 'Completion history only goes back to ' + dayLabel(started.slice(0, 10)) + '.' : '';
    var weekStart = weekStartFor(today);
    return { from: from, to: today, completed: completed, unfinished: unfinished, upcoming: upcoming, historyNote: historyNote, weekStart: weekStart, outcomes: L.getWeekOutcomes(weekStart) };
  }

  // ---------- AI ----------
  // Thin wrappers over scripts/ai-client.js (shared with the Content page).
  function accessToken() { return window.AiClient ? window.AiClient.accessToken() : ''; }
  function aiStatus() { return window.AiClient ? window.AiClient.status() : Promise.resolve({ available: false, reason: 'AI client not loaded.' }); }
  function askAi(mode, question, context) { return window.AiClient ? window.AiClient.ask(mode, question, context) : Promise.resolve({ ok: false, error: 'AI client not loaded.' }); }

  // Compact context sent to /api/assistant.
  function buildAiContext(today, avail, commitments, notes, outcomes) {
    return {
      today: today + ' (' + new Date(today + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' }) + ')',
      timeNow: pad2(new Date().getHours()) + ':' + pad2(new Date().getMinutes()),
      availableMinutes: avail.focusMinutes,
      maxSupportingActions: avail.maxSupport,
      constraints: avail.flags.concat([avail.basis]),
      commitments: commitments.map(function (c) { return { source: c.source, date: c.date, time: c.time, text: c.text }; }),
      openTasks: candidates(outcomes).slice(0, 12).map(function (c) {
        return { id: c.task.id, text: c.task.text, firstStep: c.task.firstStep || '', minutes: Number(c.task.minutes) || 0, unfinishedSince: c.carried || '' };
      }),
      weekOutcomes: outcomes || [],
      emailConnected: false,
      notes: notes.map(function (n) { return { id: n.id, title: n.title, excerpt: n.excerpt }; }),
    };
  }

  // Checks the AI reply strictly against what was sent:
  //  - a taskId must be one of the open task ids sent, otherwise the item is
  //    rejected (never re-mapped to another task);
  //  - a new action (taskId "") whose text matches an existing open task is
  //    ambiguous and rejected;
  //  - genuinely new actions are kept but flagged isNew (unticked until reviewed);
  //  - duplicates dropped, supporting capped, minutes clamped;
  //  - notesUsed limited to the note ids actually sent in this request.
  function validateAi(data, context) {
    var open = {};
    context.openTasks.forEach(function (t) { open[t.id] = t; });
    var sentNoteIds = (context.notes || []).map(function (n) { return n.id; });
    var seen = {}, rejected = [];
    function str(v) { return typeof v === 'string' ? v : ''; }
    function clean(a, role) {
      if (!a || typeof a !== 'object' || !str(a.text).trim()) return null;
      var taskId = str(a.taskId).trim(), t = null;
      if (taskId) {
        t = open[taskId] || null;
        if (!t) { rejected.push('"' + str(a.text).slice(0, 60) + '" — refers to a task that isn\'t on your open list'); return null; }
      } else if (context.openTasks.some(function (x) { return norm(x.text) === norm(a.text); })) {
        rejected.push('"' + str(a.text).slice(0, 60) + '" — ambiguous: matches an existing task without naming it');
        return null;
      }
      var text = t ? t.text : str(a.text).trim().slice(0, 200);
      var key = t ? 'id:' + t.id : 'tx:' + norm(text);
      if (seen[key]) return null;
      seen[key] = true;
      var m = Math.round(Number(a.minutes));
      return {
        id: t ? t.id : '', text: text, role: role, isNew: !t, isBiz: BIZ_RE.test(text),
        firstStep: str(a.firstStep).trim().slice(0, 200), firstStepNeeded: !str(a.firstStep).trim(),
        minutes: isNaN(m) ? DEFAULT_MINUTES : Math.min(180, Math.max(5, m)), minutesEstimated: true,
        reason: str(a.why).slice(0, 200),
      };
    }
    var actions = [];
    var main = clean(data && data.main, 'main');
    if (main) actions.push(main);
    (Array.isArray(data && data.support) ? data.support : []).forEach(function (s) {
      if (actions.length && actions.length - 1 >= context.maxSupportingActions) return;
      var a = clean(s, main ? 'support' : 'main');
      if (a) { actions.push(a); if (!main) main = a; }
    });
    return {
      actions: actions,
      rejected: rejected,
      summary: str(data && data.summary).slice(0, 400),
      answer: str(data && data.answer).slice(0, 1200),
      notesUsed: (Array.isArray(data && data.notesUsed) ? data.notesUsed : []).filter(function (id) { return sentNoteIds.indexOf(id) !== -1; }),
    };
  }

  window.AssistantEngine = {
    FAMILY_MINUTES: FAMILY_MINUTES,
    suppliedFor: suppliedFor,
    loadCalendar: loadCalendar,
    calendarLabel: calendarLabel,
    eventsOn: eventsOn,
    availability: availability,
    candidates: candidates,
    morningPlan: morningPlan,
    relevantNotes: relevantNotes,
    weeklyData: weeklyData,
    weekStartFor: weekStartFor,
    aiStatus: aiStatus,
    askAi: askAi,
    accessToken: accessToken,
    buildAiContext: buildAiContext,
    validateAi: validateAi,
    dayLabel: dayLabel,
    fmtMin: fmtMin,
    hm: hm,
    addDays: addDays,
  };
})();
