// =============================================================
// One honest sentence about where the user's data currently lives,
// shared by LOCK-IN HQ and Second Brain. Reads window.AutoSync state
// (scripts/auto-sync.js) — a successful localStorage write alone never
// counts as cloud-saved; only a cloud push that finished after the
// latest local change does.
// =============================================================
(function () {
  'use strict';

  function hm(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
  }

  // lastLocalWriteAt: ISO time of this page's most recent verified local write.
  function text(lastLocalWriteAt) {
    var s = window.AutoSync ? window.AutoSync.getState() : null;
    if (!s || s.status === 'not-configured') return 'Saved on this device only — cloud sync is not set up.';
    if (s.status === 'signed-out') return 'Saved on this device only — sign in under Integrations to sync.';
    if (s.status === 'disabled') return 'Saved on this device only — auto cloud save is off.';
    if (s.status === 'offline') return 'Offline — saved on this device; will sync when back online.';
    if (s.status === 'syncing') return 'Syncing to cloud…';
    if (s.status === 'action-needed') return 'Cloud sync needs attention' + (s.reason ? ': ' + s.reason : '.');
    if (s.status === 'synced' && s.lastPushAt && (!lastLocalWriteAt || s.lastPushAt >= lastLocalWriteAt)) return 'Synced to cloud ' + hm(s.lastPushAt) + '.';
    return 'Saved on this device — cloud sync pending.';
  }

  // Keeps node's text current as AutoSync state changes. getLastWrite() is
  // called each time so the page can update its own timestamp freely.
  function bind(node, getLastWrite) {
    function render() { node.textContent = text(getLastWrite()); }
    if (window.AutoSync) window.AutoSync.subscribe(render);
    render();
    return render;
  }

  window.SyncStatusLine = { text: text, bind: bind };
})();
