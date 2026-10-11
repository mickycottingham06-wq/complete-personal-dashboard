// =============================================================
// Workforce records — the information you maintain for the Budget and
// Training specialists ("Update my information"). Reuses the existing
// records instead of new stores:
//   money   (former Money HQ record): `bills` (personal vs business via
//           category 'Business'), plus `budget` = { balance, balanceDate,
//           payday, otherDue, earmarked{property,family,other}, updatedAt }
//   boxing  (former Boxing HQ record): fightDate (existing) plus
//           weighInDate, currentGoal, availability, limitations,
//           profileConfirmedAt
// Unknown fields already in those records are preserved. Every write is
// read back before reporting success. Everything here is manual input —
// no bank or device connection — and is labelled that way in the UI.
// =============================================================
(function () {
  'use strict';

  function raw(k) { try { var v = JSON.parse(localStorage.getItem(k)); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } }
  function write(k, obj) {
    var s = JSON.stringify(obj);
    try { localStorage.setItem(k, s); } catch (e) { return { ok: false, error: 'Could not save on this device.' }; }
    var back = null; try { back = localStorage.getItem(k); } catch (e) {}
    return back === s ? { ok: true } : { ok: false, error: 'Save could not be confirmed on this device.' };
  }
  function num(v) { if (v === '' || v === null || v === undefined) return null; var n = Number(v); return isFinite(n) ? Math.round(n * 100) / 100 : null; }
  function date(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : ''; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // ---------- Budget ----------
  function loadMoney() {
    var m = raw('money') || { currency: 'GBP' };
    if (!Array.isArray(m.bills)) m.bills = [];
    return m;
  }
  function budgetProfile() { var b = loadMoney().budget; return b && typeof b === 'object' ? b : {}; }
  function bills() { return loadMoney().bills.filter(function (b) { return b && b.status !== 'Cancelled'; }); }

  // input: { balance, balanceDate, payday, otherDue, earmarked{property,family,other}, bills:[{id,name,amount,dueDate,frequency,business,status}] }
  function saveBudget(input) {
    var m = loadMoney();
    var e = input.earmarked || {};
    m.budget = {
      balance: num(input.balance), balanceDate: date(input.balanceDate), payday: date(input.payday),
      otherDue: num(input.otherDue),
      earmarked: { property: num(e.property) || 0, family: num(e.family) || 0, other: num(e.other) || 0 },
      updatedAt: new Date().toISOString(),
    };
    if (m.budget.balance !== null && !m.budget.balanceDate) return { ok: false, error: 'Add the date the balance is from.' };
    if (Array.isArray(input.bills)) {
      var byId = {};
      m.bills.forEach(function (b) { if (b && b.id) byId[b.id] = b; });
      var next = [];
      for (var i = 0; i < input.bills.length; i++) {
        var r = input.bills[i];
        var name = String(r.name || '').trim(), amount = num(r.amount);
        if (!name && amount === null) continue;
        if (!name || amount === null || !date(r.dueDate)) return { ok: false, error: 'Each bill needs a name, amount and due date.' };
        var old = (r.id && byId[r.id]) || {};
        next.push(Object.assign({}, old, {
          id: r.id || uid(), name: name, amount: amount, dueDate: date(r.dueDate),
          frequency: r.frequency || old.frequency || 'Monthly',
          category: r.business ? 'Business' : (old.category && old.category !== 'Business' ? old.category : 'Personal'),
          status: r.status || old.status || 'Upcoming',
        }));
      }
      // Cancelled bills aren't shown in the form; keep them untouched.
      m.bills = next.concat(m.bills.filter(function (b) { return b && b.status === 'Cancelled'; }));
    }
    return write('money', m);
  }

  // ---------- Training ----------
  function trainingProfile() {
    var b = raw('boxing') || {};
    return {
      goal: b.currentGoal || '', weighInDate: b.weighInDate || '', fightDate: b.fightDate || '',
      availability: b.availability || '', limitations: b.limitations || '', confirmedAt: b.profileConfirmedAt || '',
    };
  }
  function saveTraining(p) {
    var b = raw('boxing') || {};
    b.currentGoal = String(p.goal || '').trim().slice(0, 200);
    b.weighInDate = date(p.weighInDate);
    b.fightDate = date(p.fightDate);
    b.availability = String(p.availability || '').trim().slice(0, 300);
    b.limitations = String(p.limitations || '').trim().slice(0, 300);
    b.profileConfirmedAt = new Date().toISOString();
    return write('boxing', b);
  }
  function trainingFresh(days) {
    var c = Date.parse(trainingProfile().confirmedAt);
    return !isNaN(c) && Date.now() - c < (days || 14) * 864e5;
  }

  window.WorkforceRecords = { budgetProfile: budgetProfile, bills: bills, saveBudget: saveBudget, trainingProfile: trainingProfile, saveTraining: saveTraining, trainingFresh: trainingFresh };
})();
