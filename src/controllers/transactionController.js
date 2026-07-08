const db = require('../config/db');

// 💰 ১. ওয়ালেট ট্রানজেকশন প্রসেস করার মূল ইঞ্জিন (Credit/Debit Engine)
exports.addTransaction = async (req, res) => {
    const { wallet_id, transaction_type, amount, reference_id, source, description, status } = req.body;

    if (!wallet_id || !transaction_type || !amount || !source) {
        return res.status(400).json({ success: false, error: "Missing required transaction fields" });
    }

    // ডাটাবেজ ট্রানজেকশন শুরু (যাতে ওয়ালেট আপডেট ও হিস্ট্রি সেভ একসাথে সফল হয়)
    try {
        await db.query('BEGIN');

        // ১. আগে চেক করা ওয়ালেটটি আসলেই এক্সিস্ট করে কি না
        const walletCheck = await db.query('SELECT id, available_coin, total_coin FROM wallets WHERE id = $1', [wallet_id]);
        if (walletCheck.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ success: false, error: "Target wallet not found" });
        }

        const currentWallet = walletCheck.rows[0];

        // ২. যদি 'Debit' (কয়েন কাটা) হয়, তবে ইউজারের পর্যাপ্ত ব্যালেন্স আছে কি না চেক
        if (transaction_type === 'Debit' && currentWallet.available_coin < amount) {
            await db.query('ROLLBACK');
            return res.status(400).json({ success: false, error: "Insufficient coin balance for this transaction" });
        }

        // ৩. wallet_transactions টেবিলে স্টেটমেন্ট ইনসার্ট করা
        const txQuery = `
            INSERT INTO wallet_transactions (wallet_id, transaction_type, amount, reference_id, source, description, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        const txValues = [wallet_id, transaction_type, amount, reference_id || null, source, description || null, status || 'Success'];
        const newTx = await db.query(txQuery, txValues);

        // ৪. যদি স্ট্যাটাস 'Success' হয়, তবে মূল wallets টেবিলের ব্যালেন্স আপডেট করা
        if (status === 'Success' || !status) {
            let updateWalletQuery = '';
            
            if (transaction_type === 'Credit') {
                // কয়েন যোগ হলে available_coin এবং total_coin দুটোই বাড়বে
                updateWalletQuery = `
                    UPDATE wallets 
                    SET available_coin = available_coin + $2, total_coin = total_coin + $2, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = $1
                `;
            } else if (transaction_type === 'Debit') {
                // কয়েন খরচ বা উইথড্র হলে শুধু available_coin কমবে
                updateWalletQuery = `
                    UPDATE wallets 
                    SET available_coin = available_coin - $2, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = $1
                `;
            }
            await db.query(updateWalletQuery, [wallet_id, amount]);
        }

        // সব কাজ সফল হলে ডাটাবেজে পার্মানেন্ট সেভ করা (Commit)
        await db.query('COMMIT');

        res.status(201).json({
            success: true,
            message: `Transaction processed as ${transaction_type}! 💸`,
            transaction: newTx.rows[0]
        });

    } catch (error) {
        await db.query('ROLLBACK'); // কোনো ভুল হলে আগের অবস্থায় ফেরত যাবে (Safety First)
        console.error("Transaction Engine Error:", error);
        res.status(500).json({ success: false, error: "Internal Transaction Processing Error." });
    }
};

// 🔍 ২. নির্দিষ্ট ওয়ালেটের স্টেটমেন্ট/হিস্ট্রি দেখার কন্ট্রোলার
exports.getHistory = async (req, res) => {
    const { wallet_id } = req.params;

    try {
        const history = await db.query(
            'SELECT * FROM wallet_transactions WHERE wallet_id = $1 ORDER BY created_at DESC',
            [wallet_id]
        );

        res.status(200).json({
            success: true,
            count: history.rows.length,
            transactions: history.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
};