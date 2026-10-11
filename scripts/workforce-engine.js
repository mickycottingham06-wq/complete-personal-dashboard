// =============================================================
// Workforce engine — routes a request to ONE specialist and runs that
// specialist's flow: at most one question at a time, then one result.
//
// Everything here is deterministic ("Basic mode"). Money figures always
// come from WorkforceCalc. AI (optional, via /api/assistant mode
// "workforce") can only add wording on top; its text is rejected if it
// mentions money/percentage figures the app didn't calculate, and its
// note/record references are checked against what was actually sent.
// Reads app data raw from localStorage (never through loaders that
// write defaults), so opening Workforce changes nothing.
// =============================================================
(function () {
  'use strict';

  var Calc = window.WorkforceCalc;
  var B = { phone: '07539246591', email: 'info@mbautomotiveworks.co.uk' };

  // topic: extra words for Second Brain retrieval (a note still needs 2+ distinct matches)
  var SPECIALISTS = [
    { id: 'mb-automotive-business', name: 'MB Automotive Business', short: 'Business', ai: true, topic: ['quote', 'customer', 'parts', 'labour', 'supplier'],
      words: { 'mb automotive': 3, customer: 2, quote: 3, quotation: 3, labour: 3, parts: 2, job: 1, garage: 1, invoice: 2, reply: 2, booking: 1, brake: 1, brakes: 1, clutch: 1, service: 1, mot: 1, diagnostic: 1, leads: 2, 'more customers': 3, enquiry: 2 } },
    { id: 'personal-budget', name: 'Personal Budget', short: 'Budget', ai: true, topic: ['budget', 'payday', 'savings', 'bills', 'spending'],
      words: { budget: 3, spend: 2, spending: 2, payday: 3, 'paid on': 2, bills: 2, bill: 2, afford: 3, 'money left': 3, balance: 2, overdraft: 2, wages: 2, salary: 2, income: 1, 'safe to spend': 3, 'until payday': 3 } },
    { id: 'property-analyst', name: 'Property Analyst', short: 'Property', ai: true, topic: ['property', 'deal', 'refurb', 'rent', 'landlord'],
      words: { property: 2, flip: 3, 'rent to rent': 3, 'rent-to-rent': 3, r2r: 3, 'serviced accommodation': 3, airbnb: 3, 'short let': 2, refurb: 2, gdv: 3, arv: 3, hmo: 2, landlord: 2, 'stamp duty': 2, 'buy to let': 2, btl: 2, deal: 1, 'purchase price': 2 } },
    { id: 'content-marketing', name: 'Content Marketing', short: 'Content', ai: false, topic: [],
      words: { instagram: 3, post: 2, caption: 3, story: 2, stories: 2, social: 2, marketing: 2, content: 2, reel: 2, facebook: 2 } },
    { id: 'training-recovery', name: 'Training and Recovery', short: 'Training', ai: true, topic: ['training', 'boxing', 'fight', 'injury', 'recovery', 'sparring'],
      words: { training: 2, boxing: 3, gym: 2, sparring: 2, fight: 2, 'weigh-in': 3, weight: 1, cut: 1, meal: 2, diet: 2, recovery: 2, sleep: 1, injury: 2, injured: 2, run: 1, runs: 1, session: 1, protein: 1, physio: 1 } },
  ];
  function byId(id) { return SPECIALISTS.find(function (s) { return s.id === id; }) || null; }

  // ---------- routing ----------
  function route(text) {
    var t = ' ' + String(text || '').toLowerCase().replace(/[^a-z0-9£%\- ]+/g, ' ') + ' ';
    var scores = SPECIALISTS.map(function (s) {
      var score = 0;
      Object.keys(s.words).forEach(function (w) { if (t.indexOf(' ' + w + ' ') !== -1 || (w.indexOf(' ') !== -1 && t.indexOf(w) !== -1)) score += s.words[w]; });
      return { id: s.id, score: score };
    }).sort(function (a, b) { return b.score - a.score; });
    var best = scores[0], second = scores[1];
    var ambiguous = best.score === 0 || best.score - second.score < 2 && second.score > 0 && best.score < 4;
    return { roleId: ambiguous ? null : best.id, ambiguous: ambiguous, scores: scores };
  }

  // ---------- helpers ----------
  function pad2(n) { return String(n).padStart(2, '0'); }
  function dateKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function today() { return window.LockIn ? window.LockIn.activeDate() : dateKey(new Date()); }
  function addDays(key, n) { var d = new Date(key + 'T12:00:00'); d.setDate(d.getDate() + n); return dateKey(d); }
  function gbp(n) { return (n < 0 ? '−£' : '£') + Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function dayLabel(key) { return new Date(key + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); }
  function raw(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
  var YES = /^(y|yes|yeah|yep|still on|it is|correct|right)\b/i, NO = /^(n|no|nope|not|cancel|off|it isn)\b/i;

  // Finds the number attached to a label in free text: "parts £85" (label first)
  // or "£550 per room" (number first). numberFirst tries the latter first —
  // used for counts and "per …" fields so "5 rooms at £550" reads rooms = 5.
  var NUM = '(£?\\s?\\d[\\d,]*(?:\\.\\d+)?\\s*[km%]?)';
  function grab(text, labels, numberFirst) {
    var after = new RegExp('(?:' + labels + ')[^0-9£]{0,20}' + NUM, 'i');
    var before = new RegExp(NUM + '(?![\\d,.])[^0-9£a-z]{0,3}(?:an?\\s+|per\\s+)?(?:' + labels + ')\\b', 'i');
    var order = numberFirst ? [before, after] : [after, before];
    for (var i = 0; i < 2; i++) { var m = order[i].exec(text || ''); if (m) return m[1]; }
    return null;
  }
  function findLabelled(text, labels) { var g = grab(text, labels, false); return g === null ? null : Calc.parseMoney(g); }

  // "28th", "28 Oct", "2026-10-28", "28/10", "Friday", "in 12 days" → YYYY-MM-DD (future)
  function parseDate(text, from) {
    var s = String(text || '').toLowerCase().trim();
    var m;
    if ((m = /in\s+(\d+)\s+days?/.exec(s))) return addDays(from, Number(m[1]));
    if ((m = /(\d{4})-(\d{2})-(\d{2})/.exec(s))) return m[0];
    var days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (var i = 0; i < 7; i++) if (s.indexOf(days[i]) !== -1 || s.indexOf(days[i].slice(0, 3) + ' ') === 0) {
      var d = new Date(from + 'T12:00:00'), diff = (i - d.getDay() + 7) % 7 || 7;
      return addDays(from, diff);
    }
    if ((m = /(\d{1,2})\s*\/\s*(\d{1,2})/.exec(s))) {
      var y = Number(from.slice(0, 4)), cand = y + '-' + pad2(m[2]) + '-' + pad2(m[1]);
      return cand > from ? cand : (y + 1) + '-' + pad2(m[2]) + '-' + pad2(m[1]);
    }
    if ((m = /\b(\d{1,2})(st|nd|rd|th)?\b(?:\s+([a-z]{3}))?/.exec(s)) && Number(m[1]) >= 1 && Number(m[1]) <= 31) {
      var months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      var base = new Date(from + 'T12:00:00');
      var mo = m[3] && months.indexOf(m[3]) !== -1 ? months.indexOf(m[3]) : base.getMonth();
      var c = new Date(base.getFullYear(), mo, Number(m[1]), 12);
      if (dateKey(c) <= from) c = m[3] ? new Date(base.getFullYear() + 1, mo, Number(m[1]), 12) : new Date(base.getFullYear(), base.getMonth() + 1, Number(m[1]), 12);
      return dateKey(c);
    }
    return null;
  }

  function question(key, text, extra) { return Object.assign({ type: 'question', key: key, text: text }, extra || {}); }

  // ---------- Personal Budget ----------
  function moneyRecords() {
    var m = raw('money') || {};
    var accounts = Array.isArray(m.accounts) ? m.accounts.filter(function (a) { return a && a.type === 'bank' && isFinite(Number(a.balance)); }) : [];
    var t = today(), bills = [], business = [];
    (Array.isArray(m.bills) ? m.bills : []).forEach(function (b) {
      if (!b || !isFinite(Number(b.amount)) || !b.dueDate || b.status === 'Paid' || b.status === 'Cancelled') return;
      var due = String(b.dueDate).slice(0, 10), rolled = false;
      if (b.frequency === 'Monthly') {
        var guard = 0;
        while (due < t && guard++ < 24) { var d = new Date(due + 'T12:00:00'); d.setMonth(d.getMonth() + 1); due = dateKey(d); rolled = true; }
      }
      var row = { id: 'bill:' + b.id, name: b.name || 'Bill', amount: Number(b.amount), dueDate: due, source: 'Your saved bills (entered by you)' + (rolled ? ' · next monthly date assumed' : '') };
      if (String(b.category || '').toLowerCase() === 'business') business.push(row); else bills.push(row);
    });
    return { accounts: accounts, bankTotal: accounts.reduce(function (s, a) { return s + Number(a.balance); }, 0), bills: bills, businessBills: business };
  }

  function parseEarmarked(text) {
    var s = String(text || '');
    var e = { property: findLabelled(s, 'property|house|deposit'), family: findLabelled(s, 'family|baby|kids?'), other: findLabelled(s, 'other|holiday|car|emergency') };
    if (e.property === null && e.family === null && e.other === null) { var n = Calc.parseMoney(s); if (n === null) return null; return { property: 0, family: 0, other: n }; }
    return { property: e.property || 0, family: e.family || 0, other: e.other || 0 };
  }

  function budgetStep(st) {
    var a = st.answers, t = today(), rec = moneyRecords();
    if (a.balance === undefined) { var b = findLabelled(st.request, 'balance|in my (?:bank|account)|have'); if (b !== null) a.balance = b; }
    if (a.payday === undefined) { var pm = /pa(?:id|yday)[^.]*?(?:on|is|in)?\s+([^.,;]+)/i.exec(st.request); var pd = pm && parseDate(pm[1], t); if (pd) a.payday = pd; }
    // Saved details from "Update my information" (manual entries, dated).
    var prof = window.WorkforceRecords ? window.WorkforceRecords.budgetProfile() : {};
    var savedOn = prof.updatedAt ? 'entered by you ' + dayLabel(String(prof.updatedAt).slice(0, 10)) : 'entered by you';
    st.saved = st.saved || {};
    if (a.balance === undefined && typeof prof.balance === 'number') {
      if (prof.balanceDate === t) { a.balance = prof.balance; st.saved.balance = 'entered by you for today'; }
      else return question('balance', 'Your saved personal balance is ' + gbp(prof.balance) + ' (entered by you for ' + (prof.balanceDate ? dayLabel(prof.balanceDate) : 'an earlier day') + '). What is it now?', { options: ['Still ' + gbp(prof.balance)] });
    }
    if (a.payday === undefined && prof.payday && prof.payday >= t) { a.payday = prof.payday; st.saved.payday = savedOn; }
    if (a.otherDue === undefined && typeof prof.otherDue === 'number') { a.otherDue = prof.otherDue; st.saved.otherDue = savedOn; }
    if (a.earmarked === undefined && prof.earmarked && typeof prof.earmarked === 'object') { a.earmarked = prof.earmarked; st.saved.earmarked = savedOn; }
    if (a.balance === undefined) {
      return question('balance', rec.accounts.length
        ? 'Your saved bank accounts total ' + gbp(rec.bankTotal) + ' — entered by you earlier, not a live balance. What is your personal balance right now?'
        : 'What is your current personal account balance? (£)', rec.accounts.length ? { options: ['Use ' + gbp(rec.bankTotal)] } : {});
    }
    if (a.payday === undefined) return question('payday', 'When is your next payday? (e.g. 28th, Friday, or in 12 days)');
    var bills = rec.bills.filter(function (b) { return b.dueDate >= t && b.dueDate <= a.payday; });
    if (a.otherDue === undefined) {
      return question('otherDue', (bills.length ? 'You have ' + bills.length + ' saved bill' + (bills.length === 1 ? '' : 's') + ' due before payday (' + gbp(bills.reduce(function (s, x) { return s + x.amount; }, 0)) + '). ' : 'No saved bills are due before payday. ') +
        'Any other personal payments due before payday? (total £, or 0)', { options: ['0'] });
    }
    if (a.earmarked === undefined) return question('earmarked', 'How much of your balance is set aside — property, family or other? (e.g. "property 500, family 200", or 0)', { options: ['0'] });

    var calc = Calc.budget({ today: t, balance: a.balance, payday: a.payday, bills: rec.bills, otherDue: a.otherDue, earmarked: a.earmarked });
    var lines = [];
    if (!calc.complete) lines.push('Incomplete — missing ' + calc.missing.join(', ') + '. This is not a safe-to-spend figure.');
    else if (calc.shortfall) lines.push('You\'re short by ' + gbp(calc.shortfall) + ' before payday (' + dayLabel(a.payday) + ') once bills and set-aside money are covered.');
    else lines.push(gbp(calc.available) + ' available until payday on ' + dayLabel(a.payday) + ' (' + calc.days + ' day' + (calc.days === 1 ? '' : 's') + ', about ' + gbp(calc.perDay) + ' a day).');
    lines.push('Set aside and not counted as spendable: ' + gbp(calc.earmarkTotal) + ' (property ' + gbp(a.earmarked.property) + ', family ' + gbp(a.earmarked.family) + ', other ' + gbp(a.earmarked.other) + ').');
    var src = function (k) { return '(' + (st.saved[k] || 'you said') + ')'; };
    var table = [
      ['Personal balance ' + src('balance'), gbp(a.balance)],
      ['Bills due before payday (your saved bills)', '−' + gbp(calc.billsTotal)],
      ['Other payments due ' + src('otherDue'), '−' + gbp(a.otherDue)],
      ['Set aside ' + src('earmarked'), '−' + gbp(calc.earmarkTotal)],
      [calc.shortfall ? 'Shortfall' : 'Available until payday', calc.available === null ? '—' : gbp(calc.available)],
    ];
    var assumptions = [calc.formula, 'Balance is what you typed — the app has no live bank connection.', 'Personal only: ' + (rec.businessBills.length ? rec.businessBills.length + ' business bill(s) excluded.' : 'business money not included.'), 'Spending already made but not yet cleared is not known.'];
    if (calc.bills.some(function (b) { return /assumed/.test(b.source); })) assumptions.push('Monthly bills past their saved date were rolled forward one month at a time.');
    var figures = [a.balance, calc.billsTotal, a.otherDue, calc.earmarkTotal, calc.available, calc.perDay, calc.shortfall, a.earmarked.property, a.earmarked.family, a.earmarked.other].concat(calc.bills.map(function (b) { return b.amount; }));
    return {
      type: 'result', label: 'Calculated in the app', lines: lines, table: table, assumptions: assumptions, figures: figures,
      computed: { balance: a.balance, payday: a.payday, days: calc.days, billsTotal: calc.billsTotal, otherDue: a.otherDue, earmarkTotal: calc.earmarkTotal, available: calc.available, perDay: calc.perDay, shortfall: calc.shortfall, complete: calc.complete },
      records: calc.bills.map(function (b) { return { id: b.id, label: b.name + ' ' + gbp(b.amount) + ' due ' + dayLabel(b.dueDate), source: b.source }; })
        .concat(Object.keys(st.saved).length ? [{ id: 'budget:profile', label: 'Your saved budget details (' + Object.keys(st.saved).join(', ') + ')', source: 'Entered by you in "Update my information"' }] : []),
      nextAction: calc.shortfall
        ? { text: 'Decide which payment can move before payday', firstStep: 'List the bills due before ' + dayLabel(a.payday), minutes: 10 }
        : { text: 'Check your banking app matches ' + gbp(a.balance), firstStep: 'Open your banking app', minutes: 5 },
    };
  }

  // ---------- Property ----------
  var PROP_FIELDS = {
    flip: [
      ['purchase', 'purchase|buy(?:ing)? (?:price|for|at)|asking|bought for|price', 'What is the purchase price? (£)'],
      ['refurb', 'refurb|works|renovation|build cost', 'What is the refurb budget? (£)'],
      ['salePrice', 'sale price|sell(?:ing)? (?:price|for|at)|sells? for|gdv|arv|resale','What sale price are you assuming once done? (£ — your own figure)'],
      ['buyingCosts', 'buying costs|stamp duty|sdlt'], ['sellingCosts', 'selling costs|agent fees?|estate agent'], ['financeCosts', 'finance|interest|bridging'],
      ['holdingMonths', 'months'], ['monthlyHolding', 'holding|council tax|monthly costs?'],
    ],
    r2r: [
      ['landlordRent', 'landlord rent|rent to (?:the )?landlord|pay(?:ing)? (?:the )?landlord|rent', 'What monthly rent would you pay the landlord? (£)'],
      ['rooms', 'rooms?|bedrooms?', 'How many rooms would you let?'],
      ['rentPerRoom', 'per room|room rent|each room', 'What monthly rent per room are you assuming? (£ — your own figure)'],
      ['bills', 'bills|utilities'], ['otherMonthly', 'other monthly|cleaning|insurance'], ['setupCosts', 'setup|set-up|furnish'],
    ],
    sa: [
      ['nightlyRate', 'nightly|per night|a night', 'What nightly rate are you assuming? (£ — your own figure)'],
      ['monthlyFixed', 'monthly fixed|monthly costs?|rent|mortgage', 'What are the total monthly fixed costs (rent/mortgage, bills, insurance)? (£)'],
      ['platformFeePct', 'platform|airbnb fee|booking fee|commission'], ['cleaningPerStay', 'cleaning|clean'], ['avgStayNights', 'average stay|avg stay|nights per stay'], ['occupancyPct', 'occupancy'],
    ],
  };
  var PROP_NAMES = { purchase: 'purchase price', refurb: 'refurb', salePrice: 'sale price', buyingCosts: 'buying costs (stamp duty, legal, survey)', sellingCosts: 'selling costs (agent, legal)', financeCosts: 'finance costs', holdingMonths: 'holding period (months)', monthlyHolding: 'monthly holding costs', landlordRent: 'landlord rent', rooms: 'rooms', rentPerRoom: 'rent per room', bills: 'monthly bills', otherMonthly: 'other monthly costs', setupCosts: 'setup costs', nightlyRate: 'nightly rate', monthlyFixed: 'monthly fixed costs', platformFeePct: 'platform fee %', cleaningPerStay: 'cleaning per stay', avgStayNights: 'average stay (nights)', occupancyPct: 'occupancy % (your own estimate)' };

  function detectStrategy(t) {
    t = String(t || '').toLowerCase();
    if (/rent[\s-]?to[\s-]?rent|\br2r\b/.test(t)) return 'r2r';
    if (/serviced|airbnb|short[\s-]?let|\bsa\b/.test(t)) return 'sa';
    if (/\bflip|refurb and sell|buy, refurb/.test(t)) return 'flip';
    return null;
  }

  function parseNumberField(key, text) {
    if (key === 'rooms' || key === 'holdingMonths' || key === 'avgStayNights') { var m = /(\d+(?:\.\d+)?)/.exec(String(text)); return m ? Number(m[1]) : null; }
    if (/Pct$/.test(key)) return Calc.parsePercent(text);
    return Calc.parseMoney(text);
  }

  function propertyStep(st) {
    var a = st.answers;
    if (!a.strategy) { var s = detectStrategy(st.request); if (s) a.strategy = s; }
    if (!a.strategy) return question('strategy', 'Which kind of deal is it?', { options: ['Flip', 'Rent-to-rent', 'Serviced accommodation'] });
    var fields = PROP_FIELDS[a.strategy];
    var NUMBER_FIRST = { rooms: 1, rentPerRoom: 1, nightlyRate: 1, holdingMonths: 1, avgStayNights: 1, occupancyPct: 1, platformFeePct: 1 };
    fields.forEach(function (f) {
      if (a[f[0]] !== undefined) return;
      var g = grab(st.request + ' ' + (a.extraCosts || ''), f[1], !!NUMBER_FIRST[f[0]]);
      if (g !== null) { var v = parseNumberField(f[0], g); if (v !== null) a[f[0]] = v; }
    });
    var need = fields.find(function (f) { return f[2] && a[f[0]] === undefined; });
    if (need) return question(need[0], need[2]);

    var calc = Calc[a.strategy](a);
    var lines = [], table = [], figures = [];
    fields.forEach(function (f) { if (typeof a[f[0]] === 'number') { table.push([PROP_NAMES[f[0]] + ' (you said)', /Pct$/.test(f[0]) ? a[f[0]] + '%' : /rooms|Months|Nights/.test(f[0]) ? String(a[f[0]]) : gbp(a[f[0]])]); figures.push(a[f[0]]); } });
    if (a.strategy === 'flip') {
      lines.push('Profit ' + gbp(calc.profit) + ' on total costs of ' + gbp(calc.totalCosts) + ' (' + calc.roiPct + '% return on costs).');
      lines.push('Break-even sale price: ' + gbp(calc.breakEvenSalePrice) + '.');
      table.push(['Total costs', gbp(calc.totalCosts)], ['Profit', gbp(calc.profit)], ['Return on costs', calc.roiPct + '%'], ['Break-even sale price', gbp(calc.breakEvenSalePrice)]);
      figures.push(calc.totalCosts, calc.profit, calc.roiPct, calc.breakEvenSalePrice, calc.marginOnSalePct, calc.holdingCost);
    } else if (a.strategy === 'r2r') {
      lines.push('With every room let: ' + gbp(calc.monthlyProfitFull) + ' a month after ' + gbp(calc.monthlyCosts) + ' of monthly costs.');
      lines.push('Break-even: ' + calc.breakEvenRooms + ' of ' + a.rooms + ' rooms let' + (calc.breakEvenPossible ? '.' : ' — more rooms than you have, so it can\'t break even.'));
      if (calc.paybackMonths !== null) lines.push('Setup costs paid back in ' + calc.paybackMonths + ' months at full occupancy.');
      table.push(['Monthly costs', gbp(calc.monthlyCosts)], ['Income, all rooms let', gbp(calc.monthlyIncomeFull)], ['Profit, all rooms let', gbp(calc.monthlyProfitFull)], ['Break-even rooms', String(calc.breakEvenRooms)]);
      figures.push(calc.monthlyCosts, calc.monthlyIncomeFull, calc.monthlyProfitFull, calc.breakEvenRooms, calc.paybackMonths);
    } else {
      lines.push('Net ' + gbp(calc.netPerNight) + ' per booked night. Break-even: ' + calc.breakEvenNights + ' nights a month (' + calc.breakEvenOccupancyPct + '% occupancy)' + (calc.breakEvenPossible ? '.' : ' — more nights than a month has.'));
      if (calc.monthlyProfitAtOccupancy !== undefined) lines.push('At your ' + a.occupancyPct + '% occupancy estimate: ' + gbp(calc.monthlyProfitAtOccupancy) + ' a month.');
      else lines.push('No occupancy figure used — none was supplied, and the app won\'t assume one.');
      table.push(['Net per booked night', gbp(calc.netPerNight)], ['Break-even nights / month', String(calc.breakEvenNights)], ['Break-even occupancy', calc.breakEvenOccupancyPct + '%']);
      figures.push(calc.netPerNight, calc.breakEvenNights, calc.breakEvenOccupancyPct, calc.monthlyProfitAtOccupancy, calc.nightsAtOccupancy);
    }
    var missing = calc.missingOptional.map(function (k) { return PROP_NAMES[k]; });
    var assumptions = [calc.formula];
    if (missing.length) assumptions.push('Not supplied, counted as £0: ' + missing.join(', ') + '.');
    assumptions.push('Needs verifying with current sources (not checked here): ' + ({
      flip: 'stamp duty rates, sold comparables for the sale price, lender terms, planning/building regs.',
      r2r: 'landlord written consent, HMO/selective licensing with the council, local rents, insurance.',
      sa: 'short-let planning rules (e.g. 90-night limits), lease/lender consent, local occupancy and nightly rates.',
    })[a.strategy]);
    assumptions.push('No market data, comparables or regulations were looked up — all figures are yours.');
    return {
      type: 'result', label: 'Calculated in the app', lines: lines, table: table, assumptions: assumptions, figures: figures,
      missingCosts: missing, computed: Object.assign({ strategy: a.strategy }, calc), records: [],
      nextAction: ({
        flip: { text: 'Verify the ' + gbp(a.salePrice) + ' sale price with sold comparables', firstStep: 'Look up 3 recent nearby sales on the Land Registry', minutes: 20 },
        r2r: { text: 'Check licensing and landlord consent for this deal', firstStep: 'Find the council\'s HMO/selective licensing page', minutes: 15 },
        sa: { text: 'Check short-let rules and real occupancy for this area', firstStep: 'Find the council\'s planning guidance on short lets', minutes: 20 },
      })[a.strategy],
    };
  }

  // ---------- MB Automotive Business ----------
  function businessIntent(t) {
    t = String(t || '').toLowerCase();
    if (/quote|price (?:up|for)|how much|labour|parts?\b/.test(t)) return 'quote';
    if (/repl(y|ies)|respond|message back|text back|get back to|email back|answer (?:a|the) customer/.test(t)) return 'reply';
    if (/plan|schedule|organis|fit in|order of|prepare/.test(t)) return 'plan';
    if (/more customers|leads|get customers|busier|quiet|new customers|enquir/.test(t)) return 'leads';
    return null;
  }

  function businessStep(st) {
    var a = st.answers;
    if (!a.intent) { var i = businessIntent(st.request); if (i) a.intent = i; }
    if (!a.intent) return question('intent', 'What do you need for the business?', { options: ['A quote', 'A customer reply', 'A job plan', 'More customers'] });
    var R = window.LockIn ? window.LockIn.SUPPLIED_ROUTINE.weekdayWork : null;
    if (a.intent === 'quote') {
      var t = st.request;
      if (a.parts === undefined) { var p = findLabelled(t, 'parts?'); if (p !== null) a.parts = p; }
      if (a.labourHours === undefined) { var h = /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)\b/i.exec(t); if (h) a.labourHours = Number(h[1]); }
      if (a.labourRate === undefined) { var r = /£\s?(\d+(?:\.\d+)?)\s*(?:\/|per|an?)\s*(?:h|hr|hour)/i.exec(t) || /(?:rate|at)\s*£\s?(\d+(?:\.\d+)?)/i.exec(t); if (r) a.labourRate = Number(r[1]); }
      if (a.travel === undefined) { var tr = findLabelled(t, 'travel|call[\\s-]?out|mileage'); if (tr !== null) a.travel = tr; }
      if (a.parts === undefined) return question('parts', 'What do the parts cost? (£ — your actual figure)');
      if (a.labourHours === undefined) return question('labourHours', 'How many hours of labour?');
      if (a.labourRate === undefined) return question('labourRate', 'What is your labour rate per hour? (£)');
      if (a.travel === undefined) return question('travel', 'Any travel or call-out charge? (£, or 0)', { options: ['0'] });
      if (a.vat === undefined) return question('vat', 'Are you VAT registered?', { options: ['Yes', 'No'] });
      var q = Calc.quote({ parts: a.parts, labourHours: a.labourHours, labourRate: a.labourRate, travel: a.travel, vatRegistered: a.vat });
      var breakdown = 'parts ' + gbp(a.parts) + ', labour ' + a.labourHours + ' h × ' + gbp(a.labourRate) + ' = ' + gbp(q.labour) + (q.travel ? ', travel ' + gbp(q.travel) : '') + (q.vat ? ', VAT ' + gbp(q.vat) : '');
      var reply = 'Hi [name],\n\nThanks for getting in touch. For the work we discussed, the price would be ' + gbp(q.total) + (q.vat ? ' including VAT' : '') + ' (' + breakdown + ').\n\nLet me know if you\'d like to book in.\n\nMB Automotive\n' + B.phone + ' · ' + B.email;
      return {
        type: 'result', label: 'Calculated in the app',
        lines: ['Quote total: ' + gbp(q.total) + (q.vat ? ' including VAT' : a.vat === false ? ' (not VAT registered)' : '') + '.'],
        table: [['Parts (you said)', gbp(a.parts)], ['Labour ' + a.labourHours + ' h × ' + gbp(a.labourRate), gbp(q.labour)], ['Travel (you said)', gbp(q.travel)], ['VAT', q.vat ? gbp(q.vat) : 'not added'], ['Total', gbp(q.total)]],
        assumptions: [q.formula, q.vat ? 'VAT at the UK standard rate of ' + Calc.VAT_STANDARD_RATE + '% — confirm with your accountant.' : 'No VAT added.', 'Parts and labour time are your figures; nothing was looked up.'],
        figures: [a.parts, a.labourHours, a.labourRate, q.labour, q.travel, q.vat, q.net, q.total],
        draft: reply, computed: q, records: [],
        nextAction: { text: 'Send the ' + gbp(q.total) + ' quote to the customer', firstStep: 'Copy the reply below into your messages', minutes: 5 },
      };
    }
    if (a.intent === 'reply') {
      if (a.facts === undefined) return question('facts', 'What should the reply say? Give the facts (e.g. "car ready Thursday, needs front tyres") — nothing will be added.');
      return {
        type: 'result', label: 'Basic mode (template — no AI)',
        lines: ['Template reply using only what you wrote. Fill in the name before sending.'],
        draft: 'Hi [name],\n\nThanks for your message. ' + a.facts.trim().replace(/^\w/, function (c) { return c.toUpperCase(); }).replace(/([^.!?])$/, '$1.') + '\n\nAny questions, give me a call on ' + B.phone + ' or email ' + B.email + '.\n\nMB Automotive',
        figures: [], assumptions: ['Nothing is sent from the app — copy it into your messages.'], records: [],
        nextAction: { text: 'Reply to the customer', firstStep: 'Copy the draft and add their name', minutes: 5 },
      };
    }
    if (a.intent === 'plan') {
      return {
        type: 'result', label: 'Basic mode (checklist — no AI)',
        lines: ['Job plan checklist for: ' + st.request.slice(0, 160)],
        steps: ['Write down the work the customer actually asked for', 'Confirm parts are ordered and their arrival date', 'Agree a time with the customer' + (R ? ' — your routine has ' + R.label.toLowerCase() + ' ' + R.start + '–' + R.end + ' on weekdays' : ''), 'Check you have the tools/consumables', 'Note anything you find that needs the customer\'s OK before you do it'],
        figures: [], assumptions: ['No repair times are estimated — the app has none from you.'], records: [],
        nextAction: { text: 'Confirm parts for this job', firstStep: 'Check the order confirmation or ring the supplier', minutes: 10 },
      };
    }
    return {
      type: 'result', label: 'Basic mode (no AI)',
      lines: ['One achievable customer-generation action: ask your next happy customer if you can photograph the finished job for Instagram, then turn it into a post in Content.'],
      figures: [], assumptions: ['No reviews or testimonials are written for you — only real customer words, with permission.'], records: [], contentLink: true,
      nextAction: { text: 'Ask today\'s customer if you can share a photo of their job', firstStep: 'Take a clear photo when the job is finished', minutes: 5 },
    };
  }

  // ---------- Content Marketing (hand-off) ----------
  function contentStep(st) {
    var t = st.request.trim();
    var details = t.replace(/^(please\s+)?(can you\s+)?(make|create|write|do|draft)\s+(me\s+)?(an?\s+)?(instagram\s+|insta\s+|facebook\s+)?(post|story|caption|reel)\s*(about|for|on|of)?\s*/i, '').replace(/^(the|my)\s+/i, '');
    var v = /\b((?:19|20)\d{2})\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/.exec(t);
    var kind = /\bstor(y|ies)\b/i.test(t) ? 'story' : 'post';
    var url = 'content.html?details=' + encodeURIComponent(details) + (v ? '&vehicle=' + encodeURIComponent(v[1] + ' ' + v[2]) : '') + '&kind=' + kind;
    return {
      type: 'result', label: 'Hand-off to Content',
      lines: ['Content drafts are made on the Content page, so they keep its fact checks, photo privacy and Story export. Your details are filled in — nothing is created until you press Create draft there.'],
      table: [['Job details', details || '(add them on the Content page)'], ['Vehicle', v ? v[1] + ' ' + v[2] : '—'], ['Format', kind === 'story' ? 'Instagram Story' : 'Post caption']],
      figures: [], assumptions: [], records: [], contentUrl: url,
      nextAction: { text: 'Create the ' + (kind === 'story' ? 'Story' : 'post') + ' in Content', firstStep: 'Open Content and check the job details', minutes: 10 },
    };
  }

  // ---------- Training and Recovery ----------
  function trainingStep(st) {
    var a = st.answers, t = today();
    var box = raw('boxing') || {}, tr = raw('training') || {};
    var WR = window.WorkforceRecords;
    var prof = WR ? WR.trainingProfile() : {};
    var fresh = !!(WR && WR.trainingFresh(14));
    var confirmedLabel = prof.confirmedAt ? dayLabel(String(prof.confirmedAt).slice(0, 10)) : '';
    // Dates come from your confirmed profile when there is one (see lockin-data.js).
    var dated = (window.LockIn ? window.LockIn.SUPPLIED_ROUTINE.dates : []).filter(function (d) { return d.date >= t; });
    if (!prof.confirmedAt && box.fightDate && box.fightDate >= t && !dated.some(function (d) { return d.date === box.fightDate; })) dated.push({ date: box.fightDate, label: 'Fight (saved)' });
    if (dated.length && a.datedStillOn === undefined) {
      if (fresh) a.datedStillOn = true;
      else return question('datedStillOn', 'Are these still on: ' + dated.map(function (d) { return d.label + ' ' + dayLabel(d.date); }).join(', ') + '?', { options: ['Yes', 'No'] });
    }
    if (a.injury === undefined) {
      if (fresh) a.injury = prof.limitations || 'none';
      else return question('injury', 'Any injury or niggle to plan around right now? (describe it, or "none")', { options: ['None'] });
    }
    var R = window.LockIn ? window.LockIn.SUPPLIED_ROUTINE.weekdayWork : { start: '08:00', end: '17:30', label: 'Work' };
    var lines = [], steps = [], records = [];
    if (prof.goal) steps.push('Current goal (entered by you): ' + prof.goal);
    if (prof.availability) steps.push('Your availability (entered by you): ' + prof.availability + ' — keep about an hour for family each evening.');
    else {
      steps.push('Weekdays: training fits after ' + R.end + ' (your work routine) — keep about an hour for family each evening.');
      steps.push('Weekends: longer sessions or recovery, around family plans.');
    }
    if (box.weeklyBoxingTarget || box.weeklyRunTarget || box.weeklyStrengthTarget) {
      steps.push('Your saved weekly targets: ' + [box.weeklyBoxingTarget ? box.weeklyBoxingTarget + ' boxing' : '', box.weeklyRunTarget ? box.weeklyRunTarget + ' runs' : '', box.weeklyStrengthTarget ? box.weeklyStrengthTarget + ' strength' : ''].filter(Boolean).join(', ') + ' a week.');
      records.push({ id: 'boxing:targets', label: 'Weekly training targets', source: 'Saved Boxing HQ record (entered by you)' });
    }
    if (tr && tr.currentWeek) { steps.push('Strength programme: week ' + tr.currentWeek + '.'); records.push({ id: 'training:week', label: 'Strength programme week ' + tr.currentWeek, source: 'Saved Strength HQ record' }); }
    if (box.nextSessionPlan) { steps.push('Next session you planned: ' + String(box.nextSessionPlan).slice(0, 120)); records.push({ id: 'boxing:nextSession', label: 'Next session plan', source: 'Saved Boxing HQ record (entered by you)' }); }
    if (prof.confirmedAt) records.push({ id: 'training:profile', label: 'Goals, dates, availability and limitations', source: 'Entered by you — last confirmed ' + confirmedLabel + (fresh ? '' : ' (over 2 weeks ago, so you were asked again)') });
    // WHOOP (if connected): shown as a dated device reading, not interpreted.
    var wh = window.Integrations ? window.Integrations.load().whoop : null;
    if (wh && wh.lastSync && (wh.recoveryScore != null || wh.sleepHours != null)) {
      var when = dayLabel(String(wh.lastSync).slice(0, 10)) + ' ' + String(new Date(wh.lastSync).toTimeString()).slice(0, 5);
      steps.push('WHOOP (retrieved ' + when + '): ' + [wh.recoveryScore != null ? 'recovery ' + wh.recoveryScore + '%' : '', wh.sleepHours != null ? 'sleep ' + wh.sleepHours + ' h' : ''].filter(Boolean).join(', ') + '.');
      records.push({ id: 'whoop:latest', label: 'WHOOP recovery/sleep', source: 'WHOOP, retrieved ' + when });
    }
    var soon = dated.filter(function (d) { return d.date <= addDays(t, 7); });
    if (dated.length && a.datedStillOn === true) {
      if (soon.length) lines.push('Fight week: follow your coach\'s plan; keep sessions short and sharp, protect sleep, and keep family time.');
      else lines.push('Building towards ' + dated.map(function (d) { return d.label + ' ' + dayLabel(d.date); }).join(', ') + ' — follow your coach\'s plan.');
    } else if (dated.length) lines.push('Dated goals no longer apply — planning a normal week.');
    else lines.push('Normal training week — no dated fight or weigh-in ahead.');
    if (a.injury && !/^none$/i.test(a.injury)) lines.push('Limitation noted ("' + a.injury.slice(0, 80) + '"): this isn\'t a diagnosis. Avoid loading it, and see a physio or GP if pain persists or gets worse.');
    if (/\bcut\b|make weight|lose \d+\s*(kg|lb|pounds?)|sauna|dehydrat|water ?load|sweat (it )?off/i.test(st.request)) {
      lines.push('Weight-making: no extreme or rapid cuts (dehydration, saunas, starving). Plan it with your coach and a qualified professional.');
    }
    if (prof.confirmedAt && fresh) lines.push('Using your saved goals and limitations — last confirmed ' + confirmedLabel + '.');
    return {
      type: 'result', label: 'Basic mode (no AI)', lines: lines, steps: steps, figures: [], records: records,
      assumptions: ['Uses your routine and what you entered — no session times are invented.'],
      nextAction: { text: 'Put your next training session in the diary', firstStep: 'Pick the evening and time', minutes: 5 },
    };
  }
  var STEPS = { 'mb-automotive-business': businessStep, 'personal-budget': budgetStep, 'property-analyst': propertyStep, 'content-marketing': contentStep, 'training-recovery': trainingStep };

  // Applies an answer typed/clicked by the user for the current question key.
  function applyAnswer(st, key, value) {
    var v = String(value || '').trim();
    var t = today();
    var num;
    switch (key) {
      case 'balance': num = Calc.parseMoney(v.replace(/^use\s+/i, '')); if (num === null) return 'Please type an amount, e.g. 1240.'; st.answers.balance = num; return '';
      case 'payday': num = parseDate(v, t); if (!num) return 'Try a date like 28th, Friday or "in 12 days".'; st.answers.payday = num; return '';
      case 'otherDue': num = Calc.parseMoney(v); if (num === null) return 'Please type a total, or 0.'; st.answers.otherDue = num; return '';
      case 'earmarked': num = parseEarmarked(v); if (!num) return 'Please type amounts, e.g. "property 500, family 200", or 0.'; st.answers.earmarked = num; return '';
      case 'strategy': num = detectStrategy(v); if (!num) return 'Choose flip, rent-to-rent or serviced accommodation.'; st.answers.strategy = num; return '';
      case 'intent': num = /quote/i.test(v) ? 'quote' : /repl/i.test(v) ? 'reply' : /plan/i.test(v) ? 'plan' : /customer|lead/i.test(v) ? 'leads' : null; if (!num) return 'Choose one of the options.'; st.answers.intent = num; return '';
      case 'vat': if (YES.test(v)) st.answers.vat = true; else if (NO.test(v)) st.answers.vat = false; else return 'Yes or no?'; return '';
      case 'datedStillOn': if (YES.test(v)) st.answers.datedStillOn = true; else if (NO.test(v)) st.answers.datedStillOn = false; else return 'Yes or no?'; return '';
      case 'injury': case 'facts': if (!v) return 'Please type an answer.'; st.answers[key] = v; return '';
      case 'labourHours': case 'rooms': case 'holdingMonths': case 'avgStayNights': num = /(\d+(?:\.\d+)?)/.exec(v); if (!num) return 'Please type a number.'; st.answers[key] = Number(num[1]); return '';
      default:
        num = /Pct$/.test(key) ? Calc.parsePercent(v) : Calc.parseMoney(v);
        if (num === null) return 'Please type an amount.';
        st.answers[key] = num; return '';
    }
  }

  function step(st) { return STEPS[st.roleId](st); }

  // ---------- AI validation ----------
  // Every £ amount / percentage in AI text must be one the app computed or the user gave.
  function allowedFigure(n, figures) {
    return figures.some(function (f) { return typeof f === 'number' && isFinite(f) && Math.abs(Math.abs(f) - n) < 0.006; });
  }
  function validateAiResult(data, sent, result) {
    if (!data || typeof data !== 'object' || typeof data.result !== 'string' || !data.result.trim()) return { ok: false, reason: 'the AI reply was empty' };
    var text = [data.result, data.nextAction && data.nextAction.text, data.nextAction && data.nextAction.firstStep].join(' ');
    var bad = [];
    (text.match(/£\s?\d[\d,]*(?:\.\d+)?\s*[km]?/gi) || []).forEach(function (m) { var n = Calc.parseMoney(m); if (n !== null && !allowedFigure(n, result.figures || [])) bad.push(m.trim()); });
    (text.match(/\d+(?:\.\d+)?\s?%/g) || []).forEach(function (m) { var n = parseFloat(m); if (!allowedFigure(n, result.figures || [])) bad.push(m.trim()); });
    if (bad.length) return { ok: false, reason: 'it mentioned figures the app didn\'t calculate (' + bad.slice(0, 3).join(', ') + ')' };
    if (/\b(i|we) (searched|looked up|checked (your|the) (email|inbox|account|bank)|browsed)/i.test(text)) return { ok: false, reason: 'it claimed research or account access that didn\'t happen' };
    var noteIds = (sent.notes || []).map(function (n) { return n.id; }), recIds = (sent.records || []).map(function (r) { return r.id; });
    var a = data.nextAction && typeof data.nextAction === 'object' ? data.nextAction : {};
    return {
      ok: true,
      result: data.result.trim().slice(0, 1200),
      nextAction: a.text ? { text: String(a.text).slice(0, 200), firstStep: String(a.firstStep || '').slice(0, 200), minutes: Math.min(240, Math.max(0, Math.round(Number(a.minutes) || 0))) } : null,
      clarifyingQuestion: typeof data.clarifyingQuestion === 'string' ? data.clarifyingQuestion.trim().slice(0, 300) : '',
      notesUsed: (Array.isArray(data.notesUsed) ? data.notesUsed : []).filter(function (id) { return noteIds.indexOf(id) !== -1; }),
      recordsUsed: (Array.isArray(data.recordsUsed) ? data.recordsUsed : []).filter(function (id) { return recIds.indexOf(id) !== -1; }),
    };
  }

  window.WorkforceEngine = {
    SPECIALISTS: SPECIALISTS, byId: byId, route: route, step: step, applyAnswer: applyAnswer,
    validateAiResult: validateAiResult, parseDate: parseDate, gbp: gbp, moneyRecords: moneyRecords,
  };
})();
