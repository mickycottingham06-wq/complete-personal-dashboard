// =============================================================
// Cloud Sync — one private JSON state row per signed-in user
// (public.life_os_state, RLS: auth.uid() = user_id).
//
// Builds on scripts/supabase-status.js (window.SupabaseFoundation),
// scripts/supabase-auth.js (window.SupabaseAuth) and
// scripts/backup-data.js (window.Backup: the payload excludes
// credentials and per-device bookkeeping).
//
// Conflict safety: this device remembers the cloud row's updated_at it
// last pushed or pulled (meta.lastCloudSeenAt). Status compares both
// sides against that:
//   cloud unchanged + local unchanged → synced
//   cloud unchanged + local changed   → local-newer  (safe to push)
//   cloud changed   + local unchanged → cloud-newer  (safe to load)
//   cloud changed   + local changed   → conflict     (user must choose)
// Automatic pushes are conditional: the update only applies if the row's
// updated_at is still the version this device last saw, so a newer save
// from another device can never be silently overwritten (even if this
// device was offline or stale). Only an explicit user choice (force)
// replaces a newer cloud copy.
//
// Safe when Supabase isn't configured or no one is signed in: every
// method resolves { ok:false, error } instead of throwing.
// =============================================================
(function () {
  'use strict';

  var TABLE = 'life_os_state';
  var META_KEY = 'cloudSyncMeta';

  // Keys that exist on every device just from opening the app (defaults,
  // settings, bookkeeping) — they don't make a never-synced device "changed".
  var BOOTSTRAP_KEYS = { cloudSyncMeta: 1, integrations: 1, backupSettings: 1, autoSyncCloudPromptSeen: 1 };

  function loadJSON(k, f) { try { return JSON.parse(localStorage.getItem(k)) || f; } catch (e) { return f; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function client() { return (window.SupabaseFoundation && window.SupabaseFoundation.getClient()) || null; }
  function isConfigured() { return !!(window.SupabaseFoundation && window.SupabaseFoundation.isConfigured()); }
  function currentUser() { var st = window.SupabaseAuth && window.SupabaseAuth.getState(); return (st && st.user) || null; }
  function isSignedIn() { return !!currentUser(); }
  function isAvailable() { return isConfigured() && isSignedIn(); }
  function errMsg(e) { return (e && e.message) ? e.message : String(e); }
  function ms(iso) { var t = Date.parse(iso); return isNaN(t) ? null : t; }
  function sameInstant(a, b) { var x = ms(a), y = ms(b); return x !== null && x === y; }
  function portable(k) { return window.Backup && window.Backup.isPortableKey ? window.Backup.isPortableKey(k) : true; }

  function loadMeta() { return loadJSON(META_KEY, { lastPushedAt: '', lastPulledAt: '', lastError: '', lastErrorAt: '', lastCloudSeenAt: '', lastSyncAt: '', userId: '' }); }
  function setMeta(patch) {
    var m = loadMeta();
    Object.keys(patch).forEach(function (k) { m[k] = patch[k]; });
    saveJSON(META_KEY, m);
    return m;
  }
  function recordError(message) { setMeta({ lastError: message, lastErrorAt: new Date().toISOString() }); }
  function clearError() { setMeta({ lastError: '', lastErrorAt: '' }); }

  // Latest ISO-8601 UTC timestamp found in portable data, or the dedicated
  // localChangedAt marker auto-sync stamps on every meaningful edit.
  function latestLocalTimestamp() {
    var re = /"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)"/g;
    var max = null;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k === META_KEY || !portable(k)) continue;
      var v = localStorage.getItem(k);
      if (!v) continue;
      var m;
      re.lastIndex = 0;
      while ((m = re.exec(v))) { if (!max || m[1] > max) max = m[1]; }
    }
    var localChangedAt = loadMeta().localChangedAt;
    if (localChangedAt && (!max || localChangedAt > max)) max = localChangedAt;
    return max;
  }

  function hasLocalData() {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (portable(k) && !BOOTSTRAP_KEYS[k]) return true;
    }
    return false;
  }

  // Has this device changed anything since it last synced?
  function localChanged() {
    var meta = loadMeta();
    if (!meta.lastCloudSeenAt) return hasLocalData(); // never synced: any real data counts
    var changed = ms(meta.localChangedAt), synced = ms(meta.lastSyncAt);
    return changed !== null && (synced === null || changed > synced);
  }

  async function getCloudStatus() {
    if (!isConfigured()) return { ok: true, configured: false, signedIn: false, exists: false };
    if (!isSignedIn()) return { ok: true, configured: true, signedIn: false, exists: false };
    var c = client();
    if (!c) return { ok: false, configured: true, signedIn: true, exists: false, error: 'Supabase client unavailable.' };
    try {
      var res = await c.from(TABLE).select('data_version, updated_at').eq('user_id', currentUser().id).maybeSingle();
      if (res.error) return { ok: false, configured: true, signedIn: true, exists: false, error: errMsg(res.error) };
      var row = res.data;
      return { ok: true, configured: true, signedIn: true, exists: !!row, updatedAt: row ? row.updated_at : '', dataVersion: row ? row.data_version : '' };
    } catch (e) {
      return { ok: false, configured: true, signedIn: true, exists: false, error: errMsg(e) };
    }
  }

  function settle(updatedAt, how) {
    var now = new Date().toISOString();
    var patch = { lastCloudSeenAt: updatedAt, lastSyncAt: now, localChangedAt: now, userId: currentUser().id };
    patch[how === 'pull' ? 'lastPulledAt' : 'lastPushedAt'] = now;
    setMeta(patch);
    clearError();
  }

  // Pushes this device's portable data.
  //   default: conditional — only replaces the row if it is still the version
  //            this device last saw (or creates it if none exists). Returns
  //            { ok:false, conflict:true } if another device saved in between.
  //   { force:true }: explicit user choice — replaces whatever is there.
  async function pushToCloud(opts) {
    opts = opts || {};
    if (!isConfigured()) return { ok: false, error: 'Supabase is not configured.' };
    if (!isSignedIn()) return { ok: false, error: 'Sign in first.' };
    if (!window.Backup) return { ok: false, error: 'Backup module not loaded.' };
    var c = client();
    if (!c) return { ok: false, error: 'Supabase client unavailable.' };
    try {
      var user = currentUser();
      var meta = loadMeta();
      var payload = window.Backup.buildExport();
      var nowIso = new Date().toISOString();
      var row = { data: payload.data, data_version: payload.meta.dataVersion, updated_at: nowIso };
      var res;
      if (opts.force) {
        res = await c.from(TABLE).upsert(Object.assign({ user_id: user.id }, row), { onConflict: 'user_id' }).select('updated_at');
      } else if (meta.lastCloudSeenAt && meta.userId === user.id) {
        res = await c.from(TABLE).update(row).eq('user_id', user.id).eq('updated_at', meta.lastCloudSeenAt).select('updated_at');
        if (!res.error && (!res.data || !res.data.length)) {
          var msg = 'The cloud copy was changed by another device — choose which to keep in Settings.';
          recordError(msg);
          return { ok: false, conflict: true, error: msg };
        }
      } else {
        res = await c.from(TABLE).insert(Object.assign({ user_id: user.id }, row)).select('updated_at');
        if (res.error && (res.error.code === '23505' || /duplicate|unique/i.test(errMsg(res.error)))) {
          var msg2 = 'A cloud copy already exists — choose which to keep in Settings.';
          recordError(msg2);
          return { ok: false, conflict: true, error: msg2 };
        }
      }
      if (res.error) { recordError(errMsg(res.error)); return { ok: false, error: errMsg(res.error) }; }
      var saved = (res.data && res.data[0] && res.data[0].updated_at) || nowIso;
      settle(saved, 'push');
      return { ok: true, updatedAt: saved, keyCount: payload.meta.keyCount };
    } catch (e) {
      recordError(errMsg(e));
      return { ok: false, error: errMsg(e) };
    }
  }

  // Replaces this device's portable data with the cloud copy (credentials and
  // device bookkeeping are never written). Caller confirms with the user first.
  async function pullToLocal() {
    if (!isConfigured()) return { ok: false, error: 'Supabase is not configured.' };
    if (!isSignedIn()) return { ok: false, error: 'Sign in first.' };
    if (!window.Backup) return { ok: false, error: 'Backup module not loaded.' };
    var c = client();
    if (!c) return { ok: false, error: 'Supabase client unavailable.' };
    try {
      var res = await c.from(TABLE).select('data, data_version, updated_at').eq('user_id', currentUser().id).maybeSingle();
      if (res.error) { recordError(errMsg(res.error)); return { ok: false, error: errMsg(res.error) }; }
      if (!res.data) { var noData = 'No cloud data found for this account yet — save from a device first.'; recordError(noData); return { ok: false, error: noData }; }
      var applied = window.Backup.apply({ meta: { dataVersion: res.data.data_version }, data: res.data.data });
      if (!applied.ok) { recordError(applied.error); return { ok: false, error: applied.error }; }
      settle(res.data.updated_at, 'pull');
      return { ok: true, keyCount: applied.keyCount, updatedAt: res.data.updated_at };
    } catch (e) {
      recordError(errMsg(e));
      return { ok: false, error: errMsg(e) };
    }
  }

  function lastDeviceSyncAt() { return loadMeta().lastSyncAt || ''; }

  // Single source of truth for sync status shown in Settings and used by
  // auto-sync: local-only, signed-out, error, cloud-ready, synced,
  // local-newer, cloud-newer, conflict.
  async function getSyncStatus() {
    if (!isConfigured()) return { code: 'local-only', label: 'Local only' };
    if (!isSignedIn()) return { code: 'signed-out', label: 'Signed out' };
    var status = await getCloudStatus();
    if (!status.ok) return { code: 'error', label: 'Sync error', error: status.error };
    var meta = loadMeta();
    var mine = meta.userId === currentUser().id ? meta.lastCloudSeenAt : '';
    var local = localChanged();
    if (!status.exists) return { code: 'cloud-ready', label: 'Cloud ready', localChanged: local };
    var cloudChanged = !mine || !sameInstant(status.updatedAt, mine);
    if (cloudChanged && local) return { code: 'conflict', label: 'Both changed', cloudUpdatedAt: status.updatedAt };
    if (cloudChanged) return { code: 'cloud-newer', label: 'Cloud newer', cloudUpdatedAt: status.updatedAt };
    if (local) return { code: 'local-newer', label: 'Local newer' };
    return { code: 'synced', label: 'Synced' };
  }

  window.CloudSync = {
    TABLE: TABLE,
    isConfigured: isConfigured,
    isSignedIn: isSignedIn,
    isAvailable: isAvailable,
    hasLocalData: hasLocalData,
    latestLocalTimestamp: latestLocalTimestamp,
    lastDeviceSyncAt: lastDeviceSyncAt,
    getCloudStatus: getCloudStatus,
    getSyncStatus: getSyncStatus,
    pushToCloud: pushToCloud,
    pullToLocal: pullToLocal,
    loadMeta: loadMeta,
    setMeta: setMeta,
  };
})();
