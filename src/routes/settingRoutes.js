const express = require('express');
const router = express.Router();
const settingController = require('../controllers/settingController');

// ১. মোবাইল অ্যাপের জন্য সেটিংস ডাটা নেওয়ার রাউট (GET)
// URL: http://localhost:3001/api/settings/configs
router.get('/configs', settingController.getSettings);

// ২. অ্যাডমিন প্যানেল থেকে সেটিংস আপডেট করার রাউট (POST/PUT)
router.post('/update', settingController.updateSettings);

module.exports = router;