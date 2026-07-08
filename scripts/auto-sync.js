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
// only if the cloud copy is newer — that needs the user's manual choice via
// Quick Sync / Integrations, never an automatic overwrite. A past push/pull
// *error* is never a gate here — it's retried on the next change so a fixed
// cause (network blip, table not created yet) self-heals automatically.
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

  // Six distinct states so the UI never has to guess *why* auto save isn't
  // running — 'not-configured' and 'signed-out' used to be lumped into one
  // 'offline' bucket, which is exactly what made "why isn't this saving?"
  // hard to answer from the UI alone.
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

  // lastSkipReason records why the most recent attemptPush() call didn't
  // actually push (distinct from `reason`, which is only set for states the
  // UI treats as needing attention) — cleared on every successful push, so
  // it always reflects "why isn't this saving right now?" for debugging.
  var state = { status: 'not-configured', label: LABELS['not-configured'], reason: '', lastError: '', lastPushAt: '', lastSkipReason: '' };
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

  // The three reasons a push can't even be attempted — checked before ever
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

  // Stamps a dedicated "local data changed" marker in cloudSyncMeta so
  // CloudSync.latestLocalTimestamp() can see this edit even when the edited
  // section has no ISO timestamp field of its own (most goal/list edits
  // don't). Written through window.CloudSync.setMeta(), which itself goes
  // through the wrapped localStorage.setItem below — but 'cloudSyncMeta' is
  // already in EXCLUDE_KEYS, so that write never re-triggers markDirty().
  function markLocalChange() {
    if (window.CloudSync) window.CloudSync.setMeta({ localChangedAt: new Date().toISOString() });
  }

  function markDirty() {
    markLocalChange();
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
    if (pushInFlight) { pendingRerun = true; setState({ lastSkipReason: 'A push was already in flight — this change is queued for the next one.' }); return; }
    if (!window.CloudSync || !window.Backup || !window.ForceSave) return;
    var base = computeBaseStatus();
    if (base) { setState({ status: base, reason: '', lastSkipReason: LABELS[base] + ' — see the Auto Save state above.' }); return; }
    if (document.visibilityState === 'hidden') { setState({ lastSkipReason: 'Tab not visible — retried when it becomes visible again.' }); return; } // retried on visibility/online events

    // Only 'cloud-newer' blocks the push itself — pushing over a newer
    // cloud save would silently discard another device's edits, and that
    // needs the user's explicit choice (Quick Sync / Integrations).
    //
    // A stale 'error' status is deliberately NOT a gate here. Earlier this
    // used to skip the push whenever the *last* push/pull had failed for
    // any reason (including a one-off network blip, or the cloud table not
    // existing yet during initial setup) — which meant a single past
    // failure permanently stopped every future auto-push, silently, since
    // nothing else ever retried it. Attempting the push and letting its own
    // result decide the state lets a fixed cause self-heal on the very next
    // edit instead of requiring a manual Quick Sync push to unstick it.
    var syncStatus = await window.CloudSync.getSyncStatus();
    if (syncStatus.code === 'cloud-newer') {
      var conflictReason = 'A newer cloud save is waiting on another device — open Cloud Sync to choose which to keep.';
      setState({ status: 'action-needed', reason: conflictReason, lastSkipReason: conflictReason });
      return;
    }

    pushInFlight = true;
    setState({ status: 'syncing', reason: '' });
    try {
      window.ForceSave.flushAll();
      var sig = computeSignature();
      if (sig === lastPushedSignature) { setState({ status: 'synced', reason: '', lastSkipReason: 'No meaningful changes since the last push.' }); return; }
      var result = await window.CloudSync.pushToCloud();
      if (result.ok) {
        lastPushedSignature = sig;
        setState({ status: 'synced', reason: '', lastError: '', lastPushAt: new Date().toISOString(), lastSkipReason: '' });
      } else {
        setState({ status: 'action-needed', reason: result.error, lastError: result.error, lastSkipReason: result.error });
      }
    } finally {
      pushInFlight = false;
      if (pendingRerun) { pendingRerun = false; markDirty(); }
    }
  }

  // Status-only refresh (no push) — used on load and periodically so the
  // indicator reflects reality even before any local edit happens. Unlike
  // attemptPush(), this is display-only, so a genuine last-push error is
  // still surfaced as 'action-needed' here (honest reporting) — it just
  // never blocks attemptPush() from trying again.
  async function refreshStatus() {
    if (pushInFlight) return;
    var base = computeBaseStatus();
    if (base) { setState({ status: base, reason: '' }); return; }
    var syncStatus = await window.CloudSync.getSyncStatus();
    if (syncStatus.code === 'cloud-newer') { setState({ status: 'action-needed', reason: 'A newer cloud save is waiting on another device — open Cloud Sync to choose which to keep.' }); return; }
    if (syncStatus.code === 'error') { setState({ status: 'action-needed', reason: state.lastError || 'The last cloud save failed — it will retry automatically on the next change.' }); return; }
    if (syncStatus.code === 'synced') { lastPushedSignature = computeSignature(); setState({ status: 'synced', reason: '' }); return; }
    setState({ status: 'auto-on', reason: '' });
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

  function init() {
    wrapStorage();
    // Idempotent (SupabaseAuth guards against double-init) — this is what
    // actually fetches the signed-in session on pages that don't already
    // have their own sign-in UI calling it (only Command Centre and
    // Integrations did before v2).
    if (window.SupabaseAuth) window.SupabaseAuth.init();
    refreshStatus();
    checkCloudLoad();
    // Also attempt a push on every auth change (not just refresh/checkCloudLoad)
    // so signing in starts auto save immediately instead of waiting for the
    // next edit or the 5-minute fallback tick. attemptPush() is always safe
    // to call — it no-ops via computeBaseStatus() when signed out.
    if (window.SupabaseAuth) window.SupabaseAuth.subscribe(function () { refreshStatus(); checkCloudLoad(); attemptPush(); });
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
    // Lets the Integrations Cloud Sync toggle (and anything else that just
    // changed a base-status input like cloudSync.enabled) ask for an
    // immediate status recompute instead of waiting for the next debounced
    // push, storage tick, or 60s poll. Status-only, same as the periodic
    // refresh — never triggers a push itself.
    refresh: refreshStatus,
  };

  init();
})();
