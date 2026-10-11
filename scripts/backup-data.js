// =============================================================
// Backup / Data Management — shared data layer.
// Owns the `backupSettings` localStorage key (dataVersion,
// lastBackupDate, cloudSyncProvider, cloudSyncStatus, backupNotes).
// Also owns the export/import/validate logic for the whole Life OS
// dataset. No network calls, no auth, no database — this is the
// local-first foundation a future real cloud sync (see `integrations`
// → cloudSync) can build on without changing this shape.
//
// Any page (Backup lives at pages/settings.html#backup) reads/writes
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

  // Credentials never leave the device: not in exports, not in the cloud
  // copy (CloudSync pushes buildExport()), and never written back by
  // apply() (restores and cloud loads). Listed by key name only.
  //   gcal_tokens_v1     Google Calendar OAuth tokens
  //   whoop_tokens_v1    WHOOP OAuth tokens
  //   nova_lite_api_key  Anthropic key pasted into the removed Nova page
  //   sb-*               Supabase sign-in session (supabase-js storage)
  // plus any key whose name looks like a credential.
  var SECRET_KEYS = { gcal_tokens_v1: 1, whoop_tokens_v1: 1, nova_lite_api_key: 1 };
  function isSecretKey(k) {
    k = String(k || '');
    return !!SECRET_KEYS[k] || k.indexOf('sb-') === 0 || /(token|secret|api[_-]?key|password|credential)/i.test(k);
  }
  // Per-device bookkeeping that must not be copied between devices.
  var DEVICE_KEYS = { cloudSyncMeta: 1, autoSyncCloudPromptSeen: 1 };
  function isPortableKey(k) { return !isSecretKey(k) && !DEVICE_KEYS[k]; }

  // Builds the export payload: every portable key in localStorage, as raw
  // strings — all records, including those from removed pages — minus
  // credentials and per-device bookkeeping. meta.excluded counts what was
  // left out (names are not listed in the file).
  function buildExport() {
    var data = {}, excluded = 0;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (isPortableKey(k)) data[k] = localStorage.getItem(k); else excluded++;
    }
    return {
      meta: {
        app: APP_ID,
        dataVersion: DATA_VERSION,
        exportedAt: nowIso(),
        keyCount: Object.keys(data).length,
        excluded: excluded,
      },
      data: data,
    };
  }

  // Names (never values) of credentials currently stored on this device.
  function storedCredentialKeys() {
    var out = [];
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (isSecretKey(k)) out.push(k); }
    return out;
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

  // Writes every portable key from the backup into localStorage. Only
  // touches keys present in the backup — never clears keys the backup
  // doesn't mention. Credentials and device bookkeeping in older files or
  // cloud copies are skipped. Caller confirms with the user first.
  function apply(payload) {
    var check = validate(payload);
    if (!check.ok) return { ok: false, error: check.error };
    var written = 0, skipped = 0;
    try {
      Object.keys(payload.data).forEach(function (k) {
        if (!isPortableKey(k)) { skipped++; return; }
        localStorage.setItem(k, payload.data[k]);
        written++;
      });
      return { ok: true, error: '', keyCount: written, skipped: skipped };
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

  // Downloads the full export as a JSON file and marks the backup done.
  // Shared by the Data & Backup export button and the "export a backup
  // first" prompts shown before Pull Cloud → This Device overwrites Local
  // Storage — one download implementation instead of duplicating it.
  function downloadExport() {
    try {
      var payload = buildExport();
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'life-os-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      markBackupDone();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'Export failed — please try again.' };
    }
  }

  window.Backup = {
    KEY: KEY,
    DATA_VERSION: DATA_VERSION,
    defaultBackupSettings: defaultBackupSettings,
    load: load,
    save: save,
    setField: setField,
    buildExport: buildExport,
    downloadExport: downloadExport,
    validate: validate,
    apply: apply,
    markBackupDone: markBackupDone,
    isSecretKey: isSecretKey,
    isPortableKey: isPortableKey,
    storedCredentialKeys: storedCredentialKeys,
  };
})();
