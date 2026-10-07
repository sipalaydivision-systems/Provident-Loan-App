/**
 * Loan applications: eligibility checks and the DepEd PF approval workflow.
 *
 * Workflow (Citizen's Charter / restated PF guidelines):
 *   submitted → Personnel verified (status, net take-home pay) → Legal cleared (no pending case)
 *   → PF Secretariat evaluated & computed → Recommended (Head, PF Secretariat)
 *   → Approved (SDS; Regional Director for Additional loans) → Check released (loan created)
 */
const { Op } = require('sequelize');
const E = require('./loanEngine');
const settingsSvc = require('./settings');
const ledger = require('./ledgerService');

const M = () => require('../database/db').models;

const STEPS = [
  { action: 'verify_personnel', from: ['submitted'], to: 'personnel_verified', label: 'Personnel: employment status and net take-home pay verified' },
  { action: 'clear_legal', from: ['personnel_verified'], to: 'legal_cleared', label: 'Legal: no pending administrative/civil case' },
  { action: 'evaluate', from: ['legal_cleared'], to: 'evaluated', label: 'PF Secretariat: evaluated and computed' },
  { action: 'recommend', from: ['evaluated'], to: 'recommended', label: 'Recommended by the Head, PF Secretariat' },
  { action: 'approve', from: ['recommended'], to: 'approved', label: 'Approved (SDS / Regional Director for Additional loans)' },
  { action: 'release_check', from: ['approved'], to: 'released', label: 'Check released; loan booked' },
];
const OPEN = ['submitted', 'personnel_verified', 'legal_cleared', 'evaluated', 'recommended', 'approved'];
const STATUS_LABEL = {
  submitted: 'Submitted', personnel_verified: 'Personnel verified', legal_cleared: 'Legal cleared', evaluated: 'Evaluated',
  recommended: 'Recommended', approved: 'Approved', released: 'Check released', disapproved: 'Disapproved', cancelled: 'Cancelled',
};

const yearsBetween = (a, b) => (b - a) / (365.25 * 86400000);

async function activeLoansOf(employeeNumber) {
  const { Loan } = M();
  const loans = await Loan.findAll({ where: { employee_number: employeeNumber } });
  const opts = await ledger.engineOpts();
  const out = [];
  for (const l of loans) {
    const card = await ledger.cardFor(l, opts);
    if (card.summary.status === 'active') out.push({ loan: l, card });
  }
  return out;
}

