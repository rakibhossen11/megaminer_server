const express = require('express');
const router = express.Router();
const tokenController = require('../controllers/tokenController');

// নতুন এক্সেস টোকেন নেওয়ার এন্ডপয়েন্ট
router.post('/refresh', tokenController.refreshAccessToken);

// টোকেন বাতিল/লগআউট করার এন্ডপয়েন্ট
router.post('/revoke', tokenController.revokeToken);

module.exports = router;