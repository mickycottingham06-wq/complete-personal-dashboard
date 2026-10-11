// =============================================================
// Second Brain — notes data layer.
// Owns the `secondBrain` localStorage key:
//   { version: 1, notes: [{ id, title, content, category, sourceUrl,
//     sourceFile, createdAt, updatedAt }] }
// Only title or content is needed; everything else is optional.
//
// Cloud: scripts/auto-sync.js pushes every localStorage key (this one
// is not on its exclude list), so notes sync whenever Auto Cloud Save is
// configured and signed in. This file only confirms the local write.
//
// Search is plain text matching over stored notes — no AI, no
// embeddings, nothing generated.
// =============================================================
(function () {
  'use strict';

  var KEY = 'secondBrain';
  var CATEGORIES = ['Business', 'Money', 'Property', 'Health', 'Family'];
  var IMPORT_EXT = ['txt', 'md', 'markdown'];
  var MAX_IMPORT_BYTES = 200 * 1024; // keeps the whole dataset well inside browser storage limits

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function nowIso() { return new Date().toISOString(); }
  function str(v) { return typeof v === 'string' ? v : ''; }

  function cleanNote(n) {
    return {
      id: str(n.id) || uid(),
      title: str(n.title).trim(),
      content: str(n.content),
      category: CATEGORIES.indexOf(n.category) !== -1 ? n.category : '',
      sourceUrl: str(n.sourceUrl).trim(),
      sourceFile: str(n.sourceFile),
      createdAt: str(n.createdAt) || nowIso(),
      updatedAt: str(n.updatedAt) || str(n.createdAt) || nowIso(),
    };
  }

  function load() {
    var data = null;
    try { data = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (!data || !Array.isArray(data.notes)) return { version: 1, notes: [] };
    data.notes = data.notes.filter(function (n) { return n && typeof n === 'object'; });
    return data;
  }

  // Writes then reads back — { ok, error }. Never throws.
  function write(data) {
    var raw = JSON.stringify(data);
    try {
      localStorage.setItem(KEY, raw);
    } catch (e) {
      var full = e && (e.name === 'QuotaExceededError' || e.code === 22);
      return { ok: false, error: full ? 'This device\'s storage is full — nothing was saved. Export a backup, then shorten or delete large notes.' : 'Could not save on this device.' };
    }
    var back = null;
    try { back = localStorage.getItem(KEY); } catch (e) {}
    return back === raw ? { ok: true } : { ok: false, error: 'Save could not be confirmed on this device.' };
  }

  // No title given → first line of the content (trimmed of markdown #).
  function deriveTitle(title, content) {
    title = str(title).trim();
    if (title) return title;
    var first = str(content).split(/\r?\n/).map(function (l) { return l.replace(/^#+\s*/, '').trim(); }).find(Boolean) || '';
    return first.length > 80 ? first.slice(0, 77) + '…' : first;
  }

  function create(fields) {
    var title = deriveTitle(fields.title, fields.content);
    if (!title && !str(fields.content).trim()) return { ok: false, error: 'Add a title or some content.' };
    var t = nowIso();
    var note = cleanNote(Object.assign({}, fields, { id: uid(), title: title, createdAt: t, updatedAt: t }));
    var data = load();
    data.notes.unshift(note);
    var res = write(data);
    if (res.ok) res.note = note;
    return res;
  }

  function update(id, fields) {
    var data = load();
    var i = data.notes.findIndex(function (n) { return n.id === id; });
    if (i === -1) return { ok: false, error: 'That note no longer exists.' };
    var title = deriveTitle(fields.title, fields.content);
    if (!title && !str(fields.content).trim()) return { ok: false, error: 'Add a title or some content.' };
    var old = data.notes[i];
    data.notes[i] = cleanNote(Object.assign({}, old, fields, { id: old.id, title: title, createdAt: old.createdAt, updatedAt: nowIso() }));
    var res = write(data);
    if (res.ok) res.note = data.notes[i];
    return res;
  }

  // Returns { ok, note, index } so the caller can offer Undo.
  function remove(id) {
    var data = load();
    var i = data.notes.findIndex(function (n) { return n.id === id; });
    if (i === -1) return { ok: false, error: 'That note no longer exists.' };
    var note = data.notes.splice(i, 1)[0];
    var res = write(data);
    if (res.ok) { res.note = note; res.index = i; }
    return res;
  }

  function restoreNote(note, index) {
    var data = load();
    if (data.notes.some(function (n) { return n.id === note.id; })) return { ok: true };
    data.notes.splice(Math.min(index, data.notes.length), 0, note);
    return write(data);
  }

  function get(id) { return load().notes.find(function (n) { return n.id === id; }) || null; }

  // ---------- Search ----------
  function terms(q) { return str(q).toLowerCase().split(/\s+/).filter(Boolean); }

  // Every term must appear somewhere in the note. Title hits rank first,
  // then most recently updated.
  function search(query, category) {
    var t = terms(query);
    var notes = load().notes.filter(function (n) { return !category || n.category === category; });
    var scored = [];
    notes.forEach(function (n) {
      var title = n.title.toLowerCase();
      var hay = [title, n.content.toLowerCase(), n.category.toLowerCase(), n.sourceFile.toLowerCase(), n.sourceUrl.toLowerCase()].join('\n');
      if (!t.every(function (w) { return hay.indexOf(w) !== -1; })) return;
      var score = t.reduce(function (s, w) { return s + (title.indexOf(w) !== -1 ? 1 : 0); }, 0);
      scored.push({ note: n, score: score });
    });
    scored.sort(function (a, b) { return b.score - a.score || (b.note.updatedAt > a.note.updatedAt ? 1 : -1); });
    return scored.map(function (s) { return s.note; });
  }

  // Short excerpt of the stored content around the first matching term.
  function snippet(note, query) {
    var text = note.content.replace(/\s+/g, ' ').trim();
    if (!text) return '';
    var lower = text.toLowerCase();
    var at = -1;
    terms(query).some(function (w) { at = lower.indexOf(w); return at !== -1; });
    if (at === -1) return text.length > 140 ? text.slice(0, 140) + '…' : text;
    var start = Math.max(0, at - 50);
    return (start ? '…' : '') + text.slice(start, start + 140) + (start + 140 < text.length ? '…' : '');
  }

  // ---------- Import (.txt / .md only) ----------
  function extOf(name) { var m = /\.([^.]+)$/.exec(name || ''); return m ? m[1].toLowerCase() : ''; }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result || '')); };
      r.onerror = function () { reject(r.error); };
      r.readAsText(file);
    });
  }

  // Returns { imported: [names], skipped: [{ name, reason }] }.
  async function importFiles(fileList) {
    var out = { imported: [], skipped: [] };
    var files = Array.prototype.slice.call(fileList || []);
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var ext = extOf(f.name);
      if (IMPORT_EXT.indexOf(ext) === -1) {
        var kind = ext === 'pdf' ? 'PDF' : /^(jpe?g|png|heic|gif|webp)$/.test(ext) ? 'photo' : (ext ? '.' + ext : 'this type of') ;
        out.skipped.push({ name: f.name, reason: 'Not read — ' + kind + ' files can\'t be imported yet. Add a note with a link to the original instead.' });
        continue;
      }
      if (f.size > MAX_IMPORT_BYTES) { out.skipped.push({ name: f.name, reason: 'Not imported — larger than 200 KB.' }); continue; }
      var text;
      try { text = await readFile(f); } catch (e) { out.skipped.push({ name: f.name, reason: 'Could not read the file.' }); continue; }
      var res = create({ title: f.name.replace(/\.[^.]+$/, ''), content: text, sourceFile: f.name });
      if (res.ok) out.imported.push(f.name); else out.skipped.push({ name: f.name, reason: res.error });
    }
    return out;
  }

  // ---------- Export / restore ----------
  function buildExport() {
    return { app: 'micky-life-os', kind: 'second-brain', version: 1, exportedAt: nowIso(), notes: load().notes };
  }

  // Merges a backup into current notes: new ids are added; for matching ids
  // the newer updatedAt wins. Never deletes notes that aren't in the file.
  function restore(payload) {
    if (!payload || payload.kind !== 'second-brain' || !Array.isArray(payload.notes)) {
      return { ok: false, error: 'This isn\'t a Second Brain export file.' };
    }
    var data = load();
    var byId = {};
    data.notes.forEach(function (n, i) { byId[n.id] = i; });
    var added = 0, updated = 0;
    payload.notes.forEach(function (raw) {
      if (!raw || typeof raw !== 'object' || (!raw.title && !raw.content)) return;
      var n = cleanNote(raw);
      if (n.id in byId) {
        var cur = data.notes[byId[n.id]];
        if (n.updatedAt > cur.updatedAt) { data.notes[byId[n.id]] = n; updated++; }
      } else { data.notes.push(n); byId[n.id] = data.notes.length - 1; added++; }
    });
    var res = write(data);
    if (res.ok) { res.added = added; res.updated = updated; }
    return res;
  }

  window.SecondBrain = {
    KEY: KEY,
    CATEGORIES: CATEGORIES,
    load: load,
    get: get,
    create: create,
    update: update,
    remove: remove,
    restoreNote: restoreNote,
    search: search,
    snippet: snippet,
    importFiles: importFiles,
    buildExport: buildExport,
    restore: restore,
  };
})();
