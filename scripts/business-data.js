// =============================================================
// Business HQ — shared data layer.
// Owns the `business` localStorage key: defaults and load/save.
// Any page (Business HQ itself, the preview card on index.html)
// reads/writes through this file instead of touching localStorage
// directly, so they always agree.
//
// Include this with a plain (non-defer) <script src="..."> tag
// BEFORE any inline script that calls window.Business, so it is
// guaranteed to be ready by the time it's used.
// =============================================================
(function () {
  'use strict';

  var KEY = 'business';

  var DEFAULT_PROJECTS = [
    { id: 'p1', name: 'AI automation agency', status: 'Active', priority: 'High' },
    { id: 'p2', name: 'Digital products', status: 'Active', priority: 'Medium' },
    { id: 'p3', name: 'Reselling / Whatnot', status: 'Active', priority: 'Medium' },
    { id: 'p4', name: 'Property sourcing', status: 'Paused', priority: 'Low' },
    { id: 'p5', name: 'Content / faceless TikTok', status: 'Active', priority: 'Medium' },
  ];

  function loadJSON(k, f) { try { return JSON.parse(localStorage.getItem(k)) || f; } catch (e) { return f; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function defaultBusiness() {
    return {
      currentFocus: '',
      activeProject: 'AI automation agency',
      todayTask: '',
      weeklyTarget: '',
      revenueTarget: 0,
      currentRevenue: 0,
      pipeline: [],
      projects: DEFAULT_PROJECTS.map(function (p) { return Object.assign({}, p); }),
      notes: '',
      aiCeoPrompt: '',
    };
  }

  // Reads business data, filling in any missing fields against the
  // default shape so older saved data upgrades cleanly.
  function load() {
    var b = loadJSON(KEY, null);
    if (!b) { b = defaultBusiness(); saveJSON(KEY, b); return b; }
    var d = defaultBusiness();
    Object.keys(d).forEach(function (k) { if (!(k in b)) b[k] = d[k]; });
    if (!Array.isArray(b.pipeline)) b.pipeline = [];
    if (!Array.isArray(b.projects) || b.projects.length === 0) b.projects = d.projects;
    return b;
  }

  function save(b) { saveJSON(KEY, b); }

  window.Business = {
    KEY: KEY,
    DEFAULT_PROJECTS: DEFAULT_PROJECTS,
    uid: uid,
    load: load,
    save: save,
  };
})();
