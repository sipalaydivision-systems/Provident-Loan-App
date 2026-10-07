/**
 * Ledger service — the only place balances are computed. Every change to a loan or its entries
 * goes through refreshLoan(), which rebuilds the card with the engine and caches the results on
 * the loan row (balance, months paid, status, maturity) so lists stay fast.
 */
const { Op } = require('sequelize');
const E = require('./loanEngine');
const settingsSvc = require('./settings');

const db = () => require('../database/db');
const M = () => db().models;

const INSTALLMENT_TYPES = ['deduction', 'or_payment'];
const ENTRY_TYPES = ['deduction', 'or_payment', 'moratorium', 'prepayment', 'payoff', 'renewal_offset', 'adjustment', 'refund', 'opening'];

const fullName = (e) => (e ? [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ') : '');

/**
 * The latest payroll month that has actually been posted. A month counts only when a meaningful
 * share of loans has an entry in it, so one card with stray future rows cannot move the date.
 */
async function lastPostedPeriod() {
  const { LedgerEntry } = M();
  const rows = await LedgerEntry.findAll({
    attributes: ['period', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'n']],
    where: { entry_type: { [Op.in]: ['deduction', 'moratorium', 'or_payment'] }, period: { [Op.ne]: null } },
    group: ['period'],
    raw: true,
  });
  if (rows.length) {
    const max = Math.max(...rows.map((r) => Number(r.n)));
    const cutoff = Math.max(Math.min(5, max), Math.ceil(max * 0.25));
    const qualified = rows.filter((r) => Number(r.n) >= cutoff).map((r) => r.period).sort();
    if (qualified.length) return qualified[qualified.length - 1];
  }
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - 1);
  return E.toPeriod(d);
}

async function engineOpts() {
  const s = await settingsSvc.getSettings();
  return {
    moratoria: await settingsSvc.getMoratoria(),
    asOf: await lastPostedPeriod(),
    renewalRule: s.renewal_rule,
    renewalThreshold: s.renewal_threshold,
    settings: s,
  };
}

async function entriesFor(loanId) {
  const { LedgerEntry } = M();
  const rows = await LedgerEntry.findAll({ where: { loan_id: loanId }, order: [['period', 'ASC'], ['id', 'ASC']] });
  return rows.map((r) => r.toJSON());
}

async function cardFor(loan, opts) {
  const o = opts || (await engineOpts());
  const l = loan.toJSON ? loan.toJSON() : loan;
  return E.buildLedger(l, await entriesFor(l.id), o);
}

const statusLabel = (card) =>
  card.summary.status === 'active'
    ? (card.summary.renewal_eligible ? 'QUALIFIED FOR RENEWAL' : 'NOT QUALIFIED FOR RENEWAL')
    : card.summary.status;

async function refreshLoan(loanOrId, opts) {
  const { Loan } = M();
  const loan = typeof loanOrId === 'object' && loanOrId.update ? loanOrId : await Loan.findByPk(loanOrId);
  if (!loan) return null;
  const card = await cardFor(loan, opts);
  await loan.update({
    loan_balance: card.summary.balance,
    no_of_months_paid: card.summary.months_paid,
    status: statusLabel(card),
    termination_date: card.summary.maturity_date || loan.termination_date,
    monthly_amortization: card.terms.monthly_amortization,
  });
  return card;
}

async function refreshAll() {
  const { Loan } = M();
  const opts = await engineOpts();
  const loans = await Loan.findAll();
  for (const l of loans) await refreshLoan(l, opts);
  return loans.length;
}

async function employeeLedger(employeeNumber) {
  const { Employee, Loan } = M();
  const employee = await Employee.findOne({ where: { employee_number: employeeNumber } });
  if (!employee) return null;
  const loans = await Loan.findAll({ where: { employee_number: employeeNumber }, order: [['effective_date', 'ASC'], ['id', 'ASC']] });
  const opts = await engineOpts();
  const out = [];
  for (const loan of loans) out.push({ loan: loan.toJSON(), card: await cardFor(loan, opts) });
  return { employee: employee.toJSON(), loans: out, as_of: opts.asOf, settings: publicSettings(opts.settings) };
}

