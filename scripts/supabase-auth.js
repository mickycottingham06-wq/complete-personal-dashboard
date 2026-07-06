// =============================================================
// Supabase Auth foundation — sign up / sign in / sign out + status.
//
// Phase 2 of docs/SUPABASE_PLAN.md. Builds on scripts/supabase-status.js
// (window.SupabaseFoundation) for the client — this file adds nothing to
// that module's env-var reading, it only consumes SupabaseFoundation.getClient().
//
// Auth only. This does NOT read/write any dashboard data, does NOT touch
// Local Storage, and does NOT sync anything to a database table. Signing
// in only changes window.SupabaseAuth.getState() — every HQ page keeps
// using its existing Local Storage load()/save() exactly as before.
//
// Safe when Supabase isn't configured: every method resolves with
// { error } instead of throwing, and getState().configured is false.
//
// Requires (optional — safe if absent, same as SupabaseFoundation):
//   <script src="/api/config"></script>
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//   <script src="supabase-status.js"></script>
// =============================================================
(function () {
  'use strict';

  let state = { loading: false, error: null, user: null, session: null };
  let listeners = [];
  let initialized = false;

  function notify() {
    listeners.slice().forEach((fn) => {
      try { fn(state); } catch (e) { /* listener's own problem */ }
    });
  }

  function setState(patch) {
    state = Object.assign({}, state, patch);
    notify();
  }

  function client() {
    return (window.SupabaseFoundation && window.SupabaseFoundation.getClient()) || null;
  }

  function isConfigured() {
    return !!(window.SupabaseFoundation && window.SupabaseFoundation.isConfigured());
  }

  function errMsg(e) {
    return (e && e.message) ? e.message : String(e);
  }

  async function refresh() {
    const c = client();
    if (!c) { setState({ loading: false, error: null, user: null, session: null }); return; }
    setState({ loading: true, error: null });
    try {
      const { data, error } = await c.auth.getSession();
      if (error) throw error;
      const session = data && data.session ? data.session : null;
      setState({ loading: false, error: null, session: session, user: session ? session.user : null });
    } catch (e) {
      setState({ loading: false, error: errMsg(e) });
    }
  }

  // Starts listening for auth changes (e.g. token refresh, sign-in from
  // another tab). Safe to call multiple times — only wires once.
  function init() {
    if (initialized) return;
    initialized = true;
    const c = client();
    if (!c) { setState({ loading: false }); return; }
    refresh();
    c.auth.onAuthStateChange((_event, session) => {
      setState({ error: null, session: session || null, user: session ? session.user : null });
    });
  }

  async function signUp(email, password) {
    const c = client();
    if (!c) { const msg = 'Supabase is not configured.'; setState({ error: msg }); return { error: msg }; }
    setState({ loading: true, error: null });
    try {
      const { data, error } = await c.auth.signUp({ email: email, password: password });
      if (error) { setState({ loading: false, error: error.message }); return { error: error.message }; }
      const session = data && data.session ? data.session : null;
      setState({ loading: false, error: null, session: session, user: session ? session.user : (data && data.user) || null });
      return { data: data };
    } catch (e) {
      const msg = errMsg(e);
      setState({ loading: false, error: msg });
      return { error: msg };
    }
  }

  async function signIn(email, password) {
    const c = client();
    if (!c) { const msg = 'Supabase is not configured.'; setState({ error: msg }); return { error: msg }; }
    setState({ loading: true, error: null });
    try {
      const { data, error } = await c.auth.signInWithPassword({ email: email, password: password });
      if (error) { setState({ loading: false, error: error.message }); return { error: error.message }; }
      const session = data && data.session ? data.session : null;
      setState({ loading: false, error: null, session: session, user: session ? session.user : null });
      return { data: data };
    } catch (e) {
      const msg = errMsg(e);
      setState({ loading: false, error: msg });
      return { error: msg };
    }
  }

  async function signOut() {
    const c = client();
    if (!c) return { error: 'Supabase is not configured.' };
    setState({ loading: true, error: null });
    try {
      const { error } = await c.auth.signOut();
      if (error) { setState({ loading: false, error: error.message }); return { error: error.message }; }
      setState({ loading: false, error: null, session: null, user: null });
      return {};
    } catch (e) {
      const msg = errMsg(e);
      setState({ loading: false, error: msg });
      return { error: msg };
    }
  }

  function getState() {
    return Object.assign({}, state, { configured: isConfigured() });
  }

  // Registers a listener, calls it immediately with current state, and
  // returns an unsubscribe function.
  function subscribe(fn) {
    listeners.push(fn);
    fn(getState());
    return function unsubscribe() {
      listeners = listeners.filter((l) => l !== fn);
    };
  }

  window.SupabaseAuth = {
    init: init,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    refresh: refresh,
    getState: getState,
    subscribe: subscribe,
    isConfigured: isConfigured,
  };
})();
