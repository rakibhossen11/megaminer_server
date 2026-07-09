const express = require('express');
const router = express.Router();
const planController = require('../controllers/planController');

// নতুন ভিআইপি মেম্বারশিপ প্ল্যান তৈরি করার রাউট (POST)
router.post('/add', planController.addPlan);

// মোবাইল অ্যাপে দেখানোর জন্য একটিভ মেম্বারশিপ প্ল্যান লিস্ট (GET)
// URL: http://localhost:3001/api/plans/all
router.get('/all', planController.getAllPlans);

// ইউজার কর্তৃক ভিআইপি প্ল্যান বাই/সাবস্ক্রাইব করার এন্ডপয়েন্ট (POST)
// URL: http://localhost:3001/api/plans/buy
router.post('/buy', planController.buyMembership);

module.exports = router;