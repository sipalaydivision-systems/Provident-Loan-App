const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const db = require('../database/db');

// Loan data is personal information (RA 10173). Public lookups must prove identity with
// employee number + last name; open name searches are disabled.
const norm = (v) => (v || '').toString().toUpperCase().replace(/[^A-Z0-9Ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
const verifyIdentity = async (req, res, next) => {
  try {
    const lastName = norm(req.query.last_name || req.body?.last_name);
    const empNo = req.params.employeeNumber;
    if (!empNo || lastName.length < 2) {
      return res.status(400).json({ success: false, message: 'Employee number and last name are required' });
    }
    const emp = await db.getEmployeeByNumber(empNo);
    const fullName = norm([emp?.first_name, emp?.middle_name, emp?.last_name].filter(Boolean).join(' '));
    if (!emp || !(` ${fullName} `).includes(` ${lastName} `)) {
      return res.status(404).json({ success: false, message: 'No record matches that employee number and last name' });
    }
    next();
  } catch (e) {
    next(e);
  }
};
const disabled = (req, res) => res.status(403).json({ success: false, message: 'Search by name is disabled. Use employee number and last name.' });

// ==================== PUBLIC EMPLOYEE PORTAL ====================

// POST /api/employee/search - Search for employee loan data
router.post('/search', disabled);

// GET /api/employee/lookup/:employeeNumber - Get employee loan details
router.get('/lookup/:employeeNumber', (req, res) => res.status(410).json({ success: false, message: 'Loan details are now in the Employee Portal. Sign in with the activation code from the Accounting Section.' }));

// POST /api/employee/search-by-name - Search by employee name
router.post('/search-by-name', disabled);

// GET /api/employee/ledger/:employeeNumber - Get detailed ledger card
router.get('/ledger/:employeeNumber', (req, res) => res.status(410).json({ success: false, message: 'Loan details are now in the Employee Portal. Sign in with the activation code from the Accounting Section.' }));

// GET /api/employee/statement/:employeeNumber - Generate statement
router.get('/statement/:employeeNumber', (req, res) => res.status(410).json({ success: false, message: 'Loan details are now in the Employee Portal. Sign in with the activation code from the Accounting Section.' }));

// ==================== PUBLIC INFO ENDPOINTS ====================

// GET /api/employee/help - Frequently asked questions
router.get('/help', employeeController.help);

// GET /api/employee/contact - Contact information
router.get('/contact', employeeController.contact);

module.exports = router;
