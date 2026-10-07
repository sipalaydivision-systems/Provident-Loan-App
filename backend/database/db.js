const { Sequelize, DataTypes, Op } = require('sequelize');

const connectionString = process.env.DATABASE_URL || process.env.DB_URL;
// Dialect follows the connection string (postgres:// or postgresql:// → Postgres), else DB_DIALECT, else MySQL.
const dialect = process.env.DB_DIALECT
  || (connectionString && /^postgres(ql)?:/i.test(connectionString) ? 'postgres' : 'mysql');
const isPostgres = dialect === 'postgres';
// Postgres LIKE is case-sensitive; MySQL's default collation is not. Use ILIKE on Postgres.
const LIKE = isPostgres ? Op.iLike : Op.like;
const dialectOptions = isPostgres
  ? {}
  : { decimalNumbers: true, charset: 'utf8mb4' };

const sequelize = connectionString
  ? new Sequelize(connectionString, { dialect, logging: false, dialectOptions })
  : new Sequelize(
      process.env.DB_NAME || 'provident_loan',
      process.env.DB_USER || (isPostgres ? 'postgres' : 'root'),
      process.env.DB_PASS || '',
      {
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || (isPostgres ? 5432 : 3306),
        dialect,
        logging: false,
        dialectOptions
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
    date_hired: { type: DataTypes.DATE, allowNull: true }
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
    interest_rate: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 0 },
    notes: { type: DataTypes.STRING, allowNull: true }
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
    balance: { type: DataTypes.FLOAT, allowNull: true }
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

Employee.hasMany(Loan, { foreignKey: 'employee_number', sourceKey: 'employee_number' });
Loan.belongsTo(Employee, { foreignKey: 'employee_number', targetKey: 'employee_number' });
Employee.hasMany(LedgerEntry, { foreignKey: 'employee_number', sourceKey: 'employee_number' });
Loan.hasMany(LedgerEntry, { foreignKey: 'loan_id', sourceKey: 'id' });
LedgerEntry.belongsTo(Loan, { foreignKey: 'loan_id', targetKey: 'id' });

const initializeDatabase = async () => {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  await ensureSeedData();
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

const createLoan = async (payload) => {
  const employee = await getEmployeeByNumber(payload.employee_number);
  if (!employee) {
    throw new Error('Employee not found');
  }

  const loanAmount = parseFloat(payload.loan_amount);
  const months = parseInt(payload.no_of_months, 10);
  const annualRate = PF_ANNUAL_RATE;
  const monthlyAmortization = computeAmortization(loanAmount, months, annualRate);

  return Loan.create({
    employee_number: payload.employee_number,
    loan_amount: loanAmount,
    no_of_months: months,
    monthly_amortization: monthlyAmortization,
    loan_application_date: payload.loan_application_date || new Date(),
    effective_date: payload.effective_date || new Date(),
    termination_date: computeTerminationDate(payload.effective_date || new Date(), months),
    loan_balance: loanAmount,
    no_of_months_paid: 0,
    status: 'NOT QUALIFIED FOR RENEWAL',
    interest_rate: annualRate,
    reason: payload.reason || 'Personal needs',
    approved_by: payload.approved_by || 'System Admin',
    remarks: payload.remarks || null
  });
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

const recordPayment = async ({ employee_number, loan_id, amount_paid, payment_date, reference_number, notes }) => {
  const loan = await getLoanById(loan_id);
  if (!loan) {
    throw new Error('Loan not found');
  }

  const payment = round2(parseFloat(amount_paid));
  const previousBalance = round2(parseFloat(loan.loan_balance));
  // Diminishing balance: interest is charged on the outstanding principal only.
  const monthlyRate = (Number(loan.interest_rate) || PF_ANNUAL_RATE) / 100 / 12;
  const interest = round2(previousBalance * monthlyRate);
  const principalPaid = round2(Math.min(previousBalance, payment - interest));
  const newBalance = round2(Math.max(0, previousBalance - principalPaid));
  const paidMonths = loan.no_of_months_paid + 1;
  const updatedLoan = await loan.update({
    loan_balance: newBalance,
    no_of_months_paid: paidMonths,
    status: computeRenewalStatus(loan.loan_amount, newBalance),
    termination_date: newBalance <= 0 ? new Date() : loan.termination_date
  });

  const ledgerEntry = await LedgerEntry.create({
    employee_number,
    loan_id,
    payment_date: payment_date || new Date(),
    amount_paid: payment,
    previous_balance: previousBalance,
    new_balance: newBalance,
    reference_number: reference_number || `PAY-${Date.now()}`,
    recorded_by: 'System Admin',
    notes: notes || '',
    payment_month: payment_date ? new Date(payment_date).getMonth() + 1 : null,
    date_of_deduction: payment_date ? new Date(payment_date) : null,
    payment_with_interest: interest,
    principal_payments: principalPaid,
    paid_status: true,
    monthly_payment_amount: payment,
    paid_months: paidMonths,
    balance: newBalance
  });

  return { ledgerEntry, updatedLoan };
};

// Direct loan insert that preserves all values from an import (no recalculation)
const createLoanDirect = async (payload) => {
  const loanAmount = parseFloat(payload.loan_amount) || 0;
  const parsedBalance = parseFloat(payload.loan_balance);
  const importedBalance = Number.isFinite(parsedBalance) ? parsedBalance : loanAmount;
  // Renewal status is recomputed from the 30% rule; the sheet's own label is kept in remarks for audit.
  const computedStatus = computeRenewalStatus(loanAmount, importedBalance);
  const sheetStatus = (payload.status || '').toString().trim();
  const remarkParts = [payload.remarks || null];
  if (sheetStatus && sheetStatus.toUpperCase() !== computedStatus.toUpperCase()) {
    remarkParts.push(`Sheet status: ${sheetStatus}`);
  }
  if (importedBalance < 0) remarkParts.push('Negative balance in source (possible over-deduction)');
  const importRemarks = remarkParts.filter(Boolean).join(' | ') || null;
  return Loan.create({
    employee_number: payload.employee_number,
    loan_amount: loanAmount,
    no_of_months: parseInt(payload.no_of_months) || 0,
    monthly_amortization: parseFloat(payload.monthly_amortization) || computeAmortization(loanAmount, payload.no_of_months),
    loan_application_date: payload.loan_application_date || null,
    check_number: payload.check_number || null,
    check_date: payload.check_date || null,
    effective_date: payload.effective_date || null,
    termination_date: payload.termination_date || null,
    loan_balance: importedBalance,
    no_of_months_paid: parseInt(payload.no_of_months_paid) || 0,
    status: computedStatus,
    remarks: importRemarks,
    reason: 'Imported from summary',
    approved_by: 'Import',
    interest_rate: PF_ANNUAL_RATE,
  });
};

// Annex A – report on PF borrowers covered by a moratorium (PF National Board of Trustees template).
const getMoratoriumReport = async (index = PF_MORATORIA.length - 1) => {
  const m = PF_MORATORIA[index];
  const loans = await Loan.findAll();
  const ms = monthIndex(new Date(m.start + 'T00:00:00Z'));
  const me = monthIndex(new Date(m.end + 'T00:00:00Z'));
  const affected = [];
  for (const loan of loans) {
    if (!loan.effective_date || Number(loan.loan_balance) <= 0) continue;
    const start = monthIndex(new Date(loan.effective_date));
    const naturalEnd = start + Number(loan.no_of_months) - 1;
    const overlap = Math.min(naturalEnd, me) - Math.max(start, ms) + 1;
    if (overlap <= 0) continue;
    const deferredMonths = Math.min(overlap, m.months);
    affected.push({
      employee_number: loan.employee_number,
      loan_id: loan.id,
      monthly_amortization: Number(loan.monthly_amortization),
      deferred_months: deferredMonths,
      amount_deferred: round2(Number(loan.monthly_amortization) * deferredMonths)
    });
  }
  return {
    reference: m.reference,
    name_of_calamity: 'State of National Energy Emergency (EO No. 110, s. 2026)',
    date_occurred: '2026-03-24',
    schedule_of_deferment: `${m.start} to ${m.end}`,
    borrowers_affected: new Set(affected.map(a => a.employee_number)).size,
    total_amortizations_deferred: round2(affected.reduce((sum, x) => sum + x.amount_deferred, 0)),
    details: affected
  };
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
    order: [['created_at', 'ASC']]
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
  const entry = await getLedgerEntryById(id);
  if (!entry) return null;
  await entry.update(updates);
  return entry;
};

/**
 * Delete a ledger entry.
 */
const deleteLedgerEntry = async (id) => {
  const entry = await getLedgerEntryById(id);
  if (!entry) return null;
  await entry.destroy();
  return entry;
};

/**
 * Bulk-delete ledger entries by an array of ids.
 * Returns the number of rows deleted.
 */
const bulkDeleteLedgerEntries = async (ids) => {
  return LedgerEntry.destroy({ where: { id: { [Op.in]: ids } } });
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
