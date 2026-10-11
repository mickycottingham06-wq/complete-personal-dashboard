# Things Claude must never change

The current app is LOCK-IN HQ — see `docs/LOCK_IN_HQ.md`.

- Keep the LOCK-IN HQ theme: `styles/lock-in.css` is the single stylesheet; reuse its tokens and components.
- Keep the one shared Menu (`scripts/menu.js`) on every page; don't add competing navigation.
- Keep screens simple: no extra dashboards, charts, scores, streaks or decorative controls.
- Never delete or rewrite saved browser data; removed pages' records stay in storage and Backup.
- Never show "Saved"/"Synced" without a verified write; never invent calendar, email, money or completed work.
- Keep AI server-side, protected (session + allowlist + usage limit) and optional, with labelled non-AI fallbacks.
- Only edit the files necessary for the requested change.
