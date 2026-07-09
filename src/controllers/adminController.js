const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { logAdminAction } = require('../utils/logger');

// ➕ ১. নতুন অ্যাডমিন/মডারেটর তৈরি করার কন্ট্রোলার (Admin Registration)
exports.registerAdmin = async (req, res) => {
    const { name, email, password, role, status } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ success: false, error: "Name, email, and password are required." });
    }

    try {
        // পাসওয়ার্ড হ্যাশ করা (সিকিউরিটি লকিং)
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const queryText = `
            INSERT INTO admins (name, email, password_hash, role, status)
            VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, status, created_at
        `;
        const values = [name, email.toLowerCase(), password_hash, role || 'Moderator', status || 'Active'];
        const newAdmin = await db.query(queryText, values);

        res.status(201).json({
            success: true,
            message: "New admin account registered successfully! 👑",
            admin: newAdmin.rows[0]
        });

    } catch (error) {
        console.error("Register Admin Error:", error);
        if (error.code === '23505') {
            return res.status(400).json({ success: false, error: "This email is already registered as an admin." });
        }
        res.status(500).json({ success: false, error: "Internal Database Error." });
    }
};

// 🔑 ২. অ্যাডমিন প্যানেল লগইন কন্ট্রোলার
exports.loginAdmin = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, error: "Email and password are required." });
    }

    try {
        // ইমেইল চেক করা
        const result = await db.query('SELECT * FROM admins WHERE email = $1', [email.toLowerCase()]);
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: "Invalid email or password." });
        }

        const admin = result.rows[0];

        // স্ট্যাটাস একটিভ আছে কি না চেক করা
        if (admin.status !== 'Active') {
            return res.status(403).json({ success: false, error: `Your account is ${admin.status}. Please contact Super Admin.` });
        }

        // পাসওয়ার্ড ভেরিফাই করা
        const isMatch = await bcrypt.compare(password, admin.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: "Invalid email or password." });
        }

        res.status(200).json({
            success: true,
            message: "Welcome to Admin Dashboard! 🖥️",
            admin: {
                id: admin.id,
                name: admin.name,
                email: admin.email,
                role: admin.role
            }
        });

    } catch (error) {
        console.error("Admin Login Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};

// 🔍 ৩. সুপার অ্যাডমিনের জন্য সব অডিট লগ দেখার কন্ট্রোলার (Admin Route)
exports.getAuditLogs = async (req, res) => {
    try {
        const queryText = `
            SELECT l.*, a.name as admin_name, a.role as admin_role 
            FROM admin_audit_logs l
            JOIN admins a ON l.admin_id = a.id
            ORDER BY l.created_at DESC
        `;
        const logs = await db.query(queryText);

        res.status(200).json({
            success: true,
            count: logs.rows.length,
            logs: logs.rows
        });
    } catch (error) {
        console.error("Get Audit Logs Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};

/* 
💡 এক্সাম্পল (ব্যবহারের নিয়ম): 
অ্যাডমিন যখন কোনো কাজ করবে, তখন কন্ট্রোলারের ভেতর ফাংশনটি এভাবে কল করতে হবে:

await logAdminAction({
    admin_id: admin.id,
    action: 'APPROVE_WITHDRAWAL',
    target_table: 'withdrawals',
    target_id: withdrawal_id,
    old_value: { status: 'Pending' },
    new_value: { status: 'Approved' },
    ip_address: req.ip // এক্সপ্রেস থেকে অটো আইপি ক্যাচ করবে
});
*/