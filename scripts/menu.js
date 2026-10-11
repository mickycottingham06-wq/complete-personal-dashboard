// =============================================================
// Shared app bar + Menu for every LOCK-IN HQ page.
// Inserts a sticky bar (brand → Today, Menu button) at the top of
// .wrap and a modal <dialog> menu: native focus trapping, Escape to
// close, focus returns to the Menu button. Click outside or on a link
// closes it. The current page (and Assistant mode / Settings section)
// is marked with aria-current="page".
// Include with <script src=".../scripts/menu.js" defer></script>.
// =============================================================
(function () {
  'use strict';

  var script = document.currentScript;
  var base = new URL('../', script ? script.src : location.href); // site root (scripts/ lives under it)

  var MAIN = [
    ['Today', 'index.html'],
    ['Second Brain', 'pages/second-brain.html'],
    ['Morning', 'pages/assistant.html?mode=morning'],
    ['Evening', 'pages/assistant.html?mode=evening'],
    ['Weekly reset', 'pages/assistant.html?mode=weekly'],
    ['Content', 'pages/content.html'],
    ['Workforce', 'pages/workforce.html'],
  ];
  var SECONDARY = [
    ['Settings', 'pages/settings.html#sync'],
    ['Integrations', 'pages/settings.html#integrations'],
    ['Account', 'pages/settings.html#account'],
    ['Backup', 'pages/settings.html#backup'],
  ];

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function path(p) { return p.replace(/\/index\.html$/, '/'); }

  // Is this menu target the page we're on?
  function isCurrent(href) {
    var u = new URL(href, base);
    if (path(u.pathname) !== path(location.pathname)) return false;
    var mode = u.searchParams.get('mode');
    if (mode) return new URLSearchParams(location.search).get('mode') === mode;
    if (u.hash) return (location.hash || '#sync') === u.hash;
    return true;
  }

  function links(items, cls) {
    return el('ul', { class: cls || '' }, items.map(function (it) {
      var a = el('a', { href: new URL(it[1], base).href, text: it[0] });
      return el('li', {}, [a]);
    }));
  }

  function markCurrent(dialog) {
    Array.prototype.forEach.call(dialog.querySelectorAll('a'), function (a) {
      if (isCurrent(a.getAttribute('href'))) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function init() {
    var wrap = document.querySelector('.wrap') || document.body;
    var btn = el('button', { type: 'button', class: 'menu-btn', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': 'appMenu', text: ' Menu' });
    var bar = el('div', { class: 'appbar' }, [el('a', { class: 'brand', href: base.href, text: 'LOCK-IN HQ' }), btn]);
    wrap.insertBefore(bar, wrap.firstChild);

    var close = el('button', { type: 'button', text: 'Close', 'aria-label': 'Close menu' });
    var dialog = el('dialog', { id: 'appMenu', class: 'app-menu', 'aria-label': 'Menu' }, [
      el('div', { class: 'app-menu-inner' }, [
        el('div', { class: 'app-menu-head' }, [el('strong', { text: 'MENU' }), close]),
        el('nav', { 'aria-label': 'Main' }, [links(MAIN)]),
        el('p', { class: 'menu-group', id: 'menuSecondary', text: 'Settings & data' }),
        el('nav', { 'aria-labelledby': 'menuSecondary', class: 'secondary' }, [links(SECONDARY)]),
      ]),
    ]);
    document.body.appendChild(dialog);

    function open() {
      markCurrent(dialog);
      if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
      btn.setAttribute('aria-expanded', 'true');
      (dialog.querySelector('a[aria-current="page"]') || dialog.querySelector('a')).focus();
    }
    function shut() {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close(); else dialog.removeAttribute('open');
    }
    dialog.addEventListener('close', function () { btn.setAttribute('aria-expanded', 'false'); btn.focus(); });
    btn.addEventListener('click', open);
    close.addEventListener('click', shut);
    // click on the backdrop (outside the panel) closes
    dialog.addEventListener('click', function (e) { if (e.target === dialog) shut(); });
    // links: same-page hash links need an explicit close; others navigate away
    dialog.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) shut(); });
    window.addEventListener('hashchange', function () { markCurrent(dialog); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.AppMenu = { MAIN: MAIN, SECONDARY: SECONDARY };
})();
