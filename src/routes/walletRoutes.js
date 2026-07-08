const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');

// ব্যালেন্স চেক করার এন্ডপয়েন্ট (GET)
// URL: http://localhost:3001/api/wallet/balance/ইউজারের_UUID
router.get('/balance/:user_id', walletController.getWalletBalance);

module.exports = router;