const publicSettings = (s) => ({
  renewal_rule: s.renewal_rule, renewal_threshold: s.renewal_threshold, office_name: s.office_name, section_name: s.section_name,
  signatory_prepared_by: s.signatory_prepared_by, signatory_prepared_position: s.signatory_prepared_position,
  signatory_approved_by: s.signatory_approved_by, signatory_approved_position: s.signatory_approved_position,
  nthp_threshold: s.nthp_threshold,
});

/** All loans with their cards (current state), joined with employees. */
async function allCards() {
  const { Employee, Loan } = M();
  const [emps, loans] = await Promise.all([Employee.findAll(), Loan.findAll({ order: [['effective_date', 'ASC'], ['id', 'ASC']] })]);
  const byEmp = new Map(emps.map((e) => [e.employee_number, e.toJSON()]));
  const opts = await engineOpts();
  const out = [];
  for (const loan of loans) {
    out.push({ loan: loan.toJSON(), employee: byEmp.get(loan.employee_number) || null, card: await cardFor(loan, opts) });
  }
  return { items: out, opts };
}

/** SUMMARY sheet equivalent. One row per loan; `current_only` keeps each borrower's latest loan. */
async function summaryRows({ currentOnly = true, status } = {}) {
  const { items, opts } = await allCards();
  let rows = items;
  if (currentOnly) {
    const latest = new Map();
    for (const it of items) latest.set(it.loan.employee_number, it); // ordered ascending → last wins
    rows = [...latest.values()];
  }
  const mapped = rows.map(({ loan, employee, card }, i) => ({
    loan_id: loan.id,
    station: employee?.station || '',
    school: employee?.school || '',
    employee_number: loan.employee_number,
    name: fullName(employee),
    last_name: employee?.last_name || '',
    application_no: loan.application_no || '',
    check_number: loan.check_number || '',
    check_date: loan.check_date,
    date_granted: loan.date_granted,
    loan_type: loan.loan_type,
    loan_amount: card.terms.loan_amount,
    no_of_months: card.terms.no_of_months,
    monthly_amortization: card.terms.monthly_amortization,
    amount_with_interest: card.terms.amount_with_interest,
    effective_period: card.terms.first_deduction,
    termination_period: card.summary.maturity_period,
    months_paid: card.summary.months_paid,
    months_left: card.summary.months_left,
    balance: card.summary.balance,
    payments_required_for_renewal: card.summary.payments_required_for_renewal,
    status: card.summary.status,
    renewal_status: statusLabel(card),
    renewal_eligible: card.summary.renewal_eligible,
    renewal_eligible_from: card.summary.renewal_eligible_from,
    next_due_period: card.summary.next_due_period,
    next_due_amount: card.summary.next_due_amount,
    refund_due: card.summary.refund_due,
    remarks: loan.remarks || '',
    notes: loan.notes || '',
  }));
  const filtered = status ? mapped.filter((r) => r.status === status || r.renewal_status === status) : mapped;
  filtered.sort((a, b) => String(a.station).localeCompare(String(b.station), undefined, { numeric: true }) || a.last_name.localeCompare(b.last_name));
  filtered.forEach((r, i) => { r.no = i + 1; });
  return { rows: filtered, as_of: opts.asOf, renewal_rule: opts.renewalRule };
}

