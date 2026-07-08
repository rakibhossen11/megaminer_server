const express = require('express');
const router = express.Router();
const typeController = require('../controllers/typeController');

// সব টাইপ দেখার এন্ডপয়েন্ট (GET)
// URL: http://localhost:3001/api/tx-types/all
router.get('/all', typeController.getAllTypes);

module.exports = router;