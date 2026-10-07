const { Sequelize, DataTypes, Op } = require('sequelize');

const connectionString = process.env.DATABASE_URL || process.env.DB_URL;
const dialect = 'postgres';
// Postgres LIKE is case-sensitive, so name searches use ILIKE.
const LIKE = Op.iLike;

const sequelize = connectionString
  ? new Sequelize(connectionString, { dialect, logging: false })
  : new Sequelize(
      process.env.DB_NAME || 'provident_loan',
      process.env.DB_USER || 'postgres',
      process.env.DB_PASSWORD || process.env.DB_PASS || '',
      {
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 5432,
        dialect,
        logging: false
      }
    );


// ==================== DepEd Provident Fund loan rules ====================
// DO 52 s.2017 / DO 37 s.2018 / DO 3 & 8 s.2022: 6% per annum, diminishing balance,
// equal monthly amortization, 12–60 months. Renewal when >= 30% of principal is paid.
const PF_ANNUAL_RATE = 6;
const PF_RENEWAL_THRESHOLD = 0.30;
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const computeAmortization = (principal, months, annualRate = PF_ANNUAL_RATE) => {
  const P = Number(principal);
  const n = parseInt(months, 10);
  const r = Number(annualRate) / 100 / 12;
  if (!P || !n) return 0;
  if (!r) return round2(P / n);
  // DepEd PF amortization tables round UP to the next centavo (e.g. P100,000 x 60 mos = P1,933.29).
  const exact = (P * r) / (1 - Math.pow(1 + r, -n));
  return Math.ceil(exact * 100 - 1e-9) / 100;
};

// Loan moratoria declared by DepEd. During a moratorium no amortization is deducted, no additional
// interest accrues, and the loan term is extended by the same number of months.
// DepEd Memorandum dated 24 June 2026 (Sec. Angara): 3-month moratorium, 1 Jul – 30 Sep 2026,
// for all teaching and non-teaching PF borrowers (State of National Energy Emergency, EO 110 s.2026).
const PF_MORATORIA = [
  { start: '2026-07-01', end: '2026-09-30', months: 3, reference: 'DepEd Memorandum dated June 24, 2026 – Three (3)-Month Moratorium on PF Loans' }
];

const monthIndex = (d) => d.getUTCFullYear() * 12 + d.getUTCMonth();

// Months of moratorium that fall inside a loan's repayment window (the window grows as months are deferred).
const moratoriumMonthsFor = (effectiveDate, months) => {
  if (!effectiveDate || !months) return 0;
  const eff = new Date(effectiveDate);
  if (isNaN(eff)) return 0;
  const start = monthIndex(eff);
  let end = start + parseInt(months, 10) - 1;
  let total = 0;
  for (const m of PF_MORATORIA) {
    const ms = monthIndex(new Date(m.start + 'T00:00:00Z'));
    const me = monthIndex(new Date(m.end + 'T00:00:00Z'));
    const overlap = Math.min(end, me) - Math.max(start, ms) + 1;
    if (overlap > 0) { total += overlap; end += overlap; }
  }
  return total;
};

// Last deduction month = effective month + term − 1 + moratorium months; returned as that month's last day.
const computeTerminationDate = (effectiveDate, months) => {
  if (!effectiveDate || !months) return null;
  const eff = new Date(effectiveDate);
  if (isNaN(eff)) return null;
  const last = monthIndex(eff) + parseInt(months, 10) - 1 + moratoriumMonthsFor(effectiveDate, months);
  return new Date(Date.UTC(Math.floor(last / 12), (last % 12) + 1, 0));
};

const computeRenewalStatus = (loanAmount, outstandingBalance) => {
  const P = Number(loanAmount) || 0;
  const bal = Number(outstandingBalance) || 0;
  if (P <= 0) return 'active';
  if (bal <= 0.5) return 'fully_paid';
  return (P - bal) / P >= PF_RENEWAL_THRESHOLD
    ? 'QUALIFIED FOR RENEWAL'
    : 'NOT QUALIFIED FOR RENEWAL';
};

