// =============================================================
// Content (MB Automotive marketing) — data layer.
//
// Text drafts: localStorage key `contentDrafts` (small JSON, no image
// data) — included in Auto Cloud Save like every other key.
// Photos: IndexedDB database `lockin-content-photos` on this device
// only. Never localStorage, never the Supabase sync row, never the
// project folder, never sent to the AI. If IndexedDB is unavailable,
// photos are session-only and the page says so.
//
// Captions come only from what the user typed. Template mode is
// deterministic; AI drafts are checked for invented prices/claims.
// =============================================================
(function () {
  'use strict';

  var KEY = 'contentDrafts';
  var BUSINESS = {
    name: 'MB Automotive Works',
    short: 'MB Automotive',
    base: 'Heathfield',
    areas: 'East Sussex, Brighton, Tunbridge Wells and surrounding areas',
    email: 'info@mbautomotiveworks.co.uk',
    phone: '07539246591',
    hashtags: '#MBAutomotive #Heathfield #EastSussex #Brighton #TunbridgeWells #Mechanic',
  };

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function nowIso() { return new Date().toISOString(); }
  function str(v) { return typeof v === 'string' ? v : ''; }

  // ---------- drafts (text + metadata) ----------
  function cleanDraft(d) {
    var s = d.story && typeof d.story === 'object' ? d.story : {};
    var t = s.transform && typeof s.transform === 'object' ? s.transform : {};
    return {
      id: str(d.id) || uid(),
      kind: d.kind === 'story' ? 'story' : 'post',
      jobDetails: str(d.jobDetails),
      vehicle: str(d.vehicle),
      price: str(d.price),
      caption: str(d.caption),
      source: d.source === 'ai' ? 'ai' : 'template',
      model: str(d.model),
      story: {
        headline: str(s.headline),
        lines: Array.isArray(s.lines) ? s.lines.map(str).slice(0, 4) : [],
        photoId: str(s.photoId),
        transform: { x: Number(t.x) || 0, y: Number(t.y) || 0, zoom: Number(t.zoom) || 1 },
        covers: Array.isArray(s.covers) ? s.covers.filter(function (c) { return c && isFinite(c.x) && isFinite(c.y) && c.w > 0 && c.h > 0; })
          .map(function (c) { return { x: +c.x, y: +c.y, w: +c.w, h: +c.h }; }) : [],
      },
      photos: Array.isArray(d.photos) ? d.photos.filter(function (p) { return p && p.id; }).map(function (p) { return { id: str(p.id), name: str(p.name), type: str(p.type) }; }) : [],
      createdAt: str(d.createdAt) || nowIso(),
      updatedAt: str(d.updatedAt) || str(d.createdAt) || nowIso(),
    };
  }

  function load() {
    var data = null;
    try { data = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (!data || !Array.isArray(data.drafts)) return { version: 1, drafts: [] };
    data.drafts = data.drafts.filter(function (d) { return d && typeof d === 'object'; });
    return data;
  }

  function write(data) {
    var raw = JSON.stringify(data);
    try { localStorage.setItem(KEY, raw); }
    catch (e) { return { ok: false, error: (e && e.name === 'QuotaExceededError') ? 'This device\'s storage is full — draft not saved.' : 'Could not save on this device.' }; }
    var back = null;
    try { back = localStorage.getItem(KEY); } catch (e) {}
    return back === raw ? { ok: true } : { ok: false, error: 'Save could not be confirmed on this device.' };
  }

  // Creates or updates (by id). Returns { ok, draft }.
  function saveDraft(d) {
    if (!str(d.jobDetails).trim() && !str(d.caption).trim()) return { ok: false, error: 'Nothing to save yet.' };
    var data = load();
    var i = data.drafts.findIndex(function (x) { return x.id === d.id; });
    var t = nowIso();
    var draft = cleanDraft(Object.assign({}, d, { createdAt: i === -1 ? t : data.drafts[i].createdAt, updatedAt: t }));
    if (i === -1) data.drafts.unshift(draft); else data.drafts[i] = draft;
    var res = write(data);
    if (res.ok) res.draft = draft;
    return res;
  }

  function getDraft(id) { return load().drafts.find(function (d) { return d.id === id; }) || null; }

  function removeDraft(id) {
    var data = load();
    var i = data.drafts.findIndex(function (d) { return d.id === id; });
    if (i === -1) return { ok: false, error: 'That draft no longer exists.' };
    var draft = data.drafts.splice(i, 1)[0];
    var res = write(data);
    if (res.ok) { res.draft = draft; res.index = i; }
    return res;
  }

  function restoreDraft(draft, index) {
    var data = load();
    if (data.drafts.some(function (d) { return d.id === draft.id; })) return { ok: true };
    data.drafts.splice(Math.min(index, data.drafts.length), 0, draft);
    return write(data);
  }

  function buildExport() {
    return { app: 'micky-life-os', kind: 'content-drafts', version: 1, exportedAt: nowIso(), note: 'Text only — photos are not included.', drafts: load().drafts };
  }

  function restore(payload) {
    if (!payload || payload.kind !== 'content-drafts' || !Array.isArray(payload.drafts)) return { ok: false, error: 'This isn\'t a Content drafts export file.' };
    var data = load();
    var byId = {};
    data.drafts.forEach(function (d, i) { byId[d.id] = i; });
    var added = 0, updated = 0;
    payload.drafts.forEach(function (raw) {
      if (!raw || typeof raw !== 'object' || (!raw.jobDetails && !raw.caption)) return;
      var d = cleanDraft(raw);
      if (d.id in byId) { if (d.updatedAt > data.drafts[byId[d.id]].updatedAt) { data.drafts[byId[d.id]] = d; updated++; } }
      else { data.drafts.push(d); byId[d.id] = data.drafts.length - 1; added++; }
    });
    var res = write(data);
    if (res.ok) { res.added = added; res.updated = updated; }
    return res;
  }

  // ---------- photos (IndexedDB, this device only) ----------
  var DB_NAME = 'lockin-content-photos', STORE = 'photos';
  var dbPromise = null;
  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      try {
        if (!window.indexedDB) return resolve(null);
        var req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function () { req.result.createObjectStore(STORE, { keyPath: 'id' }); };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { resolve(null); };
        req.onblocked = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
    return dbPromise;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      if (!d) return { ok: false, error: 'Photo storage unavailable on this device.' };
      return new Promise(function (resolve) {
        try {
          var t = d.transaction(STORE, mode);
          var out = fn(t.objectStore(STORE));
          t.oncomplete = function () { resolve({ ok: true, value: out && out.result }); };
          t.onerror = t.onabort = function () { resolve({ ok: false, error: (t.error && t.error.name === 'QuotaExceededError') ? 'Not enough space on this device for photos.' : 'Could not save photos on this device.' }); };
        } catch (e) { resolve({ ok: false, error: 'Could not access photo storage.' }); }
      });
    });
  }
  function photoStorageAvailable() { return db().then(function (d) { return !!d; }); }
  function putPhoto(id, draftId, blob, name) { return tx('readwrite', function (s) { return s.put({ id: id, draftId: draftId, blob: blob, name: name, savedAt: nowIso() }); }); }
  function getPhoto(id) { return tx('readonly', function (s) { return s.get(id); }).then(function (r) { return r.ok && r.value ? r.value : null; }); }
  function deletePhoto(id) { return tx('readwrite', function (s) { return s.delete(id); }); }
  function allPhotoKeys() { return tx('readonly', function (s) { return s.getAll(); }).then(function (r) { return r.ok ? (r.value || []).map(function (p) { return { id: p.id, draftId: p.draftId }; }) : []; }); }

  // Removes this draft's stored photos that are no longer attached to it.
  function prunePhotos(draftId, keepIds) {
    return allPhotoKeys().then(function (list) {
      return Promise.all(list.filter(function (p) { return p.draftId === draftId && keepIds.indexOf(p.id) === -1; }).map(function (p) { return deletePhoto(p.id); }));
    });
  }

  // Removes stored photos whose draft no longer exists. Run on page load
  // only, so Undo after a delete in the same session still has its photos.
  function cleanupOrphanPhotos(keepIds) {
    var drafts = {};
    load().drafts.forEach(function (d) { drafts[d.id] = true; });
    (keepIds || []).forEach(function (id) { drafts[id] = true; });
    return allPhotoKeys().then(function (list) {
      return Promise.all(list.filter(function (p) { return !drafts[p.draftId]; }).map(function (p) { return deletePhoto(p.id); }));
    });
  }

  // ---------- writing ----------
  function sentences(text) { return str(text).replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter(Boolean); }
  function capFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function words(s, n) { var w = str(s).replace(/[.!?,;:]+$/, '').split(/\s+/).filter(Boolean); return w.slice(0, n).join(' ') + (w.length > n ? '…' : ''); }

  function contactLine() { return 'To book or ask a question, call ' + BUSINESS.phone + ' or email ' + BUSINESS.email + '.'; }

  // Deterministic draft using only the user's own words.
  function template(input) {
    var details = str(input.jobDetails).trim().replace(/\s+/g, ' ');
    var vehicle = str(input.vehicle).trim();
    var price = str(input.price).trim();
    var first = sentences(details)[0] || details;
    var body = sentences(details).map(capFirst).join(' ');
    if (body && !/[.!?]$/.test(body)) body += '.';
    var lines = [];
    lines.push((vehicle ? vehicle + ' — ' : '') + 'recent job from ' + BUSINESS.short + '.');
    lines.push('');
    lines.push(body);
    if (price) { lines.push(''); lines.push('Call-out: ' + price); }
    lines.push('');
    lines.push(BUSINESS.name + ', based in ' + BUSINESS.base + ', covering ' + BUSINESS.areas + '.');
    lines.push(contactLine());
    lines.push('');
    lines.push(BUSINESS.hashtags);
    var storyLines = [];
    if (vehicle) storyLines.push(vehicle);
    if (price) storyLines.push('Call-out: ' + price);
    return {
      caption: lines.join('\n'),
      headline: capFirst(words(first, 6)) || 'Recent job',
      lines: storyLines,
    };
  }

  // Phrases that would be invented claims unless the user wrote them.
  var CLAIMS = [
    ['guarantee', /guarantee/i], ['warranty', /warrant(y|ies|ied)/i], ['certified', /certif/i], ['qualified', /qualified|qualification/i],
    ['accredited', /accredit/i], ['approved', /\bapproved\b/i], ['award', /award/i], ['review', /\breview|testimonial|★|\bstars?\b/i],
    ['years of experience', /\d+\s*\+?\s*years?/i], ['cheapest/best', /cheapest|best (price|value|in)|lowest price|no\.?\s*1\b/i],
    ['same day / fast turnaround', /same[- ]day|while you wait|turnaround|within \d+/i], ['fixed / sorted', /\b(fixed|sorted|repaired|good as new|running perfectly|like new)\b/i],
    ['diagnosed', /diagnos/i], ['replaced', /\breplac/i],
  ];

  // Checks AI text against the user's input. Returns { ok, problems[] }.
  function checkClaims(text, input) {
    var src = (str(input.jobDetails) + ' ' + str(input.vehicle) + ' ' + str(input.price)).toLowerCase();
    var problems = [];
    var money = str(text).match(/£\s?\d[\d,.]*/g) || [];
    money.forEach(function (m) {
      var amount = m.replace(/[£\s,]/g, '');
      if (!str(input.price) || str(input.price).replace(/[£\s,]/g, '').indexOf(amount) === -1) problems.push('a price (' + m + ') you didn\'t supply');
    });
    CLAIMS.forEach(function (c) { if (c[1].test(text) && !c[1].test(src)) problems.push('"' + c[0] + '"'); });
    var digits = str(text).replace(BUSINESS.phone, '').match(/\b\d{2,}\b/g) || [];
    digits.forEach(function (d) { if (src.indexOf(d) === -1 && problems.indexOf('the number ' + d) === -1) problems.push('the number ' + d); });
    return { ok: !problems.length, problems: problems };
  }

  function ensureContact(caption) {
    return (caption.indexOf(BUSINESS.phone) !== -1 || caption.indexOf(BUSINESS.email) !== -1) ? caption : caption.replace(/\s*$/, '') + '\n\n' + contactLine();
  }

  window.ContentData = {
    KEY: KEY,
    BUSINESS: BUSINESS,
    uid: uid,
    load: load,
    saveDraft: saveDraft,
    getDraft: getDraft,
    removeDraft: removeDraft,
    restoreDraft: restoreDraft,
    buildExport: buildExport,
    restore: restore,
    photoStorageAvailable: photoStorageAvailable,
    putPhoto: putPhoto,
    getPhoto: getPhoto,
    deletePhoto: deletePhoto,
    cleanupOrphanPhotos: cleanupOrphanPhotos,
    prunePhotos: prunePhotos,
    template: template,
    checkClaims: checkClaims,
    ensureContact: ensureContact,
    contactLine: contactLine,
  };
})();
