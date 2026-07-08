const db = require('../config/db');

// 🤝 নতুন রেফারেল প্রসেস এবং বোনাস ডিস্ট্রিবিউশন কন্ট্রোলার
exports.processReferral = async (req, res) => {
    const { referrer_id, referred_user_id } = req.body;

    if (!referrer_id || !referred_user_id) {
        return res.status(400).json({ success: false, error: "Referrer ID and Referred User ID are required" });
    }

    if (referrer_id === referred_user_id) {
        return res.status(400).json({ success: false, error: "You cannot refer yourself!" });
    }

    try {
        // ১. [🔒 সিকিউরিটি চেক]: এই নতুন ইউজার আগে অন্য কারও কোড দিয়ে অলরেডি রেফারড হয়েছে কি না?
        const checkReferral = await db.query('SELECT id FROM referrals WHERE referred_user_id = $1', [referred_user_id]);
        if (checkReferral.rows.length > 0) {
            return res.status(400).json({ success: false, error: "This user has already been referred by someone else." });
        }

        // ২. রেফারেলের বোনাস কয়েন নির্ধারণ (ধরা যাক ডিরেক্ট Level 1 রেফারে ১০০ কয়েন পুরস্কার)
        const REFERRAL_BONUS = 100;

        // ৩. রেফারেল ডাটাবেজ ট্রানজেকশন (BEGIN) শুরু
        await db.query('BEGIN');

        // ক) referrals টেবিলে রেকর্ড ইনসার্ট করা
        const newReferral = await db.query(
            `INSERT INTO referrals (referrer_id, referred_user_id, level, reward_coin) 
             VALUES ($1, $2, 1, $3) RETURNING *`,
            [referrer_id, referred_user_id, REFERRAL_BONUS]
        );

        // খ) যে রেফার করেছে (Referrer) তার ওয়ালেট আইডি খুঁজে বের করা
        const walletQuery = await db.query('SELECT id FROM wallets WHERE user_id = $1', [referrer_id]);
        if (walletQuery.rows.length > 0) {
            const wallet_id = walletQuery.rows[0].id;

            // গ) Referrer-এর ওয়ালেটে ১০০ কয়েন যোগ করে দেওয়া
            await db.query(
                'UPDATE wallets SET available_coin = available_coin + $1, total_coin = total_coin + $1 WHERE id = $2',
                [REFERRAL_BONUS, wallet_id]
            );

            // ঘ) wallet_transactions লেজারে রসিদ বা স্টেটমেন্ট জেনারেট করা
            await db.query(
                `INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, source, description) 
                 VALUES ($1, 'Credit', $2, 'Daily_Checkin', $3)`, // নোট: সোর্স হিসেবে তোমার ক্যাটাগরি ম্যাপিং অনুযায়ী দিও
                [wallet_id, REFERRAL_BONUS, `Earned ${REFERRAL_BONUS} coins for inviting a new friend! 👥`]
            );
        }

        await db.query('COMMIT'); // সব ডাটা পার্মানেন্ট সেভ হলো

        res.status(201).json({
            success: true,
            message: "Referral applied successfully! Reward credited to referrer. 🎉",
            referral: newReferral.rows[0]
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error("Process Referral Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};

// 🔍 ইউজারের মোট রেফারের সংখ্যা এবং হিস্ট্রি দেখার কন্ট্রোলার
exports.getReferralStats = async (req, res) => {
    const { user_id } = req.params;

    try {
        const statsQuery = await db.query(
            `SELECT r.*, u.username, u.full_name 
             FROM referrals r 
             JOIN users u ON r.referred_user_id = u.id 
             WHERE r.referrer_id = $1 ORDER BY r.created_at DESC`,
            [user_id]
        );

        res.status(200).json({
            success: true,
            total_refers: statsQuery.rows.length,
            refers: statsQuery.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
};