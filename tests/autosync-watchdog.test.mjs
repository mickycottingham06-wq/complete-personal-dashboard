// =============================================================
// AutoSync v3 harness — loads the real scripts/cloud-sync.js and
// scripts/auto-sync.js source into a sandboxed vm context (mocked
// localStorage/document/navigator + a fake Supabase client) and proves the
// exact behaviour required after the v3 rewrite (docs/SUPABASE_PLAN.md §26):
//   1. local-newer + signed in + visible + online + auto save enabled calls
//      CloudSync.pushToCloud().
//   2. the manual-push-equivalent sequence is used: window.ForceSave.run()
//      (the only public ForceSave method — flushAll() is internal-only, see
//      scripts/force-save.js) then CloudSync.pushToCloud(), in that order.
//   3. a successful push updates AutoSync.getState().lastPushAt.
//   4. a failed push clears the in-flight guard (a later check can push
//      again immediately) and leaves a visible error.
//   5. local-newer can never be dedup/hash-skipped — two checks in a row
//      with an unchanged payload while the mock cloud never advances both
//      call pushToCloud().
//
// Run: node tests/autosync-watchdog.test.mjs
// No new dependencies — Node's built-in vm module only.
// =============================================================
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.join(__dirname, '..', 'scripts');
const cloudSyncSrc = fs.readFileSync(path.join(SCRIPTS_DIR, 'cloud-sync.js'), 'utf8');
const supabaseAuthSrc = fs.readFileSync(path.join(SCRIPTS_DIR, 'supabase-auth.js'), 'utf8');
let autoSyncSrc = fs.readFileSync(path.join(SCRIPTS_DIR, 'auto-sync.js'), 'utf8');

let failures = 0;
function check(name, cond, detail) {
  if (cond) { console.log('  PASS  ' + name); }
  else { failures++; console.log('  FAIL  ' + name + (detail ? ' — ' + detail : '')); }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function waitUntil(predicate, timeoutMs, stepMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(stepMs || 10);
  }
  return predicate();
}

function makeLocalStorage(initial) {
  const store = Object.assign({}, initial);
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    key: (i) => Object.keys(store)[i] || null,
    get length() { return Object.keys(store).length; },
  };
}

// Fake Supabase client. `select().eq().maybeSingle()` always reports the
// fixture's cloudUpdatedAt (it does not advance after a push) so a test can
// force getSyncStatus() to keep reading 'local-newer' across a push — the
// exact condition needed to prove dedup can't hide behind it (test 5).
function makeClient({ sessionUser, sessionDelayMs, cloudUpdatedAt, upsertImpl }) {
  let pushCalls = 0;
  return {
    _pushCalls: () => pushCalls,
    auth: {
      getSession: () => new Promise((resolve) => {
        setTimeout(() => resolve({ data: { session: sessionUser ? { user: sessionUser } : null }, error: null }), sessionDelayMs || 0);
      }),
      onAuthStateChange: () => {},
    },
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({
          data: cloudUpdatedAt ? { data_version: 1, updated_at: cloudUpdatedAt } : null,
          error: null,
        }),
        upsert: async (row) => { pushCalls++; return upsertImpl(row); },
      };
    },
  };
}

function buildSandbox({ client, localStorage, autoSyncSource, realInterval, flushSpy }) {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.window.addEventListener = () => {};
  sandbox.console = console;
  sandbox.setTimeout = setTimeout;
  sandbox.clearTimeout = clearTimeout;
  // Tests that don't need the periodic 10s watchdog tick stub it out so they
  // don't keep a timer alive after the assertions are done; test 5 below
  // patches WATCHDOG_MS down and passes realInterval to actually exercise it.
  sandbox.setInterval = realInterval ? setInterval : () => 0;
  sandbox.clearInterval = realInterval ? clearInterval : () => {};
  sandbox.navigator = { onLine: true };
  sandbox.document = { visibilityState: 'visible', addEventListener: () => {} };
  sandbox.localStorage = localStorage;
  sandbox.window.SupabaseFoundation = { isConfigured: () => true, getClient: () => client };
  sandbox.window.Backup = {
    buildExport: () => {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k === 'cloudSyncMeta') continue;
        data[k] = localStorage.getItem(k);
      }
      return { meta: { dataVersion: 1, keyCount: Object.keys(data).length }, data };
    },
  };
  const calls = [];
  // Only run()/registerFlush() are exposed — matches the real
  // window.ForceSave surface (scripts/force-save.js). No flushAll() here on
  // purpose: if auto-sync.js ever calls ForceSave.flushAll() directly again,
  // it throws "flushAll is not a function" instead of silently passing.
  sandbox.window.ForceSave = {
    run: () => { calls.push('run'); return flushSpy ? flushSpy() : { ok: true, timestamp: new Date().toISOString() }; },
    registerFlush: () => () => {},
  };
  sandbox._calls = calls;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(supabaseAuthSrc, ctx, { filename: 'supabase-auth.js' });
  vm.runInContext(cloudSyncSrc, ctx, { filename: 'cloud-sync.js' });
  // Wrap pushToCloud so we can record call order relative to flushAll
  // without touching the real module logic.
  vm.runInContext(autoSyncSource || autoSyncSrc, ctx, { filename: 'auto-sync.js' });
  const origPush = sandbox.window.CloudSync.pushToCloud;
  sandbox.window.CloudSync.pushToCloud = (...args) => { calls.push('pushToCloud'); return origPush(...args); };
  return sandbox;
}