/** Compute the loan figures and every eligibility check. Unknown data → ok: null (to verify manually). */
async function evaluate(input) {
  const s = await settingsSvc.getSettings();
  const { Employee, LoanApplication } = M();
  const amount = Number(input.amount);
  const months = parseInt(input.months, 10);
  const loanType = input.loan_type || 'multi_purpose';
  const borrower = await Employee.findOne({ where: { employee_number: input.employee_number } });
  const amort = E.amortization(amount, months, s.interest_rate);
  const active = borrower ? await activeLoansOf(input.employee_number) : [];
  const outstanding = E.round2(active.reduce((t, x) => t + x.card.summary.balance, 0));
  const oldAmort = E.round2(active.reduce((t, x) => t + x.card.terms.monthly_amortization, 0));
  const isRenewal = active.length > 0;
  const checks = {};

  checks.borrower = { ok: !!borrower, detail: borrower ? `${ledger.fullName(borrower)} (${borrower.employee_number})` : 'Employee not found in the masterlist' };
  checks.term = { ok: months >= s.min_term && months <= s.max_term, detail: `${months} months (allowed ${s.min_term}–${s.max_term})` };
  const max = loanType === 'additional' ? s.max_additional : s.max_multi_purpose;
  checks.amount = { ok: amount > 0 && amount <= max, detail: `₱${ledger.fmt(amount)} (maximum ₱${ledger.fmt(max)} for ${loanType === 'additional' ? 'Additional' : 'Multi-Purpose'} loan)` };

  const status = (borrower?.appointment_status || '').toLowerCase();
  checks.employment_status = { ok: borrower?.appointment_status ? ['permanent', 'regular'].includes(status) : null, detail: borrower?.appointment_status ? `Appointment: ${borrower.appointment_status}` : 'Appointment status not recorded — verify with Personnel' };

  if (borrower?.birth_date) {
    const maturity = new Date(); maturity.setMonth(maturity.getMonth() + months + 1);
    const age = yearsBetween(new Date(borrower.birth_date), maturity);
    checks.retirement = { ok: age < s.retirement_age, detail: `Age at loan maturity ≈ ${age.toFixed(1)} (mandatory retirement ${s.retirement_age})` };
  } else checks.retirement = { ok: null, detail: 'Birth date not recorded — verify the borrower will not reach mandatory retirement before maturity' };

  if (isRenewal) {
    const elig = active.every((x) => x.card.summary.renewal_eligible);
    const req = active.map((x) => `${x.card.summary.months_paid}/${x.card.summary.payments_required_for_renewal} payments`).join(', ');
    checks.renewal = { ok: elig, detail: `Existing loan balance ₱${ledger.fmt(outstanding)}; ${s.renewal_rule === 'principal' ? `${Math.round(active[0].card.summary.principal_paid_ratio * 100)}% of principal paid` : req} (rule: ${Math.round(s.renewal_threshold * 100)}% of ${s.renewal_rule})` };
  } else checks.renewal = { ok: true, detail: 'No outstanding PF loan (new loan)' };

  const salary = Number(input.monthly_basic_salary ?? borrower?.monthly_basic_salary) || null;
  const otherDed = input.other_deductions != null && input.other_deductions !== '' ? Number(input.other_deductions) : null;
  let nthp = null;
  if (salary != null && otherDed != null) {
    // other_deductions = current total deductions on the payslip (includes the existing PF amortization).
    nthp = E.round2(salary - (otherDed - (isRenewal ? oldAmort : 0)) - amort);
    checks.net_take_home_pay = { ok: nthp >= s.nthp_threshold, detail: `₱${ledger.fmt(nthp)} after the new amortization (minimum ₱${ledger.fmt(s.nthp_threshold)})` };
  } else checks.net_take_home_pay = { ok: null, detail: 'Enter basic salary and current total deductions from the latest payslip' };

  if (input.co_maker_employee_number) {
    const cm = await Employee.findOne({ where: { employee_number: input.co_maker_employee_number } });
    if (!cm) checks.co_maker = { ok: false, detail: 'Co-maker not found in the masterlist' };
    else if (cm.employee_number === input.employee_number) checks.co_maker = { ok: false, detail: 'Borrower cannot be own co-maker' };
    else {
      const problems = [];
      const unknown = [];
      if (cm.appointment_status) { if (!['permanent', 'regular'].includes(cm.appointment_status.toLowerCase())) problems.push('not permanent'); } else unknown.push('appointment status');
      if (cm.date_hired) { if (yearsBetween(new Date(cm.date_hired), new Date()) < s.co_maker_min_years) problems.push(`less than ${s.co_maker_min_years} year in service`); } else unknown.push('date hired');
      if (cm.monthly_basic_salary && salary) { if (cm.monthly_basic_salary < salary) problems.push('salary lower than borrower’s'); } else unknown.push('salary');
      const coMakerOf = await LoanApplication.count({ where: { co_maker_employee_number: cm.employee_number, status: 'released', loan_id: { [Op.ne]: null } } });
      // count only loans still active
      let activeCo = 0;
      if (coMakerOf) {
        const apps = await LoanApplication.findAll({ where: { co_maker_employee_number: cm.employee_number, status: 'released' } });
        for (const a of apps) { const l = await M().Loan.findByPk(a.loan_id); if (l) { const c = await ledger.cardFor(l); if (c.summary.status === 'active') activeCo++; } }
      }
      if (activeCo >= s.co_maker_max_loans) problems.push(`already co-maker of ${activeCo} active PF loans`);
      checks.co_maker = { ok: problems.length ? false : (unknown.length ? null : true), detail: `${ledger.fullName(cm)}${problems.length ? ' — ' + problems.join('; ') : ''}${unknown.length ? ` (verify: ${unknown.join(', ')})` : ''}; active co-maker loans: ${activeCo}` };
    }
  } else checks.co_maker = { ok: false, detail: 'A co-maker is required' };

  const computation = {
    monthly_amortization: amort,
    amount_with_interest: E.round2(amort * months),
    total_interest: E.round2(amort * months - amount),
    outstanding_balance: outstanding,
    net_proceeds: E.round2(amount - outstanding),
    is_renewal: isRenewal,
    existing_amortization: oldAmort,
    net_take_home_pay: nthp,
    interest_rate: s.interest_rate,
  };
  const failed = Object.entries(checks).filter(([, v]) => v.ok === false).map(([k]) => k);
  const toVerify = Object.entries(checks).filter(([, v]) => v.ok === null).map(([k]) => k);
  return { computation, checks, failed, to_verify: toVerify };
}

