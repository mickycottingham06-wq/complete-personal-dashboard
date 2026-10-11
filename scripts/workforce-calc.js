// =============================================================
// Workforce calculators — deterministic money maths for the Personal
// Budget, Property Analyst and MB Automotive quote specialists.
// Pure functions: no DOM, no storage, no AI. Every result lists its
// inputs, formula, assumptions and what is missing, so nothing is
// presented as complete when it isn't. Amounts are GBP, rounded to pence.
// =============================================================
(function (root) {
  'use strict';

  function r2(n) { return Math.round(n * 100) / 100; }
  function isNum(n) { return typeof n === 'number' && isFinite(n); }
  function sum(arr) { return arr.reduce(function (a, b) { return a + b; }, 0); }

  // "£1,240.50" → 1240.5, "180k" → 180000, "1.2m" → 1200000, "none"/"0" → 0. Else null.
  function parseMoney(v) {
    if (isNum(v)) return v;
    var s = String(v == null ? '' : v).trim().toLowerCase();
    if (/^(none|nothing|nil|no|zero)$/.test(s)) return 0;
    var m = /(-?\d[\d,]*(?:\.\d+)?)\s*(k|m)?\b/.exec(s.replace(/£/g, ''));
    if (!m) return null;
    var n = Number(m[1].replace(/,/g, ''));
    if (m[2] === 'k') n *= 1e3; else if (m[2] === 'm') n *= 1e6;
    return isFinite(n) ? n : null;
  }
  function parsePercent(v) { var m = /(\d+(?:\.\d+)?)\s*%?/.exec(String(v || '')); return m ? Number(m[1]) : null; }

  function daysBetween(a, b) { return Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 864e5); }

  // ---------- Personal budget: money available until payday ----------
  // in: { today, balance, payday, bills:[{name, amount, dueDate, source}], otherDue, earmarked:{property,family,other} }
  function budget(i) {
    var missing = [];
    if (!isNum(i.balance)) missing.push('current personal balance');
    if (!i.payday) missing.push('next payday');
    if (!isNum(i.otherDue)) missing.push('other payments due before payday');
    var e = i.earmarked || {};
    var earmarkKnown = isNum(e.property) && isNum(e.family) && isNum(e.other);
    if (!earmarkKnown) missing.push('money set aside (property / family / other)');
    var days = i.payday ? Math.max(1, daysBetween(i.today, i.payday)) : null;
    var bills = (i.bills || []).filter(function (b) { return isNum(b.amount) && b.dueDate >= i.today && (!i.payday || b.dueDate <= i.payday); });
    var billsTotal = r2(sum(bills.map(function (b) { return b.amount; })));
    var earmarkTotal = earmarkKnown ? r2(e.property + e.family + e.other) : null;
    var available = missing.length ? null : r2(i.balance - billsTotal - i.otherDue - earmarkTotal);
    return {
      complete: !missing.length,
      missing: missing,
      days: days,
      bills: bills,
      billsTotal: billsTotal,
      earmarkTotal: earmarkTotal,
      available: available,
      perDay: available === null || !days ? null : r2(available / days),
      shortfall: available !== null && available < 0 ? r2(-available) : 0,
      formula: 'available = balance − bills due before payday − other payments due − money set aside',
    };
  }

  // ---------- Property ----------
  function opt(v) { return isNum(v) ? v : null; }
  function missingList(i, names) { return names.filter(function (n) { return !isNum(i[n]); }); }

  // Flip. in: purchase, refurb, salePrice; optional buyingCosts, sellingCosts, financeCosts, holdingMonths, monthlyHolding
  function flip(i) {
    var required = missingList(i, ['purchase', 'refurb', 'salePrice']);
    var optionalNames = ['buyingCosts', 'sellingCosts', 'financeCosts', 'holdingMonths', 'monthlyHolding'];
    var missingOptional = missingList(i, optionalNames);
    if (required.length) return { strategy: 'flip', missingRequired: required, missingOptional: missingOptional };
    var holding = (opt(i.holdingMonths) || 0) * (opt(i.monthlyHolding) || 0);
    var costs = r2(i.purchase + i.refurb + (opt(i.buyingCosts) || 0) + (opt(i.sellingCosts) || 0) + (opt(i.financeCosts) || 0) + holding);
    var profit = r2(i.salePrice - costs);
    return {
      strategy: 'flip', missingRequired: [], missingOptional: missingOptional,
      totalCosts: costs, holdingCost: r2(holding), profit: profit,
      roiPct: costs ? r2(profit / costs * 100) : null,
      breakEvenSalePrice: costs,
      marginOnSalePct: i.salePrice ? r2(profit / i.salePrice * 100) : null,
      formula: 'profit = sale price − (purchase + refurb + buying + selling + finance + holding months × monthly holding)',
    };
  }

  // Rent-to-rent (monthly). in: landlordRent, rooms, rentPerRoom; optional bills, otherMonthly, setupCosts
  function r2r(i) {
    var required = missingList(i, ['landlordRent', 'rooms', 'rentPerRoom']);
    var missingOptional = missingList(i, ['bills', 'otherMonthly', 'setupCosts']);
    if (required.length) return { strategy: 'r2r', missingRequired: required, missingOptional: missingOptional };
    var fixed = r2(i.landlordRent + (opt(i.bills) || 0) + (opt(i.otherMonthly) || 0));
    var income = r2(i.rooms * i.rentPerRoom);
    var profit = r2(income - fixed);
    var beRooms = i.rentPerRoom > 0 ? Math.ceil(fixed / i.rentPerRoom) : null;
    return {
      strategy: 'r2r', missingRequired: [], missingOptional: missingOptional,
      monthlyCosts: fixed, monthlyIncomeFull: income, monthlyProfitFull: profit,
      breakEvenRooms: beRooms, breakEvenPossible: beRooms !== null && beRooms <= i.rooms,
      paybackMonths: isNum(i.setupCosts) && profit > 0 ? r2(i.setupCosts / profit) : null,
      formula: 'profit/month (all rooms let) = rooms × rent per room − (landlord rent + bills + other); break-even rooms = ⌈costs ÷ rent per room⌉',
    };
  }

  // Serviced accommodation (monthly). in: nightlyRate, monthlyFixed; optional platformFeePct, cleaningPerStay, avgStayNights, occupancyPct
  var NIGHTS_PER_MONTH = 30.4;
  function sa(i) {
    var required = missingList(i, ['nightlyRate', 'monthlyFixed']);
    var missingOptional = missingList(i, ['platformFeePct', 'cleaningPerStay', 'avgStayNights', 'occupancyPct']);
    if (required.length) return { strategy: 'sa', missingRequired: required, missingOptional: missingOptional };
    var fee = (opt(i.platformFeePct) || 0) / 100;
    var cleanPerNight = isNum(i.cleaningPerStay) && isNum(i.avgStayNights) && i.avgStayNights > 0 ? i.cleaningPerStay / i.avgStayNights : 0;
    var netPerNight = r2(i.nightlyRate * (1 - fee) - cleanPerNight);
    var beNights = netPerNight > 0 ? r2(i.monthlyFixed / netPerNight) : null;
    var out = {
      strategy: 'sa', missingRequired: [], missingOptional: missingOptional,
      netPerNight: netPerNight, breakEvenNights: beNights,
      breakEvenOccupancyPct: beNights === null ? null : r2(beNights / NIGHTS_PER_MONTH * 100),
      breakEvenPossible: beNights !== null && beNights <= NIGHTS_PER_MONTH,
      formula: 'net per night = nightly rate × (1 − platform fee) − cleaning per stay ÷ average stay; break-even nights = monthly fixed ÷ net per night (month = 30.4 nights)',
    };
    if (isNum(i.occupancyPct)) {
      var nights = r2(NIGHTS_PER_MONTH * i.occupancyPct / 100);
      out.nightsAtOccupancy = nights;
      out.monthlyProfitAtOccupancy = r2(nights * netPerNight - i.monthlyFixed);
    }
    return out;
  }

  // ---------- MB Automotive quote ----------
  // in: parts, labourHours, labourRate, travel, vatRegistered (true|false|null)
  var VAT_STANDARD_RATE = 20; // UK standard rate — shown as "confirm with your accountant"
  function quote(i) {
    var missing = [];
    if (!isNum(i.parts)) missing.push('parts cost');
    if (!isNum(i.labourHours)) missing.push('labour hours');
    if (!isNum(i.labourRate)) missing.push('labour rate per hour');
    if (missing.length) return { missing: missing };
    var labour = r2(i.labourHours * i.labourRate);
    var travel = isNum(i.travel) ? i.travel : 0;
    var net = r2(i.parts + labour + travel);
    var vat = i.vatRegistered === true ? r2(net * VAT_STANDARD_RATE / 100) : 0;
    return {
      missing: [], labour: labour, travel: travel, travelMissing: !isNum(i.travel), net: net, vat: vat,
      vatKnown: i.vatRegistered === true || i.vatRegistered === false, total: r2(net + vat),
      formula: 'total = parts + labour hours × rate + travel' + (i.vatRegistered === true ? ' + VAT at ' + VAT_STANDARD_RATE + '%' : ''),
    };
  }

  var api = { parseMoney: parseMoney, parsePercent: parsePercent, daysBetween: daysBetween, budget: budget, flip: flip, r2r: r2r, sa: sa, quote: quote, NIGHTS_PER_MONTH: NIGHTS_PER_MONTH, VAT_STANDARD_RATE: VAT_STANDARD_RATE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.WorkforceCalc = api;
})(typeof window !== 'undefined' ? window : globalThis);
