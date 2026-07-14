const jwt = require('jsonwebtoken');

// 💡 ব্যাকআপ সিক্রেট কি রাখলাম, যদি ডট-এনভি (.env) লোড হতে মিস করে
const JWT_SECRET = process.env.JWT_SECRET || "MY_SUPER_SECRET_MINING_KEY_2026";

module.exports = (req, res, next) => {
    console.log('🔐 [Auth Middleware]: Request Received');
    
    // হেডার থেকে Bearer টোকেন নেওয়া
    const authHeader = req.headers['authorization'];
    console.log('📬 Raw Authorization Header:', authHeader);
    
    const token = authHeader && authHeader.split(' ')[1];
    console.log('🪙 Extracted JWT Token:', token);

    if (!token) {
        console.log('❌ Auth Failed: Token is missing from headers');
        return res.status(401).json({ success: false, error: "Access denied. Token missing." });
    }

    try {
        // টোকেন ভেরিফাই করা
        const verified = jwt.verify(token, JWT_SECRET);
        
        // 🎯 ডাটা আগে req.user-এ অ্যাসাইন করতে হবে
        req.user = verified; 
        
        // এখন কনসোল লগ করলে দেখতে পাবে ইউজারের { id, email }
        console.log('✅ Token Verified successfully! Decoded User Data:', req.user);
        
        next(); // পরের কন্ট্রোলারে যাওয়ার অনুমতি দেওয়া হলো
    } catch (error) {
        console.error('❌ JWT Verification Error:', error.message);
        return res.status(403).json({ success: false, error: "Invalid or expired token." });
    }
};