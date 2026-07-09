const db = require('../config/db');

// 🔍 নির্দিষ্ট কোনো ইউজারের অ্যাক্টিভিটি লগ দেখার কন্ট্রোলার (Admin Option)
exports.getUserLogs = async (req, res) => {
    const { user_id } = req.params;

    try {
        const queryText = `
            SELECT * FROM user_logs 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `;
        const logs = await db.query(queryText, [user_id]);

        res.status(200).json({
            success: true,
            count: logs.rows.length,
            logs: logs.rows
        });
    } catch (error) {
        console.error("Get User Logs Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};