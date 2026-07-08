// =============================================================
// Auto Cloud Save (v2) — safe background push on every core Life OS page,
// plus a guarded, opt-in cloud-load check for picking up another device's
// newer save.
//
// Builds on window.CloudSync / window.Backup / window.ForceSave exactly as
// the Quick Sync panel and Integrations Cloud Sync card do. Push path only
// ever calls CloudSync.pushToCloud() — it never pulls on its own, so it can
// never overwrite this device's Local Storage.
//
// How it works: wraps localStorage.setItem/removeItem once to detect
// meaningful writes (an exclude-list filters out UI/ephemeral and
// self-referential sync-metadata keys so those never trigger a push).
// Each meaningful write debounces a push 4s after the last change, with a
// 45s max-wait ceiling during continuous editing, plus a cheap 5-minute
// fallback check in case something changed outside the wrapped calls.
//
// Before every push: flush pending debounced saves (ForceSave.flushAll),
// require Supabase configured + signed in, require the browser online,
// require the tab visible, then read CloudSync.getSyncStatus() and skip
// if cloud is newer or in error — those need the user's manual choice via
// Quick Sync / Integrations, never an automatic overwrite.
//
// Cloud-load check (v2): on load, on visibility/online, and on the periodic
// status refresh, flush + check CloudSync.getSyncStatus(). Only when the
// status is exactly 'cloud-newer' (this device's own latest-timestamp scan
// is behind the cloud row — i.e. no unsynced local edits) does it ask, via
// a single confirm(), whether to load the newer cloud save. Declining or
// accepting is remembered per cloud updated_at in sessionStorage so the
// same version is never asked about twice — no repeated prompts/loops.
// 'local-newer' and 'error' are left entirely to manual Quick Sync.
//
// Safe when Supabase isn't configured or no one is signed in: every
// internal check just skips the push and reports status; nothing here
// ever throws.
// =============================================================
(function () {
  'use strict';

  if (window.AutoSync) return;

  var DEBOUNCE_MS = 4000;
  var MAX_WAIT_MS = 45000;
  var DIRTY_CHECK_MS = 5 * 60 * 1000;

  // Trigger-detection exclude list only — it does NOT remove these keys
  // from what gets pushed (CloudSync.pushToCloud() always sends the full
  // Backup.buildExport() payload). This just stops noisy/self-referential
  // keys from constantly re-arming the debounce timer.
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
    'auto-on': 'Auto save on',
    syncing: 'Syncing',
    synced: 'Synced',
    'action-needed': 'Action needed',
    offline: 'Offline / signed out',
  };

  var state = { status: 'offline', label: LABELS.offline, lastError: '', lastPushAt: '' };
  var listeners = [];
  function setState(patch) {
    state = Object.assign({}, state, patch);
    state.label = LABELS[state.status] || '';
    listeners.slice().forEach(function (fn) { try { fn(state); } catch (e) {} });
  }
  function subscribe(fn) {
    listeners.push(fn);
    fn(state);
    return function unsubscribe() { listeners = listeners.filter(function (l) { return l !== fn; }); };
  }

  // Cheap 32-bit string hash (djb2) so the dedupe check doesn't need to
  // hold onto the full exported payload string between runs.
  function hashString(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return h.toString(36);
  }

  // Same exclude list used for trigger detection also keeps self-referential
  // sync metadata out of the dedupe signature, so a push's own bookkeeping
  // write can never make the next check look "changed" when nothing is.
  function computeSignature() {
    var payload = window.Backup.buildExport();
    var keys = Object.keys(payload.data).filter(function (k) { return !isExcludedKey(k); }).sort();
    var parts = keys.map(function (k) { return k + '=' + payload.data[k]; });
    return hashString(parts.join('\n'));
  }

  var debounceTimer = null;
  var maxWaitTimer = null;
  var pushInFlight = false;
  var pendingRerun = false;
  var lastPushedSignature = '';

  function clearMaxWait() {
    if (maxWaitTimer) { clearTimeout(maxWaitTimer); maxWaitTimer = null; }
  }

  function markDirty() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      debounceTimer = null;
      clearMaxWait();
      attemptPush();
    }, DEBOUNCE_MS);
    if (!maxWaitTimer) {
      maxWaitTimer = setTimeout(function () {
        maxWaitTimer = null;
        if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
        attemptPush();
      }, MAX_WAIT_MS);
    }
  }

  // The single push path — in-flight guarded (only one push runs at a
  // time), coalescing (a change that lands mid-push re-arms the debounce
  // instead of starting a second concurrent push), and deduping (skips
  // the network call entirely when nothing meaningful actually changed).
  // Never calls pullToLocal — push-only, by design.
  async function attemptPush() {
    if (pushInFlight) { pendingRerun = true; return; }
    if (!window.CloudSync || !window.Backup || !window.ForceSave) return;
    if (!navigator.onLine || !window.CloudSync.isAvailable()) { setState({ status: 'offline' }); return; }
    if (document.visibilityState === 'hidden') return; // retried on visibility/online events

    var syncStatus = await window.CloudSync.getSyncStatus();
    if (syncStatus.code === 'error' || syncStatus.code === 'cloud-newer') {
      setState({ status: 'action-needed' });
      return;
    }

    pushInFlight = true;
    setState({ status: 'syncing' });
    try {
      window.ForceSave.flushAll();
      var sig = computeSignature();
      if (sig === lastPushedSignature) { setState({ status: 'synced' }); return; }
      var result = await window.CloudSync.pushToCloud();
      if (result.ok) {
        lastPushedSignature = sig;
        setState({ status: 'synced', lastError: '', lastPushAt: new Date().toISOString() });
      } else {
        setState({ status: 'action-needed', lastError: result.error });
      }
    } finally {
      pushInFlight = false;
      if (pendingRerun) { pendingRerun = false; markDirty(); }
    }
  }

  // Status-only refresh (no push) — used on load and periodically so the
  // indicator reflects reality even before any local edit happens.
  async function refreshStatus() {
    if (pushInFlight) return;
    if (!window.CloudSync) { setState({ status: 'offline' }); return; }
    if (!navigator.onLine || !window.CloudSync.isAvailable()) { setState({ status: 'offline' }); return; }
    var syncStatus = await window.CloudSync.getSyncStatus();
    if (syncStatus.code === 'error' || syncStatus.code === 'cloud-newer') { setState({ status: 'action-needed' }); return; }
    if (syncStatus.code === 'synced') { lastPushedSignature = computeSignature(); setState({ status: 'synced' }); return; }
    setState({ status: 'auto-on' });
  }

  // Cloud-load check (v2) — the only place this module ever pulls, and only
  // after an explicit confirm(). sessionStorage remembers the cloud row's
  // updated_at already asked about, so re-running this (on visibility,
  // online, sign-in, or the periodic tick) never re-prompts for the same
  // cloud version twice, i.e. no repeated-prompt loop.
  var CLOUD_PROMPT_SEEN_KEY = 'autoSyncCloudPromptSeen';
  var loadCheckInFlight = false;
  async function checkCloudLoad() {
    if (loadCheckInFlight || pushInFlight) return;
    if (!window.CloudSync || !window.ForceSave) return;
    if (!navigator.onLine || !window.CloudSync.isAvailable()) return;
    if (document.visibilityState === 'hidden') return;
    loadCheckInFlight = true;
    try {
      // Flush first so a not-yet-committed debounced edit can never be
      // mistaken for "no unsynced local changes".
      window.ForceSave.flushAll();
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
      setState({ status: 'syncing' });
      var result = await window.CloudSync.pullToLocal();
      if (result.ok) {
        window.location.reload();
      } else {
        setState({ status: 'action-needed', lastError: result.error });
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

  function init() {
    wrapStorage();
    // Idempotent (SupabaseAuth guards against double-init) — this is what
    // actually fetches the signed-in session on pages that don't already
    // have their own sign-in UI calling it (only Command Centre and
    // Integrations did before v2).
    if (window.SupabaseAuth) window.SupabaseAuth.init();
    refreshStatus();
    checkCloudLoad();
    if (window.SupabaseAuth) window.SupabaseAuth.subscribe(function () { refreshStatus(); checkCloudLoad(); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') { attemptPush(); checkCloudLoad(); }
    });
    window.addEventListener('online', function () { attemptPush(); checkCloudLoad(); });
    window.addEventListener('offline', function () { setState({ status: 'offline' }); });
    setInterval(function () { refreshStatus(); checkCloudLoad(); }, 60 * 1000);
    setInterval(attemptPush, DIRTY_CHECK_MS);
  }

  window.AutoSync = {
    getState: function () { return state; },
    subscribe: subscribe,
  };

  init();
})();
