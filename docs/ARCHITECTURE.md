# ARCHITECTURE.md

Version: 1.0

Owner: Micky Cottingham

---

# Purpose

This document defines the software architecture of the dashboard.

It explains how the application should be structured, how different systems interact, and how future features should be integrated.

This file should be treated as the architectural blueprint for the entire project.

Whenever Claude is unsure where new functionality belongs, this document takes priority.

---

# Core Architecture

The dashboard is built around five layers.

User Interface

↓

Components

↓

Pages

↓

Business Logic

↓

Data

Everything should flow in this direction.

The user interface should never directly own important data.

---

# Layer 1 — User Interface

Purpose

Display information.

Collect user interaction.

Nothing more.

Examples

Buttons

Cards

Charts

Forms

Widgets

Navigation

Search

The UI should never contain complex business logic.

---

# Layer 2 — Components

Purpose

Reusable building blocks.

Components should be shared throughout the project.

Examples

Stat Card

Progress Card

Business Card

Goal Card

Widget Card

Calendar Card

Quote Card

Heatmap

Search

Navigation

Modal

Every repeated UI element should eventually become a reusable component.

---

# Layer 3 — Pages

Purpose

Assemble components.

Pages should contain very little logic.

Their responsibility is layout.

Examples

Home

Finance

Health

Business HQ

Boxing HQ

Goals

Life Stats

Settings

Each page should read data and display components.

---

# Layer 4 — Business Logic

Purpose

Handle calculations.

Examples

Goal percentages

Weight calculations

Net worth

Revenue totals

Habit streaks

Progress

Analytics

Business logic should never live inside HTML.

Business logic should remain reusable.

---

# Layer 5 — Data

Purpose

One source of truth.

Everything editable belongs here.

Examples

Goals

Businesses

Finance

Quotes

Weather

Calendar

Training

Habits

Life Stats

Changing one value here should automatically update every page.

---

# Data Flow

The correct direction is:

Data

↓

Business Logic

↓

Components

↓

Pages

↓

User

Never reverse this flow.

---

# Folder Responsibilities

api/

External APIs.

No UI.

---

assets/

Images

Icons

Fonts

Media

Branding

---

components/

Reusable interface only.

Never page-specific code.

---

data/

All editable data.

No UI.

---

docs/

Project documentation.

Never application code.

---

pages/

Dashboard pages.

Minimal logic.

Mostly layout.

---

scripts/

Application behaviour.

Business logic.

Controllers.

---

templates/

Reusable HTML structures.

---

utils/

Small helper functions.

Formatting.

Dates.

Calculations.

Validation.

---

# Component Hierarchy

Application

↓

Page

↓

Section

↓

Component

↓

Element

Never skip unnecessary layers.

---

# Design Hierarchy

Dashboard

↓

Page

↓

Section

↓

Card

↓

Content

Every feature should fit into this structure.

---

# Adding New Features

Before writing code ask:

Does a component already exist?

Can an existing page be extended?

Does data already exist?

Where should the data live?

Will this create duplicate functionality?

If duplication is possible,

refactor instead.

---

# Business Architecture

The dashboard must support unlimited businesses.

Every business follows the same model.

Business

↓

Revenue

↓

Tasks

↓

Analytics

↓

Growth

New businesses should require almost no code changes.

---

# Boxing Architecture

Everything boxing related belongs inside Boxing HQ.

Subsections

Training

Recovery

Weight

Nutrition

Running

Strength

Coach

Fight Camp

Analytics

Nothing boxing related should be scattered around the project.

---

# Finance Architecture

Finance should eventually become one of the largest systems.

Subsections

Cash

Net Worth

Income

Expenses

Bills

Investments

Business Revenue

Property

Forecasting

Reports

Future integrations should plug into Finance HQ without redesigning it.

---

# AI Architecture

The AI Assistant is the decision engine.

It consumes data.

It produces recommendations.

Input

Businesses

Calendar

Weather

Training

Finance

Habits

Goals

Output

Morning Brief

Today's Focus

Tasks

Warnings

Recommendations

Priority

The AI should never own the data.

It should interpret the data.

---

# Widget Architecture

Widgets should be independent.

Every widget should be removable without breaking the dashboard.

Examples

Weather

Calendar

Quote

Bills

Clock

Search

Spotify

Future widgets should follow the same pattern.

---

# API Architecture

Every API should be isolated.

Weather API

Google Calendar

Whoop

Finance APIs

Email

CRM

No page should communicate directly with an API.

Pages communicate through scripts and data.

---

# Performance Principles

Keep JavaScript lightweight.

Avoid duplicate HTML.

Reuse CSS.

Minimise unnecessary rendering.

Prefer native browser functionality.

Optimise before adding complexity.

---

# Scalability Principles

Every new feature should answer:

Can another one be added?

Can this scale?

Can this be reused?

Will this become difficult to maintain?

If the answer is yes,

redesign before implementing.

---

# Engineering Principles

Build slowly.

Refactor often.

Reuse everything.

Document important changes.

Test every feature.

Commit every feature.

Keep architecture clean.

Protect the design.

Think long-term.

---

# Long-Term Vision

Eventually this dashboard should become a complete operating system capable of managing:

Health

Fitness

Boxing

Business

Finance

Property

Investments

Learning

Documents

Calendar

Tasks

Habits

Analytics

AI

Automation

Everything should feel like one application.

Not a collection of unrelated pages.

---

# Final Rule

When making any architectural decision, always choose the solution that is:

More reusable.

More maintainable.

More scalable.

More modular.

More professional.

More consistent.

This project is intended to grow for many years.

Build accordingly.