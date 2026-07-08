const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');

// প্রোফাইল আপডেট করার এন্ডপয়েন্ট (POST)
router.post('/update', profileController.updateProfile);

// নির্দিষ্ট ইউজারের প্রোফাইল দেখার এন্ডপয়েন্ট (GET)
// URL: http://localhost:3001/api/profile/ইউজারের_UUID_এখানে_বসবে
router.get('/:user_id', profileController.getProfile);

module.exports = router;