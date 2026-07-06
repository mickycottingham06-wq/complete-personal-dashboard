// =============================================================
// Cloud Sync (Phase 1) — one JSON state row per signed-in user.
//
// Builds on scripts/supabase-status.js (window.SupabaseFoundation) and
// scripts/supabase-auth.js (window.SupabaseAuth). Reuses
// scripts/backup-data.js (window.Backup) to build/validate/apply the
// Life OS dataset — this file introduces no new export/import shape, it
// just moves the existing backup payload's `data` object to/from a single
// Supabase row instead of a downloaded file.
//
// Table: public.life_os_state (id, user_id, data jsonb, data_version,
// updated_at, created_at) — one row per user, RLS-scoped to auth.uid().
// See docs/SUPABASE_PLAN.md §17 and SETUP.md for the SQL.
//
// Safe when Supabase isn't configured or no one is signed in: every
// method resolves { ok:false, error } instead of throwing, and nothing
// here ever touches Local Storage unless pullToLocal() is explicitly
// called by the caller (after the caller has confirmed with the user).
// =============================================================
(function () {
  'use strict';

  var TABLE = 'life_os_state';
  var META_KEY = 'cloudSyncMeta';

  function loadJSON(k, f) { try { return JSON.parse(localStorage.getItem(k)) || f; } catch (e) { return f; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function client() {
    return (window.SupabaseFoundation && window.SupabaseFoundation.getClient()) || null;
  }
  function isConfigured() {
    return !!(window.SupabaseFoundation && window.SupabaseFoundation.isConfigured());
  }
  function currentUser() {
    var st = window.SupabaseAuth && window.SupabaseAuth.getState();
    return (st && st.user) || null;
  }
  function isSignedIn() { return !!currentUser(); }
  function isAvailable() { return isConfigured() && isSignedIn(); }

  function errMsg(e) { return (e && e.message) ? e.message : String(e); }

  function loadMeta() { return loadJSON(META_KEY, { lastPushedAt: '', lastPulledAt: '', lastError: '', lastErrorAt: '' }); }
  function setMeta(patch) {
    var m = loadMeta();
    Object.keys(patch).forEach(function (k) { m[k] = patch[k]; });
    saveJSON(META_KEY, m);
    return m;
  }
  // Records the most recent push/pull failure so the Integrations status
  // block can still show it after a reload, not just in the moment.
  // Cleared automatically the next time a push/pull succeeds.
  function recordError(message) {
    setMeta({ lastError: message, lastErrorAt: new Date().toISOString() });
  }
  function clearError() {
    setMeta({ lastError: '', lastErrorAt: '' });
  }

  // Scans every Local Storage value for ISO-8601 UTC timestamps and
  // returns the latest one found. ISO strings with a Z suffix sort
  // lexically in chronological order, so a plain string max is safe.
  // Best-effort only — there's no single "last modified" field tracked
  // across every Life OS section, so this is what "available" means.
  function latestLocalTimestamp() {
    var re = /"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)"/g;
    var max = null;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k === META_KEY) continue;
      var v = localStorage.getItem(k);
      if (!v) continue;
      var m;
      re.lastIndex = 0;
      while ((m = re.exec(v))) {
        if (!max || m[1] > max) max = m[1];
      }
    }
    return max;
  }

  function hasLocalData() {
    for (var i = 0; i < localStorage.length; i++) {
      if (localStorage.key(i) !== META_KEY) return true;
    }
    return false;
  }

  // Cheap status check for the UI (whether a cloud row exists, when it
  // was last updated) without pulling the full data payload.
  async function getCloudStatus() {
    if (!isConfigured()) return { ok: true, configured: false, signedIn: false, exists: false };
    if (!isSignedIn()) return { ok: true, configured: true, signedIn: false, exists: false };
    var c = client();
    if (!c) return { ok: false, configured: true, signedIn: true, exists: false, error: 'Supabase client unavailable.' };
    try {
      var user = currentUser();
      var res = await c.from(TABLE).select('data_version, updated_at').eq('user_id', user.id).maybeSingle();
      if (res.error) return { ok: false, configured: true, signedIn: true, exists: false, error: errMsg(res.error) };
      var row = res.data;
      return {
        ok: true, configured: true, signedIn: true,
        exists: !!row,
        updatedAt: row ? row.updated_at : '',
        dataVersion: row ? row.data_version : '',
      };
    } catch (e) {
      return { ok: false, configured: true, signedIn: true, exists: false, error: errMsg(e) };
    }
  }

  // Pushes the current Local Storage dataset (via window.Backup.buildExport())
  // to this user's single life_os_state row. Overwrites whatever was there.
  // Caller is responsible for confirming with the user first.
  async function pushToCloud() {
    if (!isConfigured()) return { ok: false, error: 'Supabase is not configured.' };
    if (!isSignedIn()) return { ok: false, error: 'Sign in first.' };
    if (!window.Backup) return { ok: false, error: 'Backup module not loaded.' };
    var c = client();
    if (!c) return { ok: false, error: 'Supabase client unavailable.' };
    try {
      var user = currentUser();
      var payload = window.Backup.buildExport();
      var nowIso = new Date().toISOString();
      var res = await c.from(TABLE).upsert({
        user_id: user.id,
        data: payload.data,
        data_version: payload.meta.dataVersion,
        updated_at: nowIso,
      }, { onConflict: 'user_id' });
      if (res.error) { recordError(errMsg(res.error)); return { ok: false, error: errMsg(res.error) }; }
      setMeta({ lastPushedAt: nowIso });
      clearError();
      return { ok: true, updatedAt: nowIso, keyCount: payload.meta.keyCount };
    } catch (e) {
      recordError(errMsg(e));
      return { ok: false, error: errMsg(e) };
    }
  }

  // Pulls this user's cloud row and applies it to Local Storage via
  // window.Backup.apply() — the same validation/overwrite path used for
  // restoring a downloaded backup file. Caller is responsible for
  // confirming with the user first (this never prompts on its own).
  async function pullToLocal() {
    if (!isConfigured()) return { ok: false, error: 'Supabase is not configured.' };
    if (!isSignedIn()) return { ok: false, error: 'Sign in first.' };
    if (!window.Backup) return { ok: false, error: 'Backup module not loaded.' };
    var c = client();
    if (!c) return { ok: false, error: 'Supabase client unavailable.' };
    try {
      var user = currentUser();
      var res = await c.from(TABLE).select('data, data_version, updated_at').eq('user_id', user.id).maybeSingle();
      if (res.error) { recordError(errMsg(res.error)); return { ok: false, error: errMsg(res.error) }; }
      if (!res.data) {
        var noDataMsg = 'No cloud data found for this account yet — push from a device first.';
        recordError(noDataMsg);
        return { ok: false, error: noDataMsg };
      }
      var applied = window.Backup.apply({ meta: { dataVersion: res.data.data_version }, data: res.data.data });
      if (!applied.ok) { recordError(applied.error); return { ok: false, error: applied.error }; }
      setMeta({ lastPulledAt: new Date().toISOString() });
      clearError();
      return { ok: true, keyCount: applied.keyCount, updatedAt: res.data.updated_at };
    } catch (e) {
      recordError(errMsg(e));
      return { ok: false, error: errMsg(e) };
    }
  }

  window.CloudSync = {
    TABLE: TABLE,
    isConfigured: isConfigured,
    isSignedIn: isSignedIn,
    isAvailable: isAvailable,
    hasLocalData: hasLocalData,
    latestLocalTimestamp: latestLocalTimestamp,
    getCloudStatus: getCloudStatus,
    pushToCloud: pushToCloud,
    pullToLocal: pullToLocal,
    loadMeta: loadMeta,
  };
})();
