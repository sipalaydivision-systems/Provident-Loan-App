const mockdb = require('../database/mockdb');

/**
 * ADMIN CONTROLLER - Employee and Loan Management
 * Handles CRUD operations for employees, loans, and ledger entries
 */

// ==================== EMPLOYEE MANAGEMENT ====================

/**
 * GET /api/admin/employees - Get all employees
 * Query params: page, limit, position, station, status
 */
exports.getAllEmployees = (req, res) => {
  try {
    const { page = 1, limit = 10, position, station, status } = req.query;
    
    let employees = [...mockdb.employees];
    
    // Apply filters
    if (position) {
      employees = employees.filter(e => e.position === position);
    }
    if (station) {
      employees = employees.filter(e => e.station === station);
    }
    if (status) {
      employees = employees.filter(e => e.status === status);
    }
    
    // Paginate
    const startIdx = (parseInt(page) - 1) * parseInt(limit);
    const paginatedEmployees = employees.slice(startIdx, startIdx + parseInt(limit));
    
    res.json({
      success: true,
      data: paginatedEmployees,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: employees.length,
        totalPages: Math.ceil(employees.length / parseInt(limit))
      },
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employees',
      message: error.message
    });
  }
};

/**
 * GET /api/admin/employees/:employeeNumber - Get single employee
 */
exports.getEmployee = (req, res) => {
  try {
    const { employeeNumber } = req.params;
    const employee = mockdb.employees.find(e => e.employee_number === employeeNumber);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }
    
    res.json({
      success: true,
      data: employee,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employee',
      message: error.message
    });
  }
};

/**
 * POST /api/admin/employees - Create new employee
 */
exports.createEmployee = (req, res) => {
  try {
    const {
      employee_number,
      first_name,
      last_name,
      position,
      station,
      email,
      phone
    } = req.body;
    
    // Validate required fields
    if (!employee_number || !first_name || !last_name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: employee_number, first_name, last_name'
      });
    }
    
    // Check if employee already exists
    if (mockdb.employees.some(e => e.employee_number === employee_number)) {
      return res.status(409).json({
        success: false,
        error: 'Employee with this number already exists'
      });
    }
    
    const newEmployee = {
      id: Math.max(...mockdb.employees.map(e => e.id), 0) + 1,
      employee_number,
      first_name: first_name.toUpperCase(),
      last_name: last_name.toUpperCase(),
      position: position || 'Staff',
      station: station || 'Main Office',
      email,
      phone,
      status: 'active',
      date_hired: new Date(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    mockdb.employees.push(newEmployee);
    
    res.status(201).json({
      success: true,
      data: newEmployee,
      message: 'Employee created successfully',
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create employee',
      message: error.message
    });
  }
};

/**
 * PUT /api/admin/employees/:employeeNumber - Update employee
 */
exports.updateEmployee = (req, res) => {
  try {
    const { employeeNumber } = req.params;
    const updates = req.body;
    
    const employee = mockdb.employees.find(e => e.employee_number === employeeNumber);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }
    
    // Update fields
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'employee_number' && key !== 'created_at') {
        employee[key] = updates[key];
      }
    });
    employee.updated_at = new Date().toISOString();
    
    res.json({
      success: true,
      data: employee,
      message: 'Employee updated successfully',
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update employee',
      message: error.message
    });
  }
};

/**
 * DELETE /api/admin/employees/:employeeNumber - Delete employee
 */
exports.deleteEmployee = (req, res) => {
  try {
    const { employeeNumber } = req.params;
    const index = mockdb.employees.findIndex(e => e.employee_number === employeeNumber);
    
    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }
    
    const deleted = mockdb.employees.splice(index, 1);
    
    res.json({
      success: true,
      data: deleted[0],
      message: 'Employee deleted successfully',
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete employee',
      message: error.message
    });
  }
};

// ==================== LOAN MANAGEMENT ====================

/**
 * GET /api/admin/loans - Get all loans
 * Query params: page, limit, status, employee_number
 */
