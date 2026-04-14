const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');

// ==================== PUBLIC EMPLOYEE PORTAL ====================

// POST /api/employee/search - Search for employee loan data
router.post('/search', employeeController.search);

// GET /api/employee/lookup/:employeeNumber - Get employee loan details
router.get('/lookup/:employeeNumber', employeeController.lookup);

// POST /api/employee/search-by-name - Search by employee name
router.post('/search-by-name', employeeController.searchByName);

// GET /api/employee/ledger/:employeeNumber - Get detailed ledger card
router.get('/ledger/:employeeNumber', employeeController.getLedger);

// GET /api/employee/statement/:employeeNumber - Generate statement
router.get('/statement/:employeeNumber', employeeController.getStatement);

// ==================== PUBLIC INFO ENDPOINTS ====================

// GET /api/employee/help - Frequently asked questions
router.get('/help', employeeController.help);

// GET /api/employee/contact - Contact information
router.get('/contact', employeeController.contact);

module.exports = router;
