const db = require('../config/db');

// ➕ ১. নতুন সাপোর্ট টিকিট তৈরি করার কন্ট্রোলার (User Route)
exports.createTicket = async (req, res) => {
    const { user_id, subject, category, priority } = req.body;

    if (!user_id || !subject || !category) {
        return res.status(400).json({ success: false, error: "User ID, subject, and category are required." });
    }

    try {
        const queryText = `
            INSERT INTO support_tickets (user_id, subject, category, priority)
            VALUES ($1, $2, $3, $4) RETURNING *
        `;
        const values = [user_id, subject, category, priority || 'Medium'];
        const newTicket = await db.query(queryText, values);

        res.status(201).json({
            success: true,
            message: "Support ticket opened successfully! Our team will review it. 🛠️",
            ticket: newTicket.rows[0]
        });

    } catch (error) {
        console.error("Create Ticket Error:", error);
        res.status(500).json({ success: false, error: "Internal Database Error." });
    }
};

// 🔍 ২. নির্দিষ্ট ইউজারের সব সাপোর্ট টিকিট দেখার কন্ট্রোলার (User Dashboard)
exports.getUserTickets = async (req, res) => {
    const { user_id } = req.params;

    try {
        const queryText = `
            SELECT * FROM support_tickets 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `;
        const tickets = await db.query(queryText, [user_id]);

        res.status(200).json({
            success: true,
            count: tickets.rows.length,
            tickets: tickets.rows
        });

    } catch (error) {
        console.error("Get User Tickets Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};

// 🔄 ৩. টিকিটের স্ট্যাটাস বা প্রায়োরিটি আপডেট করার কন্ট্রোলার (Admin Route)
exports.updateTicketStatus = async (req, res) => {
    const { ticket_id, status, priority } = req.body;

    if (!ticket_id) {
        return res.status(400).json({ success: false, error: "Ticket ID is required." });
    }

    try {
        // ডাইনামিক ফিল্ড আপডেট লজিক
        let queryText = 'UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP';
        const values = [];
        let counter = 1;

        if (status) {
            queryText += `, status = $${counter}`;
            values.push(status);
            counter++;
        }

        if (priority) {
            queryText += `, priority = $${counter}`;
            values.push(priority);
            counter++;
        }

        queryText += ` WHERE id = $${counter} RETURNING *`;
        values.push(ticket_id);

        const updatedTicket = await db.query(queryText, values);

        if (updatedTicket.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Support ticket not found." });
        }

        res.status(200).json({
            success: true,
            message: "Ticket updated successfully! 🔄",
            ticket: updatedTicket.rows[0]
        });

    } catch (error) {
        console.error("Update Ticket Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};

// 💬 ৪. টিকিটের আন্ডারে নতুন মেসেজ/রিপ্লাই পাঠানোর কন্ট্রোলার (supportController.js এর নিচে যোগ করো)
exports.sendMessage = async (req, res) => {
    const { ticket_id, sender_type, sender_id, message, attachment } = req.body;

    if (!ticket_id || !sender_type || !sender_id || !message) {
        return res.status(400).json({ success: false, error: "Missing required messaging fields." });
    }

    try {
        // ক) মেসেজটি ইনসার্ট করার কুয়েরি
        const queryText = `
            INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, message, attachment)
            VALUES ($1, $2, $3, $4, $5) RETURNING *
        `;
        const values = [ticket_id, sender_type, sender_id, message, attachment || null];
        const newMessage = await db.query(queryText, values);

        // খ) ইউজার বা অ্যাডমিন মেসেজ দিলে মূল টিকিটের 'updated_at' টাইমটি রিফ্রেশ করে দেওয়া
        await db.query(
            'UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [ticket_id]
        );

        res.status(201).json({
            success: true,
            message: "Message sent successfully! 📩",
            chat_message: newMessage.rows[0]
        });

    } catch (error) {
        console.error("Send Message Error:", error);
        res.status(500).json({ success: false, error: "Internal Database Error." });
    }
};

// 🔍 ৫. কোনো নির্দিষ্ট টিকিটের পুরো চ্যাট হিস্ট্রি/মেসেজ লিস্ট দেখার কন্ট্রোলার
exports.getTicketMessages = async (req, res) => {
    const { ticket_id } = req.params;

    try {
        // চ্যাট স্ক্রিনে দেখানোর জন্য টাইম অনুযায়ী সর্ট করে মেসেজগুলো নিয়ে আসা
        const queryText = `
            SELECT m.*, u.username, u.full_name 
            FROM ticket_messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.ticket_id = $1
            ORDER BY m.created_at ASC
        `;
        const chatList = await db.query(queryText, [ticket_id]);

        res.status(200).json({
            success: true,
            count: chatList.rows.length,
            messages: chatList.rows
        });

    } catch (error) {
        console.error("Get Ticket Messages Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};