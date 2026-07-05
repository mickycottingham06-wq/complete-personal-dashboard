// =============================================================
// Backup / Data Management — shared data layer.
// Owns the `backupSettings` localStorage key (dataVersion,
// lastBackupDate, cloudSyncProvider, cloudSyncStatus, backupNotes).
// Also owns the export/import/validate logic for the whole Life OS
// dataset. No network calls, no auth, no database — this is the
// local-first foundation a future real cloud sync (see `integrations`
// → cloudSync) can build on without changing this shape.
//
// Any page (the full page at pages/integrations.html) reads/writes
// through this file instead of touching localStorage directly.
// =============================================================
(function () {
  'use strict';

  var KEY = 'backupSettings';
  var DATA_VERSION = '1.0.0';
  var APP_ID = 'micky-life-os';

  function loadJSON(k, f) { try { return JSON.parse(localStorage.getItem(k)) || f; } catch (e) { return f; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function nowIso() { return new Date().toISOString(); }

  function defaultBackupSettings() {
    return {
      dataVersion: DATA_VERSION,
      lastBackupDate: '',
      cloudSyncProvider: '',
      cloudSyncStatus: 'Not connected',
      backupNotes: '',
    };
  }

  // Reads stored settings, filling in any missing fields against the
  // default shape so older saved data upgrades cleanly.
  function load() {
    var stored = loadJSON(KEY, null);
    var d = defaultBackupSettings();
    if (!stored || typeof stored !== 'object') { saveJSON(KEY, d); return d; }
    Object.keys(d).forEach(function (field) {
      if (!(field in stored)) stored[field] = d[field];
    });
    return stored;
  }

  function save(state) { saveJSON(KEY, state); }

  function setField(field, value) {
    var state = load();
    state[field] = value;
    save(state);
    return state;
  }

  // Builds the full export payload: every key currently in localStorage,
  // captured as raw strings (no re-encoding, so nothing round-trips
  // through a second JSON pass). This is the whole Life OS dataset —
  // Daily Snapshot, Streaks, every HQ page, Integrations, Settings, the
  // daily goal-ticker keys, water tracker, WHOOP tokens, everything.
  function buildExport() {
    var data = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      data[k] = localStorage.getItem(k);
    }
    return {
      meta: {
        app: APP_ID,
        dataVersion: DATA_VERSION,
        exportedAt: nowIso(),
        keyCount: Object.keys(data).length,
      },
      data: data,
    };
  }

  // Never throws — always returns { ok, error }. Deliberately loose on
  // dataVersion (future versions should still be importable) but strict
  // on the basic shape so a random/corrupt JSON file can't be applied.
  function validate(payload) {
    if (!payload || typeof payload !== 'object') return { ok: false, error: 'Not a valid backup file.' };
    if (!payload.meta || typeof payload.meta !== 'object') return { ok: false, error: 'Missing backup metadata.' };
    if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) return { ok: false, error: 'Missing backup data.' };
    if (payload.meta.app && payload.meta.app !== APP_ID) return { ok: false, error: 'This file isn\'t a Micky Life OS backup.' };
    var keys = Object.keys(payload.data);
    if (!keys.length) return { ok: false, error: 'Backup file is empty.' };
    for (var i = 0; i < keys.length; i++) {
      if (typeof payload.data[keys[i]] !== 'string') return { ok: false, error: 'Backup data is malformed.' };
    }
    return { ok: true, error: '', keyCount: keys.length };
  }

  // Writes every key from the backup into localStorage. Only touches
  // keys present in the backup — never clears keys the backup doesn't
  // mention. Caller is responsible for confirming with the user first.
  function apply(payload) {
    var check = validate(payload);
    if (!check.ok) return { ok: false, error: check.error };
    try {
      Object.keys(payload.data).forEach(function (k) {
        localStorage.setItem(k, payload.data[k]);
      });
      return { ok: true, error: '', keyCount: check.keyCount };
    } catch (e) {
      return { ok: false, error: 'Could not write backup to local storage.' };
    }
  }

  function markBackupDone() {
    var state = load();
    state.lastBackupDate = nowIso();
    save(state);
    return state;
  }

  window.Backup = {
    KEY: KEY,
    DATA_VERSION: DATA_VERSION,
    defaultBackupSettings: defaultBackupSettings,
    load: load,
    save: save,
    setField: setField,
    buildExport: buildExport,
    validate: validate,
    apply: apply,
    markBackupDone: markBackupDone,
  };
})();
