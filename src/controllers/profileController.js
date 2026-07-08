const db = require('../config/db');

// 📝 ইউজার প্রোফাইল আপডেট বা তৈরি করার কন্ট্রোলার
exports.updateProfile = async (req, res) => {
    // নোট: রিয়েল অ্যাপে 'user_id' টোকেন (JWT) থেকে আসবে। আপাতত আমরা বডি থেকে নিচ্ছি টেস্ট করার জন্য।
    const { user_id, gender, date_of_birth, country, city, address, postal_code, profile_image, bio } = req.body;

    if (!user_id) {
        return res.status(400).json({ success: false, error: "User ID is required" });
    }

    try {
        // ১. চেক করা—ইউজারের প্রোফাইল কি আগে থেকেই আছে?
        const profileCheck = await db.query('SELECT * FROM user_profiles WHERE user_id = $1', [user_id]);

        let queryText = '';
        let values = [];

        if (profileCheck.rows.length > 0) {
            // ২. প্রোফাইল থাকলে ডাটা UPDATE হবে
            queryText = `
                UPDATE user_profiles 
                SET gender = $2, date_of_birth = $3, country = $4, city = $5, address = $6, postal_code = $7, profile_image = $8, bio = $9, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $1
                RETURNING *
            `;
            values = [user_id, gender, date_of_birth, country, city, address, postal_code, profile_image, bio];
        } else {
            // ৩. প্রোফাইল না থাকলে নতুন INSERT হবে
            queryText = `
                INSERT INTO user_profiles (user_id, gender, date_of_birth, country, city, address, postal_code, profile_image, bio)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;
            values = [user_id, gender, date_of_birth, country, city, address, postal_code, profile_image, bio];
        }

        const updatedProfile = await db.query(queryText, values);

        res.status(200).json({
            success: true,
            message: "Profile updated successfully! 👤",
            profile: updatedProfile.rows[0]
        });

    } catch (error) {
        console.error("Profile Controller Error:", error);
        res.status(500).json({ success: false, error: "Internal Database Server Error." });
    }
};

// 🔍 প্রোফাইল ডাটা গেট/ভিউ করার কন্ট্রোলার
exports.getProfile = async (req, res) => {
    const { user_id } = req.params;
    // console.log(user_id);

    try {
        // এখানে আমরা users এবং user_profiles দুটি টেবিল JOIN করে ডাটা নিয়ে আসবো
        const profileQuery = await db.query(`
            SELECT u.id, u.username, u.full_name, u.email, p.gender, p.date_of_birth, p.country, p.city, p.address, p.profile_image, p.bio
            FROM users u
            LEFT JOIN user_profiles p ON u.id = p.user_id
            WHERE u.id = $1
        `, [user_id]);

        if (profileQuery.rows.length === 0) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        res.status(200).json({
            success: true,
            data: profileQuery.rows[0]
        });

    } catch (error) {
        console.error("Get Profile Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};