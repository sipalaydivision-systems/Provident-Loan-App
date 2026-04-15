const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const reportController = require('../controllers/reportController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    const allowed = [
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowed.includes(file.mimetype) || ext.endsWith('.pdf') || ext.endsWith('.csv') || ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, CSV, or Excel (.xlsx/.xls) files are allowed'));
    }
  },
});

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
router.put('/ledger/:entryId', authenticateToken, authorizeAdmin, adminController.updateLedgerEntry);
router.delete('/ledger/bulk', authenticateToken, authorizeAdmin, adminController.bulkDeleteLedgerEntries);
router.delete('/ledger/:entryId', authenticateToken, authorizeAdmin, adminController.deleteLedgerEntry);

// ==================== LEDGER BY EMPLOYEE ====================

router.get('/employees/:employeeNumber/ledger', authenticateToken, authorizeAdmin, adminController.getEmployeeLedger);

// ==================== REPORTS ====================

router.get('/report/loan-summary', authenticateToken, authorizeAdmin, reportController.getLoanSummary);
router.get('/report/loan-summary/csv', authenticateToken, authorizeAdmin, reportController.exportLoanSummaryCsv);

// ==================== DASHBOARD ====================

router.get('/dashboard/summary', authenticateToken, authorizeAdmin, adminController.getDashboardSummary);

// ==================== BULK OPERATIONS ====================

router.post('/import', authenticateToken, authorizeAdmin, upload.single('file'), adminController.importEmployees);

router.get('/export', authenticateToken, authorizeAdmin, (req, res) => {
  res.json({ success: true, message: 'Export endpoint — to be implemented' });
});

// ==================== AUDIT LOGS ====================

router.get('/audit-logs', authenticateToken, authorizeAdmin, (req, res) => {
  res.json({ success: true, data: [] });
});

module.exports = router;
