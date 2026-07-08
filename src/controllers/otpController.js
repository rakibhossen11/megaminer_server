const db = require('../config/db');

// 📩 ১. ওটিপি জেনারেট এবং সেন্ড করার কন্ট্রোলার
exports.sendOTP = async (req, res) => {
    const { user_id, email, phone, purpose } = req.body;
    console.log({ user_id, email, phone, purpose });

    if (!user_id || !purpose) {
        return res.status(400).json({ success: false, error: "User ID and Purpose are required" });
    }

    try {
        // ৬ ডিজিটের একটি র্যান্ডম ওটিপি তৈরি করা
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // ওটিপির মেয়াদ ৫ মিনিট সেট করা (কারেন্ট টাইম + ৫ মিনিট)
        const expires_at = new Date(Date.now() + 5 * 60 * 1000); 

        const queryText = `
            INSERT INTO otp_verifications (user_id, email, phone, otp, purpose, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        const values = [user_id, email || null, phone || null, otp, purpose, expires_at];
        await db.query(queryText, values);

        // 💡 নোট: এখানে রিয়েল প্রোডাকশনে nodemailer (ইমেইলের জন্য) বা bulk sms api (ফোনের জন্য) কল হবে।
        res.status(200).json({
            success: true,
            message: `OTP sent successfully via ${email ? 'Email' : 'SMS'}! 📩`,
            otp_preview: otp, // ⚠️ টেস্ট করার সুবিধার জন্য ওটিপিটি রেসপন্সে পাঠিয়ে দেওয়া হলো
            expires_at
        });

    } catch (error) {
        console.error("Send OTP Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};

// 🔑 ২. ওটিপি ম্যাচ ও ভেরিফাই করার কন্ট্রোলার
exports.verifyOTP = async (req, res) => {
    const { user_id, otp, purpose } = req.body;

    if (!user_id || !otp || !purpose) {
        return res.status(400).json({ success: false, error: "All fields are required" });
    }

    try {
        // ডাটাবেজ থেকে এই ইউজারের শেষ ওটিপিটি খুঁজে বের করা
        const otpQuery = await db.query(
            `SELECT * FROM otp_verifications 
             WHERE user_id = $1 AND purpose = $2 
             ORDER BY created_at DESC LIMIT 1`,
            [user_id, purpose]
        );

        const otpRecord = otpQuery.rows[0];

        // ওটিপি রেকর্ড না পাওয়া গেলে
        if (!otpRecord) {
            return res.status(404).json({ success: false, error: "No OTP request found for this purpose" });
        }

        // ওটিপি অলরেডি ভেরিফাইড কি না চেক
        if (otpRecord.verified) {
            return res.status(400).json({ success: false, error: "This OTP has already been used" });
        }

        // ওটিপির কোড মিলছে কি না চেক
        if (otpRecord.otp !== otp) {
            return res.status(400).json({ success: false, error: "Invalid OTP code. Please try again." });
        }

        // ওটিপির মেয়াদ শেষ কি না চেক (Expired Check)
        const currentTime = new Date();
        if (currentTime > new Date(otpRecord.expires_at)) {
            return res.status(400).json({ success: false, error: "OTP has expired. Please request a new one." });
        }

        // সব কন্ডিশন পাস হলে ওটিপি টেবিল এবং মেইন ইউজার টেবিল আপডেট করা
        await db.query('UPDATE otp_verifications SET verified = TRUE WHERE id = $1', [otpRecord.id]);

        if (purpose === 'Email_Verification') {
            await db.query('UPDATE users SET email_verified = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [user_id]);
        } else if (purpose === 'Phone_Verification') {
            await db.query('UPDATE users SET phone_verified = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [user_id]);
        }

        res.status(200).json({
            success: true,
            message: `OTP verified successfully! Your ${purpose.replace('_', ' ')} is complete. 🎉`
        });

    } catch (error) {
        console.error("Verify OTP Error:", error);
        res.status(500).json({ success: false, error: "Internal Database Error." });
    }
};