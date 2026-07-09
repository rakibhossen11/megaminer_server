const db = require('../config/db');

// ➕ ১. নতুন উইথড্রাল গেটওয়ে যোগ করার কন্ট্রোলার (Admin Route)
exports.addMethod = async (req, res) => {
    const { method_name, minimum_amount, charge, status } = req.body;

    if (!method_name || minimum_amount === undefined) {
        return res.status(400).json({ success: false, error: "Method name and minimum amount are required." });
    }

    try {
        const queryText = `
            INSERT INTO withdrawal_methods (method_name, minimum_amount, charge, status)
            VALUES ($1, $2, $3, $4) RETURNING *
        `;
        const values = [method_name, minimum_amount, charge || 0.00, status || 'Active'];
        const newMethod = await db.query(queryText, values);

        res.status(201).json({
            success: true,
            message: "Payment withdrawal method added successfully! 💳",
            method: newMethod.rows[0]
        });

    } catch (error) {
        console.error("Add Method Error:", error);
        if (error.code === '23505') {
            return res.status(400).json({ success: false, error: "This method name already exists." });
        }
        res.status(500).json({ success: false, error: "Internal Database Error." });
    }
};

// 🔍 ২. অ্যাপ ফ্রন্টএন্ডের জন্য সব অ্যাক্টিভ পেমেন্ট মেথড লিস্ট দেখার কন্ট্রোলার
exports.getActiveMethods = async (req, res) => {
    try {
        const methods = await db.query("SELECT * FROM withdrawal_methods WHERE status = 'Active' ORDER BY id ASC");
        
        res.status(200).json({
            success: true,
            count: methods.rows.length,
            methods: methods.rows
        });
    } catch (error) {
        console.error("Get Active Methods Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};