const db = require('../config/db');

// ➕ ১. কুইজে নতুন প্রশ্ন যোগ করার কন্ট্রোলার (Admin Option)
exports.addQuestion = async (req, res) => {
    const { quiz_id, question, option_a, option_b, option_c, option_d, correct_answer } = req.body;

    if (!quiz_id || !question || !option_a || !option_b || !option_c || !option_d || !correct_answer) {
        return res.status(400).json({ success: false, error: "All fields are required to create a question." });
    }

    try {
        const queryText = `
            INSERT INTO quiz_questions (quiz_id, question, option_a, option_b, option_c, option_d, correct_answer)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        const values = [quiz_id, question, option_a, option_b, option_c, option_d, correct_answer.toUpperCase()];
        const newQuestion = await db.query(queryText, values);

        res.status(201).json({
            success: true,
            message: "Question added successfully to the quiz! 📝",
            question: newQuestion.rows[0]
        });

    } catch (error) {
        console.error("Add Question Error:", error);
        res.status(500).json({ success: false, error: "Internal Database Error." });
    }
};

// 🔍 ২. কোনো নির্দিষ্ট কুইজের সব প্রশ্ন র‍্যান্ডমাইজড আকারে নিয়ে আসার কন্ট্রোলার
exports.getQuestionsByQuiz = async (req, res) => {
    const { quiz_id } = req.params;

    try {
        // ORDER BY RANDOM() ব্যবহারের ফলে ইউজার প্রতিবার কুইজে ঢুকলে প্রশ্ন ওলট-পালট (Shuffle) হয়ে আসবে, যাতে চিটিং করতে না পারে
        const queryText = `
            SELECT id, quiz_id, question, option_a, option_b, option_c, option_d 
            FROM quiz_questions 
            WHERE quiz_id = $1
            ORDER BY RANDOM()
        `;
        
        // 💡 নোট: সিকিউরিটির জন্য আমরা এই এপিআই-তে 'correct_answer' ফিল্ডটি ফ্রন্টএন্ডে পাঠাচ্ছি না। 
        // ইউজার যখন উত্তর সাবমিট করবে, তখন আমরা ব্যাকএন্ডে এসে ভেরিফাই করব।
        
        const questions = await db.query(queryText, [quiz_id]);

        res.status(200).json({
            success: true,
            count: questions.rows.length,
            questions: questions.rows
        });

    } catch (error) {
        console.error("Get Questions Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};