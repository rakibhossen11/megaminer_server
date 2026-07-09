const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');

// ইউজার কর্তৃক নতুন টিকিট ওপেন করার রাউট (POST)
router.post('/ticket/create', supportController.createTicket);

// ইউজারের নিজস্ব টিকিট হিস্ট্রি দেখার রাউট (GET)
// URL: http://localhost:3001/api/support/tickets/ইউজারের_UUID
router.get('/tickets/:user_id', supportController.getUserTickets);

// অ্যাডমিন কর্তৃক টিকিট আপডেট করার রাউট (PUT/POST)
router.post('/ticket/update', supportController.updateTicketStatus);

// চ্যাটে নতুন মেসেজ বা রিপ্লাই পাঠানোর এন্ডপয়েন্ট (POST)
router.post('/message/send', supportController.sendMessage);
// নির্দিষ্ট টিকিটের পুরো চ্যাট বা কথোপকথন দেখার এন্ডপয়েন্ট (GET)
// URL: http://localhost:3001/api/support/messages/তোমার_টিকিট_UUID
router.get('/messages/:ticket_id', supportController.getTicketMessages);

module.exports = router;