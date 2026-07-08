const db = require('../config/db');

// ➕ ১. নতুন কুইজ তৈরি করার কন্ট্রোলার (Admin Option)
exports.createQuiz = async (req, res) => {
    const { category_id, title, reward_coin, time_limit, difficulty, status } = req.body;

    if (!category_id || !title || !reward_coin) {
        return res.status(400).json({ success: false, error: "Missing required fields (category_id, title, reward_coin)" });
    }

    try {
        const queryText = `
            INSERT INTO quizzes (category_id, title, reward_coin, time_limit, difficulty, status)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        const values = [
            category_id,
            title,
            reward_coin,
            time_limit || 60,
            difficulty || 'Easy',
            status || 'Active'
        ];

        const newQuiz = await db.query(queryText, values);

        res.status(201).json({
            success: true,
            message: "New quiz added successfully! 🎯",
            quiz: newQuiz.rows[0]
        });
    } catch (error) {
        console.error("Create Quiz Error:", error);
        res.status(500).json({ success: false, error: "Internal Database Error." });
    }
};

// 🔍 ২. নির্দিষ্ট ক্যাটাগরির আন্ডারে থাকা সব একটিভ কুইজ দেখার কন্ট্রোলার (App Front-end)
exports.getQuizzesByCategory = async (req, res) => {
    const { category_id } = req.params;

    try {
        const queryText = `
            SELECT q.*, c.title as category_title 
            FROM quizzes q
            JOIN quiz_categories c ON q.category_id = c.id
            WHERE q.category_id = $1 AND q.status = 'Active'
            ORDER BY q.created_at DESC
        `;
        const quizzes = await db.query(queryText, [category_id]);

        res.status(200).json({
            success: true,
            count: quizzes.rows.length,
            quizzes: quizzes.rows
        });
    } catch (error) {
        console.error("Get Quizzes Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};


// 🏆 কুইজের উত্তর সাবমিশন, স্কোর যাচাই ও কয়েন ক্রেডিট করার কোর ইঞ্জিন (quizController.js এর নিচে যোগ করো)
exports.submitQuizAnswers = async (req, res) => {
    const { quiz_id, user_id, answers } = req.body; 
    // answers ফরম্যাট হবে এমন: [{ question_id: "UUID", selected_option: "A" }, ...]

    if (!quiz_id || !user_id || !answers || !Array.isArray(answers)) {
        return res.status(400).json({ success: false, error: "Missing required submission fields" });
    }

    try {
        // ১. [🔒 সিকিউরিটি চেক]: ইউজার এই কুইজটি আগে কখনো কমপ্লিট করেছে কি না?
        const checkHistory = await db.query(
            'SELECT id FROM quiz_histories WHERE user_id = $1 AND quiz_id = $2',
            [user_id, quiz_id]
        );
        if (checkHistory.rows.length > 0) {
            return res.status(400).json({ success: false, error: "You have already completed this quiz before! 🎯" });
        }

        // ২. কুইজের নির্ধারিত টোটাল রিওয়ার্ড কয়েন কত তা জেনে নেওয়া
        const quizQuery = await db.query('SELECT reward_coin, title FROM quizzes WHERE id = $1', [quiz_id]);
        if (quizQuery.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Quiz not found" });
        }
        const { reward_coin: maxRewardCoin, title: quizTitle } = quizQuery.rows[0];

        // ৩. ডাটাবেজ থেকে এই কুইজের আসল সঠিক উত্তরগুলোর তালিকা নিয়ে আসা
        const actualQuestions = await db.query(
            'SELECT id, correct_answer FROM quiz_questions WHERE quiz_id = $1',
            [quiz_id]
        );

        // সঠিক উত্তরগুলো একটা অবজেক্ট ম্যাপে রাখা (সহজে খোঁজার জন্য)
        const answerKey = {};
        actualQuestions.rows.forEach(q => {
            answerKey[q.id] = q.correct_answer;
        });

        // ৪. ইউজারের দেওয়া খাতা (Answers Array) মূল্যায়ন করা
        let correctCount = 0;
        const totalQuestions = actualQuestions.rows.length;

        answers.forEach(userAns => {
            const correctAnswer = answerKey[userAns.question_id];
            if (correctAnswer && userAns.selected_option.toUpperCase() === correctAnswer) {
                correctCount++;
            }
        });

        // ৫. কয়েন বোনাস দেওয়ার শর্ত (ধরা যাক, কমপক্ষে ৫০% উত্তর সঠিক হতে হবে)
        let finalRewardCoin = 0;
        const passingScore = Math.ceil(totalQuestions / 2); // অর্ধেক সঠিক হতে হবে

        if (correctCount >= passingScore && totalQuestions > 0) {
            finalRewardCoin = maxRewardCoin; // শর্ত পূরণ করলে পুরো রিওয়ার্ড পাবে
        }

        // ৬. ডাটাবেজ ট্রানজেকশন (BEGIN) শুরু
        await db.query('BEGIN');

        // ক) quiz_histories টেবিলে রেজাল্ট রেকর্ড ইনসার্ট
        const historyRecord = await db.query(
            `INSERT INTO quiz_histories (quiz_id, user_id, score, reward_coin) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [quiz_id, user_id, correctCount, finalRewardCoin]
        );

        // খ) যদি ইউজার কয়েন জিতে থাকে, তবে ওয়ালেট ও ট্রানজেকশন লেজার আপডেট করা
        if (finalRewardCoin > 0) {
            const walletQuery = await db.query('SELECT id FROM wallets WHERE user_id = $1', [user_id]);
            const wallet_id = walletQuery.rows[0].id;

            // wallets টেবিলে কয়েন বাড়িয়ে দেওয়া
            await db.query(
                'UPDATE wallets SET available_coin = available_coin + $1, total_coin = total_coin + $1 WHERE id = $2',
                [finalRewardCoin, wallet_id]
            );

            // wallet_transactions লেজারে রসিদ তৈরি
            await db.query(
                `INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, source, description) 
                 VALUES ($1, 'Credit', $2, 'Quiz', $3)`,
                [wallet_id, finalRewardCoin, `Earned ${finalRewardCoin} coins from Quiz: ${quizTitle}`]
            );
        }

        await db.query('COMMIT'); // সব ডাটা একসাথে সেভ হলো

        res.status(201).json({
            success: true,
            message: finalRewardCoin > 0 ? "Congratulations! You passed the quiz! 🎉" : "Quiz completed, but score too low for rewards. 📚",
            score: `${correctCount}/${totalQuestions}`,
            reward_coin: finalRewardCoin,
            history: historyRecord.rows[0]
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error("Submit Quiz Answers Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Processing Error." });
    }
};