/**
 * Provident Fund loan engine — reproduces the Accounting Section's ledger card.
 *
 * Ledger card method (DepEd PF, 6% p.a., diminishing balance; DO 52 s.2017 / DO 37 s.2018):
 *   monthly amortization A = P·r / (1 − (1+r)^−n), r = 0.06/12, rounded UP to the centavo
 *   each deduction:  interest  = previous balance × r          (full precision, like the card)
 *                    principal = payment − interest
 *                    balance   = previous balance − principal
 *   moratorium month (DepEd Memo 24 Jun 2026): no deduction, no interest, balance unchanged,
 *   term extended by one month.
 *   "Loan amount w/ interest" on the card = n × A.
 *
 * Everything here is pure (no database). The ledger is always derived from the loan terms and
 * the posted events, never typed in.
 */

const EPS = 0.005; // half a centavo

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const amortization = (principal, months, annualRate = 6) => {
  const P = Number(principal);
  const n = parseInt(months, 10);
  const r = Number(annualRate) / 100 / 12;
  if (!(P > 0) || !(n > 0)) return 0;
  if (!r) return Math.ceil((P / n) * 100 - 1e-9) / 100;
  const exact = (P * r) / (1 - Math.pow(1 + r, -n));
  return Math.ceil(exact * 100 - 1e-9) / 100;
};

