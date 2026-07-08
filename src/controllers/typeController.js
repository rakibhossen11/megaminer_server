const db = require('../config/db');

// 🔍 ডাটাবেজের সব ট্রানজেকশন টাইপ লিস্ট করার কন্ট্রোলার
exports.getAllTypes = async (req, res) => {
    try {
        const typesQuery = await db.query('SELECT * FROM transaction_types ORDER BY id ASC');
        
        res.status(200).json({
            success: true,
            count: typesQuery.rows.length,
            types: typesQuery.rows
        });
    } catch (error) {
        console.error("Get Transaction Types Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};