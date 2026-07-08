const db = require('../config/db');

// 📱 ডিভাইস রেজিস্টার বা আপডেট করার কন্ট্রোলার
exports.saveDevice = async (req, res) => {
    const { user_id, device_id, device_name, os, app_version, fcm_token } = req.body;

    // ক্লায়েন্টের আইপি অ্যাড্রেস ক্যাচ করা
    const ip_address = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (!user_id || !device_id) {
        return res.status(400).json({ success: false, error: "User ID and Device ID are required" });
    }

    try {
        // 🔒 [💥 সিকিউরিটি চেক]: এই ডিভাইস আইডি দিয়ে অলরেডি অন্য কোনো ইউজার রেজিস্টার্ড কি না?
        const multiAccountCheck = await db.query(
            'SELECT user_id FROM user_devices WHERE device_id = $1 AND user_id != $2',
            [device_id, user_id]
        );

        // যদি একই ডিভাইসে অন্য কোনো ইউজারের আইডি পাওয়া যায়, তবে এটি মাল্টিপল অ্যাকাউন্ট চিটিং!
        let multi_account_detected = false;
        if (multiAccountCheck.rows.length > 0) {
            multi_account_detected = true;
            // তুমি চাইলে এখানে সরাসরি রেসপন্স ব্লক করে দিতে পারো, অথবা ফ্ল্যাগ ট্র্যাকিং করতে পারো।
            console.log(`⚠️ Security Alert: Multi-account detected on device ${device_id}`);
        }

        // ২. চেক করা—এই ইউজারের এই ডিভাইস কি আগে থেকেই ডাটাবেজে সেভ আছে?
        const deviceExists = await db.query(
            'SELECT * FROM user_devices WHERE user_id = $1 AND device_id = $2',
            [user_id, device_id]
        );

        let queryText = '';
        let values = [];

        if (deviceExists.rows.length > 0) {
            // ডিভাইস থাকলে শুধু লগইন টাইম, আইপি এবং এফসিএম টোকেন UPDATE হবে
            queryText = `
                UPDATE user_devices 
                SET fcm_token = $3, ip_address = $4, last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $1 AND device_id = $2
                RETURNING *
            `;
            values = [user_id, device_id, fcm_token || null, ip_address];
        } else {
            // নতুন ডিভাইস হলে সম্পূর্ণ INSERT হবে
            queryText = `
                INSERT INTO user_devices (user_id, device_id, device_name, os, app_version, fcm_token, ip_address)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;
            values = [user_id, device_id, device_name, os, app_version, fcm_token || null, ip_address];
        }

        const deviceRecord = await db.query(queryText, values);

        res.status(200).json({
            success: true,
            message: "Device session synchronized successfully! 📱",
            multi_account_detected, // ফ্রন্টএন্ডকে জানিয়ে দেওয়া হলো চিটার কি না
            device: deviceRecord.rows[0]
        });

    } catch (error) {
        console.error("Device Controller Error:", error);
        res.status(500).json({ success: false, error: "Internal Database Error." });
    }
};

// 🔍 ইউজারের কয়টি ডিভাইস অ্যাক্টিভ আছে তা দেখার কন্ট্রোলার
exports.getUserDevices = async (req, res) => {
    const { user_id } = req.params;

    try {
        const devices = await db.query('SELECT * FROM user_devices WHERE user_id = $1 ORDER BY last_login DESC', [user_id]);
        
        res.status(200).json({
            success: true,
            count: devices.rows.length,
            devices: devices.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};