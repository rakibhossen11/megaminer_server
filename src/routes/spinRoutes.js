const express = require('express');
const router = express.Router();
const spinController = require('../controllers/spinController');
const protect = require('../middleware/authMiddleware');

router.use(protect);

router.post('/play',spinController.playSpin);
router.get('/status',spinController.getSpinStatus);

module.exports = router;