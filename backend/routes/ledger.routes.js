/**
 * Accounting (admin) API for the ledger-card based system.
 * Mounted at /api/admin — every route requires an admin token.
 */
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const bcryptjs = require('bcryptjs');
const XLSX = require('xlsx');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const ledger = require('../services/ledgerService');
const settingsSvc = require('../services/settings');
const apps = require('../services/applications');
const cardImport = require('../services/cardImport');
const E = require('../services/loanEngine');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const M = () => require('../database/db').models;
const guard = [authenticateToken, authorizeAdmin];
const who = (req) => req.user?.username || 'Accounting';

const wrap = (fn) => async (req, res) => {
  try {
    const data = await fn(req, res);
    if (!res.headersSent) res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ success: false, message: err.message, error: err.message });
  }
};

const isPeriod = (p) => /^\d{4}-\d{2}$/.test(p || '');

// ── Excel export helper ───────────────────────────────────────────────────────
function sendXlsx(res, filename, sheets) {
  const wb = XLSX.utils.book_new();
  for (const { name, columns, rows, title } of sheets) {
    const aoa = [];
    if (title) aoa.push([title], []);
    aoa.push(columns.map((c) => c.label));
    for (const r of rows) aoa.push(columns.map((c) => (typeof c.value === 'function' ? c.value(r) : r[c.key]) ?? ''));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = columns.map((c) => ({ wch: c.width || 14 }));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
}

// ── Overview / dashboard ──────────────────────────────────────────────────────
router.get('/overview', guard, wrap(() => ledger.dashboard()));
router.post('/recalculate', guard, wrap(async () => ({ loans: await ledger.refreshAll() })));

// ── Ledger cards ──────────────────────────────────────────────────────────────
router.get('/ledger-cards/:employeeNumber', guard, wrap(async (req) => {
  const d = await ledger.employeeLedger(req.params.employeeNumber);
  if (!d) throw Object.assign(new Error('Employee not found'), { status: 404 });
  const acct = await M().EmployeeAccount.findOne({ where: { employee_number: req.params.employeeNumber } });
  d.portal_account = acct ? { active: acct.is_active, activated: !!acct.password_hash, last_login: acct.last_login } : null;
  return d;
}));
router.get('/loans/:loanId/card', guard, wrap(async (req) => {
  const loan = await M().Loan.findByPk(req.params.loanId);
  if (!loan) throw Object.assign(new Error('Loan not found'), { status: 404 });
  const employee = await M().Employee.findOne({ where: { employee_number: loan.employee_number } });
  const opts = await ledger.engineOpts();
  return { loan: loan.toJSON(), employee: employee?.toJSON() || null, card: await ledger.cardFor(loan, opts), as_of: opts.asOf, settings: opts.settings };
}));
router.post('/loans/:loanId/entries', guard, wrap(async (req) => ledger.addEntry(req.params.loanId, req.body, who(req))));
router.put('/entries/:id', guard, wrap(async (req) => {
  const e = await ledger.updateEntry(req.params.id, req.body);
  if (!e) throw Object.assign(new Error('Entry not found'), { status: 404 });
  return e;
}));
router.delete('/entries/:id', guard, wrap(async (req) => ({ deleted: await ledger.deleteEntries([Number(req.params.id)]) })));

// ── Summary (SUMMARY tab) ─────────────────────────────────────────────────────
router.get('/summary', guard, wrap(async (req) => ledger.summaryRows({ currentOnly: req.query.all !== '1', status: req.query.status })));
router.get('/summary/export', guard, async (req, res) => {
  try {
    const s = await settingsSvc.getSettings();
    const { rows, as_of } = await ledger.summaryRows({ currentOnly: req.query.all !== '1' });
    sendXlsx(res, `PF-SUMMARY-${as_of}.xlsx`, [{
      name: 'SUMMARY', title: `${s.office_name} – PROVIDENT LOAN FUND SUMMARY as of ${as_of}`,
      columns: [
        { label: 'No.', key: 'no', width: 5 }, { label: 'Station', key: 'station', width: 8 }, { label: 'Employee Number', key: 'employee_number' },
        { label: 'Name of Employee', key: 'name', width: 32 }, { label: 'Loan Application Number', key: 'application_no' }, { label: 'Check No.', key: 'check_number' },
        { label: 'Check Date', key: 'check_date' }, { label: 'Loan Amount', key: 'loan_amount' }, { label: 'No. of Months', key: 'no_of_months', width: 8 },
        { label: 'Monthly Amortization', key: 'monthly_amortization' }, { label: 'Effective (1st deduction)', key: 'effective_period' }, { label: 'Termination', key: 'termination_period' },
        { label: 'No. of Months Paid', key: 'months_paid', width: 8 }, { label: 'No. of Months Balance', key: 'months_left', width: 8 }, { label: 'Loan Balance', key: 'balance' },
        { label: '# of Payments Qualified for Re-loan', key: 'payments_required_for_renewal', width: 10 }, { label: 'Status', key: 'renewal_status', width: 26 },
        { label: 'Eligible for Re-loan From', key: 'renewal_eligible_from' }, { label: 'Refund Due', key: 'refund_due' }, { label: 'Remarks', key: 'remarks', width: 40 }, { label: 'Notes', key: 'notes', width: 30 },
      ],
      rows,
    }]);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Monthly payroll posting ───────────────────────────────────────────────────
router.get('/payroll/:period', guard, wrap(async (req) => {
  if (!isPeriod(req.params.period)) throw Object.assign(new Error('Period must be YYYY-MM'), { status: 400 });
  return ledger.payrollPreview(req.params.period);
}));
router.post('/payroll/:period/post', guard, wrap(async (req) => {
  if (!isPeriod(req.params.period)) throw Object.assign(new Error('Period must be YYYY-MM'), { status: 400 });
  const r = await ledger.postPayroll(req.params.period, req.body.items || [], { batch: req.body.batch, user: who(req), replace: !!req.body.replace });
  await require('../database/db').logAudit(req.user?.id, 'PAYROLL_POST', 'PAYROLL', null, { period: req.params.period }, r);
  return r;
}));
// Upload the payroll deduction list (CSV/XLSX with employee number + amount) → matched preview.
router.post('/payroll/:period/upload', guard, upload.single('file'), wrap(async (req) => {
  if (!req.file) throw Object.assign(new Error('No file uploaded'), { status: 400 });
  const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
  let hdr = rows.findIndex((r) => r.some((c) => /employee/i.test(String(c))) && r.some((c) => /amount|deduct/i.test(String(c))));
  let empCol = 0, amtCol = 1;
  if (hdr >= 0) {
    empCol = rows[hdr].findIndex((c) => /employee/i.test(String(c)));
    amtCol = rows[hdr].findIndex((c) => /amount|deduct/i.test(String(c)));
  }
  const uploaded = new Map();
  for (const r of rows.slice(hdr + 1)) {
    const emp = String(r[empCol] ?? '').replace(/\.0$/, '').trim();
    const amt = parseFloat(String(r[amtCol] ?? '').replace(/[,₱\s]/g, ''));
    if (/^\d{4,10}$/.test(emp) && amt > 0) uploaded.set(emp, (uploaded.get(emp) || 0) + amt);
  }
  const prev = await ledger.payrollPreview(req.params.period);
  const byEmp = new Map(prev.rows.map((r) => [r.employee_number, r]));
  const matched = [];
  const unmatched = [];
  for (const [emp, amt] of uploaded) {
    const r = byEmp.get(emp);
    if (!r) unmatched.push({ employee_number: emp, amount: E.round2(amt) });
    else matched.push({ ...r, uploaded: E.round2(amt), difference: E.round2(amt - r.expected) });
  }
  const missing = prev.rows.filter((r) => r.expected > 0 && !uploaded.has(r.employee_number) && r.state !== 'posted');
  return { period: req.params.period, matched, unmatched, missing, moratorium: prev.moratorium };
}));

// ── Reports ───────────────────────────────────────────────────────────────────
router.get('/reports/:kind', guard, wrap(async (req) => ledger.reports(req.params.kind, { period: req.query.period })));
router.get('/reports/:kind/export', guard, async (req, res) => {
  try {
    const kind = req.params.kind;
    const r = await ledger.reports(kind, { period: req.query.period });
    const base = [
      { label: 'Station', key: 'station', width: 8 }, { label: 'Employee Number', key: 'employee_number' }, { label: 'Name', key: 'name', width: 30 },
      { label: 'Loan Amount', key: 'loan_amount' }, { label: 'Monthly Amortization', key: 'monthly_amortization' }, { label: 'Months Paid', key: 'months_paid', width: 8 },
      { label: 'Balance', key: 'balance' },
    ];
    let sheets;
    if (kind === 'annex-a') {
      sheets = [{ name: 'Annex A', title: 'ANNEX A: THREE (3)-MONTH MORATORIUM ON PROVIDENT FUND LOANS', columns: [
        { label: 'Name of Calamity/Emergency', key: 'name_of_calamity', width: 45 }, { label: 'Date Occurred', key: 'date_occurred' },
        { label: 'No. of PF Borrowers Affected', key: 'borrowers_affected' }, { label: 'Schedule of Deferment', key: 'schedule_of_deferment', width: 22 },
        { label: 'Total Amount of Amortizations Deferred', key: 'total_amortizations_deferred', width: 20 },
      ], rows: r.moratoria },
      ...r.moratoria.map((m, i) => ({ name: `Details ${i + 1}`, columns: [...base, { label: 'Months Deferred', key: 'deferred_months' }, { label: 'Amount Deferred', key: 'amount_deferred' }], rows: m.details }))];
    } else if (kind === 'collections') {
      sheets = [{ name: 'Collections', title: `Expected vs posted deductions – ${r.period}`, columns: [
        { label: 'Station', key: 'station' }, { label: 'Employee Number', key: 'employee_number' }, { label: 'Name', key: 'name', width: 30 },
        { label: 'Expected', key: 'expected' }, { label: 'Posted', key: 'posted' }, { label: 'Status', key: 'state' }], rows: r.rows }];
    } else {
      const extra = { 'stop-deduction': [{ label: 'Action', key: 'action', width: 45 }], 'renewal-eligible': [{ label: 'Eligible From', key: 'eligible_from' }],
        refunds: [{ label: 'Refund Due', key: 'refund_due' }], 'no-deduction': [{ label: 'Months Without Deduction', value: (x) => (x.missed_periods || []).join(', '), width: 40 }],
        maturing: [{ label: 'Maturity', key: 'maturity_period' }] }[kind] || [];
      sheets = [{ name: kind, title: `${kind.replace(/-/g, ' ').toUpperCase()}${r.period ? ' – ' + r.period : ''}`, columns: [...base, ...extra], rows: r.rows }];
    }
    sendXlsx(res, `PF-${kind}-${req.query.period || 'current'}.xlsx`, sheets);
  } catch (err) { res.status(err.status || 500).json({ success: false, message: err.message }); }
});

// ── Settings & moratoria ──────────────────────────────────────────────────────
router.get('/settings', guard, wrap(async () => ({ settings: await settingsSvc.getSettings(), moratoria: await settingsSvc.getMoratoria(), defaults: settingsSvc.DEFAULTS })));
router.put('/settings', guard, wrap(async (req) => {
  const s = await settingsSvc.updateSettings(req.body || {});
  await ledger.refreshAll(); // renewal rule affects every loan's status
  return s;
}));
router.post('/moratoria', guard, wrap(async (req) => {
  const { name, start_month, end_month, date_occurred, reference } = req.body || {};
  if (!name || !isPeriod(start_month) || !isPeriod(end_month)) throw Object.assign(new Error('name, start_month and end_month (YYYY-MM) are required'), { status: 400 });
  const m = await M().Moratorium.create({ name, start_month, end_month, date_occurred: date_occurred || null, reference: reference || null });
  settingsSvc.clearMoratoriaCache();
  await ledger.refreshAll();
  return m;
}));
router.delete('/moratoria/:id', guard, wrap(async (req) => {
  await M().Moratorium.destroy({ where: { id: req.params.id } });
  settingsSvc.clearMoratoriaCache();
  await ledger.refreshAll();
  return { deleted: true };
}));

// ── Ledger workbook import ────────────────────────────────────────────────────
router.post('/import/ledger-workbook', guard, upload.single('file'), wrap(async (req) => {
  if (!req.file) throw Object.assign(new Error('No file uploaded'), { status: 400 });
  const r = await cardImport.importWorkbook(req.file.buffer, { replace: req.body.replace === 'true' || req.body.replace === true, user: who(req) });
  await require('../database/db').logAudit(req.user?.id, 'IMPORT_WORKBOOK', 'LOANS', null, { file: req.file.originalname }, { cards: r.cards, loans: r.loans_created });
  return r;
}));
router.post('/import/ledger-workbook/preview', guard, upload.single('file'), wrap(async (req) => {
  if (!req.file) throw Object.assign(new Error('No file uploaded'), { status: 400 });
  const p = cardImport.parseWorkbook(req.file.buffer);
  return { summary_tab: p.summaryName, summary_rows: p.summary.size, cards: p.cards.map((c) => ({ tab: c.tab, employee_number: c.employee_number, name: c.name, blocks: c.blocks.length, deductions: c.blocks.reduce((t, b) => t + b.entries.filter((e) => e.entry_type === 'deduction').length, 0) })), skipped_tabs: p.skipped };
}));

// ── Applications ──────────────────────────────────────────────────────────────
router.get('/applications', guard, wrap(async (req) => apps.list({ status: req.query.status, employee_number: req.query.employee_number })));
router.get('/applications/:id', guard, wrap(async (req) => {
  const a = (await apps.list({})).find((x) => String(x.id) === String(req.params.id));
  if (!a) throw Object.assign(new Error('Application not found'), { status: 404 });
  return { ...a, steps: apps.STEPS };
}));
router.post('/applications/evaluate', guard, wrap(async (req) => apps.evaluate(req.body || {})));
router.post('/applications', guard, wrap(async (req) => apps.create(req.body || {}, { by: 'admin', user: who(req) })));
router.post('/applications/:id/action', guard, wrap(async (req) => apps.act(req.params.id, req.body || {}, who(req))));

// ── Employee portal accounts ──────────────────────────────────────────────────
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
router.post('/employees/:employeeNumber/portal-code', guard, wrap(async (req) => {
  const { Employee, EmployeeAccount } = M();
  const emp = await Employee.findOne({ where: { employee_number: req.params.employeeNumber } });
  if (!emp) throw Object.assign(new Error('Employee not found'), { status: 404 });
  const code = Array.from(crypto.randomBytes(8)).map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
  const expires = new Date(Date.now() + 30 * 86400000);
  const hash = await bcryptjs.hash(code, 10);
  const acct = await EmployeeAccount.findOne({ where: { employee_number: emp.employee_number } });
  if (acct) await acct.update({ activation_code_hash: hash, activation_expires: expires, is_active: true });
  else await EmployeeAccount.create({ employee_number: emp.employee_number, activation_code_hash: hash, activation_expires: expires });
  await require('../database/db').logAudit(req.user?.id, 'PORTAL_CODE', 'EMPLOYEE', null, { employee_number: emp.employee_number }, {});
  return { employee_number: emp.employee_number, name: ledger.fullName(emp), code, expires };
}));
router.post('/employees/:employeeNumber/portal-disable', guard, wrap(async (req) => {
  const acct = await M().EmployeeAccount.findOne({ where: { employee_number: req.params.employeeNumber } });
  if (acct) await acct.update({ is_active: false });
  return { disabled: true };
}));

module.exports = router;
