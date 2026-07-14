const db = require('../config/db');

// 📅 ১. ইউজারের আজকের ডেইলি চেক-ইন স্ট্যাটাস চেক করা
exports.getCheckInStatus = async (req, res) => {
    const user_id = req.user.id;

    try {
        // ইউজারের শেষ ক্লেম করা হিস্ট্রি বের করা
        const lastCheckInQuery = await db.query(
            'SELECT * FROM daily_checkins WHERE user_id = $1 ORDER BY claimed_at DESC LIMIT 1',
            [user_id]
        );

        let currentStreak = 0;
        let canClaimToday = true;
        let lastClaimedDay = 0;

        if (lastCheckInQuery.rows.length > 0) {
            const lastCheckIn = lastCheckInQuery.rows[0];
            lastClaimedDay = lastCheckIn.day;

            const lastClaimDate = new Date(lastCheckIn.claimed_at).toDateString();
            const today = new Date().toDateString();

            // যদি শেষ ক্লেমের তারিখ আজকের তারিখের সাথে মিলে যায়, তারমানে আজ অলরেডি ক্লেমড
            if (lastClaimDate === today) {
                canClaimToday = false;
                currentStreak = lastCheckIn.day;
            } else {
                // চেক করা যে গতকাল ক্লেম করেছিল কি না (Streak মেইনটেইন করার জন্য)
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                
                if (lastClaimDate === yesterday.toDateString()) {
                    currentStreak = lastCheckIn.day === 7 ? 0 : lastCheckIn.day; // ৭ দিন হয়ে গেলে আবার ০ থেকে শুরু
                } else {
                    currentStreak = 0; // একদিন মিস করলে স্ট্রিক ভেঙে যাবে
                }
            }
        }

        // পরবর্তী কোন দিনটি ক্লেম করতে হবে তা নির্ধারণ করা
        let nextClaimDay = currentStreak + 1;
        if (nextClaimDay > 7) nextClaimDay = 1;

        res.status(200).json({
            success: true,
            canClaimToday,
            currentStreak,
            nextClaimDay,
            lastClaimedDay: canClaimToday ? currentStreak : lastClaimedDay
        });

    } catch (error) {
        console.error("Get CheckIn Status Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};

// 🚀 ২. আজকের রিওয়ার্ড ক্লেম করার মূল ইঞ্জিন
exports.claimReward = async (req, res) => {
    const user_id = req.user.id;
    
    // UI অনুযায়ী ৭ দিনের ফিক্সড রিওয়ার্ড লিস্ট
    const rewards = { 1: 10, 2: 20, 3: 30, 4: 50, 5: 60, 6: 80, 7: 150 };

    try {
        // ডাটাবেজ ট্রানজেকশন শুরু (যাতে একই সাথে দুই টেবিলে ডাটা সেভ নিশ্চিত হয়)
        await db.query('BEGIN');

        // আবার চেক করা আজ অলরেডি ক্লেম করা হয়েছে কি না
        const checkQuery = await db.query(
            "SELECT * FROM daily_checkins WHERE user_id = $1 AND DATE(claimed_at) = CURRENT_DATE",
            [user_id]
        );

        if (checkQuery.rows.length > 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ success: false, error: "You have already claimed today's reward!" });
        }

        // শেষ ক্লেম ডে বের করে কারেন্ট ডে হিসেব করা
        const lastCheckInQuery = await db.query(
            'SELECT day, claimed_at FROM daily_checkins WHERE user_id = $1 ORDER BY claimed_at DESC LIMIT 1',
            [user_id]
        );

        let nextDay = 1;
        if (lastCheckInQuery.rows.length > 0) {
            const lastCheckIn = lastCheckInQuery.rows[0];
            const lastClaimDate = new Date(lastCheckIn.claimed_at).toDateString();
            
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            // যদি গতকাল ক্লেম করে থাকে তবে ডে ১ বাড়বে, নয়তো আবার ডে ১ থেকে শুরু
            if (lastClaimDate === yesterday.toDateString()) {
                nextDay = lastCheckIn.day === 7 ? 1 : lastCheckIn.day + 1;
            }
        }

        const rewardCoin = rewards[nextDay];
        // ধরুন আপনার প্রজেক্টের রুলস অনুযায়ী ১০০ কয়েন = ১ ডলার
        const rewardDollar = rewardCoin / 100; 

        // ১. daily_checkins টেবিলে নতুন লগ ইনসার্ট করা
        await db.query(
            'INSERT INTO daily_checkins (user_id, day, reward_coin, claimed_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
            [user_id, nextDay, rewardCoin]
        );

        // ২. wallets টেবিলে টোটাল কয়েন এবং ডলার যোগ করা (আপডেট)
        await db.query(
            'UPDATE wallets SET total_coin = total_coin + $1, total_cash = total_cash + $2 WHERE user_id = $3',
            [rewardCoin, rewardDollar, user_id]
        );

        // ট্রানজেকশন সফলভাবে শেষ করা
        await db.query('COMMIT');

        res.status(200).json({
            success: true,
            message: `Successfully claimed ${rewardCoin} Coins! 🎉`,
            day: nextDay,
            reward_coin: rewardCoin
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error("Claim Reward Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};