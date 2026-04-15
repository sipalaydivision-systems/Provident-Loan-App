const { Sequelize, DataTypes, Op } = require('sequelize');

const connectionString = process.env.DATABASE_URL || process.env.DB_URL;
const dialect = process.env.DB_DIALECT || 'mysql';

const sequelize = connectionString
  ? new Sequelize(connectionString, {
      dialect,
      logging: false,
      dialectOptions: {
        decimalNumbers: true
      }
    })
  : new Sequelize(
      process.env.DB_NAME || 'provident_loan',
      process.env.DB_USER || 'root',
      process.env.DB_PASS || '',
      {
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 3306,
        dialect,
        logging: false,
        dialectOptions: {
          decimalNumbers: true,
          charset: 'utf8mb4'
        }
      }
    );

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
    interest_rate: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 0 }
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
  const monthlyAmortization = parseFloat((loanAmount / months).toFixed(2));

  return Loan.create({
    employee_number: payload.employee_number,
    loan_amount: loanAmount,
    no_of_months: months,
    monthly_amortization: monthlyAmortization,
    loan_application_date: payload.loan_application_date || new Date(),
    effective_date: payload.effective_date || new Date(),
    loan_balance: loanAmount,
    no_of_months_paid: 0,
    status: 'active',
    interest_rate: parseFloat(payload.interest_rate) || 0,
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

  const payment = parseFloat(amount_paid);
  const previousBalance = parseFloat(loan.loan_balance);
  const newBalance = Math.max(0, previousBalance - payment);
  const paidMonths = loan.no_of_months_paid + 1;
  const updatedLoan = await loan.update({
    loan_balance: newBalance,
    no_of_months_paid: paidMonths,
    status: newBalance <= 0 ? 'fully_paid' : loan.status,
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
    payment_with_interest: null,
    principal_payments: null,
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
  return Loan.create({
    employee_number: payload.employee_number,
    loan_amount: loanAmount,
    no_of_months: parseInt(payload.no_of_months) || 0,
    monthly_amortization: parseFloat(payload.monthly_amortization) || parseFloat((loanAmount / (parseInt(payload.no_of_months) || 1)).toFixed(2)),
    loan_application_date: payload.loan_application_date || null,
    check_number: payload.check_number || null,
    check_date: payload.check_date || null,
    effective_date: payload.effective_date || null,
    termination_date: payload.termination_date || null,
    loan_balance: parseFloat(payload.loan_balance) ?? loanAmount,
    no_of_months_paid: parseInt(payload.no_of_months_paid) || 0,
    status: payload.status || 'active',
    remarks: payload.remarks || null,
    reason: 'Imported from summary',
    approved_by: 'Import',
    interest_rate: 0,
  });
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
    conditions.push({ first_name: { [Op.like]: `%${firstNameValue}%` } });
    conditions.push({ last_name: { [Op.like]: `%${firstNameValue}%` } });
  }
  if (lastNameValue) {
    conditions.push({ last_name: { [Op.like]: `%${lastNameValue}%` } });
  }

  const where = conditions.length > 0 ? { [Op.or]: conditions } : {};

  return Employee.findAll({ where, limit: 25, order: [['created_at', 'DESC']] });
};

const getAllEmployees = async () => Employee.findAll({ order: [['created_at', 'DESC']] });
const getAllLoans = async () => Loan.findAll({ order: [['created_at', 'DESC']] });

const getDashboardSummary = async () => {
  const totalEmployees = await Employee.count();
  const totalLoans = await Loan.count();
  const activeLoans = await Loan.count({ where: { status: { [Op.in]: ['active', 'QUALIFIED FOR RENEWAL', 'NOT QUALIFIED'] } } });
  const fullyPaidLoans = await Loan.count({ where: { status: { [Op.like]: '%FULLY%' } } });
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
  findEmployeesByName,
  getAllEmployees,
  getAllLoans,
  getDashboardSummary
};
