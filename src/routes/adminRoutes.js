const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// নতুন অ্যাডমিন/স্টাফ তৈরি করার এন্ডপয়েন্ট (POST)
router.post('/register', adminController.registerAdmin);

// অ্যাডমিন প্যানেলে লগইনের এন্ডপয়েন্ট (POST)
// URL: http://localhost:3001/api/admin/login
router.post('/login', adminController.loginAdmin);

// সব অ্যাডমিন অ্যাক্টিভিটি লগ দেখার রাউট (GET)
// URL: http://localhost:3001/api/admin/audit-logs
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;