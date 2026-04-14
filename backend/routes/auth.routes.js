const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const authController = require('../controllers/authController');

// POST /api/auth/login - Admin login
router.post('/login', authController.login);

// POST /api/auth/register - Register admin (super admin only)
router.post('/register', authenticateToken, (req, res) => {
  // TODO: Implement admin registration
  res.json({ message: 'Register endpoint - To be implemented' });
});

// POST /api/auth/logout - Logout
router.post('/logout', authenticateToken, authController.logout);

// POST /api/auth/refresh - Refresh token
router.post('/refresh', authController.refresh);

module.exports = router;
