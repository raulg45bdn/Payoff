// ─── Month key helper ────────────────────────────────────────────────────────

/** Returns "YYYY-MM" key for a Date object. */
function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Gantt data (spec Phase 3 section 4.9) ───────────────────────────────────

/**
 * Generates Gantt row data for all cards.
 * @param {object[]} cards
 * @param {Date} startDate  - First month to include (today's month)
 * @param {Date} endDate    - Last month to include (debt-free month)
 * @returns {{ card, months: { monthKey, state }[] }[]}
 *   state: "active-urgent" | "active-watch" | "active-ontrack" | "completed" | "paid" | "empty"
 */
export function getGanttData(cards, startDate, endDate) {
  const todayKey = toMonthKey(new Date());

  // Build ordered month array
  const months = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (cursor <= end) {
    months.push(toMonthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return cards.map(card => {
    const expiryDate = new Date(card.promoExpiration);
    const expiryKey = toMonthKey(expiryDate);
    const urgency = card.urgency ?? 'ontrack';

    const monthStates = months.map(monthKey => {
      let state;
      if (card.balance === 0) {
        state = 'paid';
      } else if (monthKey > expiryKey) {
        state = 'empty';
      } else if (monthKey < todayKey) {
        state = 'completed';
      } else {
        state = `active-${urgency}`;
      }
      return { monthKey, state };
    });

    return { card, months: monthStates, expiryKey };
  });
}

// ─── Monthly debt simulation (spec Phase 3 section 5.4) ──────────────────────

/**
 * Simulates month-by-month debt reduction across all cards.
 * @returns {{ monthKey, totalDebt, monthLabel }[]}
 */
export function getMonthlyDebtSimulation(cards) {
  const today = new Date();
  let balances = cards.map(c => ({
    balance: c.balance,
    apr: c.apr,
    monthlyPayment: c.monthlyPayment,
  }));

  const results = [];
  let month = 0;
  const MAX_MONTHS = 36;

  while (month < MAX_MONTHS) {
    const d = new Date(today.getFullYear(), today.getMonth() + month, 1);
    const monthKey = toMonthKey(d);
    const monthLabel = d.toLocaleString('default', { month: 'short' }) +
      " '" + String(d.getFullYear()).slice(2);
    const totalDebt = balances.reduce((sum, b) => sum + Math.max(0, b.balance), 0);

    results.push({ monthKey, totalDebt, monthLabel });

    if (totalDebt === 0) break;

    // Simulate this month's payments
    balances = balances.map(b => {
      if (b.balance <= 0) return { ...b, balance: 0 };
      const interest = b.balance * (b.apr / 12);
      const newBalance = b.balance + interest - b.monthlyPayment;
      return { ...b, balance: Math.max(0, newBalance) };
    });

    month++;
  }

  return results;
}

// ─── Compact currency formatter for MonthlySnapshot ──────────────────────────

/**
 * Formats a dollar amount as "$22k" or "$8.5k" or "$350".
 */
export function formatCompact(amount) {
  if (amount >= 10000) return `$${Math.round(amount / 1000)}k`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
  return `$${Math.round(amount)}`;
}

// ─── Core urgency functions (spec section 6) ────────────────────────────────

/**
 * Months remaining until promoExpiration. Returns 0 if past. (spec 5.1 / 6)
 */
export function getMonthsRemaining(promoExpiration) {
  if (!promoExpiration) return 0;
  let expiry;
  if (typeof promoExpiration === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(promoExpiration)) {
    const [y, m, d] = promoExpiration.split('-').map(Number);
    expiry = new Date(y, m - 1, d);
  } else {
    expiry = new Date(promoExpiration);
  }
  if (isNaN(expiry.getTime())) return 0;
  const today = new Date();
  const months = (expiry.getFullYear() - today.getFullYear()) * 12 +
    (expiry.getMonth() - today.getMonth());
  return Math.max(0, months);
}

/**
 * Urgency string from pre-computed values. "paid" takes priority. (spec 6)
 * @param {number} monthsRemaining
 * @param {number} balance
 * @returns {"urgent"|"watch"|"ontrack"|"paid"}
 */
export function getUrgency(monthsRemaining, balance) {
  if (balance === 0) return 'paid';
  if (monthsRemaining <= 5) return 'urgent';
  if (monthsRemaining <= 9) return 'watch';
  return 'ontrack';
}

/**
 * Primary color for urgency state. (spec 6)
 * urgent=#FF453A, watch=#FF9F0A, ontrack=#007AFF, paid=#30D158
 */
export function getUrgencyColor(urgency) {
  switch (urgency) {
    case 'urgent': return '#FF453A';
    case 'watch':  return '#FF9F0A';
    case 'paid':   return '#30D158';
    case 'ontrack':
    default:       return '#007AFF';
  }
}

/**
 * Gradient [start, end] colors for the card hero section. (spec 3.3)
 */
export function getUrgencyGradient(urgency) {
  switch (urgency) {
    case 'urgent': return ['#FF453A', '#FF6B35'];
    case 'watch':  return ['#FF9F0A', '#FFCC00'];
    case 'paid':   return ['#30D158', '#34C759'];
    case 'ontrack':
    default:       return ['#007AFF', '#34AADC'];
  }
}

/**
 * Badge label text. (spec 2.4)
 */
export function getUrgencyLabel(urgency) {
  switch (urgency) {
    case 'urgent':  return 'URGENT';
    case 'watch':   return 'WATCH';
    case 'paid':    return 'PAID';
    case 'ontrack':
    default:        return 'ON TRACK';
  }
}

// ─── Payoff calculations (spec section 6) ───────────────────────────────────

/**
 * True if the card is on track to be paid off by its deadline. (spec 5.2 / 6)
 * balance / monthsRemaining <= monthlyPayment
 */
export function isOnTrack(balance, monthsRemaining, monthlyPayment) {
  if (balance === 0) return true;
  if (monthsRemaining <= 0) return false;
  return balance / monthsRemaining <= monthlyPayment + 0.01;
}

/**
 * Simulates month-by-month and returns the projected payoff month string. (spec 6)
 * @returns {string} e.g. "Mar 2027", or "Paid" if balance is 0
 */
export function getProjectedPayoffMonth(balance, monthlyPayment, apr) {
  if (balance === 0) return 'Paid';
  if (monthlyPayment <= 0) return 'N/A';
  let b = balance;
  let months = 0;
  while (b > 0 && months < 120) {
    const interest = b * (apr / 12);
    b = b + interest - monthlyPayment;
    if (b < 0) b = 0;
    months++;
  }
  if (months >= 120) return 'Over 10 years';
  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + months);
  return payoffDate.toLocaleString('default', { month: 'short', year: 'numeric' });
}

/**
 * Rough estimated interest remaining: balance * (apr/12) * monthsRemaining / 2. (spec 6)
 * Returns 0 for 0% APR cards.
 */
export function getEstimatedInterest(balance, apr, monthsRemaining) {
  if (apr === 0 || balance === 0) return 0;
  return balance * (apr / 12) * monthsRemaining / 2;
}

// ─── Aggregate card-array functions (spec section 6) ────────────────────────

/**
 * Sum of all card balances.
 */
export function getTotalDebt(cards) {
  return cards.reduce((sum, c) => sum + c.balance, 0);
}

// Alias used by HeroCard
export const getTotalBalance = getTotalDebt;

/**
 * Sum of all active card monthly payments.
 */
export function getTotalMonthlyPayment(cards) {
  return cards.reduce((sum, c) => sum + (c.balance > 0 ? c.monthlyPayment : 0), 0);
}

/**
 * Simulates month-by-month until all balances hit 0. Returns "Apr 2027"-style string.
 */
export function getDebtFreeDate(cards) {
  let balances = cards.map(c => ({ ...c }));
  const today = new Date();
  let month = 0;
  while (balances.some(c => c.balance > 0) && month < 120) {
    balances = balances.map(c => {
      if (c.balance <= 0) return { ...c, balance: 0 };
      const interest = c.balance * (c.apr / 12);
      let newBalance = c.balance + interest - c.monthlyPayment;
      if (newBalance < 0) newBalance = 0;
      return { ...c, balance: newBalance };
    });
    month++;
  }
  if (month >= 120) return '10+ years';
  const date = new Date(today);
  date.setMonth(date.getMonth() + month);
  return formatMonth(date);
}

/**
 * Total estimated interest across all cards.
 */
export function getTotalInterest(cards) {
  return cards.reduce((sum, c) => {
    const months = getMonthsRemaining(c.promoExpiration);
    return sum + getEstimatedInterest(c.balance, c.apr, months);
  }, 0);
}

// Alias for backwards compat
export const getTotalInterestEstimate = getTotalInterest;

// ─── Formatters ─────────────────────────────────────────────────────────────

/**
 * Formats number as "$X,XXX" or "$X,XXX.XX". (spec 6)
 */
export function formatCurrency(amount) {
  const n = Number(amount);
  if (!isFinite(n)) return '$0';
  const abs = Math.abs(n);
  const formatted = '$' + abs.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return n < 0 ? '-' + formatted : formatted;
}

/**
 * Formats an ISO date string as "Apr 2027". (spec 6)
 */
export function formatMonth(isoDateOrDate) {
  let d;
  if (isoDateOrDate instanceof Date) {
    d = isoDateOrDate;
  } else if (typeof isoDateOrDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(isoDateOrDate)) {
    // Date-only strings: parse as local to avoid UTC-midnight → day-before in US timezones
    const [y, m] = isoDateOrDate.split('-').map(Number);
    d = new Date(y, m - 1, 1);
  } else {
    d = new Date(isoDateOrDate);
  }
  return d.toLocaleString('default', { month: 'short', year: 'numeric' });
}

// ─── Derived field computation (stored on card after each update) ────────────

/**
 * Computes and merges all derived fields onto a card object.
 * Call on initialization and after every updateCard.
 */
export function computeDerivedFields(card) {
  const monthsRemaining = getMonthsRemaining(card.promoExpiration);
  const urgency = getUrgency(monthsRemaining, card.balance);
  const onTrack = isOnTrack(card.balance, monthsRemaining, card.monthlyPayment);
  const projectedPayoffMonth = getProjectedPayoffMonth(
    card.balance, card.monthlyPayment, card.apr
  );
  return { ...card, monthsRemaining, urgency, onTrack, projectedPayoffMonth };
}

// ─── Misc helpers ────────────────────────────────────────────────────────────

/**
 * Monthly surplus: income − fixed bills − card payments − extra pool.
 * @param {object[]} bills  - first-class bill objects from AppContext
 */
export function getMonthlySurplus(cards, settings, bills = []) {
  const income = Number(settings.monthlyIncome) || 0;
  const fixedBillsTotal = bills.reduce((sum, b) => sum + Number(b.variableAmountThisMonth ?? b.amount ?? 0), 0);
  const cardPayments = cards.reduce((sum, c) => sum + (c.balance > 0 ? Number(c.monthlyPayment ?? 0) : 0), 0);
  const extraPool = Number(settings.extraPaymentPool) || 0;
  return income - fixedBillsTotal - cardPayments - extraPool;
}

/**
 * Overall 0–1 progress across all cards.
 */
export function getOverallProgress(cards) {
  const original = cards.reduce((sum, c) => sum + c.originalBalance, 0);
  if (original === 0) return 1;
  const remaining = getTotalDebt(cards);
  return Math.max(0, Math.min(1, (original - remaining) / original));
}

/**
 * Sorts cards by promoExpiration ascending (most urgent first); paid cards go last.
 */
export function sortCardsByUrgency(cards) {
  return [...cards].sort((a, b) => {
    if (a.balance === 0 && b.balance > 0) return 1;
    if (b.balance === 0 && a.balance > 0) return -1;
    return new Date(a.promoExpiration) - new Date(b.promoExpiration);
  });
}

// ─── Phase 4: Extra payment planner functions ────────────────────────────────

/** Internal: total interest paid over lifetime of a balance. */
function simulateTotalInterest(balance, monthlyPayment, apr) {
  if (balance <= 0 || monthlyPayment <= 0) return 0;
  if (apr === 0) return 0;
  let b = balance;
  let total = 0;
  let months = 0;
  while (b > 0 && months < 120) {
    const interest = b * (apr / 12);
    total += interest;
    b = Math.max(0, b + interest - monthlyPayment);
    months++;
  }
  return total;
}

/** Internal: number of months to pay off a balance. */
function simulateMonths(balance, monthlyPayment, apr) {
  if (balance <= 0) return 0;
  if (monthlyPayment <= 0) return 120;
  let b = balance;
  let months = 0;
  while (b > 0 && months < 120) {
    const interest = b * (apr / 12);
    b = Math.max(0, b + interest - monthlyPayment);
    months++;
  }
  return months;
}

/**
 * Auto-allocates an extra payment pool across active cards by urgency.
 * Pass 1: fills the per-card gap (amount above monthlyPayment needed to clear by deadline).
 * Pass 2: distributes any remainder to the most-urgent cards first.
 * Never allocates more than a card's current balance.
 * @returns {{ [cardId]: number }}
 */
export function autoAllocateExtra(cards, extraPool) {
  if (!extraPool || extraPool <= 0) return {};

  const activeCards = [...cards]
    .filter(c => c.balance > 0)
    .sort((a, b) => (a.monthsRemaining ?? 999) - (b.monthsRemaining ?? 999));

  const allocation = {};
  let remaining = extraPool;

  // Pass 1: fill the shortfall for each card
  for (const card of activeCards) {
    if (remaining <= 0.005) break;
    const months = card.monthsRemaining ?? 0;
    const gap = months > 0
      ? Math.max(0, card.balance / months - card.monthlyPayment)
      : card.balance;
    const allocate = Math.min(gap, remaining, card.balance);
    if (allocate > 0.005) {
      allocation[card.id] = Math.round(allocate * 100) / 100;
      remaining -= allocate;
    }
  }

  // Pass 2: distribute leftover pool to most-urgent cards
  if (remaining > 0.005) {
    for (const card of activeCards) {
      if (remaining <= 0.005) break;
      const current = allocation[card.id] ?? 0;
      const extra = Math.min(Math.max(0, card.balance - current), remaining);
      if (extra > 0.005) {
        allocation[card.id] = Math.round((current + extra) * 100) / 100;
        remaining -= extra;
      }
    }
  }

  return allocation;
}

/**
 * Estimated month-end cash: checking + savings − all obligations − extra pool.
 * @param {object[]} bills  - first-class bill objects from AppContext
 */
export function getMonthEndCash(settings, cards, bills = []) {
  const fixedBillsTotal = bills.reduce((sum, b) => sum + Number(b.variableAmountThisMonth ?? b.amount ?? 0), 0);
  const cardPayments = cards.reduce((sum, c) => sum + (c.balance > 0 ? Number(c.monthlyPayment ?? 0) : 0), 0);
  const extraPool = Number(settings.extraPaymentPool) || 0;
  const liquid = (Number(settings.checkingBalance) || 0) + (Number(settings.savingsBalance) || 0);
  return liquid - fixedBillsTotal - cardPayments - extraPool;
}

/**
 * Simulates the impact of a one-time extra payment on a card's payoff.
 * @returns {{ newPayoffDate: string, interestSaved: number, daysEarlier: number }}
 */
export function getImpactOfExtra(card, extraAmount) {
  const baseDate = getProjectedPayoffMonth(card.balance, card.monthlyPayment, card.apr);
  if (!extraAmount || extraAmount <= 0 || card.balance === 0) {
    return { newPayoffDate: baseDate, interestSaved: 0, daysEarlier: 0 };
  }
  const reducedBalance = Math.max(0, card.balance - extraAmount);
  const newPayoffDate = getProjectedPayoffMonth(reducedBalance, card.monthlyPayment, card.apr);
  const interestSaved = Math.max(
    0,
    simulateTotalInterest(card.balance, card.monthlyPayment, card.apr) -
    simulateTotalInterest(reducedBalance, card.monthlyPayment, card.apr)
  );
  const daysEarlier = Math.max(
    0,
    (simulateMonths(card.balance, card.monthlyPayment, card.apr) -
     simulateMonths(reducedBalance, card.monthlyPayment, card.apr)) * 30
  );
  return { newPayoffDate, interestSaved, daysEarlier };
}

/**
 * Sum of all values in cardOverrides.
 */
export function getTotalAllocated(cardOverrides) {
  return Object.values(cardOverrides || {}).reduce((sum, v) => sum + (v || 0), 0);
}

/**
 * Remaining unallocated dollars: extraPool minus all allocations.
 */
export function getUnallocated(extraPool, cardOverrides) {
  return (extraPool ?? 0) - getTotalAllocated(cardOverrides);
}

/**
 * Clamps a due-day to the actual number of days in the given month.
 * Prevents "day 31" being invalid in February, April, June, etc.
 * @param {number} dueDay  – raw due day from card (1–31)
 * @param {Date}   [date]  – reference date for determining the month (defaults to today)
 */
export function clampDueDate(dueDay, date = new Date()) {
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Math.min(dueDay, daysInMonth);
}
