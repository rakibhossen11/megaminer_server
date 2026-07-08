const db = require('../config/db');
const jwt = require('jsonwebtoken');

// 🔄 পুরনো রিফ্রেশ টোকেন যাচাই করে নতুন Access Token জেনারেট করার কন্ট্রোলার
exports.refreshAccessToken = async (req, res) => {
    const { refresh_token } = req.body;

    if (!refresh_token) {
        return res.status(400).json({ success: false, error: "Refresh Token is required" });
    }

    try {
        // ১. ডাটাবেজে টোকেনটি আছে কি না এবং বাতিল (revoked) করা হয়েছে কি না চেক
        const tokenQuery = await db.query(
            'SELECT * FROM refresh_tokens WHERE token = $1',
            [refresh_token]
        );

        const tokenRecord = tokenQuery.rows[0];

        if (!tokenRecord) {
            return res.status(401).json({ success: false, error: "Invalid Refresh Token" });
        }

        if (tokenRecord.revoked) {
            return res.status(403).json({ success: false, error: "This token has been revoked / suspended" });
        }

        // ২. মেয়াদের তারিখ শেষ কি না চেক (Expired Check)
        if (new Date() > new Date(tokenRecord.expires_at)) {
            return res.status(401).json({ success: false, error: "Refresh token expired. Please login again." });
        }

        // ৩. JWT ভেরিফাই করা
        jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
            if (err) {
                return res.status(403).json({ success: false, error: "Token verification failed" });
            }

            // ৪. মেইন ইউজার টেবিল থেকে ইউজারের কারেন্ট রোল আইডি নিয়ে আসা
            const userQuery = await db.query('SELECT role_id, username FROM users WHERE id = $1', [tokenRecord.user_id]);
            const user = userQuery.rows[0];

            if (!user) {
                return res.status(404).json({ success: false, error: "User not found" });
            }

            // ৫. নতুন একটি শর্ট-টাইম Access Token জেনারেট করা
            const newAccessToken = jwt.sign(
                { id: tokenRecord.user_id, username: user.username, role_id: user.role_id },
                process.env.JWT_SECRET,
                { expiresIn: '1h' } // নতুন এক্সেস টোকেন ১ ঘণ্টার জন্য সচল থাকবে
            );

            res.status(200).json({
                success: true,
                access_token: newAccessToken
            });
        });

    } catch (error) {
        console.error("Refresh Token Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};

// 🚫 ডিভাইস থেকে লগআউট বা টোকেন বাতিল (Revoke) করার কন্ট্রোলার
exports.revokeToken = async (req, res) => {
    const { refresh_token } = req.body;

    try {
        await db.query('UPDATE refresh_tokens SET revoked = TRUE WHERE token = $1', [refresh_token]);
        res.status(200).json({ success: true, message: "Token revoked successfully (Logged out) 🔒" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
};