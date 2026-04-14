const mockdb = require('../database/mockdb');

/**
 * Build the joined loan-summary rows used by both the JSON and CSV endpoints.
 * Each row matches the spreadsheet columns exactly.
 */
function buildReportRows() {
  const rows = [];

  mockdb.employees.forEach((emp) => {
    const loan = mockdb.loans.find((l) => l.employee_number === emp.employee_number);

    const fullName = [emp.last_name, emp.first_name, emp.middle_name]
      .filter(Boolean)
      .join(', ');

    rows.push({
      station: emp.station || '',
      employee_number: emp.employee_number,
      name: fullName,
      loan_application_date: loan?.loan_application_date
        ? formatDate(loan.loan_application_date)
        : '',
      check_number: loan?.check_number || '',
      check_date: loan?.check_date ? formatDate(loan.check_date) : '',
      effective_date: loan?.effective_date ? formatDate(loan.effective_date) : '',
      loan_amount: loan?.loan_amount ?? '',
      no_of_months: loan?.no_of_months ?? '',
      monthly_amortization: loan?.monthly_amortization ?? '',
      termination_date: loan?.termination_date
        ? formatDate(loan.termination_date)
        : '',
      no_of_months_paid: loan?.no_of_months_paid ?? 0,
      loan_balance: loan?.loan_balance ?? '',
      status: loan?.status || 'NO LOAN',
      remarks: loan?.remarks || '',
      notes: emp.position || '',
    });
  });

  // Sort: active/qualified first, discharges (fully_paid / no loan) last
  rows.sort((a, b) => {
    const rank = (s) => {
      if (!s || s === 'NO LOAN') return 3;
      if (s.toUpperCase().includes('FULLY') || s.toUpperCase().includes('PAID')) return 2;
      return 1;
    };
    return rank(a.status) - rank(b.status);
  });

  return rows;
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/**
 * GET /api/admin/report/loan-summary
 * Returns the report rows as JSON.
 */
exports.getLoanSummary = (req, res) => {
  try {
    const rows = buildReportRows();
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/admin/report/loan-summary/csv
 * Streams a CSV file matching the Provident Loan Fund spreadsheet layout.
 */
exports.exportLoanSummaryCsv = (req, res) => {
  try {
    const rows = buildReportRows();

    const headers = [
      '#',
      'Station',
      'Employee Number',
      'Name of Employee',
      'Loan Application Date',
      'Check No.',
      'Check Date',
      'Effective Date',
      'Loan Amount',
      'No. of Months',
      'Monthly Amortization',
      'Termination Date',
      'No. of Months Paid',
      'Loan Balance',
      'Status',
      'Remarks',
      'Notes',
    ];

    const escape = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const lines = [headers.map(escape).join(',')];

    // Active / qualified group header
    const activeRows = rows.filter(
      (r) =>
        r.status &&
        !r.status.toUpperCase().includes('FULLY') &&
        r.status !== 'NO LOAN'
    );
    const dischargedRows = rows.filter(
      (r) =>
        !r.status ||
        r.status.toUpperCase().includes('FULLY') ||
        r.status === 'NO LOAN'
    );

    let rowNum = 1;

    activeRows.forEach((r) => {
      lines.push(
        [
          rowNum++,
          r.station,
          r.employee_number,
          r.name,
          r.loan_application_date,
          r.check_number,
          r.check_date,
          r.effective_date,
          r.loan_amount,
          r.no_of_months,
          r.monthly_amortization,
          r.termination_date,
          r.no_of_months_paid,
          r.loan_balance,
          r.status,
          r.remarks,
          r.notes,
        ]
          .map(escape)
          .join(',')
      );
    });

    if (dischargedRows.length > 0) {
      // Section separator row
      lines.push(
        ['DISCHARGES', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']
          .map(escape)
          .join(',')
      );
      dischargedRows.forEach((r) => {
        lines.push(
          [
            rowNum++,
            r.station,
            r.employee_number,
            r.name,
            r.loan_application_date,
            r.check_number,
            r.check_date,
            r.effective_date,
            r.loan_amount,
            r.no_of_months,
            r.monthly_amortization,
            r.termination_date,
            r.no_of_months_paid,
            r.loan_balance,
            r.status,
            r.remarks,
            r.notes,
          ]
            .map(escape)
            .join(',')
        );
      });
    }

    const csv = lines.join('\r\n');
    const filename = `provident-loan-summary-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