const Admin = sequelize.define(
  'Admin',
  {
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING, allowNull: false },
    first_name: { type: DataTypes.STRING, allowNull: false },
    last_name: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, allowNull: false, defaultValue: 'admin' },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  },
  {
    tableName: 'admins',
    timestamps: true,
    underscored: true
  }
);

const Employee = sequelize.define(
  'Employee',
  {
    employee_number: { type: DataTypes.STRING, allowNull: false, unique: true },
    station: { type: DataTypes.STRING, allowNull: true },
    first_name: { type: DataTypes.STRING, allowNull: false },
    last_name: { type: DataTypes.STRING, allowNull: false },
    middle_name: { type: DataTypes.STRING, allowNull: true },
    position: { type: DataTypes.STRING, allowNull: true },
    department: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
    date_hired: { type: DataTypes.DATE, allowNull: true },
    school: { type: DataTypes.STRING, allowNull: true },
    birth_date: { type: DataTypes.DATEONLY, allowNull: true },
    appointment_status: { type: DataTypes.STRING, allowNull: true, defaultValue: 'permanent' },
    monthly_basic_salary: { type: DataTypes.FLOAT, allowNull: true }
  },
  {
    tableName: 'employees',
    timestamps: true,
    underscored: true
  }
);

const Loan = sequelize.define(
  'Loan',
  {
    employee_number: { type: DataTypes.STRING, allowNull: false },
    loan_amount: { type: DataTypes.FLOAT, allowNull: false },
    no_of_months: { type: DataTypes.INTEGER, allowNull: false },
    monthly_amortization: { type: DataTypes.FLOAT, allowNull: false },
    loan_application_date: { type: DataTypes.DATE, allowNull: true },
    check_number: { type: DataTypes.STRING, allowNull: true },
    check_date: { type: DataTypes.DATE, allowNull: true },
    effective_date: { type: DataTypes.DATE, allowNull: true },
    termination_date: { type: DataTypes.DATE, allowNull: true },
    loan_balance: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    no_of_months_paid: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
    remarks: { type: DataTypes.TEXT, allowNull: true },
    reason: { type: DataTypes.TEXT, allowNull: true },
    approved_by: { type: DataTypes.STRING, allowNull: true },
    interest_rate: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 6 },
    notes: { type: DataTypes.TEXT, allowNull: true },
    loan_type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'multi_purpose' },
    date_granted: { type: DataTypes.DATEONLY, allowNull: true },
    previous_loan_id: { type: DataTypes.INTEGER, allowNull: true },
    outstanding_deducted: { type: DataTypes.FLOAT, allowNull: true },
    net_proceeds: { type: DataTypes.FLOAT, allowNull: true },
    application_id: { type: DataTypes.INTEGER, allowNull: true },
    source: { type: DataTypes.STRING, allowNull: true },
    application_no: { type: DataTypes.STRING, allowNull: true }
  },
  {
    tableName: 'loans',
    timestamps: true,
    underscored: true
  }
);

const LedgerEntry = sequelize.define(
  'LedgerEntry',
  {
    employee_number: { type: DataTypes.STRING, allowNull: false },
    loan_id: { type: DataTypes.INTEGER, allowNull: false },
    payment_date: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    amount_paid: { type: DataTypes.FLOAT, allowNull: false },
    previous_balance: { type: DataTypes.FLOAT, allowNull: true },
    new_balance: { type: DataTypes.FLOAT, allowNull: true },
    reference_number: { type: DataTypes.STRING, allowNull: true },
    recorded_by: { type: DataTypes.STRING, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    payment_month: { type: DataTypes.INTEGER, allowNull: true },
    date_of_deduction: { type: DataTypes.DATE, allowNull: true },
    payment_with_interest: { type: DataTypes.FLOAT, allowNull: true },
    principal_payments: { type: DataTypes.FLOAT, allowNull: true },
    paid_status: { type: DataTypes.BOOLEAN, allowNull: true },
    monthly_payment_amount: { type: DataTypes.FLOAT, allowNull: true },
    paid_months: { type: DataTypes.INTEGER, allowNull: true },
    balance: { type: DataTypes.FLOAT, allowNull: true },
    // deduction | or_payment | moratorium | prepayment | payoff | renewal_offset | adjustment | refund | opening
    entry_type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'deduction' },
    months_covered: { type: DataTypes.INTEGER, allowNull: true },
    period: { type: DataTypes.STRING(7), allowNull: true }, // 'YYYY-MM' payroll month
    payroll_batch: { type: DataTypes.STRING, allowNull: true }
  },
  {
    tableName: 'ledger_entries',
    timestamps: true,
    underscored: true
  }
);