async function nextApplicationNo() {
  const { LoanApplication } = M();
  const now = new Date();
  const y = now.getFullYear();
  const count = await LoanApplication.count({ where: { application_no: { [Op.like]: `${y}-%` } } });
  return `${y}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(3, '0')}`;
}

async function create(input, { by = 'admin', user = 'Accounting' } = {}) {
  const { LoanApplication } = M();
  const ev = await evaluate(input);
  const app = await LoanApplication.create({
    application_no: await nextApplicationNo(),
    employee_number: input.employee_number,
    loan_type: input.loan_type || 'multi_purpose',
    purpose: input.purpose || null,
    purpose_details: input.purpose_details || null,
    amount: Number(input.amount),
    months: parseInt(input.months, 10),
    co_maker_employee_number: input.co_maker_employee_number || null,
    co_maker_consent: by === 'admin' && input.co_maker_consent === 'given' ? 'given' : 'pending',
    monthly_basic_salary: input.monthly_basic_salary || null,
    other_deductions: input.other_deductions ?? null,
    computation: ev.computation,
    checks: ev.checks,
    status: 'submitted',
    submitted_by: by,
    history: [{ step: 'submitted', label: 'Application submitted', by: user, at: new Date().toISOString(), remarks: input.remarks || null }],
    remarks: input.remarks || null,
  });
  if (by === 'employee') {
    await ledger.notify(app.employee_number, 'Application received', `Your PF loan application ${app.application_no} for ₱${ledger.fmt(app.amount)} was submitted.`, '/employee/home');
  }
  if (app.co_maker_employee_number) {
    await ledger.notify(app.co_maker_employee_number, 'Co-maker consent requested', `You were named co-maker on PF loan application ${app.application_no} (₱${ledger.fmt(app.amount)}). Please review it in the portal.`, '/employee/home');
  }
  return app;
}

