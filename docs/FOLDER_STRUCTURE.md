> **Historical document.** This describes the previous dashboard, most of whose pages were removed in the LOCK-IN HQ cleanup (Oct 2026). For the current app see [LOCK_IN_HQ.md](LOCK_IN_HQ.md); data keys described here may still exist in storage and Backup.

# FOLDER_STRUCTURE.md

## Purpose

Every file belongs somewhere.

Never place files randomly.

---

api/

External APIs.

---

assets/

Images

Icons

Logos

Fonts

Media

---

components/

Reusable UI only.

Never pages.

---

data/

All editable information.

One source of truth.

---

docs/

Project documentation.

Never application code.

---

pages/

Individual dashboard pages.

---

scripts/

Application logic.

---

templates/

Shared HTML layouts.

---

utils/

Helper functions.

Date helpers.

Calculations.

Formatting.

Utilities.

---

# Rule

Before creating a new file ask:

Does a folder already exist for this?

If yes,

use it.

If no,

consider whether a new folder is actually needed.