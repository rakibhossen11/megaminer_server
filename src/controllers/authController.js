const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // 🔑 টোকেন জেনারেট করার জন্য

exports.register = async (req, res) => {
    const { username, full_name, email, phone, password, referred_by } = req.body;
    console.log('server hit');
    // console.log(db);
    
    if (!username || !full_name || !email || !password) {
        return res.status(400).json({ success: false, error: "Please fill all required fields" });
    }

    try {
        // ডুপ্লিকেট ইউজার চেক
        const userExists = await db.query(
            'SELECT * FROM users WHERE email = $1 OR username = $2', [email, username]
        );

        if (userExists.rows.length > 0) {
            return res.status(400).json({ success: false, error: "Username or Email already exists" });
        }

        // পাসওয়ার্ড হ্যাশ করা
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // কাস্টম ইউনিক রেফার কোড জেনারেট
        const referralCode = `MM-${Math.floor(10000 + Math.random() * 90000)}`;

        // ডাটাবেজে ইনসার্ট
        const queryText = `
            INSERT INTO users (username, full_name, email, phone, password_hash, referral_code) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING id, role_id, username, full_name, email, phone, referral_code, status, created_at
        `;
        const values = [username, full_name, email, phone || null, hashedPassword, referralCode];

        const newUser = await db.query(queryText, values);

        const userId = newUser.rows[0].id;
        await db.query('INSERT INTO wallets (user_id) VALUES ($1)', [userId]);

        res.status(201).json({
            success: true,
            message: "User registered successfully! 🚀",
            user: newUser.rows[0]
        });

    } catch (error) {
        // 💥 ডাটাবেজের আসল এরর মেসেজটি সরাসরি পোস্টম্যানে রেসপন্স হিসেবে চলে যাবে!
        res.status(500).json({
            success: false,
            error: "Internal Database Server Error.",
            database_saying: error.message // 👈 এই লাইনটি যোগ করো
        });
        // console.error("auth page",error);
        // res.status(500).json({ success: false, error: "Database Server Error" });
    }
};

// 🔐 ইউজার লগইন (Sign-In) কন্ট্রোলার
exports.login = async (req, res) => {
    console.log('server hit');
    const { email, password } = req.body; // ফ্রন্টএন্ড বা পোস্টম্যান থেকে আসবে
    console.log('server hit');

    // ১. ইনপুট ভ্যালিডেশন চেক
    if (!email || !password) {
        return res.status(400).json({ success: false, error: "Please provide email/username and password" });
    }

    try {
        // ২. ডাটাবেজে ইমেইল অথবা ইউজারনেম দিয়ে ইউজারকে খোঁজা
        const userQuery = await db.query(
            'SELECT * FROM users WHERE email = $1 OR username = $2',
            [email, email]
        );

        const user = userQuery.rows[0];

        // ৩. ইউজার যদি না পাওয়া যায়
        if (!user) {
            return res.status(401).json({ success: false, error: "Invalid Credentials (User not found)" });
        }

        // ৪. ইউজার যদি ব্লকেড (Blocked) থাকে
        if (user.status === 'Blocked') {
            return res.status(403).json({ success: false, error: "Your account has been suspended. Contact support." });
        }

        // ৫. পাসওয়ার্ড ম্যাচিং (Bcrypt Compare)
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: "Invalid Credentials (Wrong password)" });
        }

        // ৬. লগইন সফল হলে JWT Access Token তৈরি করা
        // টোকেনের ভেতর আমরা ইউজারের ID, username এবং role_id লক করে দিচ্ছি
        // 🛠️ authController.js এর লগইন ফাংশনের ভেতর JWT জেনারেট করার অংশটি এভাবে আপডেট করো:

        // ১. Access Token জেনারেট (expiresIn কমিয়ে ১ ঘণ্টা বা ১৫ মিনিট করতে পারো)
        const token = jwt.sign(
            { id: user.id, username: user.username, role_id: user.role_id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // ২. নতুন রিফ্রেশ টোকেন জেনারেট (মেয়াদ ৩০ দিন)
        const refreshToken = jwt.sign(
            { id: user.id },
            process.env.JWT_REFRESH_SECRET, // এটি .env ফাইলে থাকতে হবে
            { expiresIn: '30d' }
        );

        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // ৩০ দিন পর এক্সপায়ার হবে

        // ৩. ডাটাবেজে রিফ্রেশ টোকেন সেভ করা
        await db.query(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, refreshToken, expiresAt]
        );

        // ৪. রেসপন্সে দুটো টোকেনই ফ্রন্টএন্ডে পাঠানো
        res.status(200).json({
            success: true,
            message: "Logged in successfully! 🚀",
            token, // এটি এক্সেস টোকেন
            refresh_token: refreshToken, // এটি রিফ্রেশ টোকেন
            user: { id: user.id, username: user.username, email: user.email }
        });
        // const token = jwt.sign(
        //     { id: user.id, username: user.username, role_id: user.role_id },
        //     process.env.JWT_SECRET,
        //     { expiresIn: '7d' } // টোকেনটি ৭ দিন পর্যন্ত অ্যাক্টিভ থাকবে
        // );

        // ৭. ডাটাবেজে last_login টাইমস্ট্যাম্প আপডেট করা
        // await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

        // // ৮. ফ্রন্টএন্ডে টোকেন ও ইউজারের প্রয়োজনীয় ডাটা পাঠানো
        // res.status(200).json({
        //     success: true,
        //     message: "Logged in successfully! 🚀",
        //     token,
        //     user: {
        //         id: user.id,
        //         username: user.username,
        //         full_name: user.full_name,
        //         email: user.email,
        //         role_id: user.role_id,
        //         status: user.status
        //     }
        // });

    } catch (error) {
        console.error("Login Controller Error:", error);
        res.status(500).json({ success: false, error: "Internal Server Error." });
    }
};