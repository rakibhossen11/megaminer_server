const db = require('../config/db');

exports.playSpin = async (req, res) => {
    const user_id = req.user.id;
    
    // 🎡 স্পিন হুইলের সম্ভাব্য রেওয়ার্ড অপশনসমূহ
    const spinOptions = [10, 20, 0, 50, 5, 15, 30, 100];

    try {
        const randomIndex = Math.floor(Math.random() * spinOptions.length);
        const rewardCoin = spinOptions[randomIndex];
        
        // 🎯 ফিক্স: "coin" এবং "empty" এর বদলে বড় হাতের 'COIN' এবং 'EMPTY' ব্যবহার করা হলো
        // (যদি আপনার ডাটাবেজে অন্য কোনো নাম থাকে, তবে 'COIN' এর জায়গায় সেটি বসাবেন)
        const rewardType = rewardCoin > 0 ? 'Coin' : 'cash'; 
        
        const rewardDollar = rewardCoin / 100;

        await db.query('BEGIN');

        // spin_logs টেবিলে ডেটা ইনসার্ট করা
        await db.query(
            'INSERT INTO spin_history (user_id, reward_coin, reward_type, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
            [user_id, rewardCoin, rewardType] // $3 তে এখন 'COIN' অথবা 'EMPTY' যাবে
        );

        if (rewardCoin > 0) {
            await db.query(
                'UPDATE wallets SET total_coin = total_coin + $1, total_cash = total_cash + $2 WHERE user_id = $3',
                [rewardCoin, rewardDollar, user_id]
            );
        }

        await db.query('COMMIT');

        res.status(200).json({
            success: true,
            winningIndex: randomIndex,
            rewardCoin: rewardCoin,
            message: rewardCoin > 0 ? `You won ${rewardCoin} Coins! 🎉` : `Better luck next time! 👍`
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error("Spin Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};


// 📊 আজকের বাকি স্পিন লিমিট চেক করার ফাংশন
exports.getSpinStatus = async (req, res) => {
    const user_id = req.user.id;
    const DAILY_LIMIT = 3; // ডেইলি ৩টা স্পিন লিমিট

    try {
        // আজ ইউজার কয়টি স্পিন করেছে তা কাউন্ট করা
        const countQuery = await db.query(
            "SELECT COUNT(*) FROM spin_history WHERE user_id = $1 AND DATE(created_at) = CURRENT_DATE",
            [user_id]
        );

        const spinsDone = parseInt(countQuery.rows[0].count);
        const spinsLeft = Math.max(0, DAILY_LIMIT - spinsDone);

        res.status(200).json({
            success: true,
            spinsLeft: spinsLeft
        });
    } catch (error) {
        console.error("Spin Status Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};