// =============================================================
// Story renderer — draws a 1080 × 1920 Instagram Story onto a canvas.
// The same function draws the on-screen preview (with safe-zone guides)
// and the exported PNG (without), so the export matches the preview.
//
// Layout keeps all text inside x 90–990 and y 270–1650, clear of
// Instagram's top bar and bottom reply bar. Text is wrapped and shrunk
// to fit; anything that still doesn't fit is reported, never clipped
// silently. Hidden areas (plates etc.) are heavily pixelated and stored
// in photo pixels so they follow the photo when it's moved or zoomed.
// No brand image assets exist in the repo, so the brand mark is text.
// =============================================================
(function () {
  'use strict';

  var W = 1080, H = 1920;
  var SAFE = { left: 90, right: 990, top: 270, bottom: 1650 };
  var FONT = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var BLUE = '#5b9cff';

  function baseScale(img) { return Math.max(W / img.width, H / img.height); }

  // Keeps the photo covering the whole frame (no empty edges).
  function clampTransform(img, t) {
    var zoom = Math.min(4, Math.max(1, Number(t.zoom) || 1));
    var s = baseScale(img) * zoom;
    var mx = Math.max(0, (img.width * s - W) / 2), my = Math.max(0, (img.height * s - H) / 2);
    return { x: Math.max(-mx, Math.min(mx, Number(t.x) || 0)), y: Math.max(-my, Math.min(my, Number(t.y) || 0)), zoom: zoom };
  }

  function placement(img, t) {
    var s = baseScale(img) * t.zoom;
    return { s: s, left: (W - img.width * s) / 2 + t.x, top: (H - img.height * s) / 2 + t.y };
  }

  // Canvas point → photo pixel (for drawing hide-areas on the preview).
  function toPhoto(img, t, cx, cy) { var p = placement(img, t); return { x: (cx - p.left) / p.s, y: (cy - p.top) / p.s }; }

  function pixelate(ctx, x, y, w, h) {
    x = Math.max(0, Math.floor(x)); y = Math.max(0, Math.floor(y));
    w = Math.min(W - x, Math.ceil(w)); h = Math.min(H - y, Math.ceil(h));
    if (w < 2 || h < 2) return;
    var block = Math.max(28, Math.min(w, h) / 2.2);
    var tw = Math.max(1, Math.round(w / block)), th = Math.max(1, Math.round(h / block));
    var tmp = document.createElement('canvas');
    tmp.width = tw; tmp.height = th;
    var tc = tmp.getContext('2d');
    tc.drawImage(ctx.canvas, x, y, w, h, 0, 0, tw, th);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, tw, th, x, y, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  function wrap(ctx, text, maxW) {
    var words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    var lines = [], cur = '';
    words.forEach(function (w) {
      var next = cur ? cur + ' ' + w : w;
      if (ctx.measureText(next).width <= maxW) { cur = next; return; }
      if (cur) lines.push(cur);
      // a single word wider than the line is broken by characters
      while (ctx.measureText(w).width > maxW && w.length > 1) {
        var i = w.length;
        while (i > 1 && ctx.measureText(w.slice(0, i) + '-').width > maxW) i--;
        lines.push(w.slice(0, i) + '-');
        w = w.slice(i);
      }
      cur = w;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  // Finds the largest size ≤ max where text fits in maxLines; else ellipsises.
  function fit(ctx, text, weight, max, min, maxLines, maxW) {
    for (var size = max; size >= min; size -= 4) {
      ctx.font = weight + ' ' + size + 'px ' + FONT;
      var lines = wrap(ctx, text, maxW);
      if (lines.length <= maxLines) return { size: size, lines: lines, shortened: false };
    }
    ctx.font = weight + ' ' + min + 'px ' + FONT;
    var all = wrap(ctx, text, maxW), kept = all.slice(0, maxLines);
    var last = kept[maxLines - 1] || '';
    while (last && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1);
    kept[maxLines - 1] = last.replace(/\s+$/, '') + '…';
    return { size: min, lines: kept, shortened: true };
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // opts: { img, transform, covers, headline, lines, business, guides }
  // Returns { issues: [] } describing any text that had to be shortened.
  function render(canvas, opts) {
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    var issues = [];
    var B = opts.business;

    // 1. background: the user's photo, or a plain branded gradient (never a fake photo)
    if (opts.img) {
      var t = clampTransform(opts.img, opts.transform || {});
      var p = placement(opts.img, t);
      ctx.drawImage(opts.img, p.left, p.top, opts.img.width * p.s, opts.img.height * p.s);
      (opts.covers || []).forEach(function (c) { pixelate(ctx, p.left + c.x * p.s, p.top + c.y * p.s, c.w * p.s, c.h * p.s); });
    } else {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#1f2a3d'); g.addColorStop(1, '#101318');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    // 2. readability overlay behind the text panel
    var ov = ctx.createLinearGradient(0, 980, 0, H);
    ov.addColorStop(0, 'rgba(12,14,18,0)'); ov.addColorStop(0.35, 'rgba(12,14,18,0.78)'); ov.addColorStop(1, 'rgba(12,14,18,0.94)');
    ctx.fillStyle = ov; ctx.fillRect(0, 980, W, H - 980);

    // 3. brand mark (top, inside safe zone)
    ctx.font = '700 40px ' + FONT;
    ctx.textBaseline = 'alphabetic';
    var mark = B.short.toUpperCase();
    var mw = ctx.measureText(mark).width + 64;
    ctx.fillStyle = 'rgba(12,14,18,0.72)';
    roundRect(ctx, (W - mw) / 2, SAFE.top, mw, 78, 39); ctx.fill();
    ctx.fillStyle = BLUE; ctx.fillRect((W - mw) / 2 + 32, SAFE.top + 64, mw - 64, 4);
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
    ctx.fillText(mark, W / 2, SAFE.top + 52);

    // 4. text panel, laid out bottom-up from the safe bottom edge
    ctx.textAlign = 'left';
    var maxW = SAFE.right - SAFE.left;
    var y = SAFE.bottom;
    ctx.font = '500 30px ' + FONT; ctx.fillStyle = 'rgba(233,237,242,0.78)';
    var area = wrap(ctx, B.base + ' · East Sussex · Brighton · Tunbridge Wells', maxW);
    for (var i = area.length - 1; i >= 0; i--) { ctx.fillText(area[i], SAFE.left, y); y -= 40; }
    y -= 10;
    ctx.font = '500 38px ' + FONT; ctx.fillStyle = '#e9edf2';
    ctx.fillText(B.email, SAFE.left, y); y -= 56;
    ctx.font = '700 50px ' + FONT; ctx.fillStyle = BLUE;
    ctx.fillText(B.phone, SAFE.left, y); y -= 80;

    var lines = (opts.lines || []).filter(function (l) { return String(l).trim(); }).slice(0, 3);
    for (var j = lines.length - 1; j >= 0; j--) {
      var f = fit(ctx, lines[j], '500', 46, 36, 2, maxW);
      if (f.shortened) issues.push('A line was shortened to fit: "' + String(lines[j]).slice(0, 40) + '"');
      ctx.font = '500 ' + f.size + 'px ' + FONT; ctx.fillStyle = 'rgba(233,237,242,0.92)';
      for (var k = f.lines.length - 1; k >= 0; k--) { ctx.fillText(f.lines[k], SAFE.left, y); y -= Math.round(f.size * 1.3); }
    }
    y -= 14;
    var h = fit(ctx, opts.headline || '', '800', 96, 60, 3, maxW);
    if (h.shortened) issues.push('Headline shortened to fit.');
    ctx.font = '800 ' + h.size + 'px ' + FONT; ctx.fillStyle = '#ffffff';
    var lh = Math.round(h.size * 1.12);
    for (var m = h.lines.length - 1; m >= 0; m--) { ctx.fillText(h.lines[m], SAFE.left, y); y -= lh; }
    var textTop = y + lh - h.size;
    if (textTop < 1000) issues.push('Text is tall — it now covers part of the photo. Consider fewer lines.');
    // accent bar
    ctx.fillStyle = BLUE; ctx.fillRect(SAFE.left, textTop - 34, 120, 8);

    // 5. preview-only guides
    if (opts.guides) {
      ctx.save();
      ctx.setLineDash([18, 14]); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(242,196,109,0.9)';
      ctx.strokeRect(SAFE.left, SAFE.top - 20, maxW, SAFE.bottom - SAFE.top + 40);
      ctx.fillStyle = 'rgba(242,196,109,0.18)';
      ctx.fillRect(0, 0, W, 250); ctx.fillRect(0, 1670, W, H - 1670);
      ctx.restore();
    }
    return { issues: issues };
  }

  window.StoryRender = { W: W, H: H, SAFE: SAFE, render: render, clampTransform: clampTransform, toPhoto: toPhoto, baseScale: baseScale };
})();
