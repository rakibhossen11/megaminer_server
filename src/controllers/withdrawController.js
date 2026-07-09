const db = require('../config/db');

// 💸 ১. ইউজার সাইড: নতুন উইথড্রাল রিকোয়েস্ট সাবমিট করার কোর ইঞ্জিন
exports.requestWithdraw = async (req, res) => {
    const { user_id, payment_method, account_number, amount } = req.body;

    if (!user_id || !payment_method || !account_number || !amount) {
        return res.status(400).json({ success: false, error: "All fields are required." });
    }

    try {
        // ক) চেক করা: এই মেথডের মিনিমাম উইথড্রাল লিমিট কত?
        const methodCheck = await db.query(
            "SELECT minimum_amount FROM withdrawal_methods WHERE method_name = $1 AND status = 'Active'",
            [payment_method]
        );

        if (methodCheck.rows.length === 0) {
            return res.status(400).json({ success: false, error: "Selected payment method is currently disabled or invalid." });
        }

        const minAmount = parseFloat(methodCheck.rows[0].minimum_amount);
        if (parseFloat(amount) < minAmount) {
            return res.status(400).json({ success: false, error: `Minimum withdrawal amount for ${payment_method} is $${minAmount}` });
        }

        // খ) ডাটাবেজ ট্রানজেকশন (BEGIN) শুরু
        await db.query('BEGIN');

        // গ) [🔒 সিকিউরিটি চেক]: ইউজারের ওয়ালেটে পর্যাপ্ত 'available_cash' আছে কি না?
        const walletQuery = await db.query('SELECT id, available_cash FROM wallets WHERE user_id = $1', [user_id]);
        if (walletQuery.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ success: false, error: "Wallet not found." });
        }

        const wallet = walletQuery.rows[0];
        const currentBalance = parseFloat(wallet.available_cash);

        if (currentBalance < parseFloat(amount)) {
            await db.query('ROLLBACK');
            return res.status(400).json({ success: false, error: "Insufficient balance in your wallet." });
        }

        // ঘ) ১. মেইন ওয়ালেট থেকে ব্যালেন্স কেটে নেওয়া (Debit করা)
        await db.query(
            'UPDATE wallets SET available_cash = available_cash - $1 WHERE id = $2',
            [amount, wallet.id]
        );

        // ঙ) ২. withdrawals টেবিলে পেন্ডিং রিকোয়েস্ট সেভ করা
        const withdrawQuery = `
            INSERT INTO withdrawals (user_id, payment_method, account_number, amount, status)
            VALUES ($1, $2, $3, $4, 'Pending') RETURNING *
        `;
        const newWithdraw = await db.query(withdrawQuery, [user_id, payment_method, account_number, amount]);

        // চ) ৩. wallet_transactions লেজারে রসিদ জেনারেট করা
        await db.query(
            `INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, source, description, status) 
             VALUES ($1, 'Debit', $2, 'Withdraw', $3, 'Pending')`,
            [wallet.id, Math.round(amount), `Withdrawal request submitted to ${payment_method} (${account_number})`, 'Pending']
        );

        await db.query('COMMIT'); // সব কাজ সফলভাবে সেভ হলো

        res.status(201).json({
            success: true,
            message: "Withdrawal request submitted successfully! 💸 It will be processed soon.",
            withdraw: newWithdraw.rows[0]
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error("Withdraw Request Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};

// 👑 ২. অ্যাডমিন সাইড: উইথড্রাল রিকোয়েস্ট এপ্রুভ বা রিজেক্ট (রিফান্ড) করার ইঞ্জিন
exports.processWithdrawStatus = async (req, res) => {
    const { withdraw_id, status, admin_note } = req.body; // status হবে 'Approved' বা 'Rejected'

    if (!withdraw_id || !status) {
        return res.status(400).json({ success: false, error: "Withdraw ID and Status are required." });
    }

    try {
        // ক) উইথড্রাল রিকোয়েস্টটি খুঁজে বের করা এবং ওটা পেন্ডিং আছে কি না চেক করা
        const withdrawQuery = await db.query('SELECT * FROM withdrawals WHERE id = $1', [withdraw_id]);
        if (withdrawQuery.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Withdrawal request not found." });
        }

        const withdrawal = withdrawQuery.rows[0];
        if (withdrawal.status !== 'Pending') {
            return res.status(400).json({ success: false, error: `This request has already been ${withdrawal.status}` });
        }

        await db.query('BEGIN');

        if (status === 'Approved') {
            // যদি এপ্রুভ হয়, তবে শুধু স্ট্যাটাস আপডেট হবে (টাকা আগেই কাটা হয়েছে)
            await db.query(
                `UPDATE withdrawals 
                 SET status = 'Approved', admin_note = $1, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = $2`,
                [admin_note || 'Payout released successfully.', withdraw_id]
            );
        } else if (status === 'Rejected') {
            // যদি রিজেক্ট হয়, তবে ইউজারের কেটে নেওয়া টাকা আবার ওয়ালেটে রিফান্ড (প্লাস) করে দিতে হবে!
            await db.query(
                'UPDATE wallets SET available_cash = available_cash + $1 WHERE user_id = $2',
                [withdrawal.amount, withdrawal.user_id]
            );

            // স্ট্যাটাস Rejected করা
            await db.query(
                `UPDATE withdrawals 
                 SET status = 'Rejected', admin_note = $1, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = $2`,
                [admin_note || 'Request rejected by admin.', withdraw_id]
            );
        }

        await db.query('COMMIT');

        res.status(200).json({
            success: true,
            message: `Withdrawal request has been successfully ${status}! ✨`
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error("Process Withdraw Status Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Processing Error." });
    }
};