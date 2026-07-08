// =============================================================
// Auto Cloud Save (v3) — one simple push path, always the same sequence the
// manual "Push Local -> Cloud" button already uses successfully:
//   1. ForceSave.run() (public API — flushAll() is an internal-only helper,
//      never attached to window.ForceSave; see runForceSave() below)
//   2. CloudSync.pushToCloud()
//   3. update cloudSyncMeta / AutoSync state (pushToCloud() itself stamps
//      cloudSyncMeta; this module records lastPushAt/lastError/diagnostics)
//   4. notify subscribers so Quick Sync / Integrations re-render
//
// v1-v2 (see docs/SUPABASE_PLAN.md §20-25) added a debounce/max-wait timer
// pair, a periodic watchdog, a payload hash dedup, and an in-flight/pending
// rerun queue on top of this. Despite several rounds of fixes, local-newer
// could still silently sit unpushed live. v3 removes all of that machinery:
// every trigger below funnels into one function, runAutoSync(), which reads
// CloudSync.getSyncStatus() fresh and pushes immediately whenever it says
// there is something to push. There is no hash/signature check anywhere in
// this file — a real 'local-newer' status is never second-guessed.
//
// Push is only skipped for six reasons, checked in runAutoSync(): signed
// out, offline, hidden tab, auto save disabled, a genuine cloud-newer
// conflict (needs the user's manual choice), or a push already in flight.
// Every skip/attempt updates a small set of diagnostic fields (lastCheckAt,
// lastStatusCode, lastAttemptAt, lastResult, lastReason) so "why isn't this
// pushing right now" is always visible on-screen, not just in a tooltip.
//
// Still push-only: this module never calls CloudSync.pullToLocal() except
// from checkCloudLoad(), which only runs after an explicit confirm() and
// only when there are no unsynced local edits (status exactly 'cloud-newer')
// — unchanged from v2, out of scope for this pass.
// =============================================================
(function () {
  'use strict';

  if (window.AutoSync) return;

  var WATCHDOG_MS = 10000; // periodic check while the tab is visible
  var EDIT_DEBOUNCE_MS = 2000; // batches rapid localStorage writes into one check
  var PUSH_TIMEOUT_MS = 20000; // safety net so a hung request can't wedge the in-flight guard forever

  // Trigger-detection exclude list only — it does NOT remove these keys from
  // what gets pushed (CloudSync.pushToCloud() always sends the full
  // Backup.buildExport() payload). This just stops noisy/self-referential
  // keys from constantly re-arming the edit debounce.
  var EXCLUDE_KEYS = {
    cloudSyncMeta: true,           // written by every push/pull itself — would loop
    __force_save_probe__: true,    // ForceSave's write+remove writability probe
    sidebar_collapsed_groups_v1: true, // topbar.js UI state, not Life OS data
    whoop_last_sync: true,         // Command Centre WHOOP demo timestamp
  };
  var EXCLUDE_PREFIXES = ['sb-']; // supabase-js's own session/token storage

  function isExcludedKey(key) {
    if (!key) return true;
    if (EXCLUDE_KEYS[key]) return true;
    for (var i = 0; i < EXCLUDE_PREFIXES.length; i++) {
      if (key.indexOf(EXCLUDE_PREFIXES[i]) === 0) return true;
    }
    return false;
  }

  var LABELS = {
    'not-configured': 'Local only',
    'signed-out': 'Signed out',
    disabled: 'Off (disabled by you)',
    offline: 'Offline',
    'auto-on': 'Auto save on',
    syncing: 'Syncing…',
    synced: 'Synced',
    'action-needed': 'Action needed',
  };

  // Human phrase used in the visible diagnostic line for each base-gate code.
  var GATE_PHRASE = {
    'not-configured': 'not configured',
    'signed-out': 'signed out',
    disabled: 'disabled',
    offline: 'offline',
  };

  function fmtHM(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var h = String(d.getHours()).padStart(2, '0');
    var m = String(d.getMinutes()).padStart(2, '0');
    return h + ':' + m;
  }

  // lastCheckAt/lastStatusCode/lastAttemptAt/lastResult/lastReason are the
  // visible diagnostics — every call to runAutoSync() updates them, whether
  // it ends up pushing or skipping, so the UI line always reflects the most
  // recent check, not just the most recent push.
  var state = {
    status: 'not-configured', label: LABELS['not-configured'], reason: '',
    lastError: '', lastPushAt: '',
    lastCheckAt: '', lastStatusCode: '', lastAttemptAt: '', lastResult: '', lastReason: '',
  };
  var listeners = [];
  function setState(patch) {
    var prevStatus = state.status;
    state = Object.assign({}, state, patch);
    state.label = LABELS[state.status] || '';
    // One console line per genuine state change only — never per poll/tick,
    // so this stays useful for debugging without spamming the console.
    if (state.status !== prevStatus) {
      try { console.info('[AutoSync] ' + prevStatus + ' -> ' + state.status + (state.reason ? ' (' + state.reason + ')' : '')); } catch (e) {}
    }
    listeners.slice().forEach(function (fn) { try { fn(state); } catch (e) {} });
  }

  // The four reasons a push can't even be attempted — checked before ever
  // touching CloudSync.getSyncStatus()/pushToCloud() so each has a distinct,
  // correct label instead of everything collapsing into one generic state.
  function computeBaseStatus() {
    if (!window.SupabaseFoundation || !window.SupabaseFoundation.isConfigured()) return 'not-configured';
    // Auto Cloud Save defaults on (integrations-data.js migrates old/missing
    // data to enabled:true) — this only fires when the user has explicitly
    // turned it off via the Integrations Cloud Sync toggle. Pages that don't
    // load integrations-data.js have no toggle to disable, so they fall
    // through and auto save runs (matches the on-by-default requirement).
    if (window.Integrations && !window.Integrations.load().cloudSync.enabled) return 'disabled';
    if (!window.CloudSync || !window.CloudSync.isSignedIn()) return 'signed-out';
    if (!navigator.onLine) return 'offline';
    return null;
  }
  function subscribe(fn) {
    listeners.push(fn);
    fn(state);
    return function unsubscribe() { listeners = listeners.filter(function (l) { return l !== fn; }); };
  }

  // window.ForceSave only ever exposes registerFlush()/run() (see
  // force-save.js) — flushAll() is an internal helper that run() calls
  // itself, it is never attached to window.ForceSave. Manual Push/Sync
  // (index.html, integrations.html) call ForceSave.run() and check .ok —
  // this mirrors that so Auto Push uses the exact same public path instead
  // of a method that doesn't exist at runtime. Never throws.
  function runForceSave() {
    if (!window.ForceSave || typeof window.ForceSave.run !== 'function') {
      return { ok: true, timestamp: new Date().toISOString() };
    }
    try {
      var result = window.ForceSave.run();
      if (result && typeof result === 'object') return result;
      return { ok: true, timestamp: new Date().toISOString() };
    } catch (e) {
      return { ok: false, error: (e && e.message) ? e.message : String(e) };
    }
  }

  var pushInFlight = false;
  var editDebounceTimer = null;

  // markDirty() runs on every non-excluded localStorage write. It always
  // stamps cloudSyncMeta.localChangedAt (via CloudSync.setMeta(), which goes
  // through the wrapped localStorage.setItem below — but 'cloudSyncMeta' is
  // already in EXCLUDE_KEYS, so that write never re-triggers markDirty()) so
  // CloudSync.latestLocalTimestamp() sees the edit even for sections with no
  // ISO timestamp field of their own. It is only ONE of six triggers into
  // runAutoSync() — never the sole trigger — the watchdog, visibility,
  // online, auth-change, and page-load checkpoints below all call
  // runAutoSync() directly regardless of whether any edit debounce is
  // pending, so a local-newer state can never depend on this timer alone.
  function markDirty() {
    if (window.CloudSync) window.CloudSync.setMeta({ localChangedAt: new Date().toISOString() });
    if (editDebounceTimer) clearTimeout(editDebounceTimer);
    editDebounceTimer = setTimeout(function () { editDebounceTimer = null; runAutoSync(); }, EDIT_DEBOUNCE_MS);
  }

  // The single entry point for every trigger. Reads CloudSync.getSyncStatus()
  // fresh each time (never relies on in-memory history from a previous page)
  // and pushes immediately whenever there is something to push. No hash/
  // signature check anywhere in this function — a real 'local-newer' status
  // is never second-guessed or deduped away.
  async function runAutoSync() {
    var checkAt = new Date().toISOString();
    setState({ lastCheckAt: checkAt });

    if (pushInFlight) {
      setState({ lastReason: 'Auto check ' + fmtHM(checkAt) + ' — push already in flight, skipped' });
      return;
    }

    var base = computeBaseStatus();
    if (base) {
      setState({
        status: base, reason: '', lastStatusCode: base, lastResult: 'skipped',
        lastReason: 'Auto push skipped: ' + (GATE_PHRASE[base] || base),
      });
      return;
    }
    if (document.visibilityState === 'hidden') {
      setState({ lastReason: 'Auto push skipped: hidden tab' });
      return; // retried on the next visibilitychange->visible event
    }
    if (!window.CloudSync || !window.Backup || !window.ForceSave) return;

    // Claimed synchronously — zero awaits between the pushInFlight check
    // above and this line — so two overlapping triggers (e.g. the watchdog
    // tick and an edit debounce landing in the same tick) can never both
    // pass the guard and double-push.
    pushInFlight = true;
    try {
      var syncStatus = await window.CloudSync.getSyncStatus();
      setState({ lastStatusCode: syncStatus.code });

      // Only a genuine cloud-newer conflict blocks the push — that needs the
      // user's explicit choice via Quick Sync / Integrations, never an
      // automatic overwrite.
      if (syncStatus.code === 'cloud-newer') {
        setState({
          status: 'action-needed',
          reason: 'A newer cloud save is waiting on another device — open Cloud Sync to choose which to keep.',
          lastResult: 'skipped', lastReason: 'Auto push skipped: cloud newer',
        });
        return;
      }
      if (syncStatus.code === 'synced') {
        setState({ status: 'synced', reason: '', lastReason: 'Auto check ' + fmtHM(checkAt) + ' — synced, nothing to push' });
        return;
      }

      // local-newer, cloud-ready, or error: always push. A stale 'error' is
      // deliberately not a gate — retrying it here lets a fixed cause
      // (network blip, table not created yet) self-heal on the very next
      // check instead of requiring a manual push to unstick it.
      setState({ status: 'syncing', reason: '', lastReason: 'Auto check ' + fmtHM(checkAt) + ' — ' + syncStatus.code + ' → pushing' });
      setState({ lastAttemptAt: new Date().toISOString() });

      // The exact same sequence as the manual Push Local -> Cloud button:
      // flush pending debounced field writes, then push. Everything from
      // here down used to be catch-less (try/finally only) — any throw
      // (flushAll, pushToCloud, or anything unforeseen) left state stuck on
      // 'syncing'/"-> pushing" forever with no visible error, since finally
      // only cleared pushInFlight and the exception became a silent
      // unhandled rejection. The catch below is the fix; the setState calls
      // in between are the visible stage markers requested alongside it.
      try {
        setState({ lastReason: 'Auto push: flushing local saves' });
        var flushResult = runForceSave();
        if (!flushResult.ok) {
          setState({
            status: 'action-needed', reason: flushResult.error, lastError: flushResult.error,
            lastResult: 'failed', lastReason: 'Auto push failed: ' + flushResult.error,
          });
          return;
        }

        setState({ lastReason: 'Auto push: calling cloud push' });
        var result = await Promise.race([
          window.CloudSync.pushToCloud(),
          new Promise(function (resolve) { setTimeout(function () { resolve({ ok: false, timedOut: true }); }, PUSH_TIMEOUT_MS); }),
        ]);
        setState({ lastReason: 'Auto push: cloud push returned' });

        if (result.timedOut) {
          setState({ status: 'action-needed', reason: 'Push timed out.', lastResult: 'failed', lastReason: 'Auto push timed out' });
        } else if (result.ok) {
          setState({
            status: 'synced', reason: '', lastError: '', lastPushAt: result.updatedAt,
            lastResult: 'success', lastReason: 'Auto push succeeded ' + fmtHM(result.updatedAt),
          });
        } else {
          setState({
            status: 'action-needed', reason: result.error, lastError: result.error,
            lastResult: 'failed', lastReason: 'Auto push failed: ' + result.error,
          });
        }
      } catch (e) {
        var msg = (e && e.message) ? e.message : String(e);
        setState({
          status: 'action-needed', reason: msg, lastError: msg,
          lastResult: 'failed', lastReason: 'Auto push failed: ' + msg,
        });
      }
    } finally {
      pushInFlight = false;
    }
  }

  // Cloud-load check (unchanged from v2) — the only place this module ever
  // pulls, and only after an explicit confirm(). Out of scope for this pass:
  // still guarded to fire only when this device has no unsynced local edits
  // (status exactly 'cloud-newer'), still remembers the cloud row's
  // updated_at already asked about so the same version is never re-prompted.
  var CLOUD_PROMPT_SEEN_KEY = 'autoSyncCloudPromptSeen';
  var loadCheckInFlight = false;
  async function checkCloudLoad() {
    if (loadCheckInFlight || pushInFlight) return;
    if (!window.CloudSync || !window.ForceSave) return;
    if (!navigator.onLine || !window.CloudSync.isAvailable()) return;
    if (document.visibilityState === 'hidden') return;
    loadCheckInFlight = true;
    try {
      runForceSave();
      var syncStatus = await window.CloudSync.getSyncStatus();
      if (syncStatus.code !== 'cloud-newer') return;
      var cloudStatus = await window.CloudSync.getCloudStatus();
      if (!cloudStatus.ok || !cloudStatus.exists) return;
      var seen = null;
      try { seen = sessionStorage.getItem(CLOUD_PROMPT_SEEN_KEY); } catch (e) {}
      if (seen === cloudStatus.updatedAt) return;
      try { sessionStorage.setItem(CLOUD_PROMPT_SEEN_KEY, cloudStatus.updatedAt); } catch (e) {}

      var when = new Date(cloudStatus.updatedAt).toLocaleString();
      var confirmed = window.confirm(
        'A newer Life OS save was found in the cloud (' + when + ').\n\n' +
        'This device has no unsynced local changes, so it is safe to load it.\n\n' +
        'Load the latest cloud save now?'
      );
      if (!confirmed) return;
      setState({ status: 'syncing', reason: '' });
      var result = await window.CloudSync.pullToLocal();
      if (result.ok) {
        window.location.reload();
      } else {
        setState({ status: 'action-needed', reason: result.error, lastError: result.error });
      }
    } finally {
      loadCheckInFlight = false;
    }
  }

  function wrapStorage() {
    if (localStorage.setItem.__autoSyncWrapped) return;
    var origSet = localStorage.setItem.bind(localStorage);
    var origRemove = localStorage.removeItem.bind(localStorage);
    function wrappedSet(key, value) {
      origSet(key, value);
      if (!isExcludedKey(key)) markDirty();
    }
    function wrappedRemove(key) {
      origRemove(key);
      if (!isExcludedKey(key)) markDirty();
    }
    wrappedSet.__autoSyncWrapped = true;
    localStorage.setItem = wrappedSet;
    localStorage.removeItem = wrappedRemove;
  }

  function runCheck() { checkCloudLoad(); runAutoSync(); }

  // Resolves once SupabaseAuth has a definitive signed-in/signed-out answer
  // — running the first check while its async getSession() fetch is still
  // in flight was what let a real signed-in session get misread as
  // signed-out on page load in earlier versions.
  function whenAuthReady(cb) {
    if (!window.SupabaseAuth) { cb(); return; }
    var st = window.SupabaseAuth.getState();
    if (!st.loading) { cb(); return; }
    var unsubscribe = window.SupabaseAuth.subscribe(function (s) {
      if (!s.loading) { unsubscribe(); cb(); }
    });
  }

  function init() {
    wrapStorage();
    // Idempotent (SupabaseAuth guards against double-init) — this is what
    // actually fetches the signed-in session on pages that don't already
    // have their own sign-in UI calling it.
    if (window.SupabaseAuth) window.SupabaseAuth.init();

    // Six triggers, all funneling into the same runCheck() -> runAutoSync():
    whenAuthReady(runCheck);                                  // 1. page load, once auth is ready
    setInterval(runCheck, WATCHDOG_MS);                        // 2. every 10s while visible (runAutoSync no-ops if hidden)
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') runCheck();  // 3. tab back to visible
    });
    window.addEventListener('online', runCheck);                // 4. back online
    if (window.SupabaseAuth) window.SupabaseAuth.subscribe(runCheck); // 5. auth state change
    // 6. meaningful localStorage edit -> markDirty() (wired via wrapStorage above)
    window.addEventListener('offline', function () {
      setState({ status: 'offline', lastReason: 'Auto push skipped: offline' });
    });
  }

  window.AutoSync = {
    getState: function () { return state; },
    subscribe: subscribe,
    // Lets the Integrations Cloud Sync toggle (or anything else that just
    // changed a base-status input like cloudSync.enabled) ask for an
    // immediate re-check instead of waiting for the next edit, tick, or
    // navigation.
    refresh: runCheck,
  };

  init();
})();
