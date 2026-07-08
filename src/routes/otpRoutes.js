const express = require('express');
const router = express.Router();
const otpController = require('../controllers/otpController');

// ওটিপি জেনারেট/সেন্ড করার এন্ডপয়েন্ট (POST)
router.post('/send', otpController.sendOTP);

// ওটিপি ভেরিফাই করার এন্ডপয়েন্ট (POST)
router.post('/verify', otpController.verifyOTP);

module.exports = router;