// ── Month helpers: periods are 'YYYY-MM' strings ──────────────────────────────
const toPeriod = (d) => {
  if (!d) return null;
  if (typeof d === 'string' && /^\d{4}-\d{2}$/.test(d)) return d;
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return null;
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
};
const periodIndex = (p) => {
  const [y, m] = p.split('-').map(Number);
  return y * 12 + (m - 1);
};
const indexToPeriod = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
const addMonths = (p, k) => indexToPeriod(periodIndex(p) + k);
const periodEndDate = (p) => {
  const [y, m] = p.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

const inMoratorium = (period, moratoria) =>
  (moratoria || []).some((m) => {
    const s = toPeriod(m.start_month || m.start);
    const e = toPeriod(m.end_month || m.end);
    return s && e && periodIndex(period) >= periodIndex(s) && periodIndex(period) <= periodIndex(e);
  });

/** Entry types that pay an installment (count as a month paid). */
const INSTALLMENT_TYPES = new Set(['deduction', 'or_payment']);
/** Entry types that close a loan. */
const CLOSING_TYPES = new Set(['payoff', 'renewal_offset']);

/**
 * Build the ledger card for one loan.
 *
 * @param {object} loan  { loan_amount, no_of_months, monthly_amortization?, interest_rate?, effective_date (first deduction month), date_granted? }
 * @param {Array}  entries  ledger entries { id, entry_type, period|payment_date, amount_paid, reference_number, notes, balance?, paid_months? }
 * @param {object} opts { moratoria: [{start_month,end_month}], asOf: 'YYYY-MM' (last payroll period posted), renewalRule: 'payments'|'principal', renewalThreshold: 0.3 }
 */
function buildLedger(loan, entries = [], opts = {}) {
  const P = Number(loan.loan_amount) || 0;
  const n = parseInt(loan.no_of_months, 10) || 0;
  const rate = Number(loan.interest_rate) > 0 ? Number(loan.interest_rate) : 6;
  const r = rate / 100 / 12;
  const A = Number(loan.monthly_amortization) > 0 ? Number(loan.monthly_amortization) : amortization(P, n, rate);
  const moratoria = opts.moratoria || [];
  const renewalRule = opts.renewalRule || 'payments';
  const threshold = opts.renewalThreshold != null ? Number(opts.renewalThreshold) : 0.3;

  // Normalize entries
  const norm = entries
    .map((e) => ({
      id: e.id,
      type: e.entry_type || 'deduction',
      period: toPeriod(e.period || e.date_of_deduction || e.payment_date),
      amount: Number(e.amount_paid) || 0,
      date: e.payment_date || e.date_of_deduction || null,
      reference: e.reference_number || null,
      notes: e.notes || null,
      balanceAfter: e.balance != null ? Number(e.balance) : (e.new_balance != null ? Number(e.new_balance) : null),
      paidMonths: e.paid_months != null ? Number(e.paid_months) : null,
      // installments covering several months at once (e.g. "August to December", 5 months)
      months: e.months_covered != null ? Math.max(1, Number(e.months_covered)) : 1,
      interestOverride: e.payment_with_interest != null && e.entry_type === 'payoff' ? Number(e.payment_with_interest) : null,
    }))
    .filter((e) => e.period);

  let start = toPeriod(loan.effective_date) || (loan.date_granted ? addMonths(toPeriod(loan.date_granted), 1) : null);
  const earliest = norm.length ? norm.map((e) => e.period).sort()[0] : null;
  if (!start) start = earliest || toPeriod(new Date());
  if (earliest && periodIndex(earliest) < periodIndex(start)) start = earliest;

  const byPeriod = new Map();
  for (const e of norm) {
    if (!byPeriod.has(e.period)) byPeriod.set(e.period, []);
    byPeriod.get(e.period).push(e);
  }
  const openingPeriod = norm.filter((e) => e.type === 'opening').map((e) => e.period).sort()[0] || null;
  const lastEntryPeriod = norm.length ? norm.map((e) => e.period).sort().slice(-1)[0] : null;
  const asOf = opts.asOf || toPeriod(new Date());
  const lastActual = [asOf, lastEntryPeriod].filter(Boolean).sort().slice(-1)[0];

  let bal = P;
  let monthsPaid = 0;
  let interestPaid = 0;
  let principalPaid = 0;
  let totalPaid = 0;
  let overpayment = 0;
  let refunds = 0;
  let closedBy = null;
  let closedPeriod = null;
  let eligibleFrom = null;
  let maturity = null;
  const rows = [];

  const eligibleNow = () =>
    renewalRule === 'principal' ? (P - bal) / P >= threshold - 1e-9 : monthsPaid >= n * threshold - 1e-9;

  const applyInstallment = (amount, months = 1) => {
    if (bal <= EPS) {
      overpayment += amount;
      return { interest: 0, principal: 0, over: amount };
    }
    const interest = bal * r * months;
    let principal = amount - interest;
    let over = 0;
    if (principal > bal) {
      over = principal - bal;
      principal = bal;
    }
    bal -= principal;
    overpayment += over;
    interestPaid += interest;
    principalPaid += principal;
    return { interest, principal, over };
  };

  const maxMonths = n + 600;
  for (let i = 0, p = start; i < maxMonths; i++, p = addMonths(p, 1)) {
    const isPast = periodIndex(p) <= periodIndex(lastActual);
    const evs = byPeriod.get(p) || [];
    if (!isPast && bal <= EPS) break;

    const installments = evs.filter((e) => INSTALLMENT_TYPES.has(e.type));
    const explicitMor = evs.some((e) => e.type === 'moratorium');
    const globalMor = inMoratorium(p, moratoria);

    // Opening balance (summary import without monthly history)
    for (const e of evs.filter((x) => x.type === 'opening')) {
      if (e.balanceAfter != null) {
        principalPaid += bal - e.balanceAfter;
        bal = e.balanceAfter;
      }
      if (e.paidMonths != null) monthsPaid = e.paidMonths;
      rows.push(row(p, 'opening', e, { payment: null, interest: null, principal: null }));
    }

    if (installments.length) {
      for (const e of installments) {
        const { interest, principal, over } = applyInstallment(e.amount, e.months);
        if (e.amount > 0) monthsPaid += e.months;
        totalPaid += e.amount;
        rows.push(row(p, e.type, e, { payment: e.amount, interest, principal, over }));
      }
    } else if ((explicitMor || globalMor) && bal > EPS && (isPast || periodIndex(p) >= periodIndex(start))) {
      rows.push(row(p, 'moratorium', evs.find((e) => e.type === 'moratorium'), { payment: 0, interest: 0, principal: 0, projected: !isPast }));
    } else if (isPast) {
      const hasOtherEvents = evs.some((e) => e.type !== 'opening');
      const beforeOpening = openingPeriod && periodIndex(p) <= periodIndex(openingPeriod);
      if (bal > EPS && !closedBy && !hasOtherEvents && !beforeOpening && periodIndex(p) <= periodIndex(asOf)) {
        rows.push(row(p, 'no_deduction', null, { payment: 0, interest: 0, principal: 0 }));
      }
    } else if (bal > EPS && !closedBy) {
      // Projected installment; the final one is reduced so the balance ends at exactly zero.
      const due = Math.min(A, bal * (1 + r));
      const interest = bal * r;
      const principal = due - interest;
      bal -= principal;
      rows.push(row(p, 'projected', null, { payment: due, interest, principal, projected: true, monthsPaidOverride: monthsPaid + 1 }));
      if (!eligibleFrom && (renewalRule === 'principal' ? (P - bal) / P >= threshold - 1e-9 : monthsPaid + 1 >= n * threshold - 1e-9)) {
        eligibleFrom = p;
      }
      monthsPaid += 1; // projected count (undone after the loop)
      if (bal <= EPS) maturity = p;
      continue;
    }

    // Other posted events after the installment
    for (const e of evs) {
      if (e.type === 'prepayment') {
        const principal = Math.min(e.amount, Math.max(bal, 0));
        const over = e.amount - principal;
        bal -= principal; principalPaid += principal; totalPaid += e.amount; overpayment += over;
        rows.push(row(p, 'prepayment', e, { payment: e.amount, interest: 0, principal, over }));
      } else if (CLOSING_TYPES.has(e.type)) {
        const principal = Math.max(bal, 0);
        const interestPart = e.type === 'payoff' && e.interestOverride ? e.interestOverride : 0;
        if (interestPart) interestPaid += interestPart;
        const over = e.type === 'payoff' ? e.amount - interestPart - principal : 0;
        bal -= principal; principalPaid += principal; totalPaid += e.type === 'payoff' ? e.amount : principal;
        if (over > 0) overpayment += over;
        closedBy = e.type; closedPeriod = p;
        rows.push(row(p, e.type, e, { payment: e.type === 'payoff' ? e.amount : principal, interest: interestPart, principal, over: Math.max(over, 0), shortfall: over < -EPS ? -over : 0 }));
      } else if (e.type === 'adjustment') {
        bal += e.amount;
        rows.push(row(p, 'adjustment', e, { payment: null, interest: 0, principal: -e.amount }));
      } else if (e.type === 'refund') {
        refunds += e.amount;
        rows.push(row(p, 'refund', e, { payment: null, interest: 0, principal: 0 }));
      }
    }

    if (!eligibleFrom && eligibleNow() && monthsPaid > 0) eligibleFrom = p;
    if (bal <= EPS && !maturity && (monthsPaid > 0 || closedBy)) maturity = p;
    if (!isPast && bal <= EPS) break;
  }

  // Undo projected counting: actual figures come from posted rows only.
  const actualRows = rows.filter((x) => !x.projected);
  const actualMonthsPaid = actualRows.filter((x) => INSTALLMENT_TYPES.has(x.type) && x.payment > 0).reduce((t, x) => t + (x.months_covered || 1), 0)
    + (actualRows.find((x) => x.type === 'opening')?.monthsPaidAtOpening || 0);
  const lastActualRow = actualRows.length ? actualRows[actualRows.length - 1] : null;
  const actualBalance = lastActualRow ? lastActualRow.balance_raw : P;

  const projectedRows = rows.filter((x) => x.projected);
  const nextDue = projectedRows.length ? projectedRows[0] : null;

  const status =
    closedBy === 'renewal_offset' ? 'renewed'
      : actualBalance <= EPS ? 'fully_paid'
        : 'active';

  const eligibleByRule = renewalRule === 'principal'
    ? (P - Math.max(actualBalance, 0)) / P >= threshold - 1e-9
    : actualMonthsPaid >= n * threshold - 1e-9;

  return {
    terms: {
      loan_amount: P,
      no_of_months: n,
      interest_rate: rate,
      monthly_amortization: A,
      amount_with_interest: round2(A * n),
      first_deduction: start,
      expected_amortization: amortization(P, n, rate),
    },
    rows,
    summary: {
      months_paid: actualMonthsPaid,
      months_left: Math.max(n - actualMonthsPaid, 0),
      balance: round2(Math.max(actualBalance, 0)),
      balance_raw: actualBalance,
      interest_paid: round2(interestPaid),
      principal_paid: round2(P - Math.max(actualBalance, 0)),
      total_paid: round2(totalPaid),
      overpayment: round2(overpayment),
      refunds: round2(refunds),
      refund_due: overpayment - refunds >= 1 ? round2(overpayment - refunds) : 0,
      rounding_difference: overpayment - refunds > 0 && overpayment - refunds < 1 ? round2(overpayment - refunds) : 0,
      status,
      closed_by: closedBy,
      closed_period: closedPeriod,
      maturity_period: maturity,
      maturity_date: maturity ? periodEndDate(maturity) : null,
      next_due_period: nextDue ? nextDue.period : null,
      next_due_amount: nextDue ? round2(nextDue.payment) : 0,
      renewal_rule: renewalRule,
      renewal_threshold: threshold,
      renewal_eligible: status === 'active' ? eligibleByRule : status === 'fully_paid',
      renewal_eligible_from: status === 'active' ? (eligibleByRule ? (eligibleFrom || lastActual) : eligibleFrom) : closedPeriod || maturity,
      payments_required_for_renewal: Math.ceil(n * threshold - 1e-9),
      principal_paid_ratio: P ? round2(((P - Math.max(actualBalance, 0)) / P) * 100) / 100 : 0,
    },
  };

  function row(period, type, e, v) {
    const paidNow = v.monthsPaidOverride != null ? v.monthsPaidOverride : monthsPaid;
    return {
      period,
      type,
      projected: !!v.projected,
      entry_id: e ? e.id : null,
      payment: v.payment == null ? null : round2(v.payment),
      interest: v.interest == null ? null : round2(v.interest),
      principal: v.principal == null ? null : round2(v.principal),
      balance: round2(Math.max(bal, 0)),
      balance_raw: bal,
      months_paid: paidNow,
      months_left: Math.max(n - paidNow, 0),
      overpayment: v.over ? round2(v.over) : 0,
      months_covered: e && e.months > 1 ? e.months : undefined,
      shortfall: v.shortfall ? round2(v.shortfall) : 0,
      reference: e ? e.reference : null,
      notes: e ? e.notes : null,
      monthsPaidAtOpening: type === 'opening' && e && e.paidMonths != null ? e.paidMonths : undefined,
    };
  }
}

/** Amount payroll should deduct for this loan in `period` (0 during moratorium or when paid). */
function expectedDeduction(card, period, moratoria) {
  if (card.summary.status !== 'active') return 0;
  if (inMoratorium(period, moratoria)) return 0;
  const posted = card.rows.find((x) => x.period === period && INSTALLMENT_TYPES.has(x.type));
  if (posted) return posted.payment;
  const projected = card.rows.find((x) => x.period === period && x.projected);
  if (projected) return projected.payment;
  // Period before the projection window (missed month) — still due at the normal amortization, capped.
  const bal = card.summary.balance_raw;
  const r = card.terms.interest_rate / 100 / 12;
  return bal > EPS ? round2(Math.min(card.terms.monthly_amortization, bal * (1 + r))) : 0;
}

module.exports = {
  EPS,
  round2,
  amortization,
  toPeriod,
  periodIndex,
  addMonths,
  periodEndDate,
  inMoratorium,
  buildLedger,
  expectedDeduction,
  INSTALLMENT_TYPES,
};
