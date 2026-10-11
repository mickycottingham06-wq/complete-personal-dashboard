// =============================================================
// Browser client for the protected /api/assistant endpoint, shared by
// the Assistant and Content pages. AI counts as available only when the
// server reports every protection configured AND this browser has a
// Supabase session to send — the server still verifies the session,
// allowlist and usage limit itself on every request.
// =============================================================
(function () {
  'use strict';

  function accessToken() {
    var st = window.SupabaseAuth ? window.SupabaseAuth.getState() : null;
    return (st && st.session && st.session.access_token) || '';
  }

  async function status() {
    try {
      var r = await fetch('/api/assistant', { headers: { Accept: 'application/json' } });
      if (!r.ok) return { available: false, reason: 'The AI route isn\'t available on this server (local preview or not deployed).' };
      var j = await r.json();
      if (!j.enabled) return { available: false, reason: 'Not fully set up on the server — missing ' + (j.missing || []).join(', ') + '.' };
      if (!accessToken()) return { available: false, reason: 'Sign in under Menu → Account to use AI.' };
      return { available: true, model: j.model };
    } catch (e) {
      return { available: false, reason: 'The AI route couldn\'t be reached.' };
    }
  }

  // Returns { ok, data, model } or { ok:false, error }. Never throws.
  // extra: optional top-level fields (only `roleId` is used, by Workforce;
  // the server validates it and owns every system prompt).
  async function ask(mode, question, context, extra) {
    var token = accessToken();
    if (!token) return { ok: false, error: 'Sign in to use AI.' };
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 45000) : null;
    try {
      var r = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ mode: mode, question: question || '', context: context, roleId: extra && extra.roleId ? String(extra.roleId) : undefined }),
        signal: ctrl ? ctrl.signal : undefined,
      });
      var j = null;
      try { j = await r.json(); } catch (e) {}
      if (!r.ok || !j || !j.ok) return { ok: false, error: (j && j.error) || ('AI request failed (' + r.status + ').') };
      return { ok: true, data: j.data, model: j.model };
    } catch (e) {
      return { ok: false, error: e && e.name === 'AbortError' ? 'AI request timed out.' : 'Could not reach the AI route.' };
    } finally { if (timer) clearTimeout(timer); }
  }

  window.AiClient = { accessToken: accessToken, status: status, ask: ask };
})();
