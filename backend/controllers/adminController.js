const db = require('../database/db');
const pdfParse = require('pdf-parse');

// ==================== CSV / PDF HELPERS ====================

function parseCSVText(content) {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        row.push(field.trim());
        field = '';
      } else {
        field += ch;
      }
    }
    row.push(field.trim());
    rows.push(row);
  }
  return rows;
}

function parseDate(str) {
  if (!str || !str.trim()) return null;
  const s = str.trim();
  // MM/DD/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function parseNum(str) {
  if (str === null || str === undefined || str === '') return null;
  const n = parseFloat(String(str).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

/**
 * Parse extracted PDF text into employee/loan row objects.
 * Handles the Provident Loan Fund table layout.
 */
function parsePDFText(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const results = [];

  // Skip known header/section lines
  const SKIP = [
    /^#/, /^no\b/i, /^station/i, /^employee.*(number|no)/i,
    /^name\b/i, /^loan/i, /^check/i, /^effective/i,
    /^monthly/i, /^termination/i, /^balance/i, /^status/i,
    /^remarks/i, /^notes/i, /^discharges/i, /^active loans/i,
    /^provident/i, /^prepared/i, /^approved/i, /^page/i,
  ];

  const DATE_RE = /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/g;
  // Name pattern: ALL-CAPS LAST, FIRST (optional MIDDLE)
  const NAME_RE = /([A-ZÑÄÖÜ][A-ZÑÄÖÜ\s\-\']+),\s*([A-ZÑÄÖÜ][A-ZÑÄÖÜ\s\-\']+?)(?:,\s*([A-ZÑÄÖÜ][A-ZÑÄÖÜ\s\-\']+?))?(?=\s{2,}|\s+\d|\s+[A-Z]{2,}\s|$)/;

  for (const line of lines) {
    if (SKIP.some(p => p.test(line))) continue;
    if (line.length < 10) continue;

    // Extract dates
    const dates = [];
    let dm;
    const dateClone = new RegExp(DATE_RE.source, 'g');
    while ((dm = dateClone.exec(line)) !== null) dates.push(dm[1]);

    // Extract numbers (amounts, months, etc.)
    const numRe = /\b(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\b/g;
    const nums = [];
    let nm;
    while ((nm = numRe.exec(line)) !== null) {
      const n = parseFloat(nm[1].replace(/,/g, ''));
      nums.push(n);
    }

    // Must look like a data row: has a name in LAST, FIRST format
    const nameMatch = NAME_RE.exec(line);
    if (!nameMatch) continue;

    const last_name = nameMatch[1].trim();
    const first_name = nameMatch[2].trim();
    const middle_name = nameMatch[3]?.trim() || null;

    // Everything before the name
    const beforeName = line.substring(0, nameMatch.index).trim();
    const tokens = beforeName.split(/\s{2,}|\t/).map(t => t.trim()).filter(Boolean);

    // Last token before name → employee number
    const emp_num = tokens.length > 0 ? tokens[tokens.length - 1] : null;
    if (!emp_num) continue;

    // Station is tokens before employee number (skip leading row-number)
    const stationTokens = tokens.slice(0, -1).filter(t => !/^\d+$/.test(t));
    const station = stationTokens.join(' ') || 'Main Office';

    // Status keyword anywhere in line
    const statusMatch = line.match(/\b(FULLY\s*PAID|QUALIFIED\s*FOR\s*RENEWAL|NOT\s*QUALIFIED|ACTIVE|DISCHARGED|INACTIVE)\b/i);
    const status = statusMatch ? statusMatch[1].replace(/\s+/g, '_').toLowerCase() : 'active';

    // Remarks / notes: text after the status keyword
    let remarks = '';
    if (statusMatch) {
      const afterStatus = line.substring(line.indexOf(statusMatch[0]) + statusMatch[0].length).trim();
      // The last chunk is often position/notes
      remarks = afterStatus;
    }

    // Numbers in order: row#, loan_amount, no_of_months, monthly_amortization, no_of_months_paid, loan_balance
    // Filter out the row number (small integer at start)
    const dataNums = nums.filter((n, i) => !(i === 0 && n < 10000 && n === Math.floor(n)));

    results.push({
      employee_number: emp_num,
      last_name,
      first_name,
      middle_name,
      station,
      loan_application_date: dates[0] || null,
      check_date: dates[1] || null,
      effective_date: dates[2] || null,
      termination_date: dates[3] || null,
      loan_amount: dataNums[0] || null,
      no_of_months: dataNums[1] || null,
      monthly_amortization: dataNums[2] || null,
      no_of_months_paid: dataNums[3] ?? 0,
      loan_balance: dataNums[4] ?? dataNums[0] ?? null,
      status,
      remarks,
      rawLine: line,
    });
  }

  return results;
}

function rowsFromCSV(csvRows) {
  if (csvRows.length < 2) return [];
  const headers = csvRows[0].map(h => h.toLowerCase().trim());
  const results = [];

  const col = (row, ...names) => {
    for (const name of names) {
      const idx = headers.findIndex(h => h.includes(name));
      if (idx !== -1) return row[idx] || '';
    }
    return '';
  };

  for (let i = 1; i < csvRows.length; i++) {
    const row = csvRows[i];
    if (!row || row.length < 3) continue;

    const empNum = col(row, 'employee number', 'employee_number', 'emp no', 'empno');
    if (!empNum || /^discharges/i.test(row[0])) continue;

    const rawName = col(row, 'name of employee', 'name');
    const nameParts = rawName.split(',').map(p => p.trim());
    const last_name = nameParts[0] || '';
    const first_name = nameParts[1] || '';
    const middle_name = nameParts[2] || null;

    if (!last_name || !first_name) continue;

    const loanAmt = parseNum(col(row, 'loan amount', 'loan_amount'));
    const noOfMonths = parseNum(col(row, 'no. of months', 'no_of_months', 'months'));
    const monthlyAmort = parseNum(col(row, 'monthly amortization', 'monthly_amortization'));
    const noMonthsPaid = parseNum(col(row, 'no. of months paid', 'no_of_months_paid', 'months paid')) ?? 0;
    const loanBal = parseNum(col(row, 'loan balance', 'loan_balance'));

    results.push({
      employee_number: empNum,
      last_name,
      first_name,
      middle_name,
      station: col(row, 'station') || 'Main Office',
      loan_application_date: col(row, 'loan application', 'loan_application_date') || null,
      check_number: col(row, 'check no', 'check_number') || null,
      check_date: col(row, 'check date', 'check_date') || null,
      effective_date: col(row, 'effective date', 'effective_date') || null,
      termination_date: col(row, 'termination date', 'termination_date') || null,
      loan_amount: loanAmt,
      no_of_months: noOfMonths,
      monthly_amortization: monthlyAmort,
      no_of_months_paid: noMonthsPaid,
      loan_balance: loanBal,
      status: col(row, 'status') || 'active',
      remarks: col(row, 'remarks') || '',
      position: col(row, 'notes', 'position') || '',
    });
  }
  return results;
}

/**
 * ADMIN CONTROLLER - Employee and Loan Management
 * Handles CRUD operations for employees, loans, and ledger entries
 */

// ==================== EMPLOYEE MANAGEMENT ====================

/**
 * GET /api/admin/employees - Get all employees
 * Query params: page, limit, position, station, status
 */
exports.getAllEmployees = async (req, res) => {
  try {
    const { page = 1, limit = 10, position, station, status } = req.query;
    const { count, rows } = await db.getEmployees({ page, limit, position, station, status });

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: count,
        totalPages: Math.ceil(count / parseInt(limit, 10))
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
exports.getEmployee = async (req, res) => {
  try {
    const { employeeNumber } = req.params;
    const employee = await db.getEmployeeByNumber(employeeNumber);

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
exports.createEmployee = async (req, res) => {
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
    
    const existingEmployee = await db.getEmployeeByNumber(employee_number);
    if (existingEmployee) {
      return res.status(409).json({
        success: false,
        error: 'Employee with this number already exists'
      });
    }

    const newEmployee = await db.createEmployee({
      employee_number,
      first_name: first_name.toUpperCase(),
      last_name: last_name.toUpperCase(),
      position: position || 'Staff',
      station: station || 'Main Office',
      email,
      phone,
      status: 'active',
      date_hired: new Date()
    });

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
exports.updateEmployee = async (req, res) => {
  try {
    const { employeeNumber } = req.params;
    const updates = req.body;
    
    const employee = await db.updateEmployee(employeeNumber, updates);

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

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
exports.deleteEmployee = async (req, res) => {
  try {
    const { employeeNumber } = req.params;
    const deleted = await db.deleteEmployee(employeeNumber);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Employee not found'
      });
    }

    res.json({
      success: true,
      data: deleted,
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
exports.getAllLoans = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, employee_number } = req.query;
    const { count, rows } = await db.getLoans({ page, limit, status, employee_number });

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: count,
        totalPages: Math.ceil(count / parseInt(limit, 10))
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
exports.getLoan = async (req, res) => {
  try {
    const { loanId } = req.params;
    const loan = await db.getLoanById(parseInt(loanId, 10));

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
exports.createLoan = async (req, res) => {
  try {
    const {
      employee_number,
      loan_amount,
      no_of_months,
      interest_rate = 2.0,
      effective_date,
      reason,
      approved_by
    } = req.body;

    if (!employee_number || !loan_amount || !no_of_months) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: employee_number, loan_amount, no_of_months'
      });
    }

    const newLoan = await db.createLoan({
      employee_number,
      loan_amount,
      no_of_months,
      interest_rate,
      effective_date,
      reason,
      approved_by
    });

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
exports.updateLoan = async (req, res) => {
  try {
    const { loanId } = req.params;
    const updates = req.body;

    const loan = await db.updateLoan(parseInt(loanId, 10), updates);

    if (!loan) {
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }

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
exports.deleteLoan = async (req, res) => {
  try {
    const { loanId } = req.params;
    const deleted = await db.deleteLoan(parseInt(loanId, 10));

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Loan not found'
      });
    }

    res.json({
      success: true,
      data: deleted,
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
exports.getAllLedgerEntries = async (req, res) => {
  try {
    const { page = 1, limit = 20, employee_number, month, year } = req.query;
    const { count, rows } = await db.getLedgerEntries({ page, limit, employee_number, month, year });

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: count,
        totalPages: Math.ceil(count / parseInt(limit, 10))
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
exports.recordPayment = async (req, res) => {
  try {
    const {
      employee_number,
      loan_id,
      amount_paid,
      payment_date,
      reference_number,
      notes
    } = req.body;

    if (!employee_number || !loan_id || !amount_paid) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: employee_number, loan_id, amount_paid'
      });
    }

    const { ledgerEntry, updatedLoan } = await db.recordPayment({
      employee_number,
      loan_id: parseInt(loan_id, 10),
      amount_paid,
      payment_date,
      reference_number,
      notes
    });

    res.status(201).json({
      success: true,
      data: {
        ledgerEntry,
        updatedLoan
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
exports.getDashboardSummary = async (req, res) => {
  try {
    const data = await db.getDashboardSummary();

    res.json({
      success: true,
      data,
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

// ==================== IMPORT ====================

/**
 * POST /api/admin/import
 * Accepts a PDF or CSV file and bulk-upserts employees + loans.
 */
exports.importEmployees = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const mime = req.file.mimetype;
    const isPDF = mime === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf');
    const isCSV = mime === 'text/csv' || mime === 'application/vnd.ms-excel' || req.file.originalname.toLowerCase().endsWith('.csv');

    if (!isPDF && !isCSV) {
      return res.status(400).json({ success: false, error: 'Only PDF or CSV files are supported' });
    }

    let parsedRows = [];
    let rawText = '';

    if (isPDF) {
      const data = await pdfParse(req.file.buffer);
      rawText = data.text;
      parsedRows = parsePDFText(rawText);
    } else {
      const content = req.file.buffer.toString('utf8');
      rawText = content;
      const csvRows = parseCSVText(content);
      parsedRows = rowsFromCSV(csvRows);
    }

    if (parsedRows.length === 0) {
      // Return first 3000 chars of raw text so the format can be diagnosed
      return res.status(400).json({
        success: false,
        error: 'No employee data found in the file. Make sure the file follows the Provident Loan Summary format.',
        debug_raw_text: rawText.substring(0, 3000),
      });
    }

    const results = { created: 0, updated: 0, loansCreated: 0, errors: [] };

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      const empNum = row.employee_number;

      try {
        // Upsert employee
        const existing = await db.getEmployeeByNumber(empNum);
        const employeePayload = {
          employee_number: empNum,
          station: row.station || 'Main Office',
          first_name: row.first_name.toUpperCase(),
          last_name: row.last_name.toUpperCase(),
          middle_name: row.middle_name ? row.middle_name.toUpperCase() : null,
          position: row.position || row.remarks || 'Staff',
          department: row.department || 'General',
          status: 'active',
        };

        if (existing) {
          await db.updateEmployee(empNum, employeePayload);
          results.updated++;
        } else {
          await db.createEmployee(employeePayload);
          results.created++;
        }

        // Create loan if loan data present and no existing loan
        const loanAmt = parseNum(row.loan_amount);
        const noOfMonths = parseNum(row.no_of_months);

        if (loanAmt > 0 && noOfMonths > 0) {
          const existingLoan = await db.findLoanByEmployeeNumber(empNum);
          if (!existingLoan) {
            await db.createLoan({
              employee_number: empNum,
              loan_amount: loanAmt,
              no_of_months: noOfMonths,
              interest_rate: 0,
              effective_date: parseDate(row.effective_date),
              loan_application_date: parseDate(row.loan_application_date),
              reason: 'Imported from summary',
              approved_by: 'Import',
              remarks: row.remarks || null,
            });
            results.loansCreated++;
          }
        }
      } catch (err) {
        results.errors.push({ row: i + 1, employee: empNum, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `Import complete: ${results.created} employees created, ${results.updated} updated, ${results.loansCreated} loans created.`,
      ...results,
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ success: false, error: 'Import failed', message: err.message });
  }
};

module.exports = exports;
