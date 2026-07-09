const express = require('express');
const router = express.Router();
const withdrawMethodController = require('../controllers/withdrawMethodController');
const withdrawController = require('../controllers/withdrawController');

// নতুন মেথড তৈরি করার রাউট (POST)
router.post('/method/add', withdrawMethodController.addMethod);

// মোবাইল অ্যাপে দেখানোর জন্য একটিভ মেথড লিস্ট (GET)
// URL: http://localhost:3001/api/withdraw/method/all
router.get('/method/all', withdrawMethodController.getActiveMethods);

// ১. ইউজারের টাকা তোলার রিকোয়েস্ট পাঠানোর রাউট (POST)
router.post('/request', withdrawController.requestWithdraw);
// ২. অ্যাডমিনের এপ্রুভ বা রিজেক্ট করার রাউট (POST)
// URL: http://localhost:3001/api/withdraw/process-status
router.post('/process-status', withdrawController.processWithdrawStatus);

module.exports = router;