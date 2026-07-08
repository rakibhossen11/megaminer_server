const db = require('../config/db');

// 📥 ১. ইউজারের টাস্ক সাবমিট করার কন্ট্রোলার
exports.submitTask = async (req, res) => {
    const { task_id, user_id, proof } = req.body;

    if (!task_id || !user_id) {
        return res.status(400).json({ success: false, error: "Task ID and User ID are required" });
    }

    try {
        // [🔒 সিকিউরিটি চেক]: ইউজার এই টাস্কটি অলরেডি সাবমিট করেছে কি না?
        const alreadySubmitted = await db.query(
            'SELECT id, status FROM task_submissions WHERE user_id = $1 AND task_id = $2',
            [user_id, task_id]
        );

        if (alreadySubmitted.rows.length > 0) {
            return res.status(400).json({ 
                success: false, 
                error: `You already submitted this task. Current Status: ${alreadySubmitted.rows[0].status}` 
            });
        }

        const queryText = `
            INSERT INTO task_submissions (task_id, user_id, proof)
            VALUES ($1, $2, $3) RETURNING *
        `;
        const submission = await db.query(queryText, [task_id, user_id, proof || null]);

        res.status(201).json({
            success: true,
            message: "Task proof submitted successfully! Waiting for review. ⏳",
            submission: submission.rows[0]
        });

    } catch (error) {
        console.error("Submit Task Error:", error);
        res.status(500).json({ success: false, error: "Internal Database Error." });
    }
};

// 👑 ২. অ্যাডমিন কর্তৃক টাস্ক রিভিউ করার কোর ইঞ্জিন (Approve/Reject)
exports.reviewSubmission = async (req, res) => {
    const { submission_id, status, reviewed_by } = req.body; // status হবে 'Approved' অথবা 'Rejected'

    if (!submission_id || !status || !reviewed_by) {
        return res.status(400).json({ success: false, error: "Missing required fields (submission_id, status, reviewed_by)" });
    }

    try {
        // ক) আগে চেক করা সাবমিশনটি এক্সিস্ট করে এবং ওটা এখনো 'Pending' আছে কি না
        const submissionQuery = await db.query(
            'SELECT s.*, t.reward_coin, t.title FROM task_submissions s JOIN tasks t ON s.task_id = t.id WHERE s.id = $1',
            [submission_id]
        );

        if (submissionQuery.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Submission not found" });
        }

        const submission = submissionQuery.rows[0];

        if (submission.status !== 'Pending') {
            return res.status(400).json({ success: false, error: `This submission is already processed as ${submission.status}` });
        }

        // খ) ডাটাবেজ ট্রানজেকশন (BEGIN) শুরু
        await db.query('BEGIN');

        // ১. task_submissions টেবিল আপডেট (Approved/Rejected)
        await db.query(
            `UPDATE task_submissions 
             SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $3`,
            [status, reviewed_by, submission_id]
        );

        // ২. যদি স্ট্যাটাস Approved হয়, তবে ইউজারের ওয়ালেটে কয়েন ক্রেডিট করা
        if (status === 'Approved') {
            // ইউজারের ওয়ালেট আইডি খুঁজে বের করা
            const walletQuery = await db.query('SELECT id FROM wallets WHERE user_id = $1', [submission.user_id]);
            const wallet_id = walletQuery.rows[0].id;

            // wallets টেবিলে কয়েন বাড়িয়ে দেওয়া
            await db.query(
                'UPDATE wallets SET available_coin = available_coin + $1, total_coin = total_coin + $1 WHERE id = $2',
                [submission.reward_coin, wallet_id]
            );

            // wallet_transactions লেজারে রসিদ বা স্টেটমেন্ট তৈরি
            await db.query(
                `INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, source, description) 
                 VALUES ($1, 'Credit', $2, 'App_Download', $3)`, // source টা ডাইনামিক করতে পারো, আপাতত ক্যাটাগরি অনুযায়ী সেট করলাম
                [wallet_id, submission.reward_coin, `Earned ${submission.reward_coin} coins from task: ${submission.title}`]
            );
        }

        await db.query('COMMIT'); // সব অপারেশন একসাথে সফলভাবে সেভ হলো

        res.status(200).json({
            success: true,
            message: `Submission successfully updated to ${status}! 🎉`,
            task_title: submission.title,
            reward_credited: status === 'Approved' ? submission.reward_coin : 0
        });

    } catch (error) {
        await db.query('ROLLBACK'); // এরর হলে ব্যাকআউট করবে
        console.error("Review Submission Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Processing Error." });
    }
};