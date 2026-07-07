// =============================================================
// Force Local Save — shared helper so any sync action can guarantee the
// latest in-memory edits are actually in Local Storage before reading it.
//
// Most sections already write straight to localStorage on every change
// (no debounce), so there's usually nothing to flush. A few fields (the
// Command Centre profile modal, Integrations' notes/provider fields) use a
// short debounce so typing doesn't thrash storage — those register a
// flush callback here so Force Local Save can commit them immediately.
//
// Never throws: run() always resolves { ok, timestamp, error }.
// =============================================================
(function () {
  'use strict';

  var flushers = [];

  // Lets any page register a "commit pending debounced writes now"
  // callback. Returns an unregister function. Safe to call repeatedly.
  function registerFlush(fn) {
    if (typeof fn !== 'function') return function () {};
    flushers.push(fn);
    return function unregister() {
      flushers = flushers.filter(function (f) { return f !== fn; });
    };
  }

  function flushAll() {
    flushers.slice().forEach(function (fn) {
      try { fn(); } catch (e) { /* one flush failing shouldn't block the others */ }
    });
  }

  function storageWritable() {
    var k = '__force_save_probe__';
    try {
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Flushes pending debounced saves, confirms Local Storage can still be
  // written to, and returns the freshest data timestamp available (reusing
  // CloudSync's existing localStorage scan rather than tracking a second,
  // separate "last saved" clock).
  function run() {
    flushAll();
    if (!storageWritable()) {
      return { ok: false, error: 'Local Storage is not available in this browser.' };
    }
    var timestamp = (window.CloudSync && window.CloudSync.latestLocalTimestamp())
      || new Date().toISOString();
    return { ok: true, timestamp: timestamp };
  }

  window.ForceSave = {
    registerFlush: registerFlush,
    run: run,
  };
})();
