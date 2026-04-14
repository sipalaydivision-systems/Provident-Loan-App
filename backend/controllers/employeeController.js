const db = require('../database/db');

// Search for employee loan data
exports.search = async (req, res) => {
  try {
    const { employee_number, first_name, last_name, search_query } = req.body;

    let employee = null;
    let loan = null;
    let ledgerSummary = null;

    // Search by employee number
    if (employee_number) {
      employee = await db.getEmployeeByNumber(employee_number);
      if (employee) {
        loan = await db.findLoanByEmployeeNumber(employee_number);
        const ledgerCards = await db.getLedgerByEmployeeNumber(employee_number);
        ledgerSummary = {
          total_months: ledgerCards.length,
          last_payment: ledgerCards[ledgerCards.length - 1] || null
        };
      }
    }
    // Search by name
    else if (search_query) {
      const parts = search_query.split(' ');
      const matches = await db.findEmployeesByName(parts[0], parts[1]);
      
      if (matches.length === 1) {
        employee = matches[0];
        loan = await db.findLoanByEmployeeNumber(employee.employee_number);
        const ledgerCards = await db.getLedgerByEmployeeNumber(employee.employee_number);
        ledgerSummary = {
          total_months: ledgerCards.length,
          last_payment: ledgerCards[ledgerCards.length - 1] || null
        };
      } else if (matches.length > 1) {
        return res.json({
          success: true,
          matches: matches.map(m => ({
            employee_number: m.employee_number,
            first_name: m.first_name,
            last_name: m.last_name,
            position: m.position,
            station: m.station
          }))
        });
      }
    }

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.json({
      success: true,
      data: {
        employee: {
          employee_number: employee.employee_number,
          first_name: employee.first_name,
          last_name: employee.last_name,
          middle_name: employee.middle_name,
          position: employee.position,
          station: employee.station,
          department: employee.department,
          status: employee.status
        },
        loan: loan ? {
          loan_amount: loan.loan_amount,
          loan_balance: loan.loan_balance,
          monthly_amortization: loan.monthly_amortization,
          no_of_months: loan.no_of_months,
          no_of_months_paid: loan.no_of_months_paid,
          effective_date: loan.effective_date,
          termination_date: loan.termination_date,
          status: loan.status
        } : null,
        ledgerSummary: ledgerSummary
      }
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get employee loan details
exports.lookup = async (req, res) => {
  try {
    const { employeeNumber } = req.params;

    const employee = await db.getEmployeeByNumber(employeeNumber);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const loan = await db.findLoanByEmployeeNumber(employeeNumber);
    const ledgerCards = await db.getLedgerByEmployeeNumber(employeeNumber);

    res.json({
      success: true,
      employee: {
        employee_number: employee.employee_number,
        first_name: employee.first_name,
        last_name: employee.last_name,
        position: employee.position,
        station: employee.station,
        department: employee.department
      },
      loan: loan ? {
        loan_amount: loan.loan_amount,
        loan_balance: loan.loan_balance,
        monthly_amortization: loan.monthly_amortization,
        no_of_months: loan.no_of_months,
        no_of_months_paid: loan.no_of_months_paid,
        effective_date: loan.effective_date,
        termination_date: loan.termination_date,
        status: loan.status
      } : null,
      recentPayments: ledgerCards.slice(-12) // Last 12 months
    });

  } catch (error) {
    console.error('Lookup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Search by name
exports.searchByName = async (req, res) => {
  try {
    const { first_name, last_name } = req.body;

    const matches = await db.findEmployeesByName(first_name, last_name);

    res.json({
      success: true,
      matches: matches.map(m => ({
        employee_number: m.employee_number,
        first_name: m.first_name,
        last_name: m.last_name,
        middle_name: m.middle_name,
        position: m.position,
        station: m.station,
        department: m.department
      }))
    });

  } catch (error) {
    console.error('Search by name error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get ledger card
exports.getLedger = async (req, res) => {
  try {
    const { employeeNumber } = req.params;

    const employee = await db.getEmployeeByNumber(employeeNumber);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const loan = await db.findLoanByEmployeeNumber(employeeNumber);
    const ledgerCards = await db.getLedgerByEmployeeNumber(employeeNumber);

    res.json({
      success: true,
      ledgerCard: {
        employee_number: employeeNumber,
        employee_name: `${employee.first_name} ${employee.last_name}`,
        position: employee.position,
        department: employee.department,
        loan_amount: loan?.loan_amount,
        no_of_months: loan?.no_of_months,
        date_granted: loan?.effective_date,
        payments: ledgerCards
      }
    });

  } catch (error) {
    console.error('Get ledger error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get statement
exports.getStatement = async (req, res) => {
  try {
    const { employeeNumber } = req.params;
    const { format = 'json' } = req.query;

    const employee = await db.getEmployeeByNumber(employeeNumber);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const loan = await db.findLoanByEmployeeNumber(employeeNumber);
    const ledgerCards = await db.getLedgerByEmployeeNumber(employeeNumber);

    const statement = {
      employee_number: employeeNumber,
      employee_name: `${employee.first_name} ${employee.middle_name} ${employee.last_name}`,
      position: employee.position,
      department: employee.department,
      generated_date: new Date(),
      loan_details: loan ? {
        loan_amount: loan.loan_amount,
        effective_date: loan.effective_date,
        termination_date: loan.termination_date,
        no_of_months: loan.no_of_months,
        status: loan.status
      } : null,
      payment_summary: {
        total_paid: ledgerCards.reduce((sum, lc) => sum + lc.monthly_payment_amount, 0),
        remaining_balance: loan?.loan_balance,
        months_remaining: loan ? loan.no_of_months - loan.no_of_months_paid : 0
      },
      recent_transactions: ledgerCards.slice(-12)
    };

    res.json({
      success: true,
      statement
    });

  } catch (error) {
    console.error('Get statement error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// FAQ
exports.help = (req, res) => {
  res.json({
    success: true,
    faqs: [
      {
        question: 'How do I check my provident loan balance?',
        answer: 'Enter your employee number or name in the search box above and click Search.'
      },
      {
        question: 'What is the monthly amortization?',
        answer: 'The monthly amortization is the fixed amount automatically deducted from your salary each month towards your provident loan.'
      },
      {
        question: 'Can I pay off my loan early?',
        answer: 'Yes, you can pay off your loan early. Please contact the HR or Finance department for more information.'
      },
      {
        question: 'How do I download my statement?',
        answer: 'After searching for your information, click the "Download Statement" button to save a PDF copy.'
      },
      {
        question: 'What does "QUALIFIED FOR RENEWAL" mean?',
        answer: 'It means you are eligible to apply for another provident loan based on your payment history.'
      }
    ]
  });
};

// Contact
exports.contact = (req, res) => {
  res.json({
    success: true,
    contact: {
      hr_department: 'hr@company.com',
      hr_phone: '+63-2-1234-5678',
      office_hours: '8:00 AM - 5:00 PM, Monday - Friday',
      support_email: 'provident-support@company.com'
    }
  });
};