const AuditLog = sequelize.define(
  'AuditLog',
  {
    user_id: { type: DataTypes.INTEGER, allowNull: true },
    action: { type: DataTypes.STRING, allowNull: false },
    resource_type: { type: DataTypes.STRING, allowNull: true },
    resource_id: { type: DataTypes.INTEGER, allowNull: true },
    metadata: { type: DataTypes.JSON, allowNull: true },
    details: { type: DataTypes.JSON, allowNull: true }
  },
  {
    tableName: 'audit_logs',
    timestamps: true,
    underscored: true
  }
);

const Setting = sequelize.define('Setting', {
  key: { type: DataTypes.STRING, allowNull: false, unique: true },
  value: { type: DataTypes.JSON, allowNull: true }
}, { tableName: 'settings', timestamps: true, underscored: true });

const Moratorium = sequelize.define('Moratorium', {
  name: { type: DataTypes.STRING, allowNull: false },
  start_month: { type: DataTypes.STRING(7), allowNull: false },
  end_month: { type: DataTypes.STRING(7), allowNull: false },
  date_occurred: { type: DataTypes.DATEONLY, allowNull: true },
  reference: { type: DataTypes.TEXT, allowNull: true }
}, { tableName: 'moratoria', timestamps: true, underscored: true });

const LoanApplication = sequelize.define('LoanApplication', {
  application_no: { type: DataTypes.STRING, allowNull: true, unique: true },
  employee_number: { type: DataTypes.STRING, allowNull: false },
  loan_type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'multi_purpose' },
  purpose: { type: DataTypes.STRING, allowNull: true },
  purpose_details: { type: DataTypes.TEXT, allowNull: true },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  months: { type: DataTypes.INTEGER, allowNull: false },
  co_maker_employee_number: { type: DataTypes.STRING, allowNull: true },
  co_maker_consent: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' }, // pending|given|declined
  monthly_basic_salary: { type: DataTypes.FLOAT, allowNull: true },
  other_deductions: { type: DataTypes.FLOAT, allowNull: true },
  computation: { type: DataTypes.JSON, allowNull: true },
  checks: { type: DataTypes.JSON, allowNull: true },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'submitted' },
  history: { type: DataTypes.JSON, allowNull: true },
  submitted_by: { type: DataTypes.STRING, allowNull: false, defaultValue: 'admin' },
  loan_id: { type: DataTypes.INTEGER, allowNull: true },
  check_number: { type: DataTypes.STRING, allowNull: true },
  check_date: { type: DataTypes.DATEONLY, allowNull: true },
  first_deduction_month: { type: DataTypes.STRING(7), allowNull: true },
  remarks: { type: DataTypes.TEXT, allowNull: true }
}, { tableName: 'loan_applications', timestamps: true, underscored: true });

