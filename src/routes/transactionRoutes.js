const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

// নতুন ট্রানজেকশন তৈরি করার কোর এন্ডপয়েন্ট (POST)
router.post('/process', transactionController.addTransaction);

// কোনো ওয়ালেটের ফুল স্টেটমেন্ট/হিস্ট্রি দেখার এন্ডপয়েন্ট (GET)
router.get('/history/:wallet_id', transactionController.getHistory);

module.exports = router;