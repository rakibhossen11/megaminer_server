const db = require('../config/db');

/**
 * ইউজারের যেকোনো গুরুত্বপূর্ণ অ্যাক্টিভিটি ডাটাবেজে রেকর্ড করার গ্লোবাল হেল্পার
 */
exports.logUserAction = async ({ user_id, activity, device, ip }) => {
    try {
        const queryText = `
            INSERT INTO user_logs (user_id, activity, device, ip)
            VALUES ($1, $2, $3, $4)
        `;
        await db.query(queryText, [
            user_id,
            activity,
            device || 'Unknown Device',
            ip || null
        ]);
        console.log(`[User Log Saved]: ${activity} by User ${user_id}`);
    } catch (error) {
        // মেইন ইউজার এপিআই যাতে ক্র্যাশ না করে, তাই শুধু কনসোলে এরর দেখাচ্ছি
        console.error("Failed to write user log:", error);
    }
};