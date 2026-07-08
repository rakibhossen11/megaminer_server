const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// 📝 রেজিস্ট্রেশন রাউট
router.post('/register', authController.register);
// 🔐 নতুন লগইন রাউট যুক্ত হলো
// URL: http://localhost:3001/api/auth/login
router.post('/login', authController.login);

module.exports = router;