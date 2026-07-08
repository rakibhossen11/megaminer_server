const db = require('../config/db');

// 🎁 দৈনিক রিওয়ার্ড ক্লেইম করার মূল কন্ট্রোলার
exports.claimDailyCheckin = async (req, res) => {
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).json({ success: false, error: "User ID is required" });
    }

    try {
        // ১. ইউজারের ওয়ালেট আইডি এবং কারেন্ট স্ট্রেইক তথ্য নিয়ে আসা
        const userQuery = await db.query(
            'SELECT u.current_streak, u.last_check_in_at, w.id as wallet_id FROM users u JOIN wallets w ON u.id = w.user_id WHERE u.id = $1',
            [user_id]
        );

        if (userQuery.rows.length === 0) {
            return res.status(404).json({ success: false, error: "User or Wallet not found" });
        }

        const { current_streak, last_check_in_at, wallet_id } = userQuery.rows[0];

        // ২. [🔒 সিকিউরিটি চেক]: ইউজার কি আজকে অলরেডি ক্লেইম করেছে?
        if (last_check_in_at) {
            const today = new Date().toDateString();
            const lastClaimDate = new Date(last_check_in_at).toDateString();

            if (today === lastClaimDate) {
                return res.status(400).json({ 
                    success: false, 
                    error: "Already claimed today! Come back tomorrow. ⏳" 
                });
            }
        }

        // ৩. স্ট্রেইক এবং ডে (Day) ক্যালকুলেশন লজিক
        let nextStreak = 1; // ডিফল্ট বা স্ট্রেইক ভেঙে গেলে Day 1
        const now = new Date();

        if (last_check_in_at) {
            const timeDiff = now - new Date(last_check_in_at);
            const hoursDiff = timeDiff / (1000 * 60 * 60);

            if (hoursDiff <= 48) {
                // যদি ৪৮ ঘণ্টার মধ্যে আবার ক্লেইম করে, তবে স্ট্রেইক সচল থাকবে এবং ১ দিন বাড়বে
                nextStreak = current_streak >= 7 ? 1 : current_streak + 1; // ৭ দিন শেষ হলে আবার ১ থেকে শুরু
            }
        }

        // ৪. দিন অনুযায়ী ডাইনামিক কয়েন সেট করা (যেমন: Day 1 = 10 coins, Day 7 = 100 coins)
        const coinRewards = { 1: 10, 2: 20, 3: 30, 4: 40, 5: 50, 6: 60, 7: 100 };
        const rewardCoin = coinRewards[nextStreak] || 10;

        // ৫. ডাটাবেজ ট্রানজেকশন (BEGIN) যাতে সব টেবিলে একসাথে ডাটা সেভ হয়
        await db.query('BEGIN');

        // ক) daily_checkins টেবিলে রেকর্ড ইনসার্ট
        await db.query(
            'INSERT INTO daily_checkins (user_id, day, reward_coin) VALUES ($1, $2, $3)',
            [user_id, nextStreak, rewardCoin]
        );

        // খ) users টেবিলে স্ট্রেইক ও লাস্ট ক্লেইম টাইম আপডেট
        await db.query(
            'UPDATE users SET current_streak = $1, last_check_in_at = CURRENT_TIMESTAMP WHERE id = $2',
            [nextStreak, user_id]
        );

        // গ) wallet_transactions টেবিলে রসিদ তৈরি
        await db.query(
            `INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, source, description) 
             VALUES ($1, 'Credit', $2, 'Daily_Checkin', $3)`,
            [wallet_id, rewardCoin, `Claimed Day ${nextStreak} daily bonus!`]
        );

        // ঘ) মূল wallets টেবিলে কয়েন ব্যালেন্স বাড়িয়ে দেওয়া
        await db.query(
            'UPDATE wallets SET available_coin = available_coin + $1, total_coin = total_coin + $1 WHERE id = $2',
            [rewardCoin, wallet_id]
        );

        await db.query('COMMIT'); // সব সফলভাবে সেভ হলো

        res.status(200).json({
            success: true,
            message: `Successfully claimed Day ${nextStreak} reward! 🎉`,
            reward_coin: rewardCoin,
            current_streak: nextStreak
        });

    } catch (error) {
        await db.query('ROLLBACK'); // এরর হলে আগের জায়গায় ফেরত যাবে
        console.error("Daily Checkin Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};

// 📺 ভিডিও অ্যাড রিওয়ার্ড ক্লেইম করার কন্ট্রোলার (rewardController.js এর নিচে যোগ করো)
exports.watchRewardAd = async (req, res) => {
    const { user_id, ad_network, reward_coin } = req.body;

    // ১. ইনপুট ভ্যালিডেশন চেক
    if (!user_id || !ad_network || !reward_coin) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    try {
        // ২. ইউজারের ওয়ালেট আইডি এবং লিমিট চেক করার জন্য ডাটা নিয়ে আসা
        const walletQuery = await db.query('SELECT id FROM wallets WHERE user_id = $1', [user_id]);
        if (walletQuery.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Wallet not found for this user." });
        }
        const wallet_id = walletQuery.rows[0].id;

        // 🔒 [💥 সিকিউরিটি চেক]: একজন ইউজার ২৪ ঘণ্টায় সর্বোচ্চ কতটি অ্যাড দেখতে পারবে?
        // ধরা যাক দৈনিক সর্বোচ্চ লিমিট ২০টি অ্যাড।
        const dailyAdCountQuery = await db.query(
            `SELECT COUNT(*) FROM reward_ads 
             WHERE user_id = $1 AND watched_at >= NOW() - INTERVAL '1 day'`,
            [user_id]
        );
        
        const watchedToday = parseInt(dailyAdCountQuery.rows[0].count);
        const MAX_DAILY_ADS = 20;

        if (watchedToday >= MAX_DAILY_ADS) {
            return res.status(429).json({ 
                success: false, 
                error: `Daily video ad limit reached (${MAX_DAILY_ADS}/${MAX_DAILY_ADS}). Please try again tomorrow! ⏳` 
            });
        }

        // ৩. ডাটাবেজ ট্রানজেকশন (BEGIN) শুরু
        await db.query('BEGIN');

        // ক) reward_ads টেবিলে বিজ্ঞাপন দেখার রেকর্ড ইনসার্ট
        const newAdRecord = await db.query(
            'INSERT INTO reward_ads (user_id, ad_network, reward_coin) VALUES ($1, $2, $3) RETURNING *',
            [user_id, ad_network, reward_coin]
        );

        // খ) wallet_transactions টেবিলে রসিদ তৈরি
        await db.query(
            `INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, source, description) 
             VALUES ($1, 'Credit', $2, 'Reward_Ad', $3)`,
            [wallet_id, reward_coin, `Earned ${reward_coin} coins by watching a video ad from ${ad_network}.`]
        );

        // গ) মূল wallets টেবিলে কয়েন ব্যালেন্স বাড়িয়ে দেওয়া
        await db.query(
            'UPDATE wallets SET available_coin = available_coin + $1, total_coin = total_coin + $1 WHERE id = $2',
            [reward_coin, wallet_id]
        );

        await db.query('COMMIT'); // সব ডাটা একসাথে সেভ হলো

        res.status(201).json({
            success: true,
            message: `Reward credited successfully! 🪙`,
            remaining_ads_today: MAX_DAILY_ADS - (watchedToday + 1),
            ad_record: newAdRecord.rows[0]
        });

    } catch (error) {
        await db.query('ROLLBACK'); // এরর হলে পুরো প্রসেস বাতিল হবে
        console.error("Reward Ad Controller Error:", error);
        res.status(500).json({ success: false, error: "Internal Database Server Error." });
    }
};

// 🎡 লাকি স্পিনের রেজাল্ট সেভ ও রিওয়ার্ড ক্রেডিট করার কন্ট্রোলার (rewardController.js এর নিচে যোগ করো)
exports.saveSpinResult = async (req, res) => {
    const { user_id, reward_coin, reward_type } = req.body; // reward_type হবে 'Coin' অথবা 'Cash'

    if (!user_id || reward_coin === undefined || !reward_type) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    try {
        // ১. ইউজারের ওয়ালেট আইডি খুঁজে বের করা
        const walletQuery = await db.query('SELECT id FROM wallets WHERE user_id = $1', [user_id]);
        if (walletQuery.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Wallet not found for this user." });
        }
        const wallet_id = walletQuery.rows[0].id;

        // 🔒 [💥 সিকিউরিটি লিমিট]: ২৪ ঘণ্টায় একজন ইউজার সর্বোচ্চ কতটি স্পিন করতে পারবে?
        // ধরা যাক দৈনিক সর্বোচ্চ লিমিট ৫টি স্পিন।
        const dailySpinCountQuery = await db.query(
            `SELECT COUNT(*) FROM spin_history 
             WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '1 day'`,
            [user_id]
        );
        
        const spunToday = parseInt(dailySpinCountQuery.rows[0].count);
        const MAX_DAILY_SPINS = 5;

        if (spunToday >= MAX_DAILY_SPINS) {
            return res.status(429).json({ 
                success: false, 
                error: `Daily spin limit reached (${MAX_DAILY_SPINS}/${MAX_DAILY_SPINS}). Try again tomorrow! ⏳` 
            });
        }

        // ২. ডাটাবেজ ট্রানজেকশন (BEGIN) শুরু
        await db.query('BEGIN');

        // ক) spin_history টেবিলে রেকর্ড ইনসার্ট
        const newSpinRecord = await db.query(
            'INSERT INTO spin_history (user_id, reward_coin, reward_type) VALUES ($1, $2, $3) RETURNING *',
            [user_id, reward_coin, reward_type]
        );

        // খ) যদি কোনো রিওয়ার্ড জিতে থাকে (reward_coin > 0)
        if (reward_coin > 0) {
            let walletUpdateQuery = '';
            let txDescription = '';

            if (reward_type === 'Coin') {
                // কয়েন জিতলে ওয়ালেটের কয়েন ব্যালেন্স আপডেট
                walletUpdateQuery = 'UPDATE wallets SET available_coin = available_coin + $1, total_coin = total_coin + $1 WHERE id = $2';
                txDescription = `Won ${reward_coin} coins from Lucky Fortune Wheel! 🎡`;

                // wallet_transactions লেজারে রসিদ তৈরি
                await db.query(
                    `INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, source, description) 
                     VALUES ($1, 'Credit', $2, 'Spin_History', $3)`,
                    [wallet_id, reward_coin, txDescription]
                );
            } else if (reward_type === 'Cash') {
                // ক্যাশ/ডলার জিতলে ওয়ালেটের ক্যাশ ব্যালেন্স আপডেট (ধরা যাক ওয়ান কয়েন = ১ সেন্ট বা ডিরেক্ট ভ্যালু)
                walletUpdateQuery = 'UPDATE wallets SET available_cash = available_cash + $1, total_cash = total_cash + $1 WHERE id = $2';
                txDescription = `Won $${reward_coin} cash prize from Lucky Fortune Wheel! 💵`;
                
                // নোট: ক্যাশ ট্রানজেকশনের জন্য ট্রানজেকশন লেজারেও রেকর্ড পাঠানো হলো
                await db.query(
                    `INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, source, description) 
                     VALUES ($1, 'Credit', $2, 'Spin_History', $3)`,
                    [wallet_id, reward_coin, txDescription]
                );
            }

            await db.query(walletUpdateQuery, [reward_coin, wallet_id]);
        }

        await db.query('COMMIT'); // সব ডাটা পার্মানেন্টলি সেভ হলো

        res.status(201).json({
            success: true,
            message: reward_coin > 0 ? `Congratulations! You won ${reward_coin} ${reward_type}! 🎉` : "Better luck next time! 🔄",
            remaining_spins_today: MAX_DAILY_SPINS - (spunToday + 1),
            spin_record: newSpinRecord.rows[0]
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error("Spin Controller Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};

// 🎫 স্ক্র্যাচ কার্ডের রেজাল্ট সেভ ও রিওয়ার্ড ক্রেডিট করার কন্ট্রোলার (rewardController.js এর নিচে যোগ করো)
exports.saveScratchResult = async (req, res) => {
    const { user_id, reward_coin, reward_type } = req.body; // reward_type হবে 'Coin' অথবা 'Cash'

    if (!user_id || reward_coin === undefined || !reward_type) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    try {
        // ১. ইউজারের ওয়ালেট আইডি খুঁজে বের করা
        const walletQuery = await db.query('SELECT id FROM wallets WHERE user_id = $1', [user_id]);
        if (walletQuery.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Wallet not found for this user." });
        }
        const wallet_id = walletQuery.rows[0].id;

        // 🔒 [💥 সিকিউরিটি লিমিট]: ২৪ ঘণ্টায় একজন ইউজার সর্বোচ্চ কতটি কার্ড স্ক্র্যাচ করতে পারবে?
        // ধরা যাক দৈনিক সর্বোচ্চ লিমিট ৫টি স্ক্র্যাচ কার্ড।
        const dailyScratchCountQuery = await db.query(
            `SELECT COUNT(*) FROM scratch_history 
             WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '1 day'`,
            [user_id]
        );
        
        const scratchedToday = parseInt(dailyScratchCountQuery.rows[0].count);
        const MAX_DAILY_SCRATCH = 5;

        if (scratchedToday >= MAX_DAILY_SCRATCH) {
            return res.status(429).json({ 
                success: false, 
                error: `Daily scratch limit reached (${MAX_DAILY_SCRATCH}/${MAX_DAILY_SCRATCH}). Try again tomorrow! ⏳` 
            });
        }

        // ২. ডাটাবেজ ট্রানজেকশন (BEGIN) শুরু
        await db.query('BEGIN');

        // ক) scratch_history টেবিলে রেকর্ড ইনসার্ট
        const newScratchRecord = await db.query(
            'INSERT INTO scratch_history (user_id, reward_coin, reward_type) VALUES ($1, $2, $3) RETURNING *',
            [user_id, reward_coin, reward_type]
        );

        // খ) যদি কোনো রিওয়ার্ড জিতে থাকে (reward_coin > 0)
        if (reward_coin > 0) {
            let walletUpdateQuery = '';
            let txDescription = '';

            if (reward_type === 'Coin') {
                walletUpdateQuery = 'UPDATE wallets SET available_coin = available_coin + $1, total_coin = total_coin + $1 WHERE id = $2';
                txDescription = `Won ${reward_coin} coins from Scratch Card! 🎫`;
            } else if (reward_type === 'Cash') {
                walletUpdateQuery = 'UPDATE wallets SET available_cash = available_cash + $1, total_cash = total_cash + $1 WHERE id = $2';
                txDescription = `Won $${reward_coin} cash from Scratch Card! 💵`;
            }

            // wallets টেবিল আপডেট
            await db.query(walletUpdateQuery, [reward_coin, wallet_id]);

            // wallet_transactions লেজারে স্টেটমেন্ট তৈরি
            await db.query(
                `INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, source, description) 
                 VALUES ($1, 'Credit', $2, 'Scratch_History', $3)`,
                [wallet_id, reward_coin, txDescription]
            );
        }

        await db.query('COMMIT'); // সব ডাটা একসাথে সেভ হলো

        res.status(201).json({
            success: true,
            message: reward_coin > 0 ? `Awesome! You scratched and won ${reward_coin} ${reward_type}! 🎉` : "Better luck with the next card! 🎫",
            remaining_scratch_today: MAX_DAILY_SCRATCH - (scratchedToday + 1),
            scratch_record: newScratchRecord.rows[0]
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error("Scratch Controller Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};