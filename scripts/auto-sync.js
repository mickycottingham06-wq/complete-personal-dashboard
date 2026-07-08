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
// self-referential sync-metadata keys so those never trigger a push), and
// stamps cloudSyncMeta.localChangedAt on each one. Each meaningful write
// also debounces a push 4s after the last change, with a 45s max-wait
// ceiling during continuous editing.
//
// This is a static multi-page app, so that debounce timer dies the moment
// the user navigates — localChangedAt is what survives it. maybeAutoPush()
// checks CloudSync.getSyncStatus() directly (state, not memory) on init,
// auth change, visibility/online, and periodic ticks, and pushes whenever
// it says 'local-newer' (or 'cloud-ready'/'error'), regardless of whether
// this page's own timer ever fired.
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
  var WATCHDOG_MS = 12000; // periodic local-newer check while the tab is visible
  var PUSH_TIMEOUT_MS = 20000;

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

  // Canonical short strings for the visible status/reason line (Quick Sync
  // modal + Integrations card) — the watchdog sets one of these on every
  // check so "why isn't this pushing right now?" never requires a tooltip.
  var SKIP_REASON = {
    'not-configured': 'skipped: not configured',
    'signed-out': 'skipped: signed out',
    disabled: 'skipped: disabled',
    offline: 'skipped: offline',
  };
  function fmtHM(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var h = String(d.getHours()).padStart(2, '0');
    var m = String(d.getMinutes()).padStart(2, '0');
    return h + ':' + m;
  }

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
    if (pushInFlight) { pendingRerun = true; setState({ lastSkipReason: 'queued' }); return; }
    if (!window.CloudSync || !window.Backup || !window.ForceSave) return;
    var base = computeBaseStatus();
    if (base) { setState({ status: base, reason: '', lastSkipReason: SKIP_REASON[base] || ('skipped: ' + base) }); return; }
    if (document.visibilityState === 'hidden') { setState({ lastSkipReason: 'skipped: hidden tab' }); return; } // retried on visibility/online events
    setState({ lastSkipReason: 'checking' });

    // Claimed synchronously, before the first await below — two overlapping
    // callers (e.g. init's auth-ready check and an auth-change subscriber
    // firing for the same transition) both pass the `if (pushInFlight)`
    // guard above in the same tick otherwise, since neither has set the
    // flag yet; only *this* function is allowed to actually claim the slot,
    // and it must do so before yielding control for the first time.
    pushInFlight = true;
    try {
      // Flush any pending debounced field writes (e.g. a text input mid-typing
      // debounce) into Local Storage *before* reading sync status — otherwise
      // the freshness check below can miss an edit that hasn't hit
      // localStorage.setItem yet and misjudge cloud-newer/local-newer.
      window.ForceSave.flushAll();

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
        setState({ status: 'action-needed', reason: conflictReason, lastSkipReason: 'skipped: cloud newer' });
        return;
      }

      setState({ status: 'syncing', reason: '', lastSkipReason: 'pushing' });
      var sig = computeSignature();
      // Only skip as a no-op when the export matches the hash of the last
      // *successfully pushed* payload (set below, only on a real push
      // success) AND this device has nothing newer than that push's own
      // timestamp. Never dedup against a hash computed from just "what's
      // on screen right now" (e.g. a boot-time/status-check read) — that
      // would skip a genuine unpushed local-newer edit as if it were
      // already synced. If either signal is missing or ambiguous, push.
      // 'local-newer' itself is never dedup-skipped, full stop — the check
      // below only even runs for the other two push-worthy codes
      // (cloud-ready, error) so a hash coincidence can never silently sit
      // on top of local edits the cloud doesn't have.
      var meta = window.CloudSync.loadMeta();
      var alreadyPushed = syncStatus.code !== 'local-newer' && sig === lastPushedSignature &&
        !!meta.lastPushedAt && !!meta.localChangedAt && meta.localChangedAt <= meta.lastPushedAt;
      if (alreadyPushed) { setState({ status: 'synced', reason: '', lastSkipReason: 'No meaningful changes since the last push.' }); return; }
      var result = await Promise.race([
        window.CloudSync.pushToCloud(),
        new Promise(function (resolve) { setTimeout(function () { resolve({ ok: false, timedOut: true }); }, PUSH_TIMEOUT_MS); }),
      ]);
      if (result.timedOut) {
        setState({ status: 'action-needed', reason: 'Push timed out.', lastSkipReason: 'push timed out' });
      } else if (result.ok) {
        lastPushedSignature = sig;
        setState({ status: 'synced', reason: '', lastError: '', lastPushAt: result.updatedAt, lastSkipReason: 'pushed successfully at ' + fmtHM(result.updatedAt) });
      } else {
        setState({ status: 'action-needed', reason: result.error, lastError: result.error, lastSkipReason: 'push failed: ' + result.error });
      }
    } finally {
      pushInFlight = false;
      if (pendingRerun) { pendingRerun = false; markDirty(); }
    }
  }

  // The state-based counterpart to markDirty()'s debounce: checks the
  // authoritative, persisted CloudSync.getSyncStatus() directly and only
  // calls attemptPush() when it says there's really something to push
  // ('local-newer' — Local Storage has edits the cloud doesn't; 'cloud-ready'
  // — no cloud row exists yet at all; or 'error' — a past push/pull failed
  // and deserves a retry, same self-healing reasoning as above). This is
  // what makes a push happen even with zero in-memory history on this page
  // — a fresh load, a page navigated to mid-debounce, or a browser restart
  // all still see local-newer here via cloudSyncMeta.localChangedAt (set by
  // markDirty() on whatever page made the edit) and push. Never triggers on
  // 'synced' or 'cloud-newer' — no redundant pushes, no overwriting a
  // genuinely newer cloud save.
  async function maybeAutoPush() {
    if (pushInFlight) return;
    var base = computeBaseStatus();
    if (base) { setState({ lastSkipReason: SKIP_REASON[base] || ('skipped: ' + base) }); return; }
    if (document.visibilityState === 'hidden') { setState({ lastSkipReason: 'skipped: hidden tab' }); return; }
    if (!window.CloudSync) return;
    setState({ lastSkipReason: 'checking' });
    var syncStatus = await window.CloudSync.getSyncStatus();
    if (syncStatus.code === 'local-newer' || syncStatus.code === 'cloud-ready' || syncStatus.code === 'error') {
      attemptPush();
    } else if (syncStatus.code === 'cloud-newer') {
      setState({ lastSkipReason: 'skipped: cloud newer' });
    } else if (syncStatus.code === 'synced') {
      setState({ lastSkipReason: '' });
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
    // Deliberately does NOT set lastPushedSignature here. That hash must
    // only ever come from a payload CloudSync.pushToCloud() actually
    // confirmed as pushed (see attemptPush) — seeding it from "whatever's
    // on screen right now just because getSyncStatus() currently reads
    // synced" would let a later genuine local-newer edit dedup-skip itself
    // if it happened to hash-collide with this boot-time read.
    if (syncStatus.code === 'synced') { setState({ status: 'synced', reason: '' }); return; }
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

  function runCheck() { refreshStatus(); checkCloudLoad(); maybeAutoPush(); }

  // Resolves once SupabaseAuth has a definitive signed-in/signed-out
  // answer — never a bare "wait a tick and hope". SupabaseAuth.init()
  // kicks off an async getSession() fetch and only flips loading:false once
  // it resolves; running the first check while that's still in flight was
  // the actual gap that let a real 'local-newer' state get misread as
  // signed-out on load and silently sit there until some later event (a
  // storage write, a visibility flip) happened to re-check it. Subscribing
  // and resolving on the first non-loading state removes that gap outright.
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
    // have their own sign-in UI calling it (only Command Centre and
    // Integrations did before v2).
    if (window.SupabaseAuth) window.SupabaseAuth.init();
    checkCloudLoad();
    whenAuthReady(runCheck);
    // Same checkpoint on every auth change, visibility/online recovery, and
    // the periodic ticks below — so signing in, coming back online, or
    // simply returning to the tab all re-check state instead of only
    // reacting to this page's own in-memory dirty timer.
    if (window.SupabaseAuth) window.SupabaseAuth.subscribe(runCheck);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') runCheck();
    });
    window.addEventListener('online', runCheck);
    window.addEventListener('offline', function () { setState({ status: 'offline', lastSkipReason: 'skipped: offline' }); });
    // Single watchdog tick, 10-15s while the tab is open — the state-based
    // checkpoint (maybeAutoPush reads CloudSync.getSyncStatus() directly,
    // not in-memory history) is what guarantees a 'local-newer' reading can
    // never just sit there for a full page session without a real edit.
    setInterval(runCheck, WATCHDOG_MS);
  }

  window.AutoSync = {
    getState: function () { return state; },
    subscribe: subscribe,
    // Lets the Integrations Cloud Sync toggle (and anything else that just
    // changed a base-status input like cloudSync.enabled) ask for an
    // immediate status recompute instead of waiting for the next debounced
    // push, storage tick, or watchdog poll. Status-only, same as the
    // periodic refresh — never triggers a push itself.
    refresh: refreshStatus,
  };

  init();
})();
