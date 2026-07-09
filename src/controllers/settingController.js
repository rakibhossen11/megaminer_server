const db = require('../config/db');
const { logAdminAction } = require('../utils/logger');

// 🔍 ১. অ্যাপের সেটিংস ডাটা নিয়ে আসার কন্ট্রোলার (Public/App Route)
exports.getSettings = async (req, res) => {
    try {
        const settings = await db.query('SELECT * FROM app_settings WHERE id = 1');
        
        res.status(200).json({
            success: true,
            settings: settings.rows[0]
        });
    } catch (error) {
        console.error("Get Settings Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};

// 🔄 ২. অ্যাডমিন প্যানেল থেকে সেটিংস আপডেট করার কন্ট্রোলার (Admin Route)
exports.updateSettings = async (req, res) => {
    const { app_name, app_version, minimum_withdraw, coin_rate, referral_bonus, daily_bonus, maintenance_mode, admin_id } = req.body;

    if (!admin_id) {
        return res.status(400).json({ success: false, error: "Admin ID is required for this action." });
    }

    try {
        // ক) পরিবর্তনের আগের ওল্ড ডাটা তুলে রাখা (অডিট লগের জন্য)
        const oldDataQuery = await db.query('SELECT * FROM app_settings WHERE id = 1');
        const oldData = oldDataQuery.rows[0];

        // খ) সেটিংস আপডেট করার কুয়েরি
        const queryText = `
            UPDATE app_settings 
            SET app_name = COALESCE($1, app_name),
                app_version = COALESCE($2, app_version),
                minimum_withdraw = COALESCE($3, minimum_withdraw),
                coin_rate = COALESCE($4, coin_rate),
                referral_bonus = COALESCE($5, referral_bonus),
                daily_bonus = COALESCE($6, daily_bonus),
                maintenance_mode = COALESCE($7, maintenance_mode),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1 RETURNING *
        `;
        const values = [
            app_name, 
            app_version, 
            minimum_withdraw, 
            coin_rate, 
            referral_bonus, 
            daily_bonus, 
            maintenance_mode
        ];

        const updatedSettings = await db.query(queryText, values);

        // গ) 🛡️ সিকিউরিটি অডিট লগে এই অ্যাকশনটি রেকর্ড করে রাখা
        await logAdminAction({
            admin_id: admin_id,
            action: 'UPDATE_APP_SETTINGS',
            target_table: 'app_settings',
            target_id: '1',
            old_value: oldData,
            new_value: updatedSettings.rows[0],
            ip_address: req.ip
        });

        res.status(200).json({
            success: true,
            message: "App global settings updated successfully! ⚙️",
            settings: updatedSettings.rows[0]
        });

    } catch (error) {
        console.error("Update Settings Error:", error);
        res.status(500).json({ success: false, error: "Internal Database Error." });
    }
};