const HOUR_AGO = new Date(Date.now() - 3600 * 1000).toISOString();
const NOW = new Date().toISOString();

function localNewerFixture(extraMeta) {
  return makeLocalStorage({
    goals: JSON.stringify({ updatedAt: NOW, items: ['ship it'] }),
    cloudSyncMeta: JSON.stringify(Object.assign({ localChangedAt: NOW, lastPushedAt: '', lastPulledAt: '', lastError: '', lastErrorAt: '' }, extraMeta || {})),
  });
}

async function test1_localNewerCallsPush() {
  console.log('\n1. local-newer + signed in + visible + online + enabled -> CloudSync.pushToCloud() is called');
  const ls = localNewerFixture();
  const client = makeClient({
    sessionUser: { id: 'u1' }, sessionDelayMs: 30, cloudUpdatedAt: HOUR_AGO,
    upsertImpl: () => ({ error: null }),
  });
  const sandbox = buildSandbox({ client, localStorage: ls });
  await waitUntil(() => client._pushCalls() >= 1, 5000);
  check('CloudSync.pushToCloud was actually called', client._pushCalls() >= 1);
  await waitUntil(() => sandbox.window.AutoSync.getState().status === 'synced', 2000);
  check('AutoSync ends in "synced"', sandbox.window.AutoSync.getState().status === 'synced');
}

async function test2_manualEquivalentSequence() {
  console.log('\n2. Manual-push-equivalent sequence is used: ForceSave.run() then pushToCloud()');
  const ls = localNewerFixture();
  const client = makeClient({
    sessionUser: { id: 'u1' }, sessionDelayMs: 10, cloudUpdatedAt: HOUR_AGO,
    upsertImpl: () => ({ error: null }),
  });
  const sandbox = buildSandbox({ client, localStorage: ls });
  await waitUntil(() => sandbox._calls.includes('pushToCloud'), 5000);
  const order = sandbox._calls.filter((c) => c === 'run' || c === 'pushToCloud');
  const runIdx = order.indexOf('run');
  const pushIdx = order.indexOf('pushToCloud');
  check('ForceSave.run() was called (the same public method the manual Push/Sync buttons use)', runIdx !== -1);
  check('CloudSync.pushToCloud() was called', pushIdx !== -1);
  check('run() ran before pushToCloud() (same order as the manual button)', runIdx !== -1 && pushIdx !== -1 && runIdx < pushIdx, order.join(','));
}

function test1b_neverCallsMissingFlushAll() {
  console.log('\n1b. auto-sync.js source never calls the non-existent ForceSave.flushAll()');
  check('no "ForceSave.flushAll" reference in scripts/auto-sync.js', !autoSyncSrc.includes('ForceSave.flushAll'));
}

async function test3_successUpdatesLastAutoPush() {
  console.log('\n3. Push success updates AutoSync.getState().lastPushAt');
  const ls = localNewerFixture();
  const client = makeClient({
    sessionUser: { id: 'u1' }, sessionDelayMs: 10, cloudUpdatedAt: HOUR_AGO,
    upsertImpl: () => ({ error: null }),
  });
  const sandbox = buildSandbox({ client, localStorage: ls });
  await waitUntil(() => !!sandbox.window.AutoSync.getState().lastPushAt, 5000);
  const state = sandbox.window.AutoSync.getState();
  check('lastPushAt is set', !!state.lastPushAt);
  check('lastResult is "success"', state.lastResult === 'success', state.lastResult);
  check('lastReason reports "Auto push succeeded HH:MM"', /^Auto push succeeded \d{2}:\d{2}$/.test(state.lastReason), state.lastReason);
  const meta = sandbox.window.CloudSync.loadMeta();
  check('cloudSyncMeta.lastPushedAt updated after success', !!meta.lastPushedAt);
}

