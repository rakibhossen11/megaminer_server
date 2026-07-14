const express = require('express');
const router = express.Router();
const checkInController = require('../controllers/dailyCheckInController');
const protect = require('../middleware/authMiddleware'); // আপনার তৈরি করা টোকেন মিডলওয়্যার

router.use(protect);

router.get('/status',checkInController.getCheckInStatus);
router.post('/claim',checkInController.claimReward);

module.exports = router;