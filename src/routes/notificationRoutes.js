const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// অ্যাডমিন প্যানেল থেকে নোটিফিকেশন পুশ করার রাউট (POST)
router.post('/send', notificationController.sendNotification);

// মোবাইল অ্যাপের ইনবক্সে নোটিফিকেশন লিস্ট দেখানোর রাউট (GET)
// URL: http://localhost:3001/api/notifications/user/ইউজারের_UUID
router.get('/user/:user_id', notificationController.getUserNotifications);

// নোটিফিকেশন রিড/পঠিত হিসেবে মার্ক করার এন্ডপয়েন্ট (POST)
// URL: http://localhost:3001/api/notifications/mark-read
router.post('/mark-read', notificationController.markAsRead);

module.exports = router;