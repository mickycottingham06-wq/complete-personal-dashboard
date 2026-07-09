// =============================================================
// Money HQ — shared data layer.
// Owns the `money` localStorage key: accounts, assets, liabilities,
// spending, income, budgets, investments, bills, receipts. Any page
// (Money HQ itself, the Command Centre preview card) reads/writes
// through this file instead of touching localStorage directly, so
// they always agree.
//
// Currency is always GBP (£) — this app never uses CHF.
//
// Include this with a plain (non-defer) <script src="..."> tag
// BEFORE any inline script that calls window.Money, so it is
// guaranteed to be ready by the time it's used.
// =============================================================
(function () {
  'use strict';

  var KEY = 'money';
  var HISTORY_CAP = 90;

  function loadJSON(k, f) { try { return JSON.parse(localStorage.getItem(k)) || f; } catch (e) { return f; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function todayKey() { return new Date().toISOString().slice(0, 10); }
  function monthKey(dateStr) { return (dateStr || '').slice(0, 7); }
  function isThisMonth(dateStr) { return monthKey(dateStr) === todayKey().slice(0, 7); }

  var SPENDING_CATEGORIES = [
    'Food', 'Transport', 'Training/Health', 'Clothes/Appearance',
    'Business', 'Subscriptions', 'Savings/Investments', 'Other',
  ];
  var PAYMENT_METHODS = ['Card', 'Cash', 'Bank Transfer', 'Direct Debit', 'Other'];
  var INCOME_TYPES = ['Job', 'Business', 'Resale', 'Investment', 'Other'];
  var BILL_FREQUENCIES = ['Monthly', 'Yearly', 'Weekly', 'Quarterly'];
  var BILL_STATUSES = ['Upcoming', 'Paid', 'Overdue', 'Cancelled'];
  var INVESTMENT_TYPES = ['Stocks/Funds', 'Crypto', 'Other'];

  function defaultBudgets() {
    return SPENDING_CATEGORIES.map(function (cat) {
      return { id: 'budget-' + cat.toLowerCase().replace(/[^a-z0-9]+/g, '-'), category: cat, monthlyLimit: 0, spent: 0 };
    });
  }

  function defaultMoney() {
    return {
      currency: 'GBP',
      accounts: [],      // { id, name, type: 'bank'|'cash', balance }
      assets: [],        // { id, name, type: 'crypto'|'other', value }
      liabilities: [],   // { id, name, type, balance }
      spending: [],      // { id, date, merchant, category, amount, paymentMethod, notes, source }
      income: [],        // { id, date, source, type, amount, notes }
      budgets: defaultBudgets(), // { id, category, monthlyLimit, spent }
      budgetTarget: 0,
      investments: [],   // { id, name, type, ticker, shares, averageCost, currentPrice, currentValue, contributed, account, notes, source }
      bills: [],         // { id, name, amount, dueDate, frequency, category, status }
      receipts: [],      // { id, date, merchant, amount, category, status, notes }
      netWorthHistory: [], // { date, value }
      notes: '',
    };
  }

  // Reads money data, filling in any missing fields against the
  // default shape so older saved data upgrades cleanly.
  function load() {
    var m = loadJSON(KEY, null);
    if (!m) { m = defaultMoney(); saveJSON(KEY, m); return m; }
    var d = defaultMoney();
    Object.keys(d).forEach(function (k) { if (!(k in m)) m[k] = d[k]; });
    ['accounts', 'assets', 'liabilities', 'spending', 'income', 'budgets', 'investments', 'bills', 'receipts', 'netWorthHistory']
      .forEach(function (k) { if (!Array.isArray(m[k])) m[k] = []; });
    // Upgrade path: make sure every default budget category exists,
    // without touching limits/spend a user already saved.
    var existingCats = m.budgets.map(function (b) { return b.category; });
    defaultBudgets().forEach(function (b) { if (existingCats.indexOf(b.category) === -1) m.budgets.push(b); });
    // Upgrade path: fill in new optional holding fields on older
    // investment rows without touching any value already saved.
    m.investments = m.investments.map(function (i) {
      return Object.assign({
        ticker: '', shares: 0, averageCost: 0, currentPrice: 0,
        currentValue: 0, contributed: 0, account: '', notes: '', source: '',
      }, i);
    });
    m.currency = 'GBP';
    return m;
  }

  // A holding's value is derived from shares × current price whenever
  // both are set (Trading 212-style tracking); otherwise it falls back
  // to the manually-entered currentValue, so older rows keep working
  // untouched.
  function investmentValue(inv) {
    var shares = num(inv.shares), price = num(inv.currentPrice);
    if (shares > 0 && price > 0) return shares * price;
    return num(inv.currentValue);
  }

  function totalAccounts(m, type) {
    return m.accounts.filter(function (a) { return a.type === type; })
      .reduce(function (s, a) { return s + num(a.balance); }, 0);
  }
  function totalAssets(m, type) {
    return m.assets.filter(function (a) { return a.type === type; })
      .reduce(function (s, a) { return s + num(a.value); }, 0);
  }
  function totalLiabilities(m) {
    return m.liabilities.reduce(function (s, l) { return s + num(l.balance); }, 0);
  }
  function totalInvestmentsValue(m) {
    return m.investments.reduce(function (s, i) { return s + investmentValue(i); }, 0);
  }
  function totalInvestmentsContributed(m) {
    return m.investments.reduce(function (s, i) { return s + num(i.contributed); }, 0);
  }
  function totalInvestmentsGain(m) {
    return totalInvestmentsValue(m) - totalInvestmentsContributed(m);
  }
  function totalInvestmentsGainPct(m) {
    var c = totalInvestmentsContributed(m);
    if (c <= 0) return 0;
    return Math.round((totalInvestmentsGain(m) / c) * 100);
  }
  // Allocation of current investment value by type or account —
  // same shape/pattern as spendingByCategory. groupBy defaults to 'type'.
  function investmentAllocation(m, groupBy) {
    var field = groupBy === 'account' ? 'account' : 'type';
    var map = {};
    m.investments.forEach(function (i) {
      var key = i[field] || 'Other';
      map[key] = (map[key] || 0) + investmentValue(i);
    });
    var total = Object.keys(map).reduce(function (s, k) { return s + map[k]; }, 0) || 1;
    return Object.keys(map).map(function (k) { return { label: k, value: map[k], pct: Math.round((map[k] / total) * 100) }; })
      .sort(function (a, b) { return b.value - a.value; });
  }
  var TRADING212_ACCOUNT = 'Trading 212';

  // Merges read-only Trading 212 holdings (from api/trading212-data.js)
  // into m.investments. Matches existing rows by source==='trading212'
  // + ticker so a re-import updates in place instead of duplicating.
  // Manual rows (source !== 'trading212') are never touched. Mutates
  // m.investments directly; caller is responsible for persisting.
  function importTrading212(m, holdings) {
    var added = 0, updated = 0;
    (holdings || []).forEach(function (h) {
      var ticker = (h.ticker || '').trim();
      if (!ticker) return;
      var quantity = num(h.quantity);
      var avgPrice = num(h.averagePrice);
      var currentPrice = num(h.currentPrice);
      var existing = m.investments.find(function (i) { return i.source === 'trading212' && i.ticker === ticker; });
      if (existing) {
        existing.shares = quantity;
        existing.averageCost = avgPrice;
        existing.currentPrice = currentPrice;
        existing.contributed = quantity * avgPrice;
        if (h.name) existing.name = h.name;
        updated++;
      } else {
        m.investments.push({
          id: uid(), name: h.name || ticker, type: 'Stocks/Funds', ticker: ticker,
          account: TRADING212_ACCOUNT, source: 'trading212',
          shares: quantity, averageCost: avgPrice, currentPrice: currentPrice,
          currentValue: 0, contributed: quantity * avgPrice, notes: '',
        });
        added++;
      }
    });
    return { added: added, updated: updated };
  }

  function netWorth(m) {
    return totalAccounts(m, 'bank') + totalAccounts(m, 'cash')
      + totalAssets(m, 'crypto') + totalAssets(m, 'other')
      + totalInvestmentsValue(m) - totalLiabilities(m);
  }

  function monthlyIncome(m, month) {
    month = month || todayKey().slice(0, 7);
    return m.income.filter(function (i) { return monthKey(i.date) === month; })
      .reduce(function (s, i) { return s + num(i.amount); }, 0);
  }
  function monthlySpending(m, month) {
    month = month || todayKey().slice(0, 7);
    return m.spending.filter(function (s) { return monthKey(s.date) === month; })
      .reduce(function (sum, s) { return sum + num(s.amount); }, 0);
  }
  function monthlySavings(m) { return monthlyIncome(m) - monthlySpending(m); }
  function savingsRate(m) {
    var inc = monthlyIncome(m);
    if (inc <= 0) return 0;
    return Math.round((monthlySavings(m) / inc) * 100);
  }

  function spendingByCategory(m, monthOnly) {
    var month = todayKey().slice(0, 7);
    var rows = m.spending.filter(function (s) { return !monthOnly || monthKey(s.date) === month; });
    var map = {};
    rows.forEach(function (s) {
      var cat = s.category || 'Other';
      map[cat] = (map[cat] || 0) + num(s.amount);
    });
    return Object.keys(map).map(function (cat) { return { category: cat, amount: map[cat] }; })
      .sort(function (a, b) { return b.amount - a.amount; });
  }

  function incomeBySource(m, monthOnly) {
    var month = todayKey().slice(0, 7);
    var rows = m.income.filter(function (i) { return !monthOnly || monthKey(i.date) === month; });
    var map = {};
    rows.forEach(function (i) {
      var src = i.source || 'Other';
      map[src] = (map[src] || 0) + num(i.amount);
    });
    return Object.keys(map).map(function (src) { return { source: src, amount: map[src] }; })
      .sort(function (a, b) { return b.amount - a.amount; });
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    var ms = new Date(dateStr + 'T00:00:00') - new Date(todayKey() + 'T00:00:00');
    return Math.round(ms / 86400000);
  }

  function upcomingBills(m, limit) {
    return m.bills.filter(function (b) { return b.status !== 'Paid' && b.status !== 'Cancelled'; })
      .map(function (b) { return Object.assign({}, b, { daysUntil: daysUntil(b.dueDate) }); })
      .sort(function (a, b) { return (a.daysUntil == null ? 9999 : a.daysUntil) - (b.daysUntil == null ? 9999 : b.daysUntil); })
      .slice(0, limit || 999);
  }

  function monthlyRecurringTotal(m) {
    return m.bills.filter(function (b) { return b.status !== 'Cancelled'; })
      .reduce(function (s, b) {
        var amt = num(b.amount);
        if (b.frequency === 'Yearly') amt = amt / 12;
        else if (b.frequency === 'Weekly') amt = amt * 4.345;
        else if (b.frequency === 'Quarterly') amt = amt / 3;
        return s + amt;
      }, 0);
  }

  function recentTransactions(m, limit) {
    var rows = m.spending.map(function (s) {
      return { id: s.id, date: s.date, label: s.merchant || s.category || 'Spending', amount: -num(s.amount), kind: 'spending', category: s.category };
    }).concat(m.income.map(function (i) {
      return { id: i.id, date: i.date, label: i.source || i.type || 'Income', amount: num(i.amount), kind: 'income', category: i.type };
    }));
    rows.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    return rows.slice(0, limit || 8);
  }

  // Persists money data. Also refreshes derived/cache fields so they
  // never silently drift from the arrays that are the real source of
  // truth: each budget's `spent` (this month's spending in that
  // category) and a net-worth snapshot for today.
  function save(m) {
    m.currency = 'GBP';
    var month = todayKey().slice(0, 7);
    (m.budgets || []).forEach(function (b) {
      b.spent = m.spending.filter(function (s) { return s.category === b.category && monthKey(s.date) === month; })
        .reduce(function (sum, s) { return sum + num(s.amount); }, 0);
    });
    var nw = netWorth(m);
    var today = todayKey();
    var hist = m.netWorthHistory || [];
    if (hist.length && hist[hist.length - 1].date === today) {
      hist[hist.length - 1].value = nw;
    } else {
      hist.push({ date: today, value: nw });
      if (hist.length > HISTORY_CAP) hist = hist.slice(hist.length - HISTORY_CAP);
    }
    m.netWorthHistory = hist;
    saveJSON(KEY, m);
    return m;
  }

  // Compact cross-section summary for the Command Centre preview card
  // and other future readers (Life Stats, etc). Pure read — never
  // persists.
  function computeSummary() {
    var m = load();
    var bills = upcomingBills(m, 1);
    return {
      netWorth: netWorth(m),
      monthlyIncome: monthlyIncome(m),
      monthlySpending: monthlySpending(m),
      monthlySavings: monthlySavings(m),
      savingsRate: savingsRate(m),
      totalInvestments: totalInvestmentsValue(m),
      investmentsGain: totalInvestmentsGain(m),
      investmentsGainPct: totalInvestmentsGainPct(m),
      upcomingBillsCount: upcomingBills(m).length,
      nextBill: bills[0] || null,
    };
  }

  window.Money = {
    KEY: KEY,
    SPENDING_CATEGORIES: SPENDING_CATEGORIES,
    PAYMENT_METHODS: PAYMENT_METHODS,
    INCOME_TYPES: INCOME_TYPES,
    BILL_FREQUENCIES: BILL_FREQUENCIES,
    BILL_STATUSES: BILL_STATUSES,
    INVESTMENT_TYPES: INVESTMENT_TYPES,
    uid: uid,
    load: load,
    save: save,
    netWorth: netWorth,
    totalAccounts: totalAccounts,
    totalAssets: totalAssets,
    totalLiabilities: totalLiabilities,
    totalInvestmentsValue: totalInvestmentsValue,
    totalInvestmentsContributed: totalInvestmentsContributed,
    totalInvestmentsGain: totalInvestmentsGain,
    totalInvestmentsGainPct: totalInvestmentsGainPct,
    investmentValue: investmentValue,
    investmentAllocation: investmentAllocation,
    importTrading212: importTrading212,
    monthlyIncome: monthlyIncome,
    monthlySpending: monthlySpending,
    monthlySavings: monthlySavings,
    savingsRate: savingsRate,
    spendingByCategory: spendingByCategory,
    incomeBySource: incomeBySource,
    upcomingBills: upcomingBills,
    monthlyRecurringTotal: monthlyRecurringTotal,
    recentTransactions: recentTransactions,
    daysUntil: daysUntil,
    computeSummary: computeSummary,
  };
})();
