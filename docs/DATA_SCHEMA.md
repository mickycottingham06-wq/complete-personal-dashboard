# DATA_SCHEMA.md

## Purpose

This document defines how all dashboard data should be structured.

The dashboard should separate data from the interface.

Pages display data.

Data files store information.

Never hardcode values throughout the project.

---

# Philosophy

The dashboard should work like a database.

Every page should simply read data.

Changing one value should update the entire dashboard.

---

# Data Folder

The data folder should eventually contain:

data/
│
├── dashboardData.js
├── boxing.js
├── business.js
├── finance.js
├── goals.js
├── habits.js
├── calendar.js
├── weather.js
├── quotes.js
├── lifeStats.js
└── settings.js

Never mix unrelated data.

---

# Dashboard Data

dashboardData should contain:

Today's Date

Sleep

Weight

Calories

Water

Steps

Mood

Recovery

Tasks Completed

Training Status

Daily Score

Current Focus

---

# Boxing Data

boxing.js

Should contain:

Current Weight

Fight Weight

Weight Difference

Weeks Until Fight

Current Camp Phase

Today's Session

Running Pace

Recovery Score

Conditioning Score

Coach Notes

Sparring Notes

Strength Numbers

Training Volume

Weekly Sessions

Monthly Sessions

Fight Countdown

Everything related to boxing belongs here.

---

# Business Data

business.js

Must support multiple businesses.

Each business should contain:

Name

Description

Status

Priority

Monthly Revenue

Revenue Target

Current Goal

Current Task

Next Action

Progress

Monthly Expenses

Notes

Example Businesses

AI Automation

Amazon FBA

Digital Products

Property

Faceless Content

Future businesses should be easy to add.

---

# Finance Data

finance.js

Should contain:

Cash

Bank Accounts

Emergency Fund

Investments

Crypto

Monthly Income

Monthly Expenses

Monthly Savings

Net Worth

Property Equity

Business Revenue

Debt

Bills

Subscriptions

Financial Goals

---

# Goal Data

goals.js

Each goal should contain:

Name

Category

Target

Current Progress

Percentage

Deadline

Priority

Status

Notes

Categories

Health

Business

Finance

Boxing

Learning

Personal

---

# Habit Data

habits.js

Each habit should contain:

Name

Current Streak

Best Streak

Today's Status

Weekly Status

Monthly Status

Completion Percentage

Habits

Gym

Boxing

Running

Reading

Business

Diet

Sleep

Water

---

# Calendar Data

calendar.js

Should contain:

Today's Events

Meetings

Training

Appointments

Deadlines

Business Tasks

Personal Tasks

---

# Weather Data

weather.js

Should contain:

Temperature

Conditions

Wind

Rain Chance

Sunrise

Sunset

Forecast

API Ready

---

# Quote Data

quotes.js

Should contain:

Quote

Author

Category

Rotation

Favourite

Categories

Stoicism

Warriors

Business

Discipline

Leadership

Mindset

Original Quotes

---

# Life Stats

lifeStats.js

Should contain:

Days Alive

Gym Sessions

Boxing Sessions

Runs Completed

Hours Trained

Books Read

Money Saved

Revenue Generated

Hours Worked

Hours Slept

Calories Burned

---

# AI Assistant Data

aiAssistant.js

Should contain:

Today's Focus

Top Priorities

Money Task

Learning Task

Admin Task

Reminder

Warnings

Recommendations

Generated Briefing

Future API Integration

---

# Settings

settings.js

Should contain:

Theme

Accent Colour

Units

Notification Settings

Dashboard Preferences

Default Landing Page

Widget Preferences

Future AI Settings

---

# Rules

Never duplicate data.

One source of truth.

UI reads data.

UI does not own data.

Every editable value should exist in exactly one place.

---

# Future Database

Eventually this schema should map directly to a real database if required.

The transition should require minimal code changes.

Design the data structure with scalability in mind.

---

# Final Rule

When adding new features:

First ask:

Which data file should own this information?

Never store data inside UI components unless absolutely necessary.