async function test4_failureClearsInFlightAndShowsError() {
  console.log('\n4. Push failure clears the in-flight guard and shows a visible error');
  const ls = localNewerFixture();
  const client = makeClient({
    sessionUser: { id: 'u1' }, sessionDelayMs: 10, cloudUpdatedAt: HOUR_AGO,
    upsertImpl: () => ({ error: { message: 'network down' } }),
  });
  const sandbox = buildSandbox({ client, localStorage: ls });
  await waitUntil(() => sandbox.window.AutoSync.getState().status === 'action-needed', 5000);
  const state = sandbox.window.AutoSync.getState();
  check('status is "action-needed" (not stuck on "syncing")', state.status === 'action-needed', state.status);
  check('lastError recorded', state.lastError === 'network down', state.lastError);
  check('visible reason is "Auto push failed: <message>"', state.lastReason === 'Auto push failed: network down', state.lastReason);
  // In-flight guard released: refresh() (=runCheck) must be able to attempt
  // another push right away, not be blocked by a stuck flag from the failure.
  client.upsertImpl = () => ({ error: null }); // eslint-disable-line no-unused-vars -- illustrative only, real client below
  const client2Calls = client._pushCalls();
  sandbox.window.CloudSync.pushToCloud = async () => { client2Calls; return { ok: true, updatedAt: new Date().toISOString(), keyCount: 1 }; };
  sandbox.window.AutoSync.refresh();
  await waitUntil(() => sandbox.window.AutoSync.getState().status === 'synced', 2000);
  check('a later check can push again immediately (in-flight guard was released)', sandbox.window.AutoSync.getState().status === 'synced');
}

async function test5_dedupCannotSkipLocalNewer() {
  console.log('\n5. Local-newer can never be dedup/hash-skipped');
  // Real setInterval (WATCHDOG_MS patched down) so a *second* check happens
  // with zero new localStorage writes and an unchanged payload, while the
  // mock cloud row never advances after the first push — the exact
  // condition any hash/signature dedup would treat as "already synced".
  const patched = autoSyncSrc.replace('var WATCHDOG_MS = 10000;', 'var WATCHDOG_MS = 40;');
  if (patched === autoSyncSrc) throw new Error('WATCHDOG_MS constant not found to patch — harness is out of sync with auto-sync.js');
  const ls = localNewerFixture();
  const client = makeClient({
    sessionUser: { id: 'u1' }, sessionDelayMs: 10,
    cloudUpdatedAt: HOUR_AGO, // never advances -> getSyncStatus() keeps reading local-newer even after a push
    upsertImpl: () => ({ error: null }),
  });
  const sandbox = buildSandbox({ client, localStorage: ls, autoSyncSource: patched, realInterval: true });
  await waitUntil(() => client._pushCalls() >= 1, 5000);
  check('first push happened', client._pushCalls() >= 1, client._pushCalls());
  await waitUntil(() => sandbox.window.AutoSync.getState().status === 'synced', 2000);

  const secondPushHappened = await waitUntil(() => client._pushCalls() >= 2, 2000);
  check('an unchanged-payload watchdog tick while status is local-newer still pushes again (no dedup-skip)', secondPushHappened, 'pushCalls=' + client._pushCalls());
}

// Tests 6-8 target the "stuck on pushing forever" bug: the push sequence
// used to be wrapped in try/finally with no catch, so a throw/rejection
// anywhere between flushAll() and the result being read left state stuck on
// 'syncing' ("-> pushing") with no visible error, forever, even though
// pushInFlight was silently cleared. Each proves a different throw site
// is now caught, surfaced, and the guard is still released afterwards.

