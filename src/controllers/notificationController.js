const db = require('../config/db');

// ➕ ১. নতুন নোটিফিকেশন তৈরি/সেন্ড করার কন্ট্রোলার (Admin Route)
exports.sendNotification = async (req, res) => {
    const { user_id, title, body, image, notification_type } = req.body;

    if (!title || !body) {
        return res.status(400).json({ success: false, error: "Title and body are required." });
    }

    try {
        const queryText = `
            INSERT INTO notifications (user_id, title, body, image, notification_type)
            VALUES ($1, $2, $3, $4, $5) RETURNING *
        `;
        // যদি টাইপ 'All' হয়, তবে আমরা user_id পাস করলেও ডাটাবেজে ওটা পাস করার দরকার নেই বা null যাবে
        const targetUser = notification_type === 'All' ? null : user_id;
        
        const newNotification = await db.query(queryText, [targetUser, title, body, image || null, notification_type || 'All']);

        // 💡 নোট: রিয়েল প্রোডাকশনে এখানে Firebase Cloud Messaging (FCM) ট্রিগার হবে
        // যা আমরা 'user_devices' টেবিল থেকে fcm_token নিয়ে পুশ নোটিফিকেশন পাঠাতে ব্যবহার করব।

        res.status(201).json({
            success: true,
            message: "Notification created & sent successfully! 🔔",
            notification: newNotification.rows[0]
        });

    } catch (error) {
        console.error("Send Notification Error:", error);
        res.status(500).json({ success: false, error: "Internal Database Error." });
    }
};

// 🔍 ২. ইউজারের জন্য নির্দিষ্ট নোটিফিকেশন ইনবক্স নিয়ে আসার কন্ট্রোলার
// 🔍 ২. ইউজারের জন্য নোটিফিকেশন ইনবক্স (is_read স্ট্যাটাস সহ)
exports.getUserNotifications = async (req, res) => {
    const { user_id } = req.params;

    try {
        // LEFT JOIN এর মাধ্যমে আমরা চেক করছি user_notification_statuses টেবিলে কোনো রেকর্ড আছে কি না
        const queryText = `
            SELECT n.*, 
            CASE WHEN s.id IS NOT NULL THEN TRUE ELSE FALSE END as is_read,
            s.read_at
            FROM notifications n
            LEFT JOIN user_notification_statuses s ON n.id = s.notification_id AND s.user_id = $1
            WHERE n.notification_type = 'All' OR n.user_id = $1
            ORDER BY n.created_at DESC
        `;
        const notifications = await db.query(queryText, [user_id]);

        res.status(200).json({
            success: true,
            count: notifications.rows.length,
            notifications: notifications.rows
        });

    } catch (error) {
        console.error("Get User Notifications Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};
// exports.getUserNotifications = async (req, res) => {
//     const { user_id } = req.params;

//     try {
//         // লজিক: ইউজারকে সেই নোটিফিকেশনগুলো দেখানো হবে যেগুলো সবার জন্য ('All') অথবা স্পেসিফিকালি তার নিজের জন্য ('Personal'/'Transactional')
//         const queryText = `
//             SELECT * FROM notifications 
//             WHERE notification_type = 'All' OR user_id = $1
//             ORDER BY created_at DESC
//         `;
//         const notifications = await db.query(queryText, [user_id]);

//         res.status(200).json({
//             success: true,
//             count: notifications.rows.length,
//             notifications: notifications.rows
//         });

//     } catch (error) {
//         console.error("Get User Notifications Error:", error);
//         res.status(500).json({ success: false, error: "Internal Server Error." });
//     }
// };

// 🔔 ৩. নোটিফিকেশন 'Read' বা পঠিত হিসেবে মার্ক করার কন্ট্রোলার (notificationController.js এর নিচে যোগ করো)
exports.markAsRead = async (req, res) => {
    const { notification_id, user_id } = req.body;

    if (!notification_id || !user_id) {
        return res.status(400).json({ success: false, error: "Notification ID and User ID are required." });
    }

    try {
        // ১. আগে চেক করা—এই নোটিফিকেশনটি অলরেডি এই ইউজার রিড করেছে কি না
        const checkQuery = await db.query(
            'SELECT id FROM user_notification_statuses WHERE notification_id = $1 AND user_id = $2',
            [notification_id, user_id]
        );

        if (checkQuery.rows.length > 0) {
            return res.status(200).json({ success: true, message: "Notification already marked as read." });
        }

        // ২. যদি আগে রিড না করে থাকে, তবে টেবিলে ইনসার্ট করা
        const insertQuery = `
            INSERT INTO user_notification_statuses (notification_id, user_id)
            VALUES ($1, $2) RETURNING *
        `;
        const result = await db.query(insertQuery, [notification_id, user_id]);

        res.status(200).json({
            success: true,
            message: "Notification marked as read successfully! 📖",
            read_status: result.rows[0]
        });

    } catch (error) {
        console.error("Mark As Read Error:", error);
        res.status(500).json({ success: false, error: "Internal Database Error." });
    }
};