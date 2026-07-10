// =============================================================
// Strength HQ — shared data layer.
// Owns the `training` localStorage key: the 12-week Boxing+Gym
// periodized programme, workout logging, progressive-overload
// rules, readiness, mobility, PRs and assessment results.
//
// Same pattern as scripts/boxing-data.js / scripts/health-data.js:
// load() upgrades older saved shapes, save() persists, uid() makes
// ids. Progression logic is deliberately simple/transparent (no
// black-box scoring) — see each progressXxx() function below.
//
// Include this with a plain (non-defer) <script src="..."> tag
// BEFORE any inline script that calls window.Training.
// =============================================================
(function () {
  'use strict';

  var KEY = 'training';
  var SCHEMA_VERSION = 1;

  function loadJSON(k, f) { try { return JSON.parse(localStorage.getItem(k)) || f; } catch (e) { return f; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // Same 6 AM rollover convention as every other section.
  function activeDateKey(d) {
    var now = d || new Date();
    var out = new Date(now);
    if (now.getHours() < 6) out.setDate(out.getDate() - 1);
    return out.getFullYear() + '-' + String(out.getMonth() + 1).padStart(2, '0') + '-' + String(out.getDate()).padStart(2, '0');
  }
  var DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  // ---------------------------------------------------------------
  // Exercise definitions — stable ids, shared across templates and
  // substitute lookups. isSubstituteOnly rows never appear in a
  // workoutTemplate directly, only as a substitution offer.
  // ---------------------------------------------------------------
  function defaultExercises() {
    return [
      // Gym A
      { id: 'ex_boxJump', name: 'Box Jump', category: 'power', progressionType: 'power', unilateral: false, bodyweight: true, allowsAssistance: false, defaultSets: 4, repRangeLow: 3, repRangeHigh: 3, order: 1, paused: false, notes: '' },
      { id: 'ex_backSquat', name: 'Back Squat', category: 'main', progressionType: 'main', unilateral: false, bodyweight: false, allowsAssistance: false, defaultSets: 4, repRangeLow: 5, repRangeHigh: 5, order: 2, paused: false, notes: '' },
      { id: 'ex_benchPress', name: 'Barbell Bench Press', category: 'main', progressionType: 'main', unilateral: false, bodyweight: false, allowsAssistance: false, defaultSets: 4, repRangeLow: 5, repRangeHigh: 5, order: 3, paused: false, notes: '' },
      { id: 'ex_pullUp', name: 'Weighted / Bodyweight Pull-Up', category: 'pullup', progressionType: 'pullupLadder', unilateral: false, bodyweight: true, allowsAssistance: true, defaultSets: 4, repRangeLow: 5, repRangeHigh: 8, order: 4, paused: false, notes: '' },
      { id: 'ex_romanianDeadlift', name: 'Romanian Deadlift', category: 'accessory', progressionType: 'doubleProgression', unilateral: false, bodyweight: false, allowsAssistance: false, defaultSets: 3, repRangeLow: 6, repRangeHigh: 8, order: 5, paused: false, notes: '' },
      { id: 'ex_bulgarianSplitSquat', name: 'Bulgarian Split Squat', category: 'accessory', progressionType: 'doubleProgression', unilateral: true, bodyweight: false, allowsAssistance: false, defaultSets: 2, repRangeLow: 8, repRangeHigh: 8, order: 6, paused: false, notes: '' },
      { id: 'ex_cableLateralRaise', name: 'Cable Lateral Raise', category: 'accessory', progressionType: 'doubleProgression', unilateral: false, bodyweight: false, allowsAssistance: false, defaultSets: 3, repRangeLow: 12, repRangeHigh: 20, order: 7, paused: false, notes: '' },
      { id: 'ex_pallofPress', name: 'Pallof Press', category: 'accessory', progressionType: 'doubleProgression', unilateral: true, bodyweight: false, allowsAssistance: false, defaultSets: 3, repRangeLow: 10, repRangeHigh: 10, order: 8, paused: false, notes: '' },
      // Gym B
      { id: 'ex_medBallThrow', name: 'Rotational Medicine-Ball Throw', category: 'power', progressionType: 'power', unilateral: true, bodyweight: false, allowsAssistance: false, defaultSets: 4, repRangeLow: 4, repRangeHigh: 4, order: 1, paused: false, notes: '' },
      { id: 'ex_deadlift', name: 'Conventional / Trap-Bar Deadlift', category: 'main', progressionType: 'main', unilateral: false, bodyweight: false, allowsAssistance: false, defaultSets: 4, repRangeLow: 3, repRangeHigh: 3, order: 2, paused: false, notes: '' },
      { id: 'ex_ohp', name: 'Standing Overhead Press', category: 'main', progressionType: 'main', unilateral: false, bodyweight: false, allowsAssistance: false, defaultSets: 4, repRangeLow: 5, repRangeHigh: 5, order: 3, paused: false, notes: '' },
      { id: 'ex_frontSquat', name: 'Front Squat', category: 'accessory', progressionType: 'doubleProgression', unilateral: false, bodyweight: false, allowsAssistance: false, defaultSets: 3, repRangeLow: 6, repRangeHigh: 8, order: 4, paused: false, notes: '' },
      { id: 'ex_chestSupportedRow', name: 'Chest-Supported Row', category: 'accessory', progressionType: 'doubleProgression', unilateral: false, bodyweight: false, allowsAssistance: false, defaultSets: 4, repRangeLow: 6, repRangeHigh: 10, order: 5, paused: false, notes: '' },
      { id: 'ex_inclineDbPress', name: 'Incline Dumbbell Press', category: 'accessory', progressionType: 'doubleProgression', unilateral: false, bodyweight: false, allowsAssistance: false, defaultSets: 3, repRangeLow: 8, repRangeHigh: 12, order: 6, paused: false, notes: '' },
      { id: 'ex_hamstringCurl', name: 'Hamstring Curl', category: 'accessory', progressionType: 'doubleProgression', unilateral: false, bodyweight: false, allowsAssistance: false, defaultSets: 3, repRangeLow: 10, repRangeHigh: 15, order: 7, paused: false, notes: '' },
      { id: 'ex_suitcaseCarry', name: 'Suitcase Carry', category: 'accessory', progressionType: 'doubleProgression', unilateral: true, bodyweight: false, allowsAssistance: false, unit: 'm', defaultSets: 3, repRangeLow: 20, repRangeHigh: 30, order: 8, paused: false, notes: '20-30 metres each side' },
      // Gym C (optional)
      { id: 'ex_pogoJumps', name: 'Pogo Jumps', category: 'power', progressionType: 'power', unilateral: false, bodyweight: true, allowsAssistance: false, defaultSets: 3, repRangeLow: 20, repRangeHigh: 20, order: 1, paused: false, notes: '' },
      { id: 'ex_broadJump', name: 'Standing Broad Jump', category: 'power', progressionType: 'power', unilateral: false, bodyweight: true, allowsAssistance: false, unit: 'cm', defaultSets: 4, repRangeLow: 3, repRangeHigh: 3, order: 2, paused: false, notes: '' },
      { id: 'ex_inclineBarbellPress', name: 'Incline Barbell / DB Press', category: 'accessory', progressionType: 'doubleProgression', unilateral: false, bodyweight: false, allowsAssistance: false, defaultSets: 3, repRangeLow: 6, repRangeHigh: 10, order: 3, paused: false, notes: '' },
      { id: 'ex_chinUp', name: 'Chin-Ups', category: 'pullup', progressionType: 'pullupLadder', unilateral: false, bodyweight: true, allowsAssistance: true, defaultSets: 3, repRangeLow: 6, repRangeHigh: 10, order: 4, paused: false, notes: '' },
      { id: 'ex_hackSquatC', name: 'Hack / Pendulum / Smith Squat', category: 'accessory', progressionType: 'doubleProgression', unilateral: false, bodyweight: false, allowsAssistance: false, defaultSets: 3, repRangeLow: 8, repRangeHigh: 12, order: 5, paused: false, notes: '' },
      { id: 'ex_reverseFly', name: 'Reverse Fly', category: 'accessory', progressionType: 'doubleProgression', unilateral: false, bodyweight: false, allowsAssistance: false, defaultSets: 2, repRangeLow: 12, repRangeHigh: 20, order: 7, paused: false, notes: '' },
      { id: 'ex_preacherCurl', name: 'Preacher Curl', category: 'accessory', progressionType: 'doubleProgression', unilateral: false, bodyweight: false, allowsAssistance: false, defaultSets: 3, repRangeLow: 8, repRangeHigh: 12, order: 8, paused: false, notes: '' },
      { id: 'ex_tricepsExt', name: 'Overhead Cable Triceps Extension', category: 'accessory', progressionType: 'doubleProgression', unilateral: false, bodyweight: false, allowsAssistance: false, defaultSets: 3, repRangeLow: 10, repRangeHigh: 15, order: 9, paused: false, notes: '' },
      { id: 'ex_calfRaise', name: 'Standing Calf Raise', category: 'accessory', progressionType: 'doubleProgression', unilateral: false, bodyweight: false, allowsAssistance: false, defaultSets: 2, repRangeLow: 8, repRangeHigh: 15, order: 10, paused: false, notes: '' },
      // Substitute-only exercise defs (not in any template slot directly)
      { id: 'ex_safetyBarSquat', name: 'Safety-Bar Squat', category: 'main', progressionType: 'main', isSubstituteOnly: true },
      { id: 'ex_trapBarDeadlift', name: 'Trap-Bar Deadlift', category: 'main', progressionType: 'main', isSubstituteOnly: true },
      { id: 'ex_dbBench', name: 'Dumbbell Bench Press', category: 'main', progressionType: 'main', isSubstituteOnly: true },
      { id: 'ex_machineChestPress', name: 'Machine Chest Press', category: 'main', progressionType: 'main', isSubstituteOnly: true },
      { id: 'ex_seatedDbPress', name: 'Seated Dumbbell Press', category: 'main', progressionType: 'main', isSubstituteOnly: true },
      { id: 'ex_landminePress', name: 'Landmine Press', category: 'main', progressionType: 'main', isSubstituteOnly: true },
      { id: 'ex_assistedPullUp', name: 'Assisted Pull-Up', category: 'pullup', progressionType: 'pullupLadder', isSubstituteOnly: true },
      { id: 'ex_latPulldown', name: 'Lat Pulldown', category: 'accessory', progressionType: 'doubleProgression', isSubstituteOnly: true },
      { id: 'ex_reverseLunge', name: 'Reverse Lunge', category: 'accessory', progressionType: 'doubleProgression', unilateral: true, isSubstituteOnly: true },
      { id: 'ex_legPress', name: 'Leg Press', category: 'accessory', progressionType: 'doubleProgression', isSubstituteOnly: true },
      { id: 'ex_cableRotation', name: 'Light Explosive Cable Rotation', category: 'power', progressionType: 'power', unilateral: true, isSubstituteOnly: true },
    ];
  }

  function defaultWorkoutTemplates() {
    return [
      {
        id: 'gymA', name: 'Gym A — Squat & Bench Strength', optional: false,
        exerciseSlots: ['ex_boxJump', 'ex_backSquat', 'ex_benchPress', 'ex_pullUp', 'ex_romanianDeadlift', 'ex_bulgarianSplitSquat', 'ex_cableLateralRaise', 'ex_pallofPress'],
      },
      {
        id: 'gymB', name: 'Gym B — Deadlift & Overhead Strength', optional: false,
        exerciseSlots: ['ex_medBallThrow', 'ex_deadlift', 'ex_ohp', 'ex_frontSquat', 'ex_chestSupportedRow', 'ex_inclineDbPress', 'ex_hamstringCurl', 'ex_suitcaseCarry'],
      },
      {
        id: 'gymC', name: 'Gym C — Athletic Hypertrophy (Optional)', optional: true,
        exerciseSlots: ['ex_pogoJumps', 'ex_broadJump', 'ex_inclineBarbellPress', 'ex_chinUp', 'ex_hackSquatC', 'ex_cableLateralRaise', 'ex_reverseFly', 'ex_preacherCurl', 'ex_tricepsExt', 'ex_calfRaise'],
      },
    ];
  }

  function defaultPhases() {
    return [
      { weekNumbers: [1, 2, 3], name: 'Movement Foundation', mainSets: 4, mainRepsLow: 5, mainRepsHigh: 5, deadliftSets: 4, deadliftReps: 3, targetRIRByWeek: { 1: 3, 2: 2.5, 3: 2 }, deload: false },
      { weekNumbers: [4], name: 'Deload', deload: true, deloadPct: 12.5 },
      { weekNumbers: [5, 6, 7], name: 'Strength & Size', mainSets: 5, mainRepsLow: 4, mainRepsHigh: 4, deadliftSets: 5, deadliftReps: 3, targetRIRByWeek: { 5: 3, 6: 2, 7: 1.5 }, deload: false },
      { weekNumbers: [8], name: 'Deload', deload: true, deloadPct: 12.5 },
      { weekNumbers: [9, 10, 11], name: 'Strength Intensification', mainSets: 4, mainRepsLow: 3, mainRepsHigh: 3, deadliftSets: 3, deadliftReps: 2, targetRIRByWeek: { 9: 2, 10: 1.5, 11: 1.5 }, deload: false },
      { weekNumbers: [12], name: 'Assessment', deload: false, isAssessment: true },
    ];
  }

  function defaultSubstitutions() {
    return {
      ex_backSquat: ['ex_safetyBarSquat', 'ex_frontSquat', 'ex_hackSquatC'],
      ex_deadlift: ['ex_trapBarDeadlift', 'ex_romanianDeadlift'],
      ex_benchPress: ['ex_dbBench', 'ex_machineChestPress'],
      ex_ohp: ['ex_seatedDbPress', 'ex_landminePress'],
      ex_pullUp: ['ex_assistedPullUp', 'ex_latPulldown'],
      ex_chinUp: ['ex_assistedPullUp', 'ex_latPulldown'],
      ex_bulgarianSplitSquat: ['ex_reverseLunge', 'ex_legPress'],
      ex_medBallThrow: ['ex_cableRotation'],
    };
  }

  function defaultMobilityRoutine() {
    return [
      'Supported Deep-Squat Hold — 2x45s',
      'Couch Stretch — 2x45s each side',
      '90/90 Hip Stretch and Transitions',
      'Adductor Rock-Back — 10 each side',
      'Knee-to-Wall Ankle Mobilisation — 10 each side',
      'Open-Book Rotation — 8 each side',
      'Bench Thoracic Extension — 8 reps',
      'Wall Slide — 10 reps',
      'Controlled Dead Hang — 2x20-40s',
    ].map(function (label) { return { id: uid(), label: label, completed: false }; });
  }

  function defaultTraining() {
    return {
      schemaVersion: SCHEMA_VERSION,
      programmeStartDate: '',
      currentWeek: 1,
      programmeId: 'default-12wk-v1',
      restartCount: 0,
      units: 'kg',
      startingValues: { benchPress1RM: 100, backSquat1RM: 100, deadlift1RM: 150, ohp1RM: 60, pullUpMaxReps: 8 },
      weeklySchedule: {
        mon: { type: 'boxing-mobility' }, tue: { type: 'gym', templateId: 'gymA' },
        wed: { type: 'boxing-mobility' }, thu: { type: 'gym', templateId: 'gymB' },
        fri: { type: 'gym-optional', templateId: 'gymC' }, sat: { type: 'boxing' }, sun: { type: 'rest' },
      },
      exercises: defaultExercises(),
      workoutTemplates: defaultWorkoutTemplates(),
      phases: defaultPhases(),
      weekOverrides: {},
      substitutions: defaultSubstitutions(),
      activeWorkout: null,
      completedWorkouts: [],
      exerciseState: {},
      readinessChecks: [],
      personalRecords: [],
      mobilityRoutine: defaultMobilityRoutine(),
      mobilityRoutineDate: activeDateKey(),
      mobilityTests: [],
      assessmentResults: { dateKey: '', benchRepMax: { weight: 0, reps: 0 }, squatRepMax: { weight: 0, reps: 0 }, deadlift3RM: 0, strictPullUpMax: 0, standingBroadJumpCm: 0, bodyMeasurements: {}, notes: '' },
      onboardingCompletedAt: '',
    };
  }

  function migrate(t) {
    // No breaking shape changes yet — placeholder for future schemaVersion bumps.
    t.schemaVersion = SCHEMA_VERSION;
    return t;
  }

  function rolloverMobility(t) {
    var today = activeDateKey();
    if (t.mobilityRoutineDate !== today) {
      t.mobilityRoutine.forEach(function (i) { i.completed = false; });
      t.mobilityRoutineDate = today;
    }
    return t;
  }

  function load() {
    var t = loadJSON(KEY, null);
    if (!t) { t = defaultTraining(); saveJSON(KEY, t); return t; }
    var d = defaultTraining();
    Object.keys(d).forEach(function (k) { if (!(k in t)) t[k] = d[k]; });
    if (!Array.isArray(t.exercises) || !t.exercises.length) t.exercises = d.exercises;
    if (!Array.isArray(t.workoutTemplates) || !t.workoutTemplates.length) t.workoutTemplates = d.workoutTemplates;
    if (!Array.isArray(t.phases) || !t.phases.length) t.phases = d.phases;
    if (!Array.isArray(t.completedWorkouts)) t.completedWorkouts = [];
    if (!Array.isArray(t.readinessChecks)) t.readinessChecks = [];
    if (!Array.isArray(t.personalRecords)) t.personalRecords = [];
    if (!Array.isArray(t.mobilityRoutine) || !t.mobilityRoutine.length) t.mobilityRoutine = d.mobilityRoutine;
    if (!Array.isArray(t.mobilityTests)) t.mobilityTests = [];
    if (!t.exerciseState || typeof t.exerciseState !== 'object') t.exerciseState = {};
    if (!t.weekOverrides || typeof t.weekOverrides !== 'object') t.weekOverrides = {};
    if (!t.substitutions || typeof t.substitutions !== 'object') t.substitutions = d.substitutions;
    if (!t.startingValues) t.startingValues = d.startingValues;
    if (!t.assessmentResults) t.assessmentResults = d.assessmentResults;
    t = migrate(t);
    t = rolloverMobility(t);
    saveJSON(KEY, t);
    return t;
  }

  function save(t) { saveJSON(KEY, t); }

  // ---------------------------------------------------------------
  // Onboarding
  // ---------------------------------------------------------------
  function needsOnboarding(t) { return !t.programmeStartDate; }
  function completeOnboarding(t, opts) {
    opts = opts || {};
    t.programmeStartDate = opts.startDate || activeDateKey();
    if (opts.startingValues) Object.assign(t.startingValues, opts.startingValues);
    t.currentWeek = 1;
    t.onboardingCompletedAt = new Date().toISOString();
    return t;
  }

  // ---------------------------------------------------------------
  // Programme / phase / today's session
  // ---------------------------------------------------------------
  function getExercise(t, id) { return t.exercises.find(function (e) { return e.id === id; }) || null; }
  function getTemplate(t, id) { return t.workoutTemplates.find(function (w) { return w.id === id; }) || null; }

  function getCurrentPhase(t, weekNumber) {
    var override = t.weekOverrides[String(weekNumber)];
    var phase = t.phases.find(function (p) { return p.weekNumbers.indexOf(weekNumber) !== -1; }) || t.phases[0];
    if (override && override.deload) {
      return Object.assign({}, phase, { deload: true, name: 'Deload (manual)', deloadPct: phase.deloadPct || 12.5 });
    }
    return phase;
  }

  function getTargetRIR(phase, weekNumber) {
    if (!phase || !phase.targetRIRByWeek) return null;
    return phase.targetRIRByWeek[weekNumber] != null ? phase.targetRIRByWeek[weekNumber] : null;
  }

  // Estimates session length from exercise count — main lifts ~9 min/exercise
  // (more sets, more rest), accessories ~6 min/exercise. Deliberately rough.
  function estimateMinutes(t, templateId) {
    var tmpl = getTemplate(t, templateId);
    if (!tmpl) return 0;
    var mins = 10; // warm-up
    tmpl.exerciseSlots.forEach(function (exId) {
      var ex = getExercise(t, exId);
      mins += (ex && ex.category === 'main') ? 9 : 6;
    });
    return Math.round(mins);
  }

  function shouldSkipGymC(t, readinessStatus) {
    if (readinessStatus === 'red') return true;
    var recent = t.completedWorkouts.slice(-4);
    var rirSum = 0, rirCount = 0;
    recent.forEach(function (w) {
      if (w.averageRIR != null) { rirSum += w.averageRIR; rirCount++; }
    });
    if (rirCount && (rirSum / rirCount) < 1) return true; // grinding, little RIR left recently
    return false;
  }

  function getTodaysSession(t, date) {
    date = date || new Date();
    var dayKey = DOW_KEYS[date.getDay()];
    var sched = t.weeklySchedule[dayKey] || { type: 'rest' };
    var phase = getCurrentPhase(t, t.currentWeek);
    var out = {
      type: sched.type, templateId: sched.templateId || null,
      weekNumber: t.currentWeek, phaseName: phase ? phase.name : '',
      isOptionalGymC: sched.type === 'gym-optional',
      skipRecommended: false, estimatedMinutes: 0,
    };
    if (sched.templateId) {
      out.estimatedMinutes = estimateMinutes(t, sched.templateId);
      var tmpl = getTemplate(t, sched.templateId);
      out.templateName = tmpl ? tmpl.name : '';
    }
    if (out.isOptionalGymC) {
      var latestReadiness = t.readinessChecks[t.readinessChecks.length - 1];
      out.skipRecommended = shouldSkipGymC(t, latestReadiness ? latestReadiness.computedStatus : 'green');
    }
    return out;
  }

  // ---------------------------------------------------------------
  // Readiness
  // ---------------------------------------------------------------
  function computeReadinessStatus(inputs) {
    var sleep = Number(inputs.sleepQuality) || 3, energy = Number(inputs.energy) || 3;
    var soreness = Number(inputs.soreness) || 3, joint = Number(inputs.jointCondition) || 3;
    if (joint <= 2) return 'red';
    var avg = (sleep + energy + (6 - soreness) + joint) / 4; // soreness inverted: 5=very sore is bad
    if (avg >= 3.6) return 'green';
    if (avg >= 2.6) return 'amber';
    return 'red';
  }
  function recordReadinessCheck(t, inputs) {
    var status = computeReadinessStatus(inputs);
    var check = {
      id: uid(), dateKey: activeDateKey(),
      sleepQuality: Number(inputs.sleepQuality) || 3, energy: Number(inputs.energy) || 3,
      soreness: Number(inputs.soreness) || 3, jointCondition: Number(inputs.jointCondition) || 3,
      computedStatus: status,
    };
    t.readinessChecks.push(check);
    if (t.readinessChecks.length > 120) t.readinessChecks = t.readinessChecks.slice(-120);
    return check;
  }
  function getReadinessDefaultInputs() {
    var h = (window.Health && window.Health.load) ? window.Health.load() : null;
    if (!h) return { sleepQuality: 3, energy: 3, soreness: 3, jointCondition: 3 };
    var sleep = Math.max(1, Math.min(5, Math.round((h.lastNightSleep || 7) / 1.8)));
    var energy = Math.max(1, Math.min(5, Math.round((h.energyLevel || 5) / 2)));
    return { sleepQuality: sleep, energy: energy, soreness: 3, jointCondition: 5 };
  }

  // ---------------------------------------------------------------
  // Strength calc
  // ---------------------------------------------------------------
  function estimate1RM(weight, reps) {
    if (!weight || !reps) return 0;
    if (reps <= 1) return weight;
    return weight * (1 + reps / 30);
  }

  // ---------------------------------------------------------------
  // Workout flow
  // ---------------------------------------------------------------
  function ensureExerciseState(t, exerciseId) {
    if (!t.exerciseState[exerciseId]) {
      var ex = getExercise(t, exerciseId);
      var startW = 0;
      if (exerciseId === 'ex_backSquat') startW = t.startingValues.backSquat1RM * 0.8;
      else if (exerciseId === 'ex_benchPress') startW = t.startingValues.benchPress1RM * 0.8;
      else if (exerciseId === 'ex_deadlift') startW = t.startingValues.deadlift1RM * 0.8;
      else if (exerciseId === 'ex_ohp') startW = t.startingValues.ohp1RM * 0.8;
      t.exerciseState[exerciseId] = {
        currentWorkingWeight: Math.round(startW / 2.5) * 2.5,
        consecutiveMisses: 0, lastSessionWasDeload: false, flaggedForReview: false,
        currentTargetRepRangeLow: ex ? ex.repRangeLow : 8, currentTargetRepRangeHigh: ex ? ex.repRangeHigh : 12,
        assistanceWeight: 0, addedWeight: 0, ladderStage: 'increaseReps',
        lastQualityRating: 'clean', bestDistance: 0, bestHeight: 0, bestMedBallWeight: 0,
      };
    }
    return t.exerciseState[exerciseId];
  }

  function suggestNextPrescription(t, exerciseId) {
    var ex = getExercise(t, exerciseId);
    if (!ex) return null;
    var st = ensureExerciseState(t, exerciseId);
    var phase = getCurrentPhase(t, t.currentWeek);
    var rir = getTargetRIR(phase, t.currentWeek);
    if (ex.progressionType === 'main') {
      var sets = phase.deload ? 2 : (ex.id === 'ex_deadlift' ? (phase.deadliftSets || 4) : (phase.mainSets || 4));
      var repsLow = ex.id === 'ex_deadlift' ? (phase.deadliftReps || 3) : (phase.mainRepsLow || 5);
      var repsHigh = ex.id === 'ex_deadlift' ? (phase.deadliftReps || 3) : (phase.mainRepsHigh || 5);
      var weight = st.currentWorkingWeight;
      if (phase.deload) weight = Math.round((weight * (1 - (phase.deloadPct || 12.5) / 100)) / 2.5) * 2.5;
      return { sets: sets, repsLow: repsLow, repsHigh: repsHigh, weight: weight, targetRIR: rir, isDeload: !!phase.deload };
    }
    if (ex.progressionType === 'doubleProgression') {
      return { sets: ex.defaultSets, repsLow: st.currentTargetRepRangeLow, repsHigh: st.currentTargetRepRangeHigh, weight: st.currentWorkingWeight, targetRIR: rir, isDeload: !!phase.deload };
    }
    if (ex.progressionType === 'pullupLadder') {
      return { sets: ex.defaultSets, repsLow: ex.repRangeLow, repsHigh: ex.repRangeHigh, assistanceWeight: st.assistanceWeight, addedWeight: st.addedWeight, ladderStage: st.ladderStage, targetRIR: rir, isDeload: !!phase.deload };
    }
    // power
    return { sets: ex.defaultSets, repsLow: ex.repRangeLow, repsHigh: ex.repRangeHigh, bestDistance: st.bestDistance, bestHeight: st.bestHeight, bestMedBallWeight: st.bestMedBallWeight, targetRIR: rir, isDeload: !!phase.deload };
  }

  function startWorkout(t, templateId, readinessCheckId) {
    if (t.activeWorkout && t.activeWorkout.templateId === templateId) return t.activeWorkout; // resume
    var tmpl = getTemplate(t, templateId);
    if (!tmpl) return null;
    var phase = getCurrentPhase(t, t.currentWeek);
    t.activeWorkout = {
      id: uid(), templateId: templateId, weekNumber: t.currentWeek, phaseName: phase.name,
      dateKey: activeDateKey(), startedAt: new Date().toISOString(), readinessCheckId: readinessCheckId || null,
      exercises: tmpl.exerciseSlots.map(function (exId) {
        var rx = suggestNextPrescription(t, exId);
        return { exerciseId: exId, substitutedWithId: null, prescription: rx, sets: [], techniqueAcceptable: true, notes: '' };
      }),
      sessionNote: '',
    };
    return t.activeWorkout;
  }

  function findActiveExercise(t, exerciseId) {
    if (!t.activeWorkout) return null;
    return t.activeWorkout.exercises.find(function (e) { return e.exerciseId === exerciseId; }) || null;
  }

  function substituteExercise(t, exerciseId, substituteId) {
    var aw = findActiveExercise(t, exerciseId);
    if (aw) aw.substitutedWithId = substituteId;
    return aw;
  }

  function updateSessionNote(t, text) { if (t.activeWorkout) t.activeWorkout.sessionNote = text; }

  function logSet(t, exerciseId, setData) {
    var aw = findActiveExercise(t, exerciseId);
    if (!aw) return null;
    var entry = {
      setNumber: aw.sets.length + 1,
      weight: Number(setData.weight) || 0, reps: Number(setData.reps) || 0,
      rir: setData.rir != null ? Number(setData.rir) : null,
      painFlag: !!setData.painFlag, notes: setData.notes || '', completedAt: new Date().toISOString(),
    };
    aw.sets.push(entry);
    return entry;
  }

  // ---- Progression algorithms (pure, operate on exerciseState + set results) ----
  function progressMainLift(st, exResult, targetRIR) {
    var sets = exResult.sets;
    if (!sets.length) return 'maintained';
    var lastSet = sets[sets.length - 1];
    var repsTarget = exResult.prescription.repsHigh;
    var allRepsHit = sets.every(function (s) { return s.reps >= exResult.prescription.repsLow; });
    var noPain = sets.every(function (s) { return !s.painFlag; });
    var rirOk = lastSet.rir != null && targetRIR != null ? lastSet.rir >= targetRIR : true;
    var wasDeload = exResult.prescription.isDeload;
    var techOk = exResult.techniqueAcceptable !== false;

    if (allRepsHit && noPain && rirOk && techOk && !wasDeload) {
      st.consecutiveMisses = 0; st.flaggedForReview = false;
      st.lastSessionWasDeload = false;
      return 'progressed';
    }
    if (wasDeload) { st.lastSessionWasDeload = true; return 'deloaded'; }
    st.consecutiveMisses = (st.consecutiveMisses || 0) + 1;
    if (st.consecutiveMisses >= 3) st.flaggedForReview = true;
    return 'regressed';
  }

  function applyMainLiftWeightChange(exerciseId, st, outcome) {
    var upper = ['ex_benchPress', 'ex_ohp'].indexOf(exerciseId) !== -1;
    var inc = upper ? 1.25 : 5;
    if (outcome === 'progressed') {
      st.currentWorkingWeight = Math.round((st.currentWorkingWeight + inc) / 1.25) * 1.25;
    } else if (outcome === 'regressed' && st.consecutiveMisses === 2) {
      st.currentWorkingWeight = Math.round((st.currentWorkingWeight - inc / 2) / 1.25) * 1.25;
    }
    // 1st miss: repeat (no change). 3rd+: flagged, weight held for user review.
  }

  function progressDoubleProgression(st, exResult) {
    var sets = exResult.sets;
    if (!sets.length) return 'maintained';
    var top = st.currentTargetRepRangeHigh;
    var allHitTop = sets.every(function (s) { return s.reps >= top; });
    var noPain = sets.every(function (s) { return !s.painFlag; });
    if (allHitTop && noPain) {
      st.currentWorkingWeight = Math.round((st.currentWorkingWeight + 2.5) / 2.5) * 2.5;
      st.currentTargetRepRangeLow = Math.max(6, st.currentTargetRepRangeLow); // reset toward bottom of range (kept as-is; range itself doesn't move)
      return 'progressed';
    }
    return 'maintained';
  }

  function progressPullUpLadder(st, exResult) {
    var sets = exResult.sets;
    if (!sets.length) return 'maintained';
    var repsTarget = exResult.prescription.repsHigh;
    var allHitTop = sets.every(function (s) { return s.reps >= repsTarget; });
    if (!allHitTop) return 'maintained';
    if (st.assistanceWeight > 0) {
      st.assistanceWeight = Math.max(0, st.assistanceWeight - 5);
      return 'progressed';
    }
    if (st.ladderStage === 'increaseReps' && st.addedWeight === 0) {
      // reps already maxed the range; move to adding weight next
      st.ladderStage = 'addWeight';
      st.addedWeight = 1.25;
      return 'progressed';
    }
    st.addedWeight = (st.addedWeight || 0) + 1.25;
    return 'progressed';
  }

  function progressPower(st, exResult) {
    var sets = exResult.sets;
    if (!sets.length) return 'maintained';
    var quality = exResult.qualityRating || 'clean';
    if (quality !== 'clean') return 'maintained';
    sets.forEach(function (s) {
      if (s.reps > (st.bestDistance || 0)) st.bestDistance = s.reps; // "reps" field doubles as distance/height/weight for power exercises
    });
    return 'progressed';
  }

  function detectPRs(t, completedWorkout) {
    var prs = [];
    completedWorkout.exercises.forEach(function (exResult) {
      if (!exResult.sets.length) return;
      var ex = getExercise(t, exResult.exerciseId);
      if (!ex) return;
      var bestSet = exResult.sets.reduce(function (a, b) { return (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps)) ? b : a; }, exResult.sets[0]);
      var history = t.completedWorkouts;
      function priorBestWeight() {
        var best = 0;
        history.forEach(function (w) {
          (w.exercises || []).forEach(function (e) {
            if (e.exerciseId !== exResult.exerciseId || !e.sets || !e.sets.length) return;
            var s = e.sets.reduce(function (a, b) { return b.weight > a.weight ? b : a; }, e.sets[0]);
            if (s.weight > best) best = s.weight;
          });
        });
        return best;
      }
      if (bestSet.weight > priorBestWeight() && bestSet.weight > 0) {
        prs.push({ id: uid(), type: 'heaviestSet', exerciseId: ex.id, value: bestSet.weight, unit: t.units, dateKey: completedWorkout.dateKey, workoutId: completedWorkout.id });
      }
      if (ex.id === 'ex_pullUp' || ex.id === 'ex_chinUp') {
        var maxReps = Math.max.apply(null, exResult.sets.map(function (s) { return s.reps; }));
        if (maxReps > (t.startingValues.pullUpMaxReps || 0)) {
          prs.push({ id: uid(), type: 'pullUpReps', exerciseId: ex.id, value: maxReps, unit: 'reps', dateKey: completedWorkout.dateKey, workoutId: completedWorkout.id });
          t.startingValues.pullUpMaxReps = maxReps;
        }
      }
      if (ex.id === 'ex_broadJump') {
        var maxDist = Math.max.apply(null, exResult.sets.map(function (s) { return s.reps; }));
        prs.push({ id: uid(), type: 'broadJump', exerciseId: ex.id, value: maxDist, unit: 'cm', dateKey: completedWorkout.dateKey, workoutId: completedWorkout.id });
      }
    });
    return prs;
  }

  function completeWorkout(t) {
    var aw = t.activeWorkout;
    if (!aw) return null;
    var phase = getCurrentPhase(t, t.currentWeek);
    var rir = getTargetRIR(phase, t.currentWeek);
    var totalSets = 0, rirTotal = 0, rirCount = 0;
    var progressionOutcome = [];
    aw.exercises.forEach(function (exResult) {
      var ex = getExercise(t, exResult.exerciseId);
      if (!ex || !exResult.sets.length) return;
      var st = ensureExerciseState(t, exResult.exerciseId);
      var outcome = 'maintained';
      if (ex.progressionType === 'main') {
        outcome = progressMainLift(st, exResult, rir);
        applyMainLiftWeightChange(ex.id, st, outcome);
      } else if (ex.progressionType === 'doubleProgression') {
        outcome = progressDoubleProgression(st, exResult);
      } else if (ex.progressionType === 'pullupLadder') {
        outcome = progressPullUpLadder(st, exResult);
      } else if (ex.progressionType === 'power') {
        outcome = progressPower(st, exResult);
      }
      progressionOutcome.push({ exerciseId: ex.id, outcome: outcome });
      totalSets += exResult.sets.length;
      exResult.sets.forEach(function (s) { if (s.rir != null) { rirTotal += s.rir; rirCount++; } });
    });
    var completed = {
      id: aw.id, templateId: aw.templateId, weekNumber: aw.weekNumber, phaseName: aw.phaseName,
      dateKey: aw.dateKey, startedAt: aw.startedAt, completedAt: new Date().toISOString(),
      durationMinutes: Math.max(1, Math.round((Date.now() - new Date(aw.startedAt).getTime()) / 60000)),
      readinessCheckId: aw.readinessCheckId, exercises: aw.exercises,
      totalWorkingSets: totalSets, averageRIR: rirCount ? Math.round((rirTotal / rirCount) * 10) / 10 : null,
      sessionNote: aw.sessionNote, prsHit: [], progressionOutcome: progressionOutcome,
    };
    var prs = detectPRs(t, completed);
    completed.prsHit = prs.map(function (p) { return p.id; });
    t.personalRecords = t.personalRecords.concat(prs);
    t.completedWorkouts.push(completed);
    if (t.completedWorkouts.length > 200) t.completedWorkouts = t.completedWorkouts.slice(-200);
    t.activeWorkout = null;
    return completed;
  }

  function discardActiveWorkout(t) { t.activeWorkout = null; }

  // ---------------------------------------------------------------
  // Mobility
  // ---------------------------------------------------------------
  function toggleMobilityItem(t, id) {
    var item = t.mobilityRoutine.find(function (i) { return i.id === id; });
    if (item) item.completed = !item.completed;
  }
  function recordMobilityTest(t, results) {
    var test = Object.assign({ id: uid(), dateKey: activeDateKey() }, results);
    t.mobilityTests.push(test);
    if (t.mobilityTests.length > 60) t.mobilityTests = t.mobilityTests.slice(-60);
    return test;
  }
  function computeMobilityTrend(t) {
    var tests = t.mobilityTests;
    if (tests.length < 2) return 'stable';
    var a = tests[tests.length - 2], b = tests[tests.length - 1];
    function score(x) { return (x.deepSquatComfort || 3) + (x.hip90_90Rating || 3) + (x.thoracicRotationRating || 3) + (x.wallSlideQualityRating || 3) - (x.generalStiffnessRating || 3); }
    var diff = score(b) - score(a);
    if (diff > 0.5) return 'improving';
    if (diff < -0.5) return 'declining';
    return 'stable';
  }

  // ---------------------------------------------------------------
  // Dashboard stats / exercise history
  // ---------------------------------------------------------------
  function computeDashboardStats(t) {
    var weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); weekStart.setHours(0, 0, 0, 0);
    var workoutsThisWeek = t.completedWorkouts.filter(function (w) { return new Date(w.dateKey) >= weekStart; }).length;
    var mainLiftsProgressing = 0;
    ['ex_backSquat', 'ex_benchPress', 'ex_deadlift', 'ex_ohp'].forEach(function (id) {
      var st = t.exerciseState[id];
      if (st && st.consecutiveMisses === 0) mainLiftsProgressing++;
    });
    var weeklySets = t.completedWorkouts.filter(function (w) { return new Date(w.dateKey) >= weekStart; })
      .reduce(function (s, w) { return s + w.totalWorkingSets; }, 0);
    var latestReadiness = t.readinessChecks[t.readinessChecks.length - 1];
    var broadJumpPRs = t.personalRecords.filter(function (p) { return p.type === 'broadJump'; });
    return {
      currentWeek: t.currentWeek,
      workoutsThisWeek: workoutsThisWeek,
      mainLiftsProgressing: mainLiftsProgressing,
      weeklyWorkingSets: weeklySets,
      readiness: latestReadiness ? latestReadiness.computedStatus : 'unknown',
      pullUpMax: t.startingValues.pullUpMaxReps,
      broadJumpBest: broadJumpPRs.length ? Math.max.apply(null, broadJumpPRs.map(function (p) { return p.value; })) : 0,
      mobilityTrend: computeMobilityTrend(t),
    };
  }

  function computeExerciseHistory(t, exerciseId) {
    var rows = [];
    t.completedWorkouts.forEach(function (w) {
      var exResult = (w.exercises || []).find(function (e) { return e.exerciseId === exerciseId; });
      if (!exResult || !exResult.sets || !exResult.sets.length) return;
      var bestSet = exResult.sets.reduce(function (a, b) { return b.weight > a.weight ? b : a; }, exResult.sets[0]);
      rows.push({
        dateKey: w.dateKey, sets: exResult.sets.length, sets_detail: exResult.sets,
        bestWeight: bestSet.weight, bestReps: bestSet.reps,
        estimated1RM: Math.round(estimate1RM(bestSet.weight, bestSet.reps)),
        totalReps: exResult.sets.reduce(function (s, x) { return s + x.reps; }, 0),
        volume: exResult.sets.reduce(function (s, x) { return s + x.weight * x.reps; }, 0),
        painFlag: exResult.sets.some(function (s) { return s.painFlag; }),
        notes: exResult.notes,
      });
    });
    return rows;
  }

  function computeMetricSeries(t, exerciseId, metric) {
    var history = computeExerciseHistory(t, exerciseId);
    return history.map(function (row) { return { dateKey: row.dateKey, value: row[metric] || 0 }; });
  }

  function getPersonalRecords(t) { return t.personalRecords; }

  // ---------------------------------------------------------------
  // Cross-link readers (never persist)
  // ---------------------------------------------------------------
  function computeWeeklyReviewSummary() {
    var t = load();
    var weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); weekStart.setHours(0, 0, 0, 0);
    var thisWeek = t.completedWorkouts.filter(function (w) { return new Date(w.dateKey) >= weekStart; });
    var lifts = ['ex_backSquat', 'ex_benchPress', 'ex_deadlift', 'ex_ohp'].filter(function (id) {
      var st = t.exerciseState[id]; return st && st.consecutiveMisses === 0;
    }).length;
    var mobilityDone = t.mobilityRoutine.filter(function (i) { return i.completed; }).length;
    var readinessThisWeek = t.readinessChecks.filter(function (r) { return new Date(r.dateKey) >= weekStart; });
    var avgReadinessNum = readinessThisWeek.length
      ? readinessThisWeek.reduce(function (s, r) { return s + (r.computedStatus === 'green' ? 3 : r.computedStatus === 'amber' ? 2 : 1); }, 0) / readinessThisWeek.length
      : null;
    return {
      sessionsCompleted: thisWeek.length,
      liftsProgressed: lifts,
      workingSets: thisWeek.reduce(function (s, w) { return s + w.totalWorkingSets; }, 0),
      prsThisWeek: t.personalRecords.filter(function (p) { return new Date(p.dateKey) >= weekStart; }).length,
      mobilityPct: Math.round((mobilityDone / (t.mobilityRoutine.length || 1)) * 100),
      avgReadinessLabel: avgReadinessNum == null ? '—' : (avgReadinessNum >= 2.5 ? 'Green' : avgReadinessNum >= 1.7 ? 'Amber' : 'Red'),
    };
  }

  function computeLifeStatsSummary() {
    var t = load();
    var stats = computeDashboardStats(t);
    var recent = t.completedWorkouts.slice(-8);
    var consistency = recent.length ? Math.round((recent.length / 8) * 100) : 0;
    var mainProgressing = stats.mainLiftsProgressing;
    var strengthTrend = mainProgressing >= 3 ? 'improving' : mainProgressing >= 1 ? 'stable' : 'flat';
    return { trainingConsistency: consistency, strengthTrend: strengthTrend, mobilityTrend: stats.mobilityTrend };
  }

  function computeBoxingFatigueNote() {
    var t = load();
    var recent = t.completedWorkouts.slice(-3);
    if (!recent.length) return 'No recent gym sessions logged — nothing to factor into boxing load yet.';
    var avgRIR = recent.filter(function (w) { return w.averageRIR != null; });
    var avg = avgRIR.length ? avgRIR.reduce(function (s, w) { return s + w.averageRIR; }, 0) / avgRIR.length : null;
    if (avg != null && avg < 1.5) return 'Recent gym sessions have been pushed close to failure — consider easing intensity in the next boxing session.';
    return 'Recent gym load looks manageable — no extra fatigue flagged for boxing.';
  }

  function computeHealthReadinessSummary() {
    var t = load();
    var latest = t.readinessChecks[t.readinessChecks.length - 1];
    if (!latest) return null;
    return { dateKey: latest.dateKey, status: latest.computedStatus, sleepQuality: latest.sleepQuality, energy: latest.energy, soreness: latest.soreness, jointCondition: latest.jointCondition };
  }

  // ---------------------------------------------------------------
  // Substitutions / programme editor helpers
  // ---------------------------------------------------------------
  function getSubstitutesFor(t, exerciseId) {
    var ids = t.substitutions[exerciseId] || [];
    return ids.map(function (id) { return getExercise(t, id); }).filter(Boolean);
  }
  function updateExercise(t, exerciseId, patch) {
    var ex = getExercise(t, exerciseId);
    if (ex) Object.assign(ex, patch);
  }
  function reorderExerciseSlot(t, templateId, exerciseId, newOrder) {
    var tmpl = getTemplate(t, templateId);
    if (!tmpl) return;
    var idx = tmpl.exerciseSlots.indexOf(exerciseId);
    if (idx === -1) return;
    tmpl.exerciseSlots.splice(idx, 1);
    tmpl.exerciseSlots.splice(Math.max(0, Math.min(tmpl.exerciseSlots.length, newOrder)), 0, exerciseId);
  }
  function pauseExercise(t, exerciseId, paused) { updateExercise(t, exerciseId, { paused: !!paused }); }
  function addOptionalExercise(t, templateId, exerciseDef) {
    exerciseDef.id = exerciseDef.id || ('ex_custom_' + uid());
    t.exercises.push(exerciseDef);
    var tmpl = getTemplate(t, templateId);
    if (tmpl) tmpl.exerciseSlots.push(exerciseDef.id);
    return exerciseDef;
  }
  function setProgrammeStartDate(t, date) { t.programmeStartDate = date; }
  function setCurrentWeek(t, weekNumber) { t.currentWeek = Math.max(1, Math.min(12, weekNumber)); }
  function restartProgramme(t) {
    t.currentWeek = 1; t.restartCount = (t.restartCount || 0) + 1;
    t.programmeStartDate = activeDateKey();
  }
  function markWeekAsDeload(t, weekNumber, isDeload) {
    t.weekOverrides[String(weekNumber)] = { deload: !!isDeload };
  }
  function resetToDefaultProgramme(t) {
    var d = defaultTraining();
    t.exercises = d.exercises; t.workoutTemplates = d.workoutTemplates; t.phases = d.phases;
    t.substitutions = d.substitutions; t.weekOverrides = {};
  }

  window.Training = {
    KEY: KEY, uid: uid, activeDateKey: activeDateKey,
    load: load, save: save, defaultTraining: defaultTraining, migrate: migrate,
    needsOnboarding: needsOnboarding, completeOnboarding: completeOnboarding,
    getExercise: getExercise, getTemplate: getTemplate,
    getCurrentPhase: getCurrentPhase, getTargetRIR: getTargetRIR,
    getTodaysSession: getTodaysSession, shouldSkipGymC: shouldSkipGymC,
    startWorkout: startWorkout, logSet: logSet, substituteExercise: substituteExercise,
    updateSessionNote: updateSessionNote, completeWorkout: completeWorkout, discardActiveWorkout: discardActiveWorkout,
    suggestNextPrescription: suggestNextPrescription,
    computeReadinessStatus: computeReadinessStatus, recordReadinessCheck: recordReadinessCheck,
    getReadinessDefaultInputs: getReadinessDefaultInputs,
    estimate1RM: estimate1RM, detectPRs: detectPRs, getPersonalRecords: getPersonalRecords,
    computeDashboardStats: computeDashboardStats, computeExerciseHistory: computeExerciseHistory,
    computeMetricSeries: computeMetricSeries,
    toggleMobilityItem: toggleMobilityItem, recordMobilityTest: recordMobilityTest, computeMobilityTrend: computeMobilityTrend,
    computeWeeklyReviewSummary: computeWeeklyReviewSummary, computeLifeStatsSummary: computeLifeStatsSummary,
    computeBoxingFatigueNote: computeBoxingFatigueNote, computeHealthReadinessSummary: computeHealthReadinessSummary,
    getSubstitutesFor: getSubstitutesFor, updateExercise: updateExercise, reorderExerciseSlot: reorderExerciseSlot,
    pauseExercise: pauseExercise, addOptionalExercise: addOptionalExercise,
    setProgrammeStartDate: setProgrammeStartDate, setCurrentWeek: setCurrentWeek,
    restartProgramme: restartProgramme, markWeekAsDeload: markWeekAsDeload, resetToDefaultProgramme: resetToDefaultProgramme,
  };
})();
