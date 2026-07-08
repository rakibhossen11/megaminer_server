const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');

// ডিভাইস ট্র্যাক/সংরক্ষণ করার এন্ডপয়েন্ট (POST)
router.post('/sync', deviceController.saveDevice);

// নির্দিষ্ট ইউজারের ডিভাইস লিস্ট দেখার এন্ডপয়েন্ট (GET)
router.get('/user/:user_id', deviceController.getUserDevices);

module.exports = router;