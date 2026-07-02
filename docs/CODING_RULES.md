# CODING_RULES.md

## Purpose

This document defines how Claude should write code for this project.

Before writing any code Claude must read:

1. dashboard-bible.md
2. PROJECT.md
3. DESIGN.md
4. STYLE_GUIDE.md
5. CODING_RULES.md

Only then should development begin.

---

# Primary Rule

Never redesign the dashboard.

Never rewrite working code unless necessary.

Only edit the files required for the requested task.

---

# Development Workflow

For every request follow this process.

Step 1

Understand the request.

Step 2

Inspect the existing code.

Step 3

Identify only the files that require editing.

Step 4

Create a short implementation plan.

Step 5

Modify only the required files.

Step 6

Test the changes.

Step 7

Check for errors.

Step 8

Summarise the work completed.

Never skip testing.

---

# File Editing Rules

Always:

Read files before editing.

Reuse existing code.

Reuse existing components.

Reuse existing styles.

Reuse existing layouts.

Only edit the minimum number of files required.

Avoid creating duplicate files.

---

# Component Rules

If a component already exists:

Improve it.

Extend it.

Reuse it.

Never create a second version.

Every repeated UI element should become reusable.

---

# HTML Rules

Keep HTML simple.

Use semantic HTML where possible.

Avoid unnecessary nesting.

Use meaningful class names.

Avoid duplicated markup.

---

# CSS Rules

Reuse existing styles.

Avoid inline styling.

Keep styling modular.

Use existing spacing values.

Use existing colour palette.

Do not create duplicate CSS.

---

# JavaScript Rules

Functions should do one job.

Keep functions small.

Use descriptive names.

Avoid repeated logic.

Move repeated logic into reusable functions.

Keep code readable.

---

# Folder Rules

Only place files inside the correct folders.

pages/

components/

scripts/

data/

utils/

assets/

docs/

templates/

Never mix responsibilities.

---

# Data Rules

Never hardcode repeated values.

Store editable information inside data files.

Examples:

Goals

Businesses

Boxing

Finance

Weather

Quotes

Calendar

Widgets

The UI should display data.

The UI should not own the data.

---

# Token Saving Rules

Reduce token usage whenever possible.

Always:

Inspect only relevant files.

Avoid rewriting unchanged code.

Avoid long explanations.

Avoid unnecessary comments.

Avoid duplicate implementations.

If a file does not need changing, leave it untouched.

---

# Documentation Rules

Whenever a new feature is completed:

Update documentation if needed.

Keep ROADMAP accurate.

Keep TODO accurate.

Update CHANGELOG.

---

# Error Checking

Before finishing:

Check imports.

Check links.

Check script references.

Check CSS references.

Check console errors.

Check navigation.

Check responsive layout.

Check Vercel compatibility.

---

# Git Rules

One feature.

One commit.

Good commit messages.

Examples:

Add Boxing Dashboard

Improve Goal Tracking

Fix Finance Charts

Add Weather Widget

Refactor Business Components

Never combine multiple unrelated features into one commit.

---

# Response Rules

After completing work provide only:

Files changed.

Summary of work.

Any warnings.

Suggested commit message.

Do not write long explanations unless asked.

---

# Things Claude Must Never Do

Never redesign pages.

Never move navigation.

Never change colour palette.

Never replace typography.

Never change spacing.

Never create inconsistent cards.

Never duplicate components.

Never rewrite the entire project.

Never break the current design.

Never overcomplicate the solution.

---

# Success

Good code is:

Readable.

Reusable.

Modular.

Maintainable.

Efficient.

Consistent.

Premium.

Simple.