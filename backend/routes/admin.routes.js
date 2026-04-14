const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const reportController = require('../controllers/reportController');

// ==================== EMPLOYEE MANAGEMENT ====================

router.get('/employees', authenticateToken, authorizeAdmin, adminController.getAllEmployees);
router.get('/employees/:employeeNumber', authenticateToken, authorizeAdmin, adminController.getEmployee);
router.post('/employees', authenticateToken, authorizeAdmin, adminController.createEmployee);
router.put('/employees/:employeeNumber', authenticateToken, authorizeAdmin, adminController.updateEmployee);
router.delete('/employees/:employeeNumber', authenticateToken, authorizeAdmin, adminController.deleteEmployee);

// ==================== PROVIDENT LOAN MANAGEMENT ====================

router.get('/loans', authenticateToken, authorizeAdmin, adminController.getAllLoans);
router.get('/loans/:loanId', authenticateToken, authorizeAdmin, adminController.getLoan);
router.post('/loans', authenticateToken, authorizeAdmin, adminController.createLoan);
router.put('/loans/:loanId', authenticateToken, authorizeAdmin, adminController.updateLoan);
router.delete('/loans/:loanId', authenticateToken, authorizeAdmin, adminController.deleteLoan);

// ==================== LEDGER / PAYMENTS ====================

router.get('/ledger', authenticateToken, authorizeAdmin, adminController.getAllLedgerEntries);
router.post('/ledger/record-payment', authenticateToken, authorizeAdmin, adminController.recordPayment);

// ==================== REPORTS ====================

router.get('/report/loan-summary', authenticateToken, authorizeAdmin, reportController.getLoanSummary);
router.get('/report/loan-summary/csv', authenticateToken, authorizeAdmin, reportController.exportLoanSummaryCsv);

// ==================== DASHBOARD ====================

router.get('/dashboard/summary', authenticateToken, authorizeAdmin, adminController.getDashboardSummary);

// ==================== BULK OPERATIONS ====================

router.post('/import', authenticateToken, authorizeAdmin, (req, res) => {
  res.json({ success: true, message: 'Import endpoint — to be implemented', imported: 0, errors: [] });
});

router.get('/export', authenticateToken, authorizeAdmin, (req, res) => {
  res.json({ success: true, message: 'Export endpoint — to be implemented' });
});

// ==================== AUDIT LOGS ====================

router.get('/audit-logs', authenticateToken, authorizeAdmin, (req, res) => {
  res.json({ success: true, data: [] });
});

module.exports = router;