async function act(id, { action, remarks, check_number, check_date, first_deduction_month, decision }, user = 'Accounting') {
  const { LoanApplication, Loan, LedgerEntry } = M();
  const app = await LoanApplication.findByPk(id);
  if (!app) throw Object.assign(new Error('Application not found'), { status: 404 });
  const history = Array.isArray(app.history) ? [...app.history] : [];
  const push = (step, label) => history.push({ step, label, by: user, at: new Date().toISOString(), remarks: remarks || null });

  if (action === 'co_maker_consent') {
    if (!['given', 'declined'].includes(decision)) throw Object.assign(new Error('decision must be given or declined'), { status: 400 });
    push(`co_maker_${decision}`, `Co-maker consent ${decision}`);
    await app.update({ co_maker_consent: decision, history });
    await ledger.notify(app.employee_number, `Co-maker ${decision} consent`, `Your co-maker has ${decision} consent for application ${app.application_no}.`, '/employee/home');
    return app;
  }
  if (action === 'reevaluate') {
    const ev = await evaluate(app.toJSON());
    await app.update({ computation: ev.computation, checks: ev.checks });
    return app;
  }
  if (action === 'disapprove' || action === 'cancel') {
    if (!OPEN.includes(app.status)) throw Object.assign(new Error(`Application is already ${app.status}`), { status: 400 });
    const to = action === 'disapprove' ? 'disapproved' : 'cancelled';
    push(to, action === 'disapprove' ? 'Disapproved' : 'Cancelled');
    await app.update({ status: to, history, remarks: remarks || app.remarks });
    await ledger.notify(app.employee_number, `Application ${STATUS_LABEL[to].toLowerCase()}`, `PF loan application ${app.application_no} was ${STATUS_LABEL[to].toLowerCase()}.${remarks ? ' Remarks: ' + remarks : ''}`, '/employee/home');
    return app;
  }
  const step = STEPS.find((s) => s.action === action);
  if (!step) throw Object.assign(new Error('Unknown action'), { status: 400 });
  if (!step.from.includes(app.status)) throw Object.assign(new Error(`Cannot ${action.replace('_', ' ')} while the application is ${STATUS_LABEL[app.status] || app.status}`), { status: 400 });

  if (action === 'evaluate' || action === 'recommend' || action === 'approve') {
    const ev = await evaluate(app.toJSON());
    await app.update({ computation: ev.computation, checks: ev.checks });
    if (action !== 'evaluate' && ev.failed.length) {
      throw Object.assign(new Error(`Cannot ${action}: failed checks — ${ev.failed.join(', ')}`), { status: 400 });
    }
    if (action === 'approve' && app.co_maker_consent !== 'given') {
      throw Object.assign(new Error('Cannot approve: co-maker consent has not been given'), { status: 400 });
    }
  }

  if (action === 'release_check') {
    if (!check_number || !check_date || !/^\d{4}-\d{2}$/.test(first_deduction_month || '')) {
      throw Object.assign(new Error('Check number, check date and first deduction month (YYYY-MM) are required'), { status: 400 });
    }
    const ev = await evaluate(app.toJSON());
    const db = require('../database/db');
    // Renewal: close the existing loan(s) with the outstanding balance deducted from the proceeds.
    const active = await activeLoansOf(app.employee_number);
    let prevId = null;
    for (const { loan, card } of active) {
      const p = E.addMonths(first_deduction_month, -1);
      await LedgerEntry.create({
        employee_number: app.employee_number, loan_id: loan.id, entry_type: 'renewal_offset', period: p,
        payment_date: E.periodEndDate(p), amount_paid: card.summary.balance,
        notes: `Balance deducted from new loan ${app.application_no}`, reference_number: `CHECK ${check_number}`, recorded_by: user,
      });
      await ledger.refreshLoan(loan);
      prevId = loan.id;
    }
    const loan = await db.createLoan({
      employee_number: app.employee_number,
      loan_type: app.loan_type,
      loan_amount: app.amount,
      no_of_months: app.months,
      application_no: app.application_no,
      check_number,
      check_date,
      date_granted: check_date,
      loan_application_date: app.created_at || app.createdAt,
      effective_date: `${first_deduction_month}-01`,
      reason: app.purpose || 'Multi-purpose',
      approved_by: user,
      previous_loan_id: prevId,
      outstanding_deducted: ev.computation.outstanding_balance || null,
      net_proceeds: ev.computation.net_proceeds,
      application_id: app.id,
      source: 'application',
    });
    push(step.to, step.label);
    await app.update({ status: step.to, history, loan_id: loan.id, check_number, check_date, first_deduction_month, computation: ev.computation, checks: ev.checks });
    await ledger.notify(app.employee_number, 'Check released — loan booked', `Your PF loan ${app.application_no} (₱${ledger.fmt(app.amount)}) is released. Net proceeds ₱${ledger.fmt(ev.computation.net_proceeds)}. First deduction: ${first_deduction_month}, ₱${ledger.fmt(ev.computation.monthly_amortization)}/month.`, '/employee/home');
    return app;
  }

  push(step.to, step.label);
  await app.update({ status: step.to, history });
  await ledger.notify(app.employee_number, `Application update: ${STATUS_LABEL[step.to]}`, `PF loan application ${app.application_no}: ${step.label}.`, '/employee/home');
  return app;
}

async function list({ status, employee_number, co_maker } = {}) {
  const { LoanApplication, Employee } = M();
  const where = {};
  if (status === 'open') where.status = { [Op.in]: OPEN };
  else if (status) where.status = status;
  if (employee_number) where.employee_number = employee_number;
  if (co_maker) where.co_maker_employee_number = co_maker;
  const apps = await LoanApplication.findAll({ where, order: [['created_at', 'DESC']] });
  const nums = [...new Set(apps.flatMap((a) => [a.employee_number, a.co_maker_employee_number]).filter(Boolean))];
  const emps = await Employee.findAll({ where: { employee_number: nums } });
  const byNo = new Map(emps.map((e) => [e.employee_number, ledger.fullName(e)]));
  return apps.map((a) => ({ ...a.toJSON(), borrower_name: byNo.get(a.employee_number) || '', co_maker_name: byNo.get(a.co_maker_employee_number) || '', status_label: STATUS_LABEL[a.status] || a.status }));
}

module.exports = { STEPS, OPEN, STATUS_LABEL, evaluate, create, act, list, activeLoansOf };