const EmployeeAccount = sequelize.define('EmployeeAccount', {
  employee_number: { type: DataTypes.STRING, allowNull: false, unique: true },
  password_hash: { type: DataTypes.STRING, allowNull: true },
  activation_code_hash: { type: DataTypes.STRING, allowNull: true },
  activation_expires: { type: DataTypes.DATE, allowNull: true },
  last_login: { type: DataTypes.DATE, allowNull: true },
  is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, { tableName: 'employee_accounts', timestamps: true, underscored: true });

const Notification = sequelize.define('Notification', {
  employee_number: { type: DataTypes.STRING, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  body: { type: DataTypes.TEXT, allowNull: true },
  link: { type: DataTypes.STRING, allowNull: true },
  read_at: { type: DataTypes.DATE, allowNull: true }
}, { tableName: 'notifications', timestamps: true, underscored: true });

Employee.hasMany(Loan, { foreignKey: 'employee_number', sourceKey: 'employee_number' });
Loan.belongsTo(Employee, { foreignKey: 'employee_number', targetKey: 'employee_number' });
Employee.hasMany(LedgerEntry, { foreignKey: 'employee_number', sourceKey: 'employee_number' });
Loan.hasMany(LedgerEntry, { foreignKey: 'loan_id', sourceKey: 'id' });
LedgerEntry.belongsTo(Loan, { foreignKey: 'loan_id', targetKey: 'id' });

const initializeDatabase = async () => {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  await ensureSeedData();
  await require('../services/settings').seedReferenceData();
  // Re-derive cached balances so every loan reflects the current engine and settings.
  await ledger().refreshAll();
};

const ensureSeedData = async () => {
  const admin = await Admin.findOne({ where: { username: 'admin' } });
  const envPassword = process.env.ADMIN_PASSWORD;
  if (admin && envPassword) {
    // Keep the admin password in sync with the ADMIN_PASSWORD variable (removes the demo password).
    const bcryptjs = require('bcryptjs');
    const same = await bcryptjs.compare(envPassword, admin.password_hash);
    if (!same) await admin.update({ password_hash: await bcryptjs.hash(envPassword, 10) });
    return;
  }
  if (!admin && envPassword) {
    const bcryptjs = require('bcryptjs');
    await Admin.create({
      username: 'admin',
      email: 'admin@company.com',
      password_hash: await bcryptjs.hash(envPassword, 10),
      first_name: 'System',
      last_name: 'Administrator',
      role: 'super_admin',
      is_active: true
    });
    return;
  }
  if (!admin) {
    await Admin.create({
      username: 'admin',
      email: 'admin@company.com',
      password_hash: '$2a$10$E4zAXSKyAqOa4xDcMkMWM.i/X6z/6emrLMZu8UIRQFpH0FmdFjYom',
      first_name: 'System',
      last_name: 'Administrator',
      role: 'super_admin',
      is_active: true
    });
  }
};

const findAdmin = async (username) => {
  return Admin.findOne({
    where: {
      [Op.or]: [{ username }, { email: username }]
    }
  });
};

const logAudit = async (userId, action, resourceType, resourceId, metadata, details) => {
  return AuditLog.create({
    user_id: userId,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    metadata: metadata || {},
    details: details || {}
  });
};

const getEmployees = async ({ page = 1, limit = 10, position, station, status }) => {
  const where = {};
  if (position) where.position = position;
  if (station) where.station = station;
  if (status) where.status = status;

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const { count, rows } = await Employee.findAndCountAll({
    where,
    offset,
    limit: parseInt(limit, 10),
    order: [['created_at', 'DESC']]
  });

  return { count, rows };
};

const getEmployeeByNumber = async (employeeNumber) => {
  return Employee.findOne({ where: { employee_number: employeeNumber } });
};

const createEmployee = async (payload) => {
  return Employee.create(payload);
};

const updateEmployee = async (employeeNumber, updates) => {
  const employee = await getEmployeeByNumber(employeeNumber);
  if (!employee) return null;
  await employee.update(updates);
  return employee;
};

const deleteEmployee = async (employeeNumber) => {
  const employee = await getEmployeeByNumber(employeeNumber);
  if (!employee) return null;
  await employee.destroy();
  return employee;
};

const getLoans = async ({ page = 1, limit = 10, status, employee_number }) => {
  const where = {};
  if (status) where.status = status;
  if (employee_number) where.employee_number = employee_number;

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const { count, rows } = await Loan.findAndCountAll({
    where,
    offset,
    limit: parseInt(limit, 10),
    order: [['created_at', 'DESC']]
  });

  return { count, rows };
};

const getLoanById = async (loanId) => {
  return Loan.findByPk(loanId);
};

const ledger = () => require('../services/ledgerService');
const createLoan = async (payload) => {
  const employee = await getEmployeeByNumber(payload.employee_number);
  if (!employee) {
    throw new Error('Employee not found');
  }
  const loanAmount = parseFloat(payload.loan_amount);
  const months = parseInt(payload.no_of_months, 10);
  const annualRate = PF_ANNUAL_RATE;
  const loan = await Loan.create({
    employee_number: payload.employee_number,
    loan_type: payload.loan_type || 'multi_purpose',
    loan_amount: loanAmount,
    no_of_months: months,
    monthly_amortization: computeAmortization(loanAmount, months, annualRate),
    loan_application_date: payload.loan_application_date || new Date(),
    application_no: payload.application_no || null,
    check_number: payload.check_number || null,
    check_date: payload.check_date || null,
    date_granted: payload.date_granted || payload.check_date || null,
    // effective_date = first payroll deduction month
    effective_date: payload.effective_date || new Date(),
    loan_balance: loanAmount,
    no_of_months_paid: 0,
    status: 'NOT QUALIFIED FOR RENEWAL',
    interest_rate: annualRate,
    reason: payload.reason || 'Personal needs',
    approved_by: payload.approved_by || 'System Admin',
    remarks: payload.remarks || null,
    notes: payload.notes || null,
    previous_loan_id: payload.previous_loan_id || null,
    outstanding_deducted: payload.outstanding_deducted ?? null,
    net_proceeds: payload.net_proceeds ?? null,
    application_id: payload.application_id || null,
    source: payload.source || 'manual'
  });
  await ledger().refreshLoan(loan);
  return loan.reload();
};

const updateLoan = async (loanId, updates) => {
  const loan = await getLoanById(loanId);
  if (!loan) return null;
  await loan.update(updates);
  return loan;
};

const deleteLoan = async (loanId) => {
  const loan = await getLoanById(loanId);
  if (!loan) return null;
  await LedgerEntry.destroy({ where: { loan_id: loan.id } });
  await loan.destroy();
  return loan;
};

const getLedgerEntries = async ({ page = 1, limit = 20, employee_number, month, year }) => {
  const where = {};
  if (employee_number) where.employee_number = employee_number;
  if (month && year) {
    where.payment_date = {
      [Op.between]: [
        new Date(`${year}-${String(month).padStart(2, '0')}-01`),
        new Date(`${year}-${String(month).padStart(2, '0')}-31`)
      ]
    };
  }

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const { count, rows } = await LedgerEntry.findAndCountAll({
    where,
    offset,
    limit: parseInt(limit, 10),
    order: [['payment_date', 'DESC']]
  });

  return { count, rows };
};

const recordPayment = async ({ employee_number, loan_id, amount_paid, payment_date, reference_number, notes, entry_type, period }) => {
  const loan = await getLoanById(loan_id);
  if (!loan) {
    throw new Error('Loan not found');
  }
  // Default period: the month of the payment date, else the next month due on the card.
  let p = period || (payment_date ? ledger().toPeriodSafe(payment_date) : null);
  if (!p) {
    const card = await ledger().cardFor(loan);
    p = card.summary.next_due_period || ledger().toPeriodSafe(new Date());
  }
  const { entry, card } = await ledger().addEntry(loan.id, {
    entry_type: entry_type || 'deduction',
    period: p,
    amount: amount_paid,
    reference_number,
    notes,
    payment_date
  });
  const row = card.rows.find((r) => r.entry_id === entry.id) || {};
  await LedgerEntry.update({
    payment_with_interest: row.interest ?? null,
    principal_payments: row.principal ?? null,
    balance: row.balance ?? null,
    new_balance: row.balance ?? null,
    paid_months: row.months_paid ?? null
  }, { where: { id: entry.id } });
  const ledgerEntry = await LedgerEntry.findByPk(entry.id);
  const updatedLoan = await Loan.findByPk(loan.id);
  return { ledgerEntry, updatedLoan, card };
};

// Direct loan insert that preserves all values from an import (no recalculation)
const createLoanDirect = async (payload) => {
  // Summary-sheet import (no monthly history): the loan starts at its first deduction month and an
  // 'opening' entry carries the balance and months paid from the sheet.
  const loanAmount = parseFloat(payload.loan_amount) || 0;
  const parsedBalance = parseFloat(payload.loan_balance);
  const importedBalance = Number.isFinite(parsedBalance) ? parsedBalance : loanAmount;
  const loan = await Loan.create({
    employee_number: payload.employee_number,
    loan_amount: loanAmount,
    no_of_months: parseInt(payload.no_of_months) || 0,
    monthly_amortization: parseFloat(payload.monthly_amortization) || computeAmortization(loanAmount, payload.no_of_months),
    loan_application_date: payload.loan_application_date || null,
    application_no: payload.application_no || null,
    check_number: payload.check_number || null,
    check_date: payload.check_date || null,
    date_granted: payload.check_date || null,
    effective_date: payload.effective_date || null,
    termination_date: payload.termination_date || null,
    loan_balance: importedBalance,
    no_of_months_paid: parseInt(payload.no_of_months_paid) || 0,
    status: payload.status || 'active',
    remarks: payload.remarks || null,
    reason: 'Imported from summary',
    approved_by: 'Import',
    interest_rate: PF_ANNUAL_RATE,
    source: 'summary_import'
  });
  return loan;
};

// Annex A – report on PF borrowers covered by a moratorium (PF National Board of Trustees template).
const getMoratoriumReport = async () => {
  const r = await ledger().reports('annex-a');
  const m = r.moratoria[r.moratoria.length - 1] || {};
  return { ...m, details: m.details || [] };
};

const findLoanByEmployeeNumber = async (employee_number) => {
  return Loan.findOne({
    where: { employee_number },
    order: [['created_at', 'DESC']]
  });
};

/**
 * Returns true if at least one ledger entry exists for the given loan_id.
 * Used during import to avoid creating duplicate aggregate payment records.
 */
const hasLedgerEntries = async (loanId) => {
  const count = await LedgerEntry.count({ where: { loan_id: loanId } });
  return count > 0;
};

/**
 * Creates a single ledger entry directly from a payload object.
 * Used by the bulk import to record aggregate payment history.
 */
const createLedgerEntry = async (payload) => {
  return LedgerEntry.create(payload);
};

const getLedgerByEmployeeNumber = async (employee_number) => {
  return LedgerEntry.findAll({
    where: { employee_number },
    order: [['payment_date', 'ASC']]
  });
};

const findEmployeesByName = async (firstName, lastName) => {
  const firstNameValue = firstName ? firstName.trim().toUpperCase() : null;
  const lastNameValue = lastName ? lastName.trim().toUpperCase() : null;
  const conditions = [];

  if (firstNameValue) {
    conditions.push({ first_name: { [LIKE]: `%${firstNameValue}%` } });
    conditions.push({ last_name: { [LIKE]: `%${firstNameValue}%` } });
  }
  if (lastNameValue) {
    conditions.push({ last_name: { [LIKE]: `%${lastNameValue}%` } });
  }

  const where = conditions.length > 0 ? { [Op.or]: conditions } : {};

  return Employee.findAll({ where, limit: 25, order: [['created_at', 'DESC']] });
};

const getAllEmployees = async () => Employee.findAll({ order: [['created_at', 'DESC']] });
const getAllLoans = async () => Loan.findAll({ order: [['created_at', 'DESC']] });

/**
 * Get all loans for a specific employee, ordered by creation date ascending.
 */
const getLoansByEmployee = async (employee_number) => {
  return Loan.findAll({
    where: { employee_number },
    order: [['effective_date', 'ASC'], ['id', 'ASC']]
  });
};

/**
 * Get all ledger entries for a specific loan.
 */
const getLedgerByLoanId = async (loan_id) => {
  return LedgerEntry.findAll({
    where: { loan_id },
    order: [['payment_date', 'ASC'], ['created_at', 'ASC']]
  });
};

/**
 * Get a single ledger entry by id.
 */
const getLedgerEntryById = async (id) => {
  return LedgerEntry.findByPk(id);
};

/**
 * Update a ledger entry and recalculate loan balance accordingly.
 */
const updateLedgerEntry = async (id, updates) => {
  return ledger().updateEntry(id, updates);
};

/**
 * Delete a ledger entry.
 */
const deleteLedgerEntry = async (id) => {
  const entry = await getLedgerEntryById(id);
  if (!entry) return null;
  await ledger().deleteEntries([entry.id]);
  return entry;
};

/**
 * Bulk-delete ledger entries by an array of ids.
 * Returns the number of rows deleted.
 */
const bulkDeleteLedgerEntries = async (ids) => {
  return ledger().deleteEntries(ids);
};

const getDashboardSummary = async () => {
  const totalEmployees = await Employee.count();
  const totalLoans = await Loan.count();
  const activeLoans = await Loan.count({ where: { status: { [Op.in]: ['active', 'QUALIFIED FOR RENEWAL', 'NOT QUALIFIED FOR RENEWAL', 'NOT QUALIFIED'] } } });
  const fullyPaidLoans = await Loan.count({ where: { [Op.or]: [{ status: 'fully_paid' }, { status: { [LIKE]: '%fully%' } }] } });
  const totalLoanAmount = parseFloat((await Loan.sum('loan_amount')) || 0);
  const totalLoanBalance = parseFloat((await Loan.sum('loan_balance')) || 0);
  const totalAmortization = parseFloat((await Loan.sum('monthly_amortization')) || 0);
  const totalPaymentsRecorded = parseFloat((await LedgerEntry.sum('amount_paid')) || 0);
  const ledgerCount = await LedgerEntry.count();

  return {
    employees: {
      total: totalEmployees,
      active: await Employee.count({ where: { status: 'active' } })
    },
    loans: {
      total: totalLoans,
      active: activeLoans,
      fullyPaid: fullyPaidLoans,
      totalAmount: totalLoanAmount,
      remainingBalance: totalLoanBalance,
      monthlyAmortization: totalAmortization
    },
    payments: {
      totalRecorded: totalPaymentsRecorded,
      entriesCount: ledgerCount,
      averagePayment: ledgerCount > 0 ? parseFloat((totalPaymentsRecorded / ledgerCount).toFixed(2)) : 0
    }
  };
};

module.exports = {
  sequelize,
  models: { Admin, Employee, Loan, LedgerEntry, AuditLog, Setting, Moratorium, LoanApplication, EmployeeAccount, Notification },
  PF_MORATORIA,
  computeTerminationDate,
  moratoriumMonthsFor,
  getMoratoriumReport,
  computeAmortization,
  computeRenewalStatus,
  PF_ANNUAL_RATE,
  initializeDatabase,
  findAdmin,
  logAudit,
  getEmployees,
  getEmployeeByNumber,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getLoans,
  getLoanById,
  createLoan,
  updateLoan,
  deleteLoan,
  getLedgerEntries,
  recordPayment,
  createLoanDirect,
  findLoanByEmployeeNumber,
  hasLedgerEntries,
  createLedgerEntry,
  getLedgerByEmployeeNumber,
  getLoansByEmployee,
  getLedgerByLoanId,
  getLedgerEntryById,
  updateLedgerEntry,
  deleteLedgerEntry,
  bulkDeleteLedgerEntries,
  findEmployeesByName,
  getAllEmployees,
  getAllLoans,
  getDashboardSummary
};