/** Monthly payroll posting preview. */
async function payrollPreview(period) {
  const { items, opts } = await allCards();
  const { LedgerEntry } = M();
  const posted = await LedgerEntry.findAll({ where: { period, entry_type: { [Op.in]: INSTALLMENT_TYPES } } });
  const postedByLoan = new Map();
  for (const p of posted) postedByLoan.set(p.loan_id, (postedByLoan.get(p.loan_id) || 0) + Number(p.amount_paid));
  const mor = E.inMoratorium(period, opts.moratoria);
  const rows = [];
  for (const { loan, employee, card } of items) {
    const already = postedByLoan.get(loan.id);
    const startsLater = E.periodIndex(card.terms.first_deduction) > E.periodIndex(period);
    if (card.summary.status !== 'active' && already == null) continue;
    if (startsLater && already == null) continue;
    const expected = E.expectedDeduction(card, period, opts.moratoria);
    let state = 'due';
    if (already != null) state = 'posted';
    else if (mor) state = 'moratorium';
    else if (expected > 0 && expected < card.terms.monthly_amortization - 0.005) state = 'final';
    rows.push({
      loan_id: loan.id,
      employee_number: loan.employee_number,
      name: fullName(employee),
      station: employee?.station || '',
      monthly_amortization: card.terms.monthly_amortization,
      balance: card.summary.balance,
      expected,
      posted: already ?? null,
      state,
    });
  }
  rows.sort((a, b) => String(a.station).localeCompare(String(b.station), undefined, { numeric: true }) || a.name.localeCompare(b.name));
  const totals = rows.reduce((t, r) => ({ expected: t.expected + (r.expected || 0), posted: t.posted + (r.posted || 0) }), { expected: 0, posted: 0 });
  return { period, moratorium: mor, rows, totals: { expected: E.round2(totals.expected), posted: E.round2(totals.posted) }, last_posted: opts.asOf };
}

/**
 * Post payroll deductions for a month. items: [{ loan_id, amount }]. Loans already posted for the
 * period are skipped unless replace=true.
 */
async function postPayroll(period, items, { batch, user, replace = false } = {}) {
  const { LedgerEntry, Loan } = M();
  if (!/^\d{4}-\d{2}$/.test(period)) throw new Error('Period must be YYYY-MM');
  const result = { posted: 0, skipped: 0, replaced: 0, errors: [] };
  const touched = new Set();
  for (const it of items || []) {
    const loan = await Loan.findByPk(it.loan_id);
    const amount = E.round2(Number(it.amount));
    if (!loan) { result.errors.push({ loan_id: it.loan_id, error: 'Loan not found' }); continue; }
    if (!(amount > 0)) { result.skipped++; continue; }
    const existing = await LedgerEntry.findAll({ where: { loan_id: loan.id, period, entry_type: { [Op.in]: INSTALLMENT_TYPES } } });
    if (existing.length && !replace) { result.skipped++; continue; }
    if (existing.length) { await LedgerEntry.destroy({ where: { id: existing.map((x) => x.id) } }); result.replaced++; }
    await LedgerEntry.create({
      employee_number: loan.employee_number,
      loan_id: loan.id,
      entry_type: 'deduction',
      period,
      payment_date: E.periodEndDate(period),
      date_of_deduction: E.periodEndDate(period),
      amount_paid: amount,
      monthly_payment_amount: amount,
      payroll_batch: batch || `PAYROLL-${period}`,
      reference_number: it.reference || batch || `PAYROLL-${period}`,
      recorded_by: user || 'Accounting',
      paid_status: true,
    });
    touched.add(loan.id);
    result.posted++;
  }
  const opts = await engineOpts();
  for (const id of touched) {
    const card = await refreshLoan(id, opts);
    if (card && card.summary.status === 'fully_paid') {
      const loan = await Loan.findByPk(id);
      await notify(loan.employee_number, 'Your Provident Fund loan is fully paid', `Your loan of ₱${fmt(loan.loan_amount)} has been fully paid as of ${period}. Payroll deduction will stop.`);
    }
  }
  return result;
}

const fmt = (n) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function notify(employeeNumber, title, body, link) {
  try {
    await M().Notification.create({ employee_number: employeeNumber, title, body, link: link || null });
  } catch (_) { /* notifications are best-effort */ }
}

