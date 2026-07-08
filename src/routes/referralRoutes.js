const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralController');

// নতুন রেফারেল প্রসেস করার এন্ডপয়েন্ট (POST)
router.post('/apply', referralController.processReferral);

// নির্দিষ্ট ইউজারের রেফারেল হিস্ট্রি দেখার এন্ডপয়েন্ট (GET)
// URL: http://localhost:3001/api/referral/stats/ইউজারের_UUID
router.get('/stats/:user_id', referralController.getReferralStats);

module.exports = router;