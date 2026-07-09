const db = require('../config/db');

// ➕ ১. নতুন মেম্বারশিপ প্ল্যান যোগ করার কন্ট্রোলার (Admin Route)
exports.addPlan = async (req, res) => {
    const { title, duration, price, bonus_percentage, status } = req.body;

    if (!title || !duration || price === undefined) {
        return res.status(400).json({ success: false, error: "Title, duration, and price are required." });
    }

    try {
        const queryText = `
            INSERT INTO membership_plans (title, duration, price, bonus_percentage, status)
            VALUES ($1, $2, $3, $4, $5) RETURNING *
        `;
        const values = [title, duration, price, bonus_percentage || 0, status || 'Active'];
        const newPlan = await db.query(queryText, values);

        res.status(201).json({
            success: true,
            message: "New membership subscription plan added! 💎",
            plan: newPlan.rows[0]
        });

    } catch (error) {
        console.error("Add Plan Error:", error);
        if (error.code === '23505') {
            return res.status(400).json({ success: false, error: "A membership plan with this title already exists." });
        }
        res.status(500).json({ success: false, error: "Internal Database Error." });
    }
};

// 🔍 ২. অ্যাপ ফ্রন্টএন্ডের জন্য সব একটিভ ভিআইপি প্ল্যান লিস্ট দেখার কন্ট্রোলার
exports.getAllPlans = async (req, res) => {
    try {
        const plans = await db.query("SELECT * FROM membership_plans WHERE status = 'Active' ORDER BY price ASC");
        
        res.status(200).json({
            success: true,
            count: plans.rows.length,
            plans: plans.rows
        });
    } catch (error) {
        console.error("Get All Plans Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};

// 💎 ইউজার কর্তৃক ভিআইপি মেম্বারশিপ প্ল্যান কেনার কোর ইঞ্জিন (planController.js এর নিচে যোগ করো)
exports.buyMembership = async (req, res) => {
    const { user_id, membership_id } = req.body;

    if (!user_id || !membership_id) {
        return res.status(400).json({ success: false, error: "User ID and Membership Plan ID are required." });
    }

    try {
        // ১. চেক করা: এই প্ল্যানটি ডাটাবেজে একটিভ আছে কি না এবং এর প্রাইস ও ডিউরেশন কত?
        const planQuery = await db.query('SELECT * FROM membership_plans WHERE id = $1 AND status = \'Active\'', [membership_id]);
        if (planQuery.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Active membership plan not found." });
        }
        const plan = planQuery.rows[0];
        const planPrice = parseFloat(plan.price);
        const planDurationDays = parseInt(plan.duration);

        // ২. [🔒 সিকিউরিটি চেক]: ইউজার অলরেডি কোনো একটিভ সাবস্ক্রিপশনে আছে কি না?
        const activeSubCheck = await db.query(
            'SELECT id FROM user_subscriptions WHERE user_id = $1 AND status = \'Active\' AND end_date > NOW()',
            [user_id]
        );
        if (activeSubCheck.rows.length > 0) {
            return res.status(400).json({ success: false, error: "You already have an active VIP membership plan." });
        }

        // ৩. ডাটাবেজ ট্রানজেকশন (BEGIN) শুরু
        await db.query('BEGIN');

        // ৪. ইউজারের ওয়ালেট চেক করা এবং পর্যাপ্ত ব্যালেন্স আছে কি না তা যাচাই করা
        const walletQuery = await db.query('SELECT id, available_cash FROM wallets WHERE user_id = $1', [user_id]);
        if (walletQuery.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ success: false, error: "Wallet not found for this user." });
        }

        const wallet = walletQuery.rows[0];
        const userBalance = parseFloat(wallet.available_cash);

        if (userBalance < planPrice) {
            await db.query('ROLLBACK');
            return res.status(400).json({ success: false, error: `Insufficient balance. This plan costs $${planPrice}` });
        }

        // ৫. ওয়ালেট থেকে প্যাকেজের টাকা কেটে নেওয়া (Debit)
        await db.query(
            'UPDATE wallets SET available_cash = available_cash - $1 WHERE id = $2',
            [planPrice, wallet.id]
        );

        // ৬. মেয়াদ বা end_date ক্যালকুলেট করা (কারেন্ট টাইম + প্ল্যানের দিন সংখ্যা)
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + planDurationDays);

        // ৭. user_subscriptions টেবিলে সাবস্ক্রিপশন রেকর্ড তৈরি করা
        const subInsertQuery = `
            INSERT INTO user_subscriptions (user_id, membership_id, end_date, status)
            VALUES ($1, $2, $3, 'Active') RETURNING *
        `;
        const newSubscription = await db.query(subInsertQuery, [user_id, membership_id, endDate]);

        // ৮. wallet_transactions লেজারে রসিদ বা স্টেটমেন্ট তৈরি করা
        await db.query(
            `INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, source, description) 
             VALUES ($1, 'Debit', $2, 'Withdraw', $3)`, // সোর্স 'Withdraw' বা নতুন ক্যাটাগরি 'Subscription' দিতে পারো
            [wallet.id, Math.round(planPrice), `Purchased VIP Membership Plan: ${plan.title}`]
        );

        await db.query('COMMIT'); // সব ডাটা পার্মানেন্টলি সেভ হলো

        res.status(201).json({
            success: true,
            message: `Congratulations! You are now a ${plan.title} member! 💎🚀`,
            subscription: newSubscription.rows[0]
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error("Buy Membership Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Processing Error." });
    }
};