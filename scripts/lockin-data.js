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
      read(k).forEach(function (g) {
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
  };
})();
