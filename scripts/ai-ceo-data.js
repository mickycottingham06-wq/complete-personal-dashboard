// =============================================================
// AI CEO / Business Assistant — shared data layer.
// Owns the `aiCeo` localStorage key: defaults, load/save, and the
// prompt-generation engine. Reads context from window.Business,
// window.DailySnapshot and window.Streaks (never duplicates their
// data). Used by pages/ai-ceo.html and the preview card on
// index.html.
//
// No AI API is called here. generatePrompt() builds a text prompt
// the user copies into Claude/ChatGPT by hand. Swapping in a real
// API call later only means adding a fetch inside pages/ai-ceo.html
// that sends the same generated prompt — this file's shape does not
// need to change.
//
// Include this with a plain (non-defer) <script src="..."> tag,
// AFTER business-data.js / daily-snapshot-data.js / streaks-data.js
// and BEFORE any inline script that calls window.AiCeo.
// =============================================================
(function () {
  'use strict';

  var KEY = 'aiCeo';

  var MODES = [
    { id: 'daily-brief',  label: 'Daily CEO Brief',    icon: '🗞️', instruction: 'Give me a short, direct daily briefing: what matters most today and why.' },
    { id: 'strategy',     label: 'Business Strategy',  icon: '🧭', instruction: 'Think like a strategist. Focus on the highest-leverage move, not busywork.' },
    { id: 'offers',       label: 'Offer / Product Ideas', icon: '💡', instruction: 'Generate sharp, sellable offer or product ideas grounded in the context below.' },
    { id: 'sales',        label: 'Sales & Outreach',   icon: '📞', instruction: 'Focus on moving the pipeline forward — outreach, follow-ups, and closing.' },
    { id: 'content',      label: 'Content Ideas',      icon: '🎬', instruction: 'Generate content ideas that support the current business focus and attract buyers.' },
    { id: 'weekly-review', label: 'Weekly Review',     icon: '📊', instruction: 'Review the week honestly: what worked, what didn\'t, what changes next week.' },
    { id: 'decision',     label: 'Decision Coach',     icon: '⚖️', instruction: 'Help me make this decision. Weigh the options and commit to one, with reasoning.' },
    { id: 'problem-solver', label: 'Problem Solver',   icon: '🛠️', instruction: 'Diagnose the root cause of the problem below and give me a fix, not a workaround.' },
  ];

  var TONES = ['Direct', 'Supportive', 'Analytical', 'Blunt'];
  var ADVICE_STYLES = ['Concise', 'Detailed'];
  var ADVICE_STATUSES = ['Open', 'In Progress', 'Done', 'Dropped'];
  var ACTION_PRIORITIES = ['High', 'Medium', 'Low'];
  var ACTION_STATUSES = ['To Do', 'In Progress', 'Done'];

  function loadJSON(k, f) { try { return JSON.parse(localStorage.getItem(k)) || f; } catch (e) { return f; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function defaultAiCeo() {
    return {
      activeMode: MODES[0].id,
      currentQuestion: '',
      currentBlocker: '',
      nextBestAction: '',
      generatedPrompt: '',
      savedAdvice: [],
      actionPlan: [],
      settings: { tone: 'Direct', adviceStyle: 'Concise' },
    };
  }

  // Reads AI CEO data, filling in any missing fields against the default
  // shape so older saved data upgrades cleanly.
  function load() {
    var c = loadJSON(KEY, null);
    if (!c) { c = defaultAiCeo(); saveJSON(KEY, c); return c; }
    var d = defaultAiCeo();
    Object.keys(d).forEach(function (k) { if (!(k in c)) c[k] = d[k]; });
    if (!Array.isArray(c.savedAdvice)) c.savedAdvice = [];
    if (!Array.isArray(c.actionPlan)) c.actionPlan = [];
    if (!c.settings || typeof c.settings !== 'object') c.settings = d.settings;
    if (!c.settings.tone) c.settings.tone = d.settings.tone;
    if (!c.settings.adviceStyle) c.settings.adviceStyle = d.settings.adviceStyle;
    return c;
  }

  function save(c) { saveJSON(KEY, c); }

  function modeById(id) {
    for (var i = 0; i < MODES.length; i++) if (MODES[i].id === id) return MODES[i];
    return MODES[0];
  }

  function fmtMoney(n) {
    var v = Number(n) || 0;
    return '£' + v.toLocaleString('en-GB', { maximumFractionDigits: 0 });
  }

  // Pulls live context from the other data layers. Never stored — always
  // recomputed at generation time so the prompt reflects current state.
  function buildContext() {
    var biz = (window.Business && window.Business.load) ? window.Business.load() : null;
    var snap = (window.DailySnapshot && window.DailySnapshot.loadOrInit) ? window.DailySnapshot.loadOrInit() : null;
    var streaks = (window.Streaks && window.Streaks.get) ? window.Streaks.get() : null;
    var goals = (window.Goals && window.Goals.load) ? window.Goals.load() : null;
    var money = (window.Money && window.Money.computeSummary) ? window.Money.computeSummary() : null;
    var weeklyReview = (window.WeeklyReview && window.WeeklyReview.loadOrInit) ? window.WeeklyReview.loadOrInit() : null;

    var pipelineSummary = '';
    if (biz && Array.isArray(biz.pipeline) && biz.pipeline.length) {
      pipelineSummary = biz.pipeline
        .filter(function (p) { return p.name; })
        .map(function (p) { return p.name + ' (' + (p.stage || 'New Lead') + (p.value ? ', ' + fmtMoney(p.value) : '') + ')'; })
        .join('; ');
    }

    var activeGoals = (goals && Array.isArray(goals.activeGoals)) ? goals.activeGoals : [];

    return {
      business: biz,
      snapshot: snap,
      streaks: streaks,
      goals: goals,
      activeGoals: activeGoals,
      money: money,
      weeklyReview: weeklyReview,
      pipelineSummary: pipelineSummary,
    };
  }

  // Builds the copy-paste prompt from the current AI CEO state plus live
  // context. Pure function of (ceo state, context) — no side effects.
  function generatePrompt(ceo) {
    var mode = modeById(ceo.activeMode);
    var ctx = buildContext();
    var biz = ctx.business || {};
    var snap = ctx.snapshot || {};
    var tone = (ceo.settings && ceo.settings.tone) || 'Direct';
    var style = (ceo.settings && ceo.settings.adviceStyle) || 'Concise';

    var lines = [];
    lines.push('You are my AI CEO and business strategist. Use the context below to give me direct, practical advice.');
    lines.push('Mode: ' + mode.label + '. ' + mode.instruction);
    lines.push('Tone: ' + tone + '. Advice style: ' + style + '.');
    lines.push('');
    lines.push('Context:');
    lines.push('- Current business focus: ' + (biz.currentFocus || 'Not set'));
    lines.push('- Active project: ' + (biz.activeProject || 'Not set'));
    lines.push('- Today\'s task: ' + (biz.todayTask || 'Not set'));
    lines.push('- Weekly target: ' + (biz.weeklyTarget || 'Not set'));
    lines.push('- Revenue target: ' + fmtMoney(biz.revenueTarget));
    lines.push('- Current revenue: ' + fmtMoney(biz.currentRevenue));
    lines.push('- Pipeline: ' + (ctx.pipelineSummary || 'Empty'));
    lines.push('- Current problem / blocker: ' + (ceo.currentBlocker || 'None stated'));
    if (snap && snap.mainFocus) lines.push('- Today\'s main focus (Daily Snapshot): ' + snap.mainFocus);
    if (ctx.streaks && typeof ctx.streaks.currentStreak === 'number') lines.push('- Current habit streak: ' + ctx.streaks.currentStreak + ' days');
    if (ctx.activeGoals && ctx.activeGoals.length) {
      var topGoal = ctx.activeGoals[0];
      lines.push('- Active goals: ' + ctx.activeGoals.length + ' (top: ' + (topGoal.title || 'Untitled') + ', ' + (Number(topGoal.progress) || 0) + '% progress)');
    }
    if (ctx.money) {
      lines.push('- Money: net worth ' + fmtMoney(ctx.money.netWorth) + ', monthly savings ' + fmtMoney(ctx.money.monthlySavings) + ' (' + (Number(ctx.money.savingsRate) || 0) + '% savings rate)');
    }
    if (ctx.weeklyReview && ctx.weeklyReview.nextWeekFocus) lines.push('- Next week\'s focus (Weekly Review): ' + ctx.weeklyReview.nextWeekFocus);
    lines.push('');
    lines.push('My question:');
    lines.push(ceo.currentQuestion || '(no question typed — give general advice based on the context above)');
    lines.push('');
    lines.push('Give me:');
    lines.push('1. The best next action');
    lines.push('2. A simple 3-step plan');
    lines.push('3. What to avoid');
    lines.push('4. How to execute this today');
    lines.push('5. A short accountability check');

    return lines.join('\n');
  }

  window.AiCeo = {
    KEY: KEY,
    MODES: MODES,
    TONES: TONES,
    ADVICE_STYLES: ADVICE_STYLES,
    ADVICE_STATUSES: ADVICE_STATUSES,
    ACTION_PRIORITIES: ACTION_PRIORITIES,
    ACTION_STATUSES: ACTION_STATUSES,
    uid: uid,
    load: load,
    save: save,
    modeById: modeById,
    buildContext: buildContext,
    generatePrompt: generatePrompt,
  };
})();
