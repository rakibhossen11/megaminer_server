const db = require('../config/db');

// 🔍 ইউজারের ওয়ালেট ব্যালেন্স দেখার কন্ট্রোলার
exports.getWalletBalance = async (req, res) => {
    const { user_id } = req.params;

    if (!user_id) {
        return res.status(400).json({ success: false, error: "User ID is required" });
    }

    try {
        // ডাটাবেজ থেকে ওই ইউজারের ওয়ালেট রো নিয়ে আসা
        const walletQuery = await db.query(
            'SELECT * FROM wallets WHERE user_id = $1',
            [user_id]
        );

        const wallet = walletQuery.rows[0];

        if (!wallet) {
            return res.status(404).json({ success: false, error: "Wallet not found for this user." });
        }

        res.status(200).json({
            success: true,
            data: wallet
        });

    } catch (error) {
        console.error("Get Wallet Balance Error:", error);
        res.status(500).json({ success: false, error: "Internal Database Error." });
    }
};