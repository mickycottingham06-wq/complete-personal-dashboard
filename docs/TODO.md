# TODO.md

## High Priority

Build AI Assistant (AI CEO / Business Assistant done — prompt-powered, pages/ai-ceo.html; broader OS-level AI Assistant from AI_ASSISTANT_BEHAVIOUR.md still open)

---

## Medium Priority

Weather Widget

Calendar Widget

Bills Widget

Search

Morning Brief (v2 done — deterministic Daily Guidance Engine, scripts/daily-guidance-data.js, now history-informed via Daily Snapshot's archived days; still no live AI)

Evening Review

---

## Low Priority

API Integrations (foundation done — pages/integrations.html, scripts/integrations-data.js; each service below still needs a real key/OAuth flow to go live)

Whoop

Weather

Finance APIs

Cloud Sync (Auto Cloud Save v2 done — scripts/auto-sync.js, push-only background save now covers all core Life OS pages, plus a guarded confirm-before-load prompt when another device's cloud save is newer and this device has no unsynced edits; manual Quick Sync/Force Local Save/Push/Pull/Sync unchanged; fixed a bug where a stale past error permanently blocked all future auto-pushes, and Command Centre now shows a compact sign-in/status card near the top instead of sign-in being Integrations-only)

Voice Assistant

---

## Rule

Only work on one feature at a time.

Finish it.

Test it.

Commit it.

Push it.

Repeat.