const db = require('../config/db');

// ➕ ১. নতুন কুইজ ক্যাটাগরি/টপিক তৈরি করার কন্ট্রোলার (Admin Route)
exports.createCategory = async (req, res) => {
    const { title } = req.body;

    if (!title) {
        return res.status(400).json({ success: false, error: "Quiz title is required" });
    }

    try {
        const queryText = 'INSERT INTO quiz_categories (title) VALUES ($1) RETURNING *';
        const newCategory = await db.query(queryText, [title]);

        res.status(201).json({
            success: true,
            message: "Quiz category created successfully! 🧠",
            category: newCategory.rows[0]
        });
    } catch (error) {
        console.error("Create Quiz Category Error:", error);
        if (error.code === '23505') { // Unique constraint code
            return res.status(400).json({ success: false, error: "Quiz title already exists" });
        }
        res.status(500).json({ success: false, error: "Internal Database Error." });
    }
};

// 🔍 ২. সব কুইজ ক্যাটাগরি দেখার কন্ট্রোলার (For Mobile App Front-end)
exports.getAllCategories = async (req, res) => {
    try {
        const categories = await db.query('SELECT * FROM quiz_categories ORDER BY id ASC');
        
        res.status(200).json({
            success: true,
            count: categories.rows.length,
            categories: categories.rows
        });
    } catch (error) {
        console.error("Get Quiz Categories Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};