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
 * Parse a full name in the format "FIRSTNAME [MI.] LASTNAME"
 * e.g. "MYRAH A. DEGUIT", "MA. LUISA C. CATIGAN", "NEIL VINCENT A. TOLENTINO"
 */
function parsePersonName(fullName) {
  const parts = fullName.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (parts.length === 0) return { first_name: '', middle_name: null, last_name: '' };
  if (parts.length === 1) return { first_name: parts[0], middle_name: null, last_name: parts[0] };

  // Find the LAST middle initial: a single letter followed by a period (e.g. "A.", "C.", "G.")
  let midIdx = -1;
  for (let i = parts.length - 2; i >= 0; i--) {
    if (/^[A-ZÑÄÖÜ]\.$/.test(parts[i])) { midIdx = i; break; }
  }

  if (midIdx === -1) {
    // No middle initial — last word is last name, rest is first name
    return {
      first_name: parts.slice(0, -1).join(' '),
      middle_name: null,
      last_name: parts[parts.length - 1],
    };
  }

  return {
    first_name: parts.slice(0, midIdx).join(' '),
    middle_name: parts[midIdx],
    last_name: parts.slice(midIdx + 1).join(' '),
  };
}

/**
 * Parse extracted PDF text into employee/loan row objects.
 * Built for the Provident Loan Fund table layout:
 *   [No] [Station] [EmpNo] [Name] [LoanAppNo] [CheckNo] [CheckDate] [LEDGER marker]
 *   [LoanAmt] [Months] [MonthlyAmort] [EffDate] [TermDate] [MonthsPaid] [MonthBal]
 *   [LoanBalance] [Rate] [Status] [Remarks] [Notes]
 */