/** Add a single ledger event (OR payment, payoff, prepayment, adjustment, refund, moratorium, deduction). */
async function addEntry(loanId, { entry_type, period, amount, reference_number, notes, payment_date }, user) {
  const { Loan, LedgerEntry } = M();
  const loan = await Loan.findByPk(loanId);
  if (!loan) throw Object.assign(new Error('Loan not found'), { status: 404 });
  if (!ENTRY_TYPES.includes(entry_type)) throw Object.assign(new Error('Invalid entry type'), { status: 400 });
  const p = E.toPeriod(period || payment_date || new Date());
  let amt = Number(amount) || 0;
  if (entry_type === 'payoff' && !(amt > 0)) {
    const card = await cardFor(loan);
    amt = card.summary.balance; // settle the outstanding balance
  }
  if (['deduction', 'or_payment', 'prepayment', 'refund'].includes(entry_type) && !(amt > 0)) {
    throw Object.assign(new Error('Amount must be greater than zero'), { status: 400 });
  }
  const entry = await LedgerEntry.create({
    employee_number: loan.employee_number,
    loan_id: loan.id,
    entry_type,
    period: p,
    payment_date: payment_date || E.periodEndDate(p),
    date_of_deduction: payment_date || E.periodEndDate(p),
    amount_paid: E.round2(amt),
    reference_number: reference_number || null,
    notes: notes || null,
    recorded_by: user || 'Accounting',
    paid_status: true,
  });
  const card = await refreshLoan(loan);
  if (entry_type === 'payoff' || card.summary.status === 'fully_paid') {
    await notify(loan.employee_number, 'Your Provident Fund loan is fully paid', `Loan of ₱${fmt(loan.loan_amount)} is fully paid${reference_number ? ` (${reference_number})` : ''}.`);
  }
  return { entry: entry.toJSON(), card };
}

async function updateEntry(id, patch) {
  const { LedgerEntry } = M();
  const entry = await LedgerEntry.findByPk(id);
  if (!entry) return null;
  const allowed = ['entry_type', 'period', 'amount_paid', 'reference_number', 'notes', 'payment_date'];
  const upd = {};
  for (const k of allowed) if (k in patch) upd[k] = patch[k];
  if (upd.period) upd.period = E.toPeriod(upd.period);
  await entry.update(upd);
  await refreshLoan(entry.loan_id);
  return entry;
}

async function deleteEntries(ids) {
  const { LedgerEntry } = M();
  const entries = await LedgerEntry.findAll({ where: { id: ids } });
  const loanIds = [...new Set(entries.map((e) => e.loan_id))];
  await LedgerEntry.destroy({ where: { id: ids } });
  for (const id of loanIds) await refreshLoan(id);
  return entries.length;
}

