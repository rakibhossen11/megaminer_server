const db = require('../config/db');

// ➕ ১. নতুন টাস্ক ক্যাটাগরি তৈরি করার কন্ট্রোলার (Admin Option)
exports.createCategory = async (req, res) => {
    const { name, icon } = req.body;

    if (!name) {
        return res.status(400).json({ success: false, error: "Category name is required" });
    }

    try {
        const queryText = 'INSERT INTO task_categories (name, icon) VALUES ($1, $2) RETURNING *';
        const newCategory = await db.query(queryText, [name, icon || null]);

        res.status(201).json({
            success: true,
            message: "Task category created successfully! 📁",
            category: newCategory.rows[0]
        });
    } catch (error) {
        console.error("Create Category Error:", error);
        if (error.code === '23505') { // PostgreSQL Unique Violation Error Code
            return res.status(400).json({ success: false, error: "Category name already exists" });
        }
        res.status(500).json({ success: false, error: "Internal Database Error." });
    }
};

// 🔍 ২. সব টাস্ক ক্যাটাগরি দেখার কন্ট্রোলার (For Mobile App Front-end)
exports.getAllCategories = async (req, res) => {
    try {
        const categories = await db.query('SELECT * FROM task_categories ORDER BY id ASC');
        
        res.status(200).json({
            success: true,
            count: categories.rows.length,
            categories: categories.rows
        });
    } catch (error) {
        console.error("Get All Categories Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};