// =============================================================
// LOCK-IN HQ — task data layer for the default homepage.
//
// Reuses the existing To Do store (pages/main.html): one localStorage
// key per day, `goals:YYYY-MM-DD`, holding [{ text, done, ... }]. Items
// gain optional fields here (id, role 'main'|'support', firstStep,
// minutes, createdAt, updatedAt) — every other reader (main.html,
// topbar.js, heatmap-data.js) only looks at text/done, so they keep
// working unchanged. Same 6 AM day rollover as the rest of the app.
//
// Cloud sync is NOT handled here: scripts/auto-sync.js already wraps
// localStorage.setItem and pushes the whole dataset to Supabase when
// signed in. This file only reports whether the local write landed.
//
// Every write is read back and compared before returning { ok: true },
// so the UI can show "Saved" only after a verified write.
// =============================================================
(function () {
  'use strict';

  var PREFIX = 'goals:';
  var MAX_SUPPORT = 2;

  // Supplied by Micky (README), not retrieved from any calendar — the
  // homepage labels these separately from real events.
  var SUPPLIED_ROUTINE = {
    weekdayWork: { days: [1, 2, 3, 4, 5], start: '08:00', end: '17:30', label: 'Mechanic work' },
    dates: [
      { date: '2026-10-16', label: 'Weigh-in' },
      { date: '2026-10-17', label: 'Fight' },
    ],
  };

  function pad2(n) { return String(n).padStart(2, '0'); }
  function dateToKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function activeDate() {
    var d = new Date();
    if (d.getHours() < 6) d.setDate(d.getDate() - 1);
    return dateToKey(d);
  }
  function tomorrowDate() {
    var d = new Date();
    if (d.getHours() >= 6) d.setDate(d.getDate() + 1);
    return dateToKey(d);
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function nowIso() { return new Date().toISOString(); }

  function read(key) {
    try { var v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }

  // Writes then reads back — returns { ok, error }. Never throws.
  function write(key, list) {
    var raw = JSON.stringify(list);
    try {
      localStorage.setItem(key, raw);
    } catch (e) {
      return { ok: false, error: 'Could not save on this device (' + ((e && e.name) || 'storage error') + ').' };
    }
    var back = null;
    try { back = localStorage.getItem(key); } catch (e) {}
    if (back !== raw) return { ok: false, error: 'Save could not be confirmed on this device.' };
    try { window.dispatchEvent(new CustomEvent('goals-changed')); } catch (e) {}
    return { ok: true };
  }

  function listKeys() {
    var out = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) out.push(k);
    }
    return out;
  }

  // Same behaviour as main.html's rollover() — undone items from past days
  // move into today (deduped by text) and the old key is removed — except
  // the extra fields are kept instead of being reduced to { text, done }.
  function rollover() {
    var today = activeDate();
    var todayKey = PREFIX + today;
    var list = read(todayKey);
    var texts = {};
    list.forEach(function (g) { texts[g.text] = true; });
    var changed = false;
    listKeys().forEach(function (k) {
      if (k.slice(PREFIX.length) >= today) return;
      var old = read(k);
      archiveDone(old, k.slice(PREFIX.length));
      old.forEach(function (g) {
        if (!g.done && g.text && !texts[g.text]) {
          list.push(Object.assign({}, g, { done: false }));
          texts[g.text] = true;
        }
      });
      try { localStorage.removeItem(k); } catch (e) {}
      changed = true;
    });
    list.forEach(function (g) { if (!g.id) { g.id = uid(); changed = true; } });
    if (changed) write(todayKey, list);
    return list;
  }

  function loadToday() { return rollover(); }

  // Splits today's open items into one main, up to two supporting, and the
  // rest (captured but not yet chosen). Completed items are left out.
  function focus(list) {
    var open = list.filter(function (g) { return g && !g.done && g.text; });
    var main = open.find(function (g) { return g.role === 'main'; }) || null;
    var support = open.filter(function (g) { return g.role === 'support'; }).slice(0, MAX_SUPPORT);
    var inbox = open.filter(function (g) { return g !== main && support.indexOf(g) === -1; });
    var done = list.filter(function (g) { return g && g.done; });
    return { main: main, support: support, inbox: inbox, done: done };
  }

  // Applies fn(list) to today's list and saves. fn returns an error string
  // to abort without writing.
  function mutateToday(fn) {
    var key = PREFIX + activeDate();
    var list = rollover();
    var err = fn(list);
    if (err) return { ok: false, error: err };
    var res = write(key, list);
    return res.ok ? { ok: true, list: list } : res;
  }

  function capture(text) {
    text = String(text || '').trim();
    if (!text) return { ok: false, error: 'Type something first.' };
    var item = { id: uid(), text: text, done: false, createdAt: nowIso(), updatedAt: nowIso() };
    var res = mutateToday(function (list) {
      if (list.some(function (g) { return !g.done && g.text === text; })) return 'That is already on today\'s list.';
      list.push(item);
    });
    if (res.ok) res.item = item;
    return res;
  }

  function findIn(list, id) { return list.find(function (g) { return g.id === id; }); }

  function update(id, patch) {
    return mutateToday(function (list) {
      var g = findIn(list, id);
      if (!g) return 'That item is no longer on today\'s list.';
      if ('text' in patch) {
        var t = String(patch.text || '').trim();
        if (!t) return 'The action needs a name.';
        g.text = t;
      }
      if ('firstStep' in patch) g.firstStep = String(patch.firstStep || '').trim();
      if ('minutes' in patch) g.minutes = Number(patch.minutes) > 0 ? Number(patch.minutes) : 0;
      g.updatedAt = nowIso();
    });
  }

  function complete(id, done) {
    return mutateToday(function (list) {
      var g = findIn(list, id);
      if (!g) return 'That item is no longer on today\'s list.';
      g.done = done !== false;
      g.updatedAt = nowIso();
      if (g.done) g.completedAt = g.updatedAt; else delete g.completedAt;
    });
  }

  // role: 'main' | 'support' | '' (back to captured). Only one main; a new
  // main moves the old one back to captured. Supporting is capped at two.
  function setRole(id, role) {
    return mutateToday(function (list) {
      var g = findIn(list, id);
      if (!g) return 'That item is no longer on today\'s list.';
      if (role === 'support' && g.role !== 'support') {
        var count = list.filter(function (x) { return !x.done && x.role === 'support'; }).length;
        if (count >= MAX_SUPPORT) return 'Two supporting actions already — finish or defer one first.';
      }
      if (role === 'main') list.forEach(function (x) { if (x !== g && x.role === 'main') x.role = ''; });
      g.role = role || '';
      g.updatedAt = nowIso();
    });
  }

  // Moves an item to tomorrow's list. Tomorrow is written first so a failed
  // write can never lose the item.
  function defer(id) {
    var todayKey = PREFIX + activeDate();
    var tomKey = PREFIX + tomorrowDate();
    var list = rollover();
    var g = findIn(list, id);
    if (!g) return { ok: false, error: 'That item is no longer on today\'s list.' };
    var tom = read(tomKey);
    if (!tom.some(function (x) { return x.text === g.text; })) {
      tom.push(Object.assign({}, g, { done: false, deferredFrom: activeDate(), updatedAt: nowIso() }));
      var r1 = write(tomKey, tom);
      if (!r1.ok) return r1;
    }
    var rest = list.filter(function (x) { return x !== g; });
    var r2 = write(todayKey, rest);
    return r2.ok ? { ok: true, list: rest } : r2;
  }

  // ---------- Log: completion history + weekly outcomes ----------
  // Day keys are deleted on rollover (here and in pages/main.html), so
  // completed items are copied into `lockInLog` first — the only record of
  // past completions. History starts when this was added; nothing older exists.
  var LOG_KEY = 'lockInLog';
  var LOG_DONE_LIMIT = 300;

  function loadLog() {
    var log = null;
    try { log = JSON.parse(localStorage.getItem(LOG_KEY)); } catch (e) {}
    if (!log || typeof log !== 'object') log = {};
    if (!Array.isArray(log.done)) log.done = [];
    if (!log.weeks || typeof log.weeks !== 'object') log.weeks = {};
    if (!log.startedAt) log.startedAt = '';
    return log;
  }
  function writeLog(log) {
    var raw = JSON.stringify(log);
    try { localStorage.setItem(LOG_KEY, raw); } catch (e) { return { ok: false, error: 'Could not save on this device.' }; }
    var back = null;
    try { back = localStorage.getItem(LOG_KEY); } catch (e) {}
    return back === raw ? { ok: true } : { ok: false, error: 'Save could not be confirmed on this device.' };
  }

  // Copies done items from one day's list into the log (deduped by date+text).
  function archiveDone(list, date) {
    var done = (list || []).filter(function (g) { return g && g.done && g.text; });
    if (!done.length) return { ok: true };
    var log = loadLog();
    if (!log.startedAt) log.startedAt = nowIso();
    var seen = {};
    log.done.forEach(function (d) { seen[d.date + '|' + d.text] = true; });
    done.forEach(function (g) {
      if (seen[date + '|' + g.text]) return;
      log.done.push({ text: g.text, date: date, completedAt: g.completedAt || '' });
    });
    if (log.done.length > LOG_DONE_LIMIT) log.done = log.done.slice(-LOG_DONE_LIMIT);
    return writeLog(log);
  }

  // Completed items between two YYYY-MM-DD dates (inclusive), including
  // today's live list (not archived until tomorrow's rollover).
  function completedBetween(from, to) {
    var out = loadLog().done.filter(function (d) { return d.date >= from && d.date <= to; });
    var today = activeDate();
    if (today >= from && today <= to) {
      read(PREFIX + today).forEach(function (g) {
        if (g && g.done && g.text) out.push({ text: g.text, date: today, completedAt: g.completedAt || '' });
      });
    }
    return out;
  }

  function historyStartedAt() { return loadLog().startedAt; }

  // Up to three outcomes for the week starting `weekStart` (a Monday, YYYY-MM-DD).
  function getWeekOutcomes(weekStart) {
    var w = loadLog().weeks[weekStart];
    return w && Array.isArray(w.outcomes) ? w.outcomes : [];
  }
  function setWeekOutcomes(weekStart, outcomes) {
    var clean = (outcomes || []).map(function (o) { return String(o || '').trim(); }).filter(Boolean).slice(0, 3);
    var log = loadLog();
    log.weeks[weekStart] = { outcomes: clean, savedAt: nowIso() };
    // keep the last 12 weeks only
    var keys = Object.keys(log.weeks).sort();
    keys.slice(0, Math.max(0, keys.length - 12)).forEach(function (k) { delete log.weeks[k]; });
    return writeLog(log);
  }

  // Applies an accepted plan to today's list in one verified write.
  // plan: [{ id?, text, firstStep, minutes, role: 'main'|'support' }]
  // Items with an id update that task; items without become new tasks.
  // Every other open task loses its main/support role (stays on the list).
  function applyPlan(plan) {
    var mains = plan.filter(function (p) { return p.role === 'main'; }).length;
    var supports = plan.filter(function (p) { return p.role === 'support'; }).length;
    if (mains > 1) return { ok: false, error: 'Only one main action.' };
    if (supports > MAX_SUPPORT) return { ok: false, error: 'At most two supporting actions.' };
    return mutateToday(function (list) {
      var t = nowIso();
      var chosen = {};
      for (var i = 0; i < plan.length; i++) {
        var p = plan[i];
        var text = String(p.text || '').trim();
        if (!text) return 'Every action needs a name.';
        var g = p.id ? findIn(list, p.id) : null;
        if (p.id && !g) return 'A task in this plan is no longer on today\'s list — run Morning again.';
        if (!g) {
          g = list.find(function (x) { return !x.done && x.text === text; });
          if (!g) { g = { id: uid(), text: text, done: false, createdAt: t }; list.push(g); }
        }
        g.text = text;
        g.firstStep = String(p.firstStep || '').trim();
        g.minutes = Number(p.minutes) > 0 ? Number(p.minutes) : 0;
        g.role = p.role;
        g.updatedAt = t;
        chosen[g.id] = true;
      }
      list.forEach(function (x) { if (!x.done && !chosen[x.id] && x.role) { x.role = ''; x.updatedAt = t; } });
    });
  }

  // Adds a task to tomorrow's list (deduped by text). Becomes tomorrow's
  // main action only if tomorrow has none yet.
  function addToTomorrow(text) {
    text = String(text || '').trim();
    if (!text) return { ok: false, error: 'Type tomorrow\'s priority first.' };
    var key = PREFIX + tomorrowDate();
    var tom = read(key);
    if (tom.some(function (x) { return x.text === text; })) return { ok: true, existed: true };
    var hasMain = tom.some(function (x) { return !x.done && x.role === 'main'; });
    tom.push({ id: uid(), text: text, done: false, role: hasMain ? '' : 'main', createdAt: nowIso(), updatedAt: nowIso() });
    return write(key, tom);
  }
  function readTomorrow() { return read(PREFIX + tomorrowDate()); }

  // Restores a previous copy of today's list (used by Undo).
  function restoreToday(list) { return write(PREFIX + activeDate(), list); }
  function removeFromTomorrow(id) {
    var key = PREFIX + tomorrowDate();
    return write(key, read(key).filter(function (x) { return x.id !== id; }));
  }

  window.LockIn = {
    MAX_SUPPORT: MAX_SUPPORT,
    SUPPLIED_ROUTINE: SUPPLIED_ROUTINE,
    activeDate: activeDate,
    tomorrowDate: tomorrowDate,
    loadToday: loadToday,
    focus: focus,
    capture: capture,
    update: update,
    complete: complete,
    setRole: setRole,
    defer: defer,
    restoreToday: restoreToday,
    removeFromTomorrow: removeFromTomorrow,
    LOG_KEY: LOG_KEY,
    archiveDone: archiveDone,
    completedBetween: completedBetween,
    historyStartedAt: historyStartedAt,
    getWeekOutcomes: getWeekOutcomes,
    setWeekOutcomes: setWeekOutcomes,
    applyPlan: applyPlan,
    addToTomorrow: addToTomorrow,
    readTomorrow: readTomorrow,
  };
})();
