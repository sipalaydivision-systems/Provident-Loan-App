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
 *
 * PDF column order (Provident Loan Fund Summary):
 *   [No] [Station] [EmpNo] [Name] [LoanAppNo] [CheckNo] [CheckDate] | LEDGER MARKER |
 *   [LoanAmt] [NoOfMonths] [MonthlyAmort] [EffectiveDate] [TerminationDate]
 *   [NoOfMonthsPaid] [LoanBalance] [Status] [Remarks]
 *
 * Database mapping:
 *   employees  → employee_number, station, first_name, middle_name, last_name
 *   loans      → loan_amount, no_of_months, monthly_amortization, loan_application_date,
 *                check_number, check_date, effective_date, termination_date,
 *                no_of_months_paid, loan_balance, status, remarks
 *   ledger     → created automatically from no_of_months_paid × monthly_amortization
 */
function parsePDFText(rawText) {
  // ── Normalise ─────────────────────────────────────────────────────────────
  const text = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\f/g, '\n');   // form-feed = page break

  // ── Locate every data LEDGER marker ──────────────────────────────────────
  // Each data row contains either "PROVIDENT FUND - Google Sheets" (hyperlink text)
  // or the word "LEDGER" alone (used for DECEASED rows that have no Sheets link).
  // The column header also has the word "LEDGER" — we skip that one.
  const markers = [];

  for (const pf of ['PROVIDENT FUND - Google Sheets', 'PROVIDENT FUND- Google Sheets']) {
    let pos = 0;
    while ((pos = text.indexOf(pf, pos)) !== -1) {
      markers.push({ start: pos, end: pos + pf.length });
      pos += pf.length;
    }
  }

  // Standalone "LEDGER" — only if surrounded by what looks like data, not header text
  const ledgerRe = /\bLEDGER\b/g;
  let lm;
  while ((lm = ledgerRe.exec(text)) !== null) {
    if (markers.some(m => m.start <= lm.index && lm.index < m.end)) continue;
    const ctx = text.substring(Math.max(0, lm.index - 120), lm.index + 60).toLowerCase();
    // Header row: contains both "check date" and "loan amount" near LEDGER
    if (ctx.includes('check date') && ctx.includes('loan amount')) continue;
    markers.push({ start: lm.index, end: lm.index + 6 });
  }

  markers.sort((a, b) => a.start - b.start);
  if (markers.length === 0) return [];

  const results = [];

  for (let i = 0; i < markers.length; i++) {
    const { start: mStart, end: mEnd } = markers[i];

    // ── Pre-context: text immediately before this LEDGER marker ──────────
    // Use a 700-char lookback window so that regardless of whether the PDF
    // text is one-row-per-line or split cell-by-cell, we capture the employee
    // info that precedes this marker.
    const preRaw = text.substring(Math.max(0, mStart - 700), mStart);
    const preText = preRaw.replace(/\s+/g, ' ').trim();

    // ── Post-context: text immediately after this LEDGER marker ───────────
    const nextMStart = i < markers.length - 1 ? markers[i + 1].start : text.length;
    const postRaw = text.substring(mEnd, Math.min(nextMStart, mEnd + 700));
    const postText = postRaw.replace(/\s+/g, ' ').trim();

    // ── Employee number: 5–8 consecutive digits (last occurrence in preText) ──
    // Station codes are 2–4 digits, so 5-8 digit requirement isolates employee IDs.
    const empNoMatches = [...preText.matchAll(/\b(\d{5,8})\b/g)];
    if (empNoMatches.length === 0) continue;          // e.g. row 5 (DECEASED, no EmpNo)
    const lastEmp = empNoMatches[empNoMatches.length - 1];
    const empNo   = lastEmp[1];
    const empNoIdx = lastEmp.index;

    // ── Station ──────────────────────────────────────────────────────────
    const beforeEmp = preText.substring(0, empNoIdx);
    let employeeStatus = 'active';
    if (/DECEASED/i.test(beforeEmp)) employeeStatus = 'inactive';

    const stationNums = beforeEmp.replace(/\(DECEASED\)/gi, '').match(/\b(\d{2,4})\b/g);
    const station = stationNums ? stationNums[stationNums.length - 1] : 'Unknown';

    // ── Name + Loan Application Number ───────────────────────────────────
    const afterEmpNo = preText.substring(empNoIdx + empNo.length).trim();

    // Loan app pattern: YYYY-NNN  or  YYYY-MM-NNN  (or YYYY-MM-NNNN)
    const loanAppRe  = /\b(\d{4}-(?:\d{2}-\d{3,5}|\d{3,5}))\b/;
    const loanAppMatch = afterEmpNo.match(loanAppRe);

    let fullName = '';
    let afterName = afterEmpNo;

    if (loanAppMatch) {
      const laIdx = afterEmpNo.indexOf(loanAppMatch[1]);
      fullName  = afterEmpNo.substring(0, laIdx).trim();
      afterName = afterEmpNo.substring(laIdx);
    } else {
      // No loan app number — name ends at the first 6-digit number or a date
      fullName = afterEmpNo
        .replace(/\b\d{6}\b[\s\S]*$/, '')
        .replace(/\b\d{1,2}[-\/]\d{1,2}[-\/]\d{4}\b[\s\S]*$/, '')
        .trim();
    }

    fullName = fullName.replace(/\(DECEASED\)/gi, '').replace(/\s+/g, ' ').trim();
    if (!fullName || fullName.length < 2) continue;

    const { first_name, middle_name, last_name } = parsePersonName(fullName);
    if (!last_name) continue;

    // ── Loan application date (derived from app number) ───────────────────
    // "2023-07-001" → 07/01/2023     "2021-005" → 01/01/2021
    let loanApplicationDate = null;
    if (loanAppMatch) {
      const parts = loanAppMatch[1].split('-');
      const year  = parts[0];
      const month = parts.length >= 3 && parts[1].length === 2 ? parts[1] : '01';
      loanApplicationDate = `${month}/01/${year}`;
    }

    // ── Check number (6 digits) and check date (before LEDGER marker) ─────
    const checkNoM   = afterName.match(/\b(\d{6})\b/);
    const checkNo    = checkNoM ? checkNoM[1] : null;
    const checkDateM = afterName.match(/\b(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})\b/);
    const checkDate  = checkDateM ? checkDateM[1].replace(/-/g, '/') : null;

    // ── Loan data from postText (after LEDGER marker) ─────────────────────
    let loanAmount = null, noOfMonths = null, monthlyAmort = null;
    let loanBalance = null, noOfMonthsPaid = 0;
    let effectiveDate = null, terminationDate = null;

    // Monetary amounts — comma-formatted with 2 decimals
    // PDF column order: LoanAmount · MonthlyAmort · … · LoanBalance
    const amounts = [];
    const amRe = /\b(\d{1,3}(?:,\d{3})*\.\d{2})\b/g;
    let am;
    while ((am = amRe.exec(postText)) !== null) {
      amounts.push(parseFloat(am[1].replace(/,/g, '')));
    }
    if (amounts.length >= 1) loanAmount   = amounts[0];
    if (amounts.length >= 2) monthlyAmort = amounts[1];
    if (amounts.length >= 1) loanBalance  = amounts[amounts.length - 1];

    // No. of months (loan term) — only standard values
    const monthsM = postText.match(/\b(12|24|36|48|60|72|84|96|108|120)\b/);
    noOfMonths = monthsM ? parseInt(monthsM[1]) : null;

    // Dates after LEDGER: MM/DD/YYYY — 1st = Effective, 2nd = Termination
    const datesInPost = [...postText.matchAll(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/g)];
    if (datesInPost[0]) effectiveDate   = datesInPost[0][1].replace(/-/g, '/');
    if (datesInPost[1]) terminationDate = datesInPost[1][1].replace(/-/g, '/');

    // No. of months paid — small integer not equal to the loan term
    const postNoDates = postText.replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\b/g, ' ');
    const paidCandidates = [];
    const intRe = /\b(\d{1,3})\b/g;
    let im;
    while ((im = intRe.exec(postNoDates)) !== null) {
      const n = parseInt(im[1]);
      if (n > 0 && n <= 120 && n !== noOfMonths) paidCandidates.push(n);
    }
    noOfMonthsPaid = paidCandidates[0] ?? 0;

    // ── Status ────────────────────────────────────────────────────────────
    const combined = preText + ' ' + postText;
    let status = 'active';
    if (/NOT QUALIFIED FOR RE-LOAN/i.test(combined))     status = 'NOT QUALIFIED FOR RENEWAL';
    else if (/QUALIFIED FOR RE-LOAN/i.test(combined))    status = 'QUALIFIED FOR RENEWAL';
    else if (/DECEASED/i.test(combined))               { status = 'DECEASED'; employeeStatus = 'inactive'; }
    else if (/FULLY PAID/i.test(postText))               status = 'fully_paid';

    // ── Remarks ───────────────────────────────────────────────────────────
    let remarks = '';
    const statusKwM = combined.match(
      /(NOT QUALIFIED FOR RE-LOAN|QUALIFIED FOR RE-LOAN|FULLY PAID|DECEASED)/i
    );
    if (statusKwM) {
      const kwPos = combined.indexOf(statusKwM[0]) + statusKwM[0].length;
      remarks = combined.substring(kwPos)
        .trim()
        .replace(/^\s*\d{1,3}\s+\d{2,4}\s+/, '')   // strip next row's num+station
        .split(/\b\d{1,3}\s+(?:\d{2,4}|\bDECEASED\b)/)[0]
        .trim()
        .substring(0, 300);
    }

    results.push({
      employee_number:         empNo,
      station:                 station,
      first_name:              first_name.toUpperCase(),
      middle_name:             middle_name ? middle_name.toUpperCase() : null,
      last_name:               last_name.toUpperCase(),
      employee_status:         employeeStatus,
      loan_application_date:   loanApplicationDate,
      loan_application_number: loanAppMatch ? loanAppMatch[1] : null,
      check_number:            checkNo,
      check_date:              checkDate,
      effective_date:          effectiveDate,
      termination_date:        terminationDate,
      loan_amount:             loanAmount,
      no_of_months:            noOfMonths,
      monthly_amortization:    monthlyAmort,
      no_of_months_paid:       noOfMonthsPaid,
      loan_balance:            loanBalance,
      status,
      remarks,
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
 * PUT /api/admin/ledger/:entryId - Update a ledger entry
 */
exports.updateLedgerEntry = async (req, res) => {
  try {
    const { entryId } = req.params;
    const updates = req.body;
    const entry = await db.updateLedgerEntry(parseInt(entryId, 10), updates);
    if (!entry) {
      return res.status(404).json({ success: false, error: 'Ledger entry not found' });
    }
    res.json({ success: true, data: entry, message: 'Ledger entry updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update ledger entry', message: error.message });
  }
};

/**
 * DELETE /api/admin/ledger/:entryId - Delete a ledger entry
 */
exports.deleteLedgerEntry = async (req, res) => {
  try {
    const { entryId } = req.params;
    const deleted = await db.deleteLedgerEntry(parseInt(entryId, 10));
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Ledger entry not found' });
    }
    res.json({ success: true, data: deleted, message: 'Ledger entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete ledger entry', message: error.message });
  }
};

/**
 * GET /api/admin/employees/:employeeNumber/ledger
 * Returns employee info + all loans with their ledger entries
 */
exports.getEmployeeLedger = async (req, res) => {
  try {
    const { employeeNumber } = req.params;
    const employee = await db.getEmployeeByNumber(employeeNumber);
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }
    const loans = await db.getLoansByEmployee(employeeNumber);
    const loansWithLedger = await Promise.all(
      loans.map(async (loan) => {
        const entries = await db.getLedgerByLoanId(loan.id);
        return { ...loan.toJSON(), ledger_entries: entries.map(e => e.toJSON()) };
      })
    );
    res.json({
      success: true,
      data: { employee: employee.toJSON(), loans: loansWithLedger }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch employee ledger', message: error.message });
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

    const results = { created: 0, updated: 0, loansCreated: 0, loansUpdated: 0, ledgerCreated: 0, errors: [] };

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      const empNum = row.employee_number;

      try {
        // ── 1. Upsert employee ────────────────────────────────────────────
        // Maps to: employees.employee_number, station, first_name, middle_name,
        //          last_name, status
        const existing = await db.getEmployeeByNumber(empNum);
        const employeePayload = {
          employee_number: empNum,
          station:      row.station    || 'Unknown',
          first_name:   (row.first_name  || '').toUpperCase(),
          last_name:    (row.last_name   || '').toUpperCase(),
          middle_name:  row.middle_name  ? row.middle_name.toUpperCase() : null,
          position:     row.position    || 'Staff',
          department:   row.department  || 'General',
          // DECEASED employees become inactive; everyone else stays active
          status:       row.employee_status || 'active',
        };

        if (existing) {
          await db.updateEmployee(empNum, employeePayload);
          results.updated++;
        } else {
          await db.createEmployee(employeePayload);
          results.created++;
        }

        // ── 2. Upsert loan ────────────────────────────────────────────────
        // Maps to: loans.employee_number, loan_application_date, check_number,
        //          check_date, effective_date, termination_date, loan_amount,
        //          no_of_months, monthly_amortization, no_of_months_paid,
        //          loan_balance, status, remarks
        const loanAmt    = parseNum(row.loan_amount);
        const noOfMonths = parseNum(row.no_of_months);
        const monthlyAmort  = parseNum(row.monthly_amortization);
        const loanBalance   = parseNum(row.loan_balance);
        const noOfMonthsPaid = parseInt(row.no_of_months_paid) || 0;

        if (loanAmt > 0) {
          const loanPayload = {
            employee_number:      empNum,
            loan_application_date: parseDate(row.loan_application_date),  // derived from app number
            check_number:         row.check_number   || null,
            check_date:           parseDate(row.check_date),
            effective_date:       parseDate(row.effective_date),          // 1st date after LEDGER
            termination_date:     parseDate(row.termination_date),        // 2nd date after LEDGER
            loan_amount:          loanAmt,
            no_of_months:         noOfMonths || 0,
            monthly_amortization: monthlyAmort,
            no_of_months_paid:    noOfMonthsPaid,
            loan_balance:         loanBalance !== null ? loanBalance : loanAmt,
            status:               row.status  || 'active',
            remarks:              row.remarks  || null,
            reason:               'Imported from Provident Fund Summary',
            approved_by:          'Import',
            interest_rate:        0,
          };

          const existingLoan = await db.findLoanByEmployeeNumber(empNum);
          let loan;
          if (existingLoan) {
            // Update all fields — re-import always refreshes data
            await db.updateLoan(existingLoan.id, loanPayload);
            loan = await db.getLoanById(existingLoan.id);
            results.loansUpdated++;
          } else {
            loan = await db.createLoanDirect(loanPayload);
            results.loansCreated++;
          }

          // ── 3. Ledger entry for months already paid ───────────────────
          // Maps to: ledger_entries.employee_number, loan_id, amount_paid,
          //          previous_balance, new_balance, no_of_months_paid,
          //          reference_number, notes
          //
          // We create ONE aggregate entry per loan (representing all payments
          // made to date) so the Payments section is populated. Skip if a
          // ledger entry already exists for this loan.
          if (noOfMonthsPaid > 0) {
            const loanId = loan.id || loan.dataValues?.id;
            const hasEntries = await db.hasLedgerEntries(loanId);
            if (!hasEntries) {
              // total paid = loan_amount − current loan_balance
              const totalPaid = loanBalance !== null
                ? Math.max(0, loanAmt - loanBalance)
                : (monthlyAmort || 0) * noOfMonthsPaid;

              await db.createLedgerEntry({
                employee_number:        empNum,
                loan_id:                loanId,
                payment_date:           parseDate(row.effective_date) || new Date(),
                amount_paid:            totalPaid > 0 ? totalPaid : (monthlyAmort || 0) * noOfMonthsPaid,
                previous_balance:       loanAmt,
                new_balance:            loanBalance !== null ? loanBalance : 0,
                reference_number:       `IMPORT-${empNum}`,
                recorded_by:            'Import',
                notes:                  `Imported summary – ${noOfMonthsPaid} month(s) paid`,
                payment_month:          null,
                date_of_deduction:      parseDate(row.effective_date) || null,
                payment_with_interest:  null,
                principal_payments:     totalPaid > 0 ? totalPaid : null,
                paid_status:            true,
                monthly_payment_amount: monthlyAmort || null,
                paid_months:            noOfMonthsPaid,
                balance:                loanBalance !== null ? loanBalance : 0,
              });
              results.ledgerCreated++;
            }
          }
        }
      } catch (err) {
        results.errors.push({ row: i + 1, employee: empNum, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `Import complete: ${results.created} employees created, ${results.updated} updated, ${results.loansCreated} loans created, ${results.loansUpdated} loans updated, ${results.ledgerCreated} payment records added.`,
      ...results,
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ success: false, error: 'Import failed', message: err.message });
  }
};

module.exports = exports;
