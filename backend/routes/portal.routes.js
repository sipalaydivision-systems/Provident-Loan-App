/**
 * Employee self-service portal — mounted at /api/portal.
 * Accounts are activated with a one-time code issued by the Accounting Section (no email needed).
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { Op } = require('sequelize');
const ledger = require('../services/ledgerService');
const apps = require('../services/applications');
const settingsSvc = require('../services/settings');
const E = require('../services/loanEngine');

const router = express.Router();
const M = () => require('../database/db').models;

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 15, message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' } });

const wrap = (fn) => async (req, res) => {
  try {
    const data = await fn(req, res);
    if (!res.headersSent) res.json({ success: true, data });
  } catch (err) {
    if (!err.status) console.error(err);
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};
const fail = (status, message) => Object.assign(new Error(message), { status });

function authEmployee(req, res, next) {
  const token = (req.headers.authorization || '').split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Please sign in' });
  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err || payload.role !== 'employee') return res.status(401).json({ success: false, message: 'Session expired. Please sign in again.' });
    req.employeeNumber = payload.employee_number;
    next();
  });
}

const norm = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9Ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
const issue = (employee_number) => jwt.sign({ employee_number, role: 'employee' }, process.env.JWT_SECRET, { expiresIn: '8h' });
const strongEnough = (p) => typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);

// Public loan calculator
router.post('/calculator', wrap(async (req) => {
  const s = await settingsSvc.getSettings();
  const amount = Number(req.body.amount);
  const months = parseInt(req.body.months, 10);
  if (!(amount > 0) || !(months > 0)) throw fail(400, 'Enter amount and term');
  const A = E.amortization(amount, months, s.interest_rate);
  const card = E.buildLedger({ loan_amount: amount, no_of_months: months, monthly_amortization: A, effective_date: E.toPeriod(new Date()) }, [], { asOf: '1900-01' });
  const salary = Number(req.body.monthly_basic_salary) || null;
  const ded = req.body.other_deductions !== undefined && req.body.other_deductions !== '' ? Number(req.body.other_deductions) : null;
  const nthp = salary != null && ded != null ? E.round2(salary - ded - A) : null;
  return {
    monthly_amortization: A, amount_with_interest: E.round2(A * months), total_interest: E.round2(A * months - amount),
    schedule: card.rows.map((r, i) => ({ no: i + 1, interest: r.interest, principal: r.principal, payment: r.payment, balance: r.balance })),
    net_take_home_pay: nthp, nthp_threshold: s.nthp_threshold, nthp_ok: nthp == null ? null : nthp >= s.nthp_threshold,
    limits: { min_term: s.min_term, max_term: s.max_term, max_multi_purpose: s.max_multi_purpose, max_additional: s.max_additional },
  };
}));

router.post('/activate', authLimiter, wrap(async (req) => {
  const { employee_number, last_name, code, password } = req.body || {};
  const { Employee, EmployeeAccount } = M();
  const emp = await Employee.findOne({ where: { employee_number: String(employee_number || '').trim() } });
  const acct = emp ? await EmployeeAccount.findOne({ where: { employee_number: emp.employee_number } }) : null;
  const full = emp ? ` ${norm(`${emp.first_name} ${emp.middle_name || ''} ${emp.last_name}`)} ` : '';
  const nameOk = emp && norm(last_name).length >= 2 && full.includes(` ${norm(last_name)} `);
  if (!emp || !acct || !acct.activation_code_hash || !nameOk) throw fail(400, 'The details or activation code are not valid. Ask the Accounting Section for a new code.');
  if (acct.activation_expires && new Date(acct.activation_expires) < new Date()) throw fail(400, 'This activation code has expired. Ask the Accounting Section for a new code.');
  if (!(await bcryptjs.compare(String(code || '').trim().toUpperCase(), acct.activation_code_hash))) throw fail(400, 'The details or activation code are not valid. Ask the Accounting Section for a new code.');
  if (!strongEnough(password)) throw fail(400, 'Password must be at least 8 characters with letters and numbers.');
  await acct.update({ password_hash: await bcryptjs.hash(password, 10), activation_code_hash: null, activation_expires: null, is_active: true, last_login: new Date() });
  return { token: issue(emp.employee_number), name: ledger.fullName(emp) };
}));

router.post('/login', authLimiter, wrap(async (req) => {
  const { employee_number, password } = req.body || {};
  const { Employee, EmployeeAccount } = M();
  const acct = await EmployeeAccount.findOne({ where: { employee_number: String(employee_number || '').trim() } });
  if (!acct || !acct.password_hash || !acct.is_active || !(await bcryptjs.compare(String(password || ''), acct.password_hash))) {
    throw fail(401, 'Invalid employee number or password.');
  }
  await acct.update({ last_login: new Date() });
  const emp = await Employee.findOne({ where: { employee_number: acct.employee_number } });
  return { token: issue(acct.employee_number), name: ledger.fullName(emp) };
}));

router.post('/change-password', authEmployee, wrap(async (req) => {
  const acct = await M().EmployeeAccount.findOne({ where: { employee_number: req.employeeNumber } });
  if (!acct || !(await bcryptjs.compare(String(req.body.current_password || ''), acct.password_hash))) throw fail(400, 'Current password is incorrect.');
  if (!strongEnough(req.body.new_password)) throw fail(400, 'Password must be at least 8 characters with letters and numbers.');
  await acct.update({ password_hash: await bcryptjs.hash(req.body.new_password, 10) });
  return { changed: true };
}));

// My profile, loans and ledger cards
router.get('/me', authEmployee, wrap(async (req) => {
  const d = await ledger.employeeLedger(req.employeeNumber);
  if (!d) throw fail(404, 'Employee record not found');
  const { Notification } = M();
  const unread = await Notification.count({ where: { employee_number: req.employeeNumber, read_at: null } });
  const e = d.employee;
  return {
    employee: { employee_number: e.employee_number, name: ledger.fullName(e), station: e.station, school: e.school, position: e.position, monthly_basic_salary: e.monthly_basic_salary },
    loans: d.loans.map(({ loan, card }) => ({
      loan: { id: loan.id, loan_type: loan.loan_type, application_no: loan.application_no, check_number: loan.check_number, check_date: loan.check_date, date_granted: loan.date_granted, net_proceeds: loan.net_proceeds },
      card,
    })),
    as_of: d.as_of,
    settings: d.settings,
    unread_notifications: unread,
  };
}));

router.get('/me/notifications', authEmployee, wrap(async (req) =>
  M().Notification.findAll({ where: { employee_number: req.employeeNumber }, order: [['created_at', 'DESC']], limit: 50 })));
router.post('/me/notifications/read', authEmployee, wrap(async (req) => {
  await M().Notification.update({ read_at: new Date() }, { where: { employee_number: req.employeeNumber, read_at: null } });
  return { read: true };
}));

// Applications
router.get('/me/applications', authEmployee, wrap(async (req) => apps.list({ employee_number: req.employeeNumber })));
router.post('/me/applications/preview', authEmployee, wrap(async (req) => apps.evaluate({ ...req.body, employee_number: req.employeeNumber })));
router.post('/me/applications', authEmployee, wrap(async (req) => {
  const open = await M().LoanApplication.count({ where: { employee_number: req.employeeNumber, status: { [Op.in]: apps.OPEN } } });
  if (open) throw fail(400, 'You already have an application in process.');
  return apps.create({ ...req.body, employee_number: req.employeeNumber }, { by: 'employee', user: req.employeeNumber });
}));
router.post('/me/applications/:id/cancel', authEmployee, wrap(async (req) => {
  const a = await M().LoanApplication.findByPk(req.params.id);
  if (!a || a.employee_number !== req.employeeNumber) throw fail(404, 'Application not found');
  if (a.status !== 'submitted') throw fail(400, 'Only applications not yet acted on can be cancelled. Contact the Accounting Section.');
  return apps.act(a.id, { action: 'cancel', remarks: 'Cancelled by applicant' }, req.employeeNumber);
}));

// Co-maker requests
router.get('/me/co-maker', authEmployee, wrap(async (req) => apps.list({ co_maker: req.employeeNumber })));
router.post('/me/co-maker/:id', authEmployee, wrap(async (req) => {
  const a = await M().LoanApplication.findByPk(req.params.id);
  if (!a || a.co_maker_employee_number !== req.employeeNumber) throw fail(404, 'Request not found');
  if (!apps.OPEN.includes(a.status)) throw fail(400, 'This application is already closed.');
  return apps.act(a.id, { action: 'co_maker_consent', decision: req.body.decision }, req.employeeNumber);
}));

module.exports = router;