exports.getAllLoans = (req, res) => {
  try {
    const { page = 1, limit = 10, status, employee_number } = req.query;
    
    let loans = [...mockdb.loans];
    
    // Apply filters
    if (status) {
      loans = loans.filter(l => l.status === status);
    }
    if (employee_number) {
      loans = loans.filter(l => l.employee_number === employee_number);
    }
    
    // Paginate
    const startIdx = (parseInt(page) - 1) * parseInt(limit);
    const paginatedLoans = loans.slice(startIdx, startIdx + parseInt(limit));
    
    res.json({
      success: true,
      data: paginatedLoans,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: loans.length,
        totalPages: Math.ceil(loans.length / parseInt(limit))
      },
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch loans',
      message: error.message
    });
  }
};

/**
 * GET /api/admin/loans/:loanId - Get single loan
 */
exports.getLoan = (req, res) => {
  try {
    const { loanId } = req.params;
    const loan = mockdb.loans.find(l => l.id === parseInt(loanId));
    
    if (!loan) {
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }
    
    res.json({
      success: true,
      data: loan,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch loan',
      message: error.message
    });
  }
};

/**
 * POST /api/admin/loans - Create new loan
 */
exports.createLoan = (req, res) => {
  try {
    const {
      employee_number,
      loan_amount,
      no_of_months,
      interest_rate = 2.0,
      effective_date = new Date(),
      reason
    } = req.body;
    
    // Validate required fields
    if (!employee_number || !loan_amount || !no_of_months) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: employee_number, loan_amount, no_of_months'
      });
    }
    
    // Check if employee exists
    const employee = mockdb.employees.find(e => e.employee_number === employee_number);
    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }
    
    const monthly_amortization = (loan_amount / no_of_months).toFixed(2);
    
    const newLoan = {
      id: Math.max(...mockdb.loans.map(l => l.id), 0) + 1,
      employee_number,
      loan_amount: parseFloat(loan_amount),
      loan_balance: parseFloat(loan_amount),
      monthly_amortization: parseFloat(monthly_amortization),
      no_of_months: parseInt(no_of_months),
      no_of_months_paid: 0,
      interest_rate: parseFloat(interest_rate),
      effective_date: new Date(effective_date),
      termination_date: null,
      status: 'active',
      reason: reason || 'Personal needs',
      approved_by: 'System Admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    mockdb.loans.push(newLoan);
    
    res.status(201).json({
      success: true,
      data: newLoan,
      message: 'Loan created successfully',
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create loan',
      message: error.message
    });
  }
};

/**
 * PUT /api/admin/loans/:loanId - Update loan
 */
exports.updateLoan = (req, res) => {
  try {
    const { loanId } = req.params;
    const updates = req.body;
    
    const loan = mockdb.loans.find(l => l.id === parseInt(loanId));
    
    if (!loan) {
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }
    
    // Update fields
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'employee_number' && key !== 'created_at') {
        loan[key] = updates[key];
      }
    });
    loan.updated_at = new Date().toISOString();
    
    res.json({
      success: true,
      data: loan,
      message: 'Loan updated successfully',
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update loan',
      message: error.message
    });
  }
};

/**
 * DELETE /api/admin/loans/:loanId - Delete loan
 */
exports.deleteLoan = (req, res) => {
  try {
    const { loanId } = req.params;
    const index = mockdb.loans.findIndex(l => l.id === parseInt(loanId));
    
    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }
    
    const deleted = mockdb.loans.splice(index, 1);
    
    res.json({
      success: true,
      data: deleted[0],
      message: 'Loan deleted successfully',
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete loan',
      message: error.message
    });
  }
};

// ==================== LEDGER MANAGEMENT ====================

/**
 * GET /api/admin/ledger - Get all ledger entries
 * Query params: page, limit, employee_number, month, year
 */