// ── Reports ──────────────────────────────────────────────────────────────────
async function reports(kind, { period } = {}) {
  const { items, opts } = await allCards();
  const P = period || E.addMonths(opts.asOf, 1);
  const base = ({ loan, employee, card }) => ({
    loan_id: loan.id, employee_number: loan.employee_number, name: fullName(employee), station: employee?.station || '',
    loan_amount: card.terms.loan_amount, monthly_amortization: card.terms.monthly_amortization, balance: card.summary.balance,
    months_paid: card.summary.months_paid, no_of_months: card.terms.no_of_months, maturity_period: card.summary.maturity_period,
  });
  const latestOnly = (() => { const m = new Map(); for (const it of items) m.set(it.loan.employee_number, it); return new Set([...m.values()].map((x) => x.loan.id)); })();
  switch (kind) {
    case 'stop-deduction': {
      // Final deduction falls in the period (amount reduced), or loan already paid / overpaid.
      const rows = [];
      for (const it of items) {
        const exp = E.expectedDeduction(it.card, P, opts.moratoria);
        const s = it.card.summary;
        if (s.status === 'active' && exp > 0 && exp < it.card.terms.monthly_amortization - 0.005) rows.push({ ...base(it), action: `Final deduction ₱${fmt(exp)} in ${P}; stop after` , final_amount: exp });
        else if (s.status !== 'active' && s.refund_due > 0) rows.push({ ...base(it), action: `Stop deduction — overpaid ₱${fmt(s.refund_due)} (refund due)`, final_amount: 0 });
        else if (s.status !== 'active' && it.card.rows.some((r) => r.period === opts.asOf && r.type === 'deduction')) rows.push({ ...base(it), action: 'Stop deduction — loan fully paid', final_amount: 0 });
      }
      return { period: P, rows };
    }
    case 'renewal-eligible':
      return { rule: opts.renewalRule, rows: items.filter((it) => latestOnly.has(it.loan.id) && it.card.summary.status === 'active' && it.card.summary.renewal_eligible).map((it) => ({ ...base(it), eligible_from: it.card.summary.renewal_eligible_from })) };
    case 'maturing':
      return { period: P, rows: items.filter((it) => it.card.summary.status === 'active' && it.card.summary.maturity_period === P).map(base) };
    case 'refunds':
      return { rows: items.filter((it) => it.card.summary.refund_due > 0).map((it) => ({ ...base(it), refund_due: it.card.summary.refund_due })) };
    case 'collections': {
      const prev = await payrollPreview(period || opts.asOf);
      return prev;
    }
    case 'no-deduction': {
      const rows = [];
      for (const it of items) {
        const missed = it.card.rows.filter((r) => r.type === 'no_deduction');
        if (missed.length && it.card.summary.status === 'active') rows.push({ ...base(it), missed_periods: missed.map((r) => r.period) });
      }
      return { as_of: opts.asOf, rows };
    }
    case 'annex-a': {
      const out = [];
      for (const m of opts.moratoria) {
        const affected = [];
        for (const it of items) {
          const rows = it.card.rows.filter((r) => r.type === 'moratorium' && E.inMoratorium(r.period, [m]));
          if (rows.length) affected.push({ ...base(it), deferred_months: rows.length, amount_deferred: E.round2(rows.length * it.card.terms.monthly_amortization) });
        }
        out.push({
          name_of_calamity: m.name, date_occurred: m.date_occurred, schedule_of_deferment: `${m.start_month} to ${m.end_month}`, reference: m.reference,
          borrowers_affected: new Set(affected.map((a) => a.employee_number)).size,
          total_amortizations_deferred: E.round2(affected.reduce((s, a) => s + a.amount_deferred, 0)), details: affected,
        });
      }
      return { moratoria: out };
    }
    default:
      throw Object.assign(new Error('Unknown report'), { status: 404 });
  }
}

async function dashboard() {
  const { items, opts } = await allCards();
  const active = items.filter((it) => it.card.summary.status === 'active');
  const next = E.addMonths(opts.asOf, 1);
  return {
    as_of: opts.asOf,
    borrowers: new Set(active.map((it) => it.loan.employee_number)).size,
    active_loans: active.length,
    receivable: E.round2(active.reduce((s, it) => s + it.card.summary.balance, 0)),
    principal_granted: E.round2(active.reduce((s, it) => s + it.card.terms.loan_amount, 0)),
    expected_next_month: E.round2(active.reduce((s, it) => s + E.expectedDeduction(it.card, next, opts.moratoria), 0)),
    next_period: next,
    renewal_eligible: active.filter((it) => it.card.summary.renewal_eligible).length,
    refunds_due: items.filter((it) => it.card.summary.refund_due > 0).length,
    with_missed_deductions: active.filter((it) => it.card.rows.some((r) => r.type === 'no_deduction')).length,
    fully_paid: items.filter((it) => it.card.summary.status === 'fully_paid').length,
  };
}

module.exports = {
  toPeriodSafe: (d) => E.toPeriod(d),
  ENTRY_TYPES, INSTALLMENT_TYPES, fullName, fmt,
  lastPostedPeriod, engineOpts, cardFor, refreshLoan, refreshAll, employeeLedger, allCards, summaryRows,
  payrollPreview, postPayroll, addEntry, updateEntry, deleteEntries, reports, dashboard, notify, statusLabel,
};
