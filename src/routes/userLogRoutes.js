const express = require('express');
const router = express.Router();
const userLogController = require('../controllers/userLogController');

// অ্যাডমিন প্যানেলে কোনো নির্দিষ্ট ইউজারের লগ দেখার এন্ডপয়েন্ট (GET)
// URL: http://localhost:3001/api/user-logs/history/ইউজারের_UUID
router.get('/history/:user_id', userLogController.getUserLogs);

module.exports = router;