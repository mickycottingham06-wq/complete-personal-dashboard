# COMPONENT_LIBRARY.md

## Purpose

This document defines every reusable UI component used throughout the dashboard.

Before creating a new UI element, Claude should first check whether an existing component can be reused.

If one exists, extend it.

Do not build duplicate components.

---

# Philosophy

The dashboard should be built like LEGO.

Small reusable components.

Large pages built from those components.

This improves:

- Consistency
- Maintainability
- Performance
- Development speed
- Token efficiency

---

# Available Components

## 1. Stat Card

Purpose

Display one important metric.

Examples

Weight

Sleep

Steps

Calories

Water

Revenue

Net Worth

Recovery

Properties

Books Read

Structure

- Icon
- Title
- Main Value
- Optional subtitle
- Optional trend

---

## 2. Progress Card

Purpose

Track progress towards a target.

Examples

Fight Weight

Savings Goal

Monthly Revenue

Investment Goal

Current Course

Features

- Title
- Current Value
- Target Value
- Percentage
- Animated Progress Bar

---

## 3. Goal Card

Purpose

Display long-term goals.

Fields

Goal Name

Category

Deadline

Current Progress

Target

Progress Bar

Status

---

## 4. Widget Card

Purpose

Small utility widgets.

Examples

Weather

Calendar

Bills

Search

Quote

Clock

Spotify

Timer

Widgets should always use the same dimensions and styling.

---

## 5. Business Card

Purpose

Represent one business.

Fields

Business Name

Monthly Revenue

Target Revenue

Current Task

Priority

Progress

Status

Next Action

Notes

The dashboard must support unlimited businesses.

Never assume only one business exists.

---

## 6. Boxing Card

Purpose

Track fight camp metrics.

Examples

Current Weight

Fight Weight

Running Pace

Recovery

Conditioning

Sessions Completed

Coach Notes

Strength

Nutrition

---

## 7. Heatmap

Purpose

Track consistency.

Habits

Gym

Boxing

Running

Reading

Business

Diet

Sleep

Use GitHub-style contribution squares.

---

## 8. Quote Card

Purpose

Display one motivational quote.

Should support future rotation.

Should remain clean and uncluttered.

---

## 9. AI Assistant Card

Purpose

Display today's recommendations.

Should include

Today's Focus

Top 3 Tasks

Money Making Task

Learning Task

Admin Task

Warning

The AI Assistant should feel like a CEO and coach.

---

## 10. Finance Card

Purpose

Display financial metrics.

Examples

Cash

Investments

Income

Expenses

Emergency Fund

Net Worth

Business Revenue

Property Equity

---

## 11. Calendar Card

Purpose

Display today's schedule.

Show

Time

Event

Location

Priority

---

## 12a. Sidebar Navigation

Purpose

Full-app navigation, opened by a three-line hamburger button in the top bar.

Lives in

`scripts/topbar.js` (same script every page already includes for the top/bottom chrome — no extra script tag needed).

Behaviour

Slide-in drawer from the left, dark overlay behind it, closes on overlay click / Escape / link click. Highlights the active page. Links are grouped under five collapsible headers — Today (Command Centre, Daily Control Panel, Weekly Review), Progress (Streaks, Goals, Life Stats, Heatmap), Performance (Boxing HQ, Health HQ, Hormone Optimisation, Appearance / Looks), Wealth (Money HQ, Business HQ, AI CEO), System (Integrations, Settings). Each group header toggles a `.collapsed` class and persists that choice in `localStorage` (`sidebar_collapsed_groups_v1`); the group containing the active page is always forced open regardless of saved state.

Never build a second nav drawer elsewhere — extend `SIDEBAR_GROUPS` in topbar.js instead (a flat `SIDEBAR_LINKS` is derived from it for active-page lookups).

---

## 12b. Preview Card

Purpose

A compact, clickable entry point into a full page — used so a heavy section (Daily Snapshot, Streaks) doesn't dominate the main dashboard.

Structure

A `.gm-card.preview-card` wrapped in an `<a>`, containing a short label/value and 2–3 `.streak-stat` tiles, with a `.preview-arrow` that nudges on hover.

Rule

If a section has both a "full" page and a dashboard summary, the summary should be a Preview Card, not a shrunk copy of the full UI.

On Command Centre, only the 6 core priority Preview Cards (Money HQ, Business HQ, Boxing HQ, Health HQ, Goals, Weekly Review) sit in the main `.core-grid`. Secondary Preview Cards (Streaks, AI CEO, Hormone Optimisation, Appearance / Looks, Life Stats, Heatmap, Integrations) live inside the collapsed `<details class="more-details">` "More sections" block further down the page — same markup, just relocated, so they stay reachable without competing for attention.

---

## 12. Search Bar

Purpose

Global dashboard search.

Should search

Pages

Businesses

Goals

Habits

Widgets

Navigation

Commands

Future documents

---

# Component Rules

All components must

Use existing styling.

Use existing colours.

Use existing spacing.

Use existing typography.

Use existing animations.

Look identical across the dashboard.

---

# Component Behaviour

Components should

Resize correctly.

Support desktop.

Support laptop.

Support tablet.

Support mobile.

Never overflow.

Never distort.

---

# Future Components

Potential additions

Property Card

Investment Card

Meal Card

CRM Card

Training Session Card

Recovery Card

Journal Card

Analytics Card

Morning Brief Card

Evening Review Card

---

# Final Rule

When creating UI:

Check this file first.

If a suitable component exists,

reuse it.

Never duplicate UI unnecessarily.