exports.getAllLedgerEntries = (req, res) => {
  try {
    const { page = 1, limit = 20, employee_number, month, year } = req.query;
    
    let entries = [...mockdb.ledger];
    
    // Apply filters
    if (employee_number) {
      entries = entries.filter(e => e.employee_number === employee_number);
    }
    if (month && year) {
      entries = entries.filter(e => {
        const entryDate = new Date(e.date_of_deduction || e.payment_date);
        return entryDate.getMonth() + 1 === parseInt(month) && entryDate.getFullYear() === parseInt(year);
      });
    }
    
    // Paginate
    const startIdx = (parseInt(page) - 1) * parseInt(limit);
    const paginatedEntries = entries.slice(startIdx, startIdx + parseInt(limit));
    
    res.json({
      success: true,
      data: paginatedEntries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: entries.length,
        totalPages: Math.ceil(entries.length / parseInt(limit))
      },
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ledger entries',
      message: error.message
    });
  }
};

/**
 * POST /api/admin/ledger/record-payment - Record payment
 */
exports.recordPayment = (req, res) => {
  try {
    const {
      employee_number,
      loan_id,
      amount_paid,
      payment_date = new Date(),
      reference_number,
      notes
    } = req.body;
    
    // Validate required fields
    if (!employee_number || !loan_id || !amount_paid) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: employee_number, loan_id, amount_paid'
      });
    }
    
    // Find the loan
    const loan = mockdb.loans.find(l => l.id === parseInt(loan_id));
    if (!loan) {
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }
    
    // Update loan balance
    const previousBalance = loan.loan_balance;
    loan.loan_balance = Math.max(0, loan.loan_balance - parseFloat(amount_paid));
    loan.no_of_months_paid += 1;
    
    // Check if loan is fully paid
    if (loan.loan_balance <= 0) {
      loan.status = 'fully_paid';
      loan.termination_date = new Date();
      loan.loan_balance = 0;
    }
    
    // Create ledger entry
    const newEntry = {
      id: Math.max(...mockdb.ledger.map(e => e.id), 0) + 1,
      employee_number,
      loan_id: parseInt(loan_id),
      payment_date: new Date(payment_date),
      amount_paid: parseFloat(amount_paid),
      previous_balance: parseFloat(previousBalance),
      new_balance: loan.loan_balance,
      reference_number: reference_number || `PAY-${Date.now()}`,
      recorded_by: 'System Admin',
      notes: notes || '',
      created_at: new Date().toISOString()
    };
    
    mockdb.ledger.push(newEntry);
    
    res.status(201).json({
      success: true,
      data: {
        ledgerEntry: newEntry,
        updatedLoan: loan
      },
      message: 'Payment recorded successfully',
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to record payment',
      message: error.message
    });
  }
};

/**
 * GET /api/admin/dashboard/summary - Dashboard summary statistics
 */
exports.getDashboardSummary = (req, res) => {
  try {
    const totalEmployees = mockdb.employees.length;
    const activeLoans = mockdb.loans.filter(l => {
      const s = (l.status || '').toUpperCase();
      return s === 'ACTIVE' || s.includes('QUALIFIED') || s === 'NOT QUALIFIED';
    }).length;
    const fullyPaidLoans = mockdb.loans.filter(l => (l.status || '').toUpperCase().includes('FULLY')).length;
    const totalLoanAmount = mockdb.loans.reduce((sum, l) => sum + l.loan_amount, 0);
    const totalLoanBalance = mockdb.loans.reduce((sum, l) => sum + l.loan_balance, 0);
    const totalAmortization = mockdb.loans.reduce((sum, l) => sum + l.monthly_amortization, 0);
    const totalPaymentsRecorded = mockdb.ledger.reduce((sum, e) => sum + (e.monthly_payment_amount || e.amount_paid || 0), 0);
    
    res.json({
      success: true,
      data: {
        employees: {
          total: totalEmployees,
          active: mockdb.employees.filter(e => e.status === 'active').length
        },
        loans: {
          total: mockdb.loans.length,
          active: activeLoans,
          fullyPaid: fullyPaidLoans,
          totalAmount: totalLoanAmount,
          remainingBalance: totalLoanBalance,
          monthlyAmortization: totalAmortization
        },
        payments: {
          totalRecorded: totalPaymentsRecorded,
          entriesCount: mockdb.ledger.length,
          averagePayment: mockdb.ledger.length > 0 ? (totalPaymentsRecorded / mockdb.ledger.length).toFixed(2) : 0
        }
      },
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard summary',
      message: error.message
    });
  }
};

module.exports = exports;
