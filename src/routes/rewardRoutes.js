const express = require('express');
const router = express.Router();
const rewardController = require('../controllers/rewardController');

// দৈনিক বোনাস ক্লেইম করার এন্ডপয়েন্ট (POST)
// URL: http://localhost:3001/api/reward/daily-claim
router.post('/daily-claim', rewardController.claimDailyCheckin);
router.post('/ad-watch', rewardController.watchRewardAd);
router.post('/spin-save', rewardController.saveSpinResult);
router.post('/scratch-save', rewardController.saveScratchResult);

module.exports = router;