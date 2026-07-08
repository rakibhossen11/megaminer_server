const db = require('../config/db');

// ➕ ১. নতুন টাস্ক তৈরি করার কন্ট্রোলার (Admin Route)
exports.createTask = async (req, res) => {
    const { category_id, title, description, reward_coin, task_type, task_url, start_date, end_date, status } = req.body;

    if (!category_id || !title || !reward_coin || !task_url) {
        return res.status(400).json({ success: false, error: "Missing required fields (category_id, title, reward_coin, task_url)" });
    }

    try {
        const queryText = `
            INSERT INTO tasks (category_id, title, description, reward_coin, task_type, task_url, start_date, end_date, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;
        const values = [
            category_id, 
            title, 
            description || null, 
            reward_coin, 
            task_type || 'Automatic', 
            task_url, 
            start_date || new Date(), 
            end_date || null, 
            status || 'Active'
        ];

        const newTask = await db.query(queryText, values);

        res.status(201).json({
            success: true,
            message: "New task published successfully! 🚀",
            task: newTask.rows[0]
        });

    } catch (error) {
        console.error("Create Task Error:", error);
        res.status(500).json({ success: false, error: "Internal Database Error." });
    }
};

// 🔍 ২. অ্যাপের ফ্রন্টএন্ডের জন্য সব একটিভ টাস্ক নিয়ে আসার কন্ট্রোলার
exports.getActiveTasks = async (req, res) => {
    try {
        // লজিক: স্ট্যাটাস Active হতে হবে এবং বর্তমান সময় এন্ড ডেটের চেয়ে কম হতে হবে (যদি end_date থাকে)
        const queryText = `
            SELECT t.*, c.name as category_name, c.icon as category_icon 
            FROM tasks t
            JOIN task_categories c ON t.category_id = c.id
            WHERE t.status = 'Active' 
            AND (t.end_date IS NULL OR t.end_date > NOW())
            ORDER BY t.created_at DESC
        `;
        
        const tasks = await db.query(queryText);

        res.status(200).json({
            success: true,
            count: tasks.rows.length,
            tasks: tasks.rows
        });

    } catch (error) {
        console.error("Get Active Tasks Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};