// =============================================================
// Supabase foundation — client + status helper (future cloud sync).
//
// This is intentionally NOT wired to any page's data yet. It only:
//   - reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
//     (served via /api/config → window.NEXT_PUBLIC_SUPABASE_*)
//   - reports whether the foundation is configured
//   - hands back a lazily-created supabase-js client, or null
//
// No hardcoded URL/key here — unlike the pre-existing scripts/sync.js
// blob-sync system (see docs/SUPABASE_PLAN.md §2), this foundation
// stays fully inert with no env vars set. Local Storage remains the
// active storage system regardless of this module's status.
//
// Requires (optional — safe if absent):
//   <script src="/api/config"></script>
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// =============================================================
(function () {
  'use strict';

  let client = null;

  function getUrl() {
    return (typeof window !== 'undefined' && window.NEXT_PUBLIC_SUPABASE_URL) || '';
  }
  function getKey() {
    return (typeof window !== 'undefined' && window.NEXT_PUBLIC_SUPABASE_ANON_KEY) || '';
  }
  function isConfigured() {
    return !!(getUrl() && getKey());
  }

  // Lazily creates the client. Returns null (never throws) if env vars
  // are missing or the supabase-js library script hasn't been loaded.
  function getClient() {
    if (client) return client;
    if (!isConfigured()) return null;
    if (typeof window === 'undefined' || !window.supabase || typeof window.supabase.createClient !== 'function') return null;
    try {
      client = window.supabase.createClient(getUrl(), getKey());
    } catch (e) {
      client = null;
    }
    return client;
  }

  // Reports where the foundation stands. This never reflects the
  // legacy sync.js blob-sync system — only this new, unwired foundation.
  function getStatus() {
    const configured = isConfigured();
    return {
      configured: configured,
      // Auth (sign up/in/out) is implemented in scripts/supabase-auth.js
      // and works whenever the client is configured. Whether a user is
      // actually signed in is a separate question — see SupabaseAuth.getState().
      authEnabled: configured,
      // True once env vars are present — the client can be created,
      // but no dashboard data reads/writes through it yet.
      readyForFutureSync: configured,
      code: configured ? 'configured' : 'not_configured',
      label: configured
        ? 'Supabase configured — auth enabled, cloud database sync not active'
        : 'Supabase not configured — Local Storage is the only storage system',
    };
  }

  window.SupabaseFoundation = {
    isConfigured: isConfigured,
    getClient: getClient,
    getStatus: getStatus,
  };
})();
