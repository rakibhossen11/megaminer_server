const db = require('../config/db');

/**
 * অ্যাডমিনের যেকোনো অ্যাক্টিভিটি ডাটাবেজে রেকর্ড করার গ্লোবাল ফাংশন
 */
exports.logAdminAction = async ({ admin_id, action, target_table, target_id, old_value, new_value, ip_address }) => {
    try {
        const queryText = `
            INSERT INTO admin_audit_logs (admin_id, action, target_table, target_id, old_value, new_value, ip_address)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        
        await db.query(queryText, [
            admin_id,
            action,
            target_table,
            target_id ? target_id.toString() : null,
            old_value ? JSON.stringify(old_value) : null,
            new_value ? JSON.stringify(new_value) : null,
            ip_address || null
        ]);
        
        console.log(`[Audit Log]: ${action} performed by Admin ${admin_id}`);
    } catch (error) {
        // অডিট লগ ফেইল করলেও যাতে মেইন এপিআই ক্র্যাশ না করে, তাই এখানে শুধু এরর লগ করা হলো
        console.error("Failed to write audit log:", error);
    }
};