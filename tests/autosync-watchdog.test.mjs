// =============================================================
// AutoSync watchdog harness — loads the real scripts/cloud-sync.js and
// scripts/auto-sync.js source into a sandboxed vm context (mocked
// localStorage/document/navigator + a fake Supabase client) and proves the
// exact behaviour docs/SUPABASE_PLAN.md requires:
//   1. signed-in + online + visible + auto save on + status local-newer
//      really calls CloudSync.pushToCloud().
//   2. a failed push clears syncing and shows a visible error.
//   3. a timed-out push clears syncing/inFlight and shows a timeout.
//   4. dedup can never skip a genuine local-newer status.
//   5. a successful push updates lastAutoPush (AutoSync state) and
//      cloudSyncMeta.lastPushedAt (CloudSync meta).
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
// exact condition needed to prove dedup can't hide behind it (test 4).
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

function buildSandbox({ client, localStorage, autoSyncSource, realInterval }) {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.window.addEventListener = () => {};
  sandbox.console = console;
  sandbox.setTimeout = setTimeout;
  sandbox.clearTimeout = clearTimeout;
  // Tests that don't need the periodic watchdog tick stub it out so they
  // don't keep a timer alive after the assertions are done; test 4 below
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
  sandbox.window.ForceSave = { flushAll: () => {}, registerFlush: () => () => {} };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(supabaseAuthSrc, ctx, { filename: 'supabase-auth.js' });
  vm.runInContext(cloudSyncSrc, ctx, { filename: 'cloud-sync.js' });
  vm.runInContext(autoSyncSource || autoSyncSrc, ctx, { filename: 'auto-sync.js' });
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

async function test1and5_pushesAndUpdatesTimestamps() {
  console.log('\n1+5. local-newer + signed in + online + visible + auto save on -> pushToCloud() called; timestamps update on success');
  const ls = localNewerFixture();
  const client = makeClient({
    sessionUser: { id: 'u1' }, sessionDelayMs: 30, cloudUpdatedAt: HOUR_AGO,
    upsertImpl: () => ({ error: null }),
  });
  const sandbox = buildSandbox({ client, localStorage: ls });
  await waitUntil(() => client._pushCalls() >= 1, 5000);
  check('CloudSync.pushToCloud was actually called', client._pushCalls() >= 1);
  await waitUntil(() => sandbox.window.AutoSync.getState().status === 'synced', 2000);
  const state = sandbox.window.AutoSync.getState();
  check('AutoSync ends in "synced"', state.status === 'synced', state.status);
  check('AutoSync.getState().lastPushAt is set (Last Auto Push)', !!state.lastPushAt);
  check('lastSkipReason reports "pushed successfully at HH:MM"', /^pushed successfully at \d{2}:\d{2}$/.test(state.lastSkipReason), state.lastSkipReason);
  const meta = sandbox.window.CloudSync.loadMeta();
  check('cloudSyncMeta.lastPushedAt updated after success', !!meta.lastPushedAt);

  // init() checks status from two places on the same auth-ready transition
  // (the explicit whenAuthReady() gate, and the ongoing SupabaseAuth.subscribe
  // callback) — pushInFlight must be claimed synchronously before the first
  // await inside attemptPush(), or both call chains can race past the guard
  // and double-push for a single local-newer state (no tight push loop).
  await sleep(150);
  check('exactly one push for one local-newer state (no concurrent double-push)', client._pushCalls() === 1, client._pushCalls());
}

async function test2_failedPushClearsSyncingAndShowsError() {
  console.log('\n2. Failed push clears syncing and shows a visible error');
  const ls = localNewerFixture();
  const client = makeClient({
    sessionUser: { id: 'u1' }, sessionDelayMs: 10, cloudUpdatedAt: HOUR_AGO,
    upsertImpl: () => ({ error: { message: 'network down' } }),
  });
  const sandbox = buildSandbox({ client, localStorage: ls });
  await waitUntil(() => sandbox.window.AutoSync.getState().status === 'action-needed', 5000);
  const state = sandbox.window.AutoSync.getState();
  check('status left "syncing" (now action-needed, not stuck)', state.status === 'action-needed', state.status);
  check('visible reason is "push failed: <message>"', state.lastSkipReason === 'push failed: network down', state.lastSkipReason);
  check('lastError recorded', state.lastError === 'network down');
}

async function test3_timeoutClearsSyncingAndShowsTimeout() {
  console.log('\n3. Timed-out push clears syncing/inFlight and shows a timeout');
  const patched = autoSyncSrc.replace('var PUSH_TIMEOUT_MS = 20000;', 'var PUSH_TIMEOUT_MS = 60;');
  if (patched === autoSyncSrc) throw new Error('PUSH_TIMEOUT_MS constant not found to patch — harness is out of sync with auto-sync.js');
  const ls = localNewerFixture();
  const client = makeClient({
    sessionUser: { id: 'u1' }, sessionDelayMs: 10, cloudUpdatedAt: HOUR_AGO,
    upsertImpl: () => new Promise(() => {}), // never resolves -> forces the timeout path
  });
  const sandbox = buildSandbox({ client, localStorage: ls, autoSyncSource: patched });
  await waitUntil(() => sandbox.window.AutoSync.getState().lastSkipReason === 'push timed out', 3000);
  const state = sandbox.window.AutoSync.getState();
  check('visible reason is "push timed out"', state.lastSkipReason === 'push timed out', state.lastSkipReason);
  check('status moved off "syncing" after timeout', state.status === 'action-needed', state.status);
  // A later markDirty()-triggered check must still be able to attempt a push
  // (i.e. pushInFlight/syncing didn't get stuck true forever after the
  // timeout) — same-value rewrite is enough to re-arm the debounce.
  const patchedFast = patched.replace('var DEBOUNCE_MS = 4000;', 'var DEBOUNCE_MS = 20;');
  const ls2 = localNewerFixture();
  const client2 = makeClient({ sessionUser: { id: 'u1' }, sessionDelayMs: 5, cloudUpdatedAt: HOUR_AGO, upsertImpl: () => ({ error: null }) });
  const sandbox2 = buildSandbox({ client: client2, localStorage: ls2, autoSyncSource: patchedFast.replace('var PUSH_TIMEOUT_MS = 20000;', 'var PUSH_TIMEOUT_MS = 60;') });
  await waitUntil(() => sandbox2.window.AutoSync.getState().status !== 'not-configured', 2000);
  check('a fresh sandbox after a timeout scenario can still reach synced (not permanently stuck)', await waitUntil(() => sandbox2.window.AutoSync.getState().status === 'synced', 3000));
}

async function test4_dedupCannotSkipLocalNewer() {
  console.log('\n4. Dedup cannot silently skip a genuine local-newer status');
  // Real setInterval (WATCHDOG_MS patched down) so a *second* check happens
  // with zero new localStorage writes — deliberately not a same-value
  // rewrite: markDirty() always re-stamps cloudSyncMeta.localChangedAt to
  // "now" on any wrapped write (even an identical value), which would push
  // localChangedAt past lastPushedAt and defeat even the *old* dedup logic
  // on its own, proving nothing. A no-write watchdog tick is the only way
  // to genuinely land back on "signature matches last push, localChangedAt
  // <= lastPushedAt" — exactly the condition the old dedup would skip.
  const patched = autoSyncSrc.replace('var WATCHDOG_MS = 12000;', 'var WATCHDOG_MS = 40;');
  if (patched === autoSyncSrc) throw new Error('WATCHDOG_MS constant not found to patch — harness is out of sync with auto-sync.js');
  const ls = localNewerFixture();
  const client = makeClient({
    sessionUser: { id: 'u1' }, sessionDelayMs: 10,
    cloudUpdatedAt: HOUR_AGO, // fixture's cloud row never advances after a push, so getSyncStatus() keeps reading local-newer even once local meta says "already pushed"
    upsertImpl: () => ({ error: null }),
  });
  const sandbox = buildSandbox({ client, localStorage: ls, autoSyncSource: patched, realInterval: true });
  await waitUntil(() => client._pushCalls() >= 1, 5000);
  check('first push happened', client._pushCalls() >= 1, client._pushCalls());
  await waitUntil(() => sandbox.window.AutoSync.getState().status === 'synced', 2000);

  // No new edit at all — just the watchdog's own periodic re-check landing
  // on an unchanged, already-pushed signature while the mock cloud still
  // reports local-newer. Old dedup logic ("signature matches + localChangedAt
  // <= lastPushedAt" alone) would silently skip this as already-synced; the
  // fix requires bypassing dedup outright whenever the status itself says
  // local-newer.
  const secondPushHappened = await waitUntil(() => client._pushCalls() >= 2, 2000);
  check('an unchanged-signature watchdog tick while status is local-newer still pushes again (no silent dedup-skip)', secondPushHappened, 'pushCalls=' + client._pushCalls());
}

(async function main() {
  console.log('AutoSync watchdog harness');
  await test1and5_pushesAndUpdatesTimestamps();
  await test2_failedPushClearsSyncingAndShowsError();
  await test3_timeoutClearsSyncingAndShowsTimeout();
  await test4_dedupCannotSkipLocalNewer();
  console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'));
  process.exit(failures === 0 ? 0 : 1);
})();