async function test6_forceSaveThrowClearsPushingAndShowsError() {
  console.log('\n6. ForceSave.run() throwing stops the push safely, shows an error, and clears "pushing" (not stuck)');
  const ls = localNewerFixture();
  const client = makeClient({
    sessionUser: { id: 'u1' }, sessionDelayMs: 10, cloudUpdatedAt: HOUR_AGO,
    upsertImpl: () => ({ error: null }),
  });
  let shouldThrow = true;
  const sandbox = buildSandbox({
    client, localStorage: ls,
    flushSpy: () => { if (shouldThrow) throw new Error('flush boom'); return { ok: true, timestamp: new Date().toISOString() }; },
  });
  // checkCloudLoad() also calls ForceSave.run() (unrelated to the push path
  // under test here) — disable it via isAvailable() so the shared run()
  // mock throwing doesn't also blow up that unrelated code path.
  sandbox.window.CloudSync.isAvailable = () => false;
  await waitUntil(() => sandbox.window.AutoSync.getState().status === 'action-needed', 5000);
  const state = sandbox.window.AutoSync.getState();
  check('status is "action-needed" (not stuck on "syncing"/"pushing")', state.status === 'action-needed', state.status);
  check('lastReason shows the exact ForceSave error', state.lastReason === 'Auto push failed: flush boom', state.lastReason);
  check('lastError recorded', state.lastError === 'flush boom', state.lastError);
  check('CloudSync.pushToCloud() was never called — push stopped safely before the cloud call', !sandbox._calls.includes('pushToCloud'), sandbox._calls.join(','));
  // Guard released even after a throw: a later check can push again.
  shouldThrow = false;
  sandbox.window.AutoSync.refresh();
  await waitUntil(() => sandbox.window.AutoSync.getState().status === 'synced', 2000);
  check('in-flight guard was released after the throw (a later check succeeds)', sandbox.window.AutoSync.getState().status === 'synced');
  check('the successful retry did call pushToCloud()', sandbox._calls.includes('pushToCloud'));
}

async function test7_pushToCloudRejectionClearsPushingAndShowsError() {
  console.log('\n7. CloudSync.pushToCloud() rejecting shows an error and clears "pushing" (not stuck)');
  const ls = localNewerFixture();
  const client = makeClient({
    sessionUser: { id: 'u1' }, sessionDelayMs: 10, cloudUpdatedAt: HOUR_AGO,
    upsertImpl: () => ({ error: null }),
  });
  const sandbox = buildSandbox({ client, localStorage: ls });
  // Simulate pushToCloud() itself rejecting instead of resolving {ok:false} —
  // e.g. a bug or an unexpected exception outside its own try/catch.
  sandbox.window.CloudSync.pushToCloud = () => Promise.reject(new Error('boom-reject'));
  sandbox.window.AutoSync.refresh();
  await waitUntil(() => sandbox.window.AutoSync.getState().status === 'action-needed', 5000);
  const state = sandbox.window.AutoSync.getState();
  check('status is "action-needed" (not stuck on "syncing"/"pushing")', state.status === 'action-needed', state.status);
  check('lastReason shows the exact rejection message', state.lastReason === 'Auto push failed: boom-reject', state.lastReason);
  check('lastError recorded', state.lastError === 'boom-reject', state.lastError);
}

async function test8_pushToCloudTimeoutClearsPushingAndShowsTimeout() {
  console.log('\n8. CloudSync.pushToCloud() hanging past the timeout shows "timed out" and clears "pushing"');
  const patched = autoSyncSrc.replace('var PUSH_TIMEOUT_MS = 20000;', 'var PUSH_TIMEOUT_MS = 50;');
  if (patched === autoSyncSrc) throw new Error('PUSH_TIMEOUT_MS constant not found to patch — harness is out of sync with auto-sync.js');
  const ls = localNewerFixture();
  const client = makeClient({
    sessionUser: { id: 'u1' }, sessionDelayMs: 10, cloudUpdatedAt: HOUR_AGO,
    upsertImpl: () => ({ error: null }),
  });
  const sandbox = buildSandbox({ client, localStorage: ls, autoSyncSource: patched });
  // Simulate a hung network call: a promise that never settles.
  sandbox.window.CloudSync.pushToCloud = () => new Promise(() => {});
  await waitUntil(() => sandbox.window.AutoSync.getState().status === 'action-needed', 2000);
  const state = sandbox.window.AutoSync.getState();
  check('status is "action-needed" (not stuck on "syncing"/"pushing")', state.status === 'action-needed', state.status);
  check('lastReason is "Auto push timed out"', state.lastReason === 'Auto push timed out', state.lastReason);
  check('lastResult is "failed"', state.lastResult === 'failed', state.lastResult);
}

(async function main() {
  console.log('AutoSync v3 harness');
  await test1_localNewerCallsPush();
  test1b_neverCallsMissingFlushAll();
  await test2_manualEquivalentSequence();
  await test3_successUpdatesLastAutoPush();
  await test4_failureClearsInFlightAndShowsError();
  await test5_dedupCannotSkipLocalNewer();
  await test6_forceSaveThrowClearsPushingAndShowsError();
  await test7_pushToCloudRejectionClearsPushingAndShowsError();
  await test8_pushToCloudTimeoutClearsPushingAndShowsTimeout();
  console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
  process.exit(failures === 0 ? 0 : 1);
})();