function parsePDFText(rawText) {
  // Normalize line endings
  const lines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .split('\n').map(l => l.trim()).filter(Boolean);
  const results = [];

  // Known header / non-data lines to skip
  const SKIP = [
    /^PROVIDENT LOAN FUND/i,
    /^No\s+Station/i,
    /^Loan\s+Application\s+Number/i,
    /^No\.\s+of\s+Month/i,
    /^#\s+OF\s+PAYMENT/i,
    /^Station\s+Employee/i,
    /^Name\s+of\s+Employee/i,
  ];

  // The LEDGER column always contains one of these strings
  const LEDGER_MARKERS = ['PROVIDENT FUND - Google Sheets', 'PROVIDENT FUND- Google Sheets', 'LEDGER'];

  // Monetary amount pattern: 1,000.00 or 100,000.00
  const AMOUNT_RE = /\b(\d{1,3}(?:,\d{3})*\.\d{2})\b/g;

  for (const line of lines) {
    if (SKIP.some(p => p.test(line))) continue;
    if (line.length < 15) continue;

    // --- Step 1: must start with a row number ---
    const rowMatch = line.match(/^(\d{1,3})\s+/);
    if (!rowMatch) continue;
    const afterRowNum = line.substring(rowMatch[0].length).trim();

    // --- Step 2: find the LEDGER marker to split the line ---
    let ledgerIdx = -1;
    let ledgerMarkerLen = 0;
    for (const marker of LEDGER_MARKERS) {
      const idx = afterRowNum.indexOf(marker);
      if (idx !== -1) { ledgerIdx = idx; ledgerMarkerLen = marker.length; break; }
    }

    // --- Step 3: extract employee number (5–8 consecutive digits) ---
    const empMatch = afterRowNum.match(/\b(\d{5,8})\b/);
    if (!empMatch) continue;
    const empNo = empMatch[1];
    const empIdx = afterRowNum.indexOf(empNo);

    // Station = text between row number and employee number
    const stationRaw = afterRowNum.substring(0, empIdx).trim()
      .replace(/\(DECEASED\)/gi, '').trim();
    const station = stationRaw || 'Unknown';

    // --- Step 4: extract full name ---
    // Name is between employee number and loan application number (YYYY-NNN or YYYY-MM-NNN)
    const afterEmpNo = afterRowNum.substring(empIdx + empNo.length).trim();
    const loanAppMatch = afterEmpNo.match(/\b(\d{4}-(?:\d{2}-\d{3,4}|\d{3,4}))\b/);

    let fullName = '';
    let afterName = afterEmpNo;

    if (loanAppMatch) {
      const laidx = afterEmpNo.indexOf(loanAppMatch[1]);
      fullName = afterEmpNo.substring(0, laidx).trim();
      afterName = afterEmpNo.substring(laidx);
    } else if (ledgerIdx !== -1) {
      // Fall back: name is everything before the ledger marker (minus station/empno already consumed)
      const beforeLedger = afterRowNum.substring(empIdx + empNo.length, ledgerIdx).trim();
      // Remove check no (6-digit) and check date from end
      fullName = beforeLedger.replace(/\b\d{6}\b.*$/, '').replace(/\b\d{2}[-\/]\d{2}[-\/]\d{4}\b.*$/, '').trim();
    }

    fullName = fullName.replace(/\s+/g, ' ').trim();
    if (!fullName || fullName.length < 2) continue;

    const { first_name, middle_name, last_name } = parsePersonName(fullName);
    if (!last_name) continue;

    // --- Step 5: parse structured data after LEDGER marker ---
    let loanAmount = null, noOfMonths = null, monthlyAmort = null;
    let loanBalance = null, noOfMonthsPaid = 0;
    let checkNo = null, checkDate = null;

    // Check number: 6-digit number after loan app number
    const checkNoMatch = afterName.match(/\b(\d{6})\b/);
    if (checkNoMatch) checkNo = checkNoMatch[1];

    // Check date: MM-DD-YYYY or M/DD/YYYY before the ledger marker
    const checkDateMatch = afterName.match(/\b(\d{1,2}[-\/]\d{2}[-\/]\d{4})\b/);
    if (checkDateMatch) checkDate = checkDateMatch[1].replace(/-/g, '/');

    if (ledgerIdx !== -1) {
      const afterLedger = afterRowNum.substring(ledgerIdx + ledgerMarkerLen).trim();

      // Collect all monetary amounts in order
      const amounts = [];
      let am;
      const amRe = new RegExp(AMOUNT_RE.source, 'g');
      while ((am = amRe.exec(afterLedger)) !== null) {
        amounts.push(parseFloat(am[1].replace(/,/g, '')));
      }

      loanAmount = amounts[0] || null;           // first amount
      monthlyAmort = amounts[1] || null;          // second amount
      loanBalance = amounts[amounts.length - 1] || null; // last amount

      // No. of months: common values 12,24,36,48,60,72,84,96,108,120
      const monthsMatch = afterLedger.match(/\b(12|24|36|48|60|72|84|96|108|120)\b/);
      noOfMonths = monthsMatch ? parseInt(monthsMatch[1]) : null;

      // Extract small integers after the amounts (months paid, month balance)
      // These appear as standalone integers between termination date and loan balance
      const smallInts = [];
      const intRe = /\b(\d{1,3})\b/g;
      let im;
      while ((im = intRe.exec(afterLedger)) !== null) {
        const n = parseInt(im[1]);
        if (n >= 0 && n <= 120) smallInts.push(n);
      }
      // months paid is typically the first small int that is NOT the no_of_months value
      const candidatePaid = smallInts.filter(n => n !== noOfMonths && n > 0);
      noOfMonthsPaid = candidatePaid[0] ?? 0;
    }

    // --- Step 6: status ---
    let status = 'active';
    if (/NOT QUALIFIED FOR RE-LOAN/i.test(line)) status = 'NOT QUALIFIED';
    else if (/QUALIFIED FOR RE-LOAN/i.test(line)) status = 'QUALIFIED FOR RENEWAL';
    else if (/DECEASED/i.test(line)) status = 'inactive';
    else if (/FULLY PAID/i.test(line)) status = 'fully_paid';

    // --- Step 7: remarks after status keyword ---
    let remarks = '';
    const statusKw = line.match(/(NOT QUALIFIED FOR RE-LOAN|QUALIFIED FOR RE-LOAN|DECEASED|FULLY PAID)/i);
    if (statusKw) {
      remarks = line.substring(line.indexOf(statusKw[0]) + statusKw[0].length).trim();
    }

    results.push({
      employee_number: empNo,
      first_name: first_name.toUpperCase(),
      last_name: last_name.toUpperCase(),
      middle_name: middle_name ? middle_name.toUpperCase() : null,
      station: station.toUpperCase(),
      check_number: checkNo,
      check_date: checkDate,
      loan_amount: loanAmount,
      no_of_months: noOfMonths,
      monthly_amortization: monthlyAmort,
      no_of_months_paid: noOfMonthsPaid,
      loan_balance: loanBalance,
      status,
      remarks: remarks.trim(),
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
          station: row.station || 'Unknown',
          first_name: (row.first_name || '').toUpperCase(),
          last_name: (row.last_name || '').toUpperCase(),
          middle_name: row.middle_name ? row.middle_name.toUpperCase() : null,
          position: row.position || 'Staff',
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
            await db.createLoanDirect({
              employee_number: empNum,
              loan_amount: loanAmt,
              no_of_months: noOfMonths,
              monthly_amortization: parseNum(row.monthly_amortization),
              effective_date: parseDate(row.effective_date),
              loan_application_date: parseDate(row.loan_application_date),
              check_number: row.check_number || null,
              check_date: parseDate(row.check_date),
              termination_date: parseDate(row.termination_date),
              loan_balance: parseNum(row.loan_balance),
              no_of_months_paid: parseNum(row.no_of_months_paid) || 0,
              status: row.status || 'active',
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
