-- ১. UUID (ಯೂನಿಕ್ ಐಡಿ) জেনারেট করার এক্সটেনশন অন করা
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ২. স্ট্যাটাসের জন্য ENUM টাইপ তৈরি করা
CREATE TYPE user_status_enum AS ENUM ('Active', 'Blocked');

-- ৩. তোমার দেওয়া আর্কিটেকচার অনুযায়ী একদম ফ্রেশ users টেবিল তৈরি
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id INT DEFAULT 2, -- ২ = Regular User, ১ = Admin
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    password_hash TEXT NOT NULL,
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    referred_by UUID REFERENCES users(id) ON DELETE SET NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    status user_status_enum DEFAULT 'Active',
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, -- users টেবিলের সাথে ১:১ কানেকশন
    gender VARCHAR(20),
    date_of_birth DATE,
    country VARCHAR(100),
    city VARCHAR(100),
    address TEXT,
    postal_code VARCHAR(20),
    profile_image TEXT, -- এখানে ইমেজের URL বা লিঙ্ক সেভ হবে
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- ইউজারের সাথে কানেকশন
    device_id VARCHAR(255) NOT NULL, -- এক্সপো/রিয়্যাক্ট নেটিভ থেকে আসা ইউনিক ডিভাইস আইডি
    device_name VARCHAR(100), -- যেমন: Samsung S24, iPhone 15 Pro
    os VARCHAR(50), -- Android অথবা iOS
    app_version VARCHAR(20), -- যেমন: 1.0.0 (Beta)
    fcm_token TEXT, -- পুশ নোটিফিকেশন পাঠানোর জন্য Firebase টোকেন
    ip_address VARCHAR(45), -- ইউজারের আইপি অ্যাড্রেস (সিকিউরিটির জন্য)
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, device_id) -- একজন ইউজারের এই ডিভাইসের জন্য একটাই রেকর্ড থাকবে
);

CREATE TABLE otp_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- ইউজারের সাথে কানেকশন
    phone VARCHAR(20), -- যদি ফোনে ওটিপি পাঠানো হয়
    email VARCHAR(100), -- যদি ইমেইলে ওটিপি পাঠানো হয়
    otp VARCHAR(10) NOT NULL, -- যেমন: 482910 বা 1234
    purpose VARCHAR(50) NOT NULL, -- 'Email_Verification', 'Phone_Verification', 'Password_Reset'
    expires_at TIMESTAMP NOT NULL, -- ওটিপির মেয়াদের শেষ সময়
    verified BOOLEAN DEFAULT FALSE, -- ভেরিফাইড হয়েছে কি না
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- ইউজারের সাথে কানেকশন
    token TEXT NOT NULL UNIQUE, -- সিকিউর রিফ্রেশ টোকেন স্ট্রিং
    expires_at TIMESTAMP NOT NULL, -- টোকেনের মেয়াদ শেষ হওয়ার সময়
    revoked BOOLEAN DEFAULT FALSE, -- টোকেনটি বাতিল করা হয়েছে কি না
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

// wallets tables 

CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, -- ইউজারের সাথে ১:১ রিলেশন
    total_coin INT DEFAULT 0,
    available_coin INT DEFAULT 0,
    pending_coin INT DEFAULT 0,
    locked_coin INT DEFAULT 0,
    total_cash NUMERIC(10, 2) DEFAULT 0.00, -- ডলার/টাকা ফ্র্যাকশন হ্যান্ডেল করার জন্য NUMERIC বেস্ট
    available_cash NUMERIC(10, 2) DEFAULT 0.00,
    pending_cash NUMERIC(10, 2) DEFAULT 0.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ১. ট্রানজেকশন টাইপ (ইনকাম নাকি খরচ) এবং স্ট্যাটাসের জন্য ENUM টাইপ তৈরি করা
CREATE TYPE tx_type_enum AS ENUM ('Credit', 'Debit');
CREATE TYPE tx_status_enum AS ENUM ('Pending', 'Success', 'Failed');

-- ২. wallet_transactions টেবিল তৈরি
CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE, -- ওয়ালেটের সাথে কানেকশন
    transaction_type tx_type_enum NOT NULL, -- 'Credit' (যোগ) অথবা 'Debit' (বিয়োগ)
    amount INT NOT NULL, -- ট্রানজেকশন কয়েনের সংখ্যা (যেমন: ৫০ বা ১০০ কয়েন)
    reference_id VARCHAR(100), -- কুইজ আইডি, অ্যাড আইডি বা উইথড্রাল রিকোয়েস্ট আইডি (ট্র্যাকিংয়ের জন্য)
    source VARCHAR(50) NOT NULL, -- 'Daily_Checkin', 'Reward_Ad', 'Spin_History', 'Quiz', 'Withdraw'
    description TEXT, -- যেমন: "Earned 50 coins from daily checkin"
    status tx_status_enum DEFAULT 'Success',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ১. transaction_types টেবিল তৈরি
CREATE TABLE transaction_types (
    id SERIAL PRIMARY KEY, -- ১, ২, ৩ এভাবে আইডেন্টিফাই করার জন্য SERIAL বেস্ট
    name VARCHAR(50) UNIQUE NOT NULL, -- যেমন: 'Daily_Checkin', 'Quiz', 'Spin'
    description TEXT, -- এই টাইপের বিস্তারিত বিবরণ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ২. 🚀 [জরুরি] অ্যাপের জন্য প্রয়োজনীয় ডিফল্ট সোর্সগুলো এখনই ডাটাবেজে ইনসার্ট (Seed) করে নাও:
INSERT INTO transaction_types (name, description) VALUES
('Daily_Checkin', 'Coins earned from claiming the daily reward streak.'),
('Reward_Ad', 'Coins rewarded for watching video network advertisements.'),
('Spin_History', 'Coins won or lost from the lucky fortune wheel spin.'),
('Scratch_History', 'Coins received from scratching the digital scratch cards.'),
('Quiz', 'Coins earned by answering educational and knowledge quiz questions.'),
('Withdraw', 'Coins deducted when a user submits a withdrawal payout request.')
ON CONFLICT (name) DO NOTHING; -- আগে থেকে থাকলে ডুপ্লিকেট এরর দেবে না

// reward section
CREATE TABLE daily_checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- ইউজারের সাথে কানেকশন
    day INT NOT NULL, -- ১ থেকে ৭ নম্বর দিন ট্র্যাকিং (যেমন: Day 1, Day 2...)
    reward_coin INT NOT NULL, -- ওই দিনের জন্য কত কয়েন পুরস্কার পেল
    claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reward_ads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- ইউজারের সাথে কানেকশন
    ad_network VARCHAR(50) NOT NULL, -- যেমন: 'AdMob', 'UnityAds', 'AppLovin'
    reward_coin INT NOT NULL, -- ভিডিও দেখার জন্য কত কয়েন পুরস্কার পেল
    watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ১. রিওয়ার্ড টাইপ (কয়েন নাকি রিয়েল ডলার ক্যাশ) নির্ধারণের জন্য ENUM তৈরি
CREATE TYPE spin_reward_type_enum AS ENUM ('Coin', 'Cash');

-- ২. spin_history টেবিল তৈরি
CREATE TABLE spin_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_coin INT DEFAULT 0, -- যদি কয়েন জেতে
    reward_type spin_reward_type_enum DEFAULT 'Coin', -- 'Coin' অথবা 'Cash'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ১. স্ক্র্যাচ কার্ড রিওয়ার্ড টাইপের জন্য ENUM তৈরি
CREATE TYPE scratch_reward_type_enum AS ENUM ('Coin', 'Cash');

-- ২. scratch_history টেবিল তৈরি
CREATE TABLE scratch_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_coin INT DEFAULT 0, -- কত কয়েন বা ক্যাশ জিতলো
    reward_type scratch_reward_type_enum DEFAULT 'Coin', -- 'Coin' অথবা 'Cash'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ১. টাস্ক ক্যাটাগরি টেবিল তৈরি
CREATE TABLE task_categories (
    id SERIAL PRIMARY KEY, -- ১, ২, ৩ এভাবে অটো-ইনক্রিমেন্ট আইডি
    name VARCHAR(100) UNIQUE NOT NULL, -- যেমন: 'Telegram Task', 'YouTube Task', 'App Download'
    icon VARCHAR(255), -- ফ্রন্টএন্ডে আইকন দেখানোর জন্য আইকনের নাম বা ইমেজ ইউআরএল
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

// task module

-- ২. 🚀 অ্যাপের জন্য প্রয়োজনীয় কিছু ডিফল্ট ক্যাটাগরি এখনই ডাটাবেজে ইনসার্ট (Seed) করে নাও:
INSERT INTO task_categories (name, icon) VALUES
('Telegram Join', 'telegram-icon-name'),
('YouTube Watch', 'youtube-icon-name'),
('App Download', 'download-icon-name'),
('Twitter/X Follow', 'twitter-icon-name')
ON CONFLICT (name) DO NOTHING;

-- ১. টাস্ক টাইপ (যেমন: অটো-ভেরিফাই নাকি অ্যাডমিন ম্যানুয়ালি স্ক্রিনশট রিভিউ করবে) এবং স্ট্যাটাসের জন্য ENUM তৈরি
CREATE TYPE task_type_enum AS ENUM ('Automatic', 'Manual_Review');
CREATE TYPE task_status_enum AS ENUM ('Active', 'Inactive', 'Expired');

-- ২. tasks টেবিল তৈরি
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id INT NOT NULL REFERENCES task_categories(id) ON DELETE CASCADE, -- কোন ক্যাটাগরির টাস্ক
    title VARCHAR(255) NOT NULL, -- টাস্কের নাম (যেমন: "Join our Official Telegram Channel")
    description TEXT, -- টাস্কের নিয়মাবলী
    reward_coin INT NOT NULL DEFAULT 0, -- এই কাজ করলে কত কয়েন পাবে
    task_type task_type_enum DEFAULT 'Automatic', -- অটো নাকি স্ক্রিনশট রিভিউ লাগবে
    task_url TEXT NOT NULL, -- যে লিংকে ইউজার কাজ করবে (টেলিগ্রাম বা ইউটিউব লিংক)
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- টাস্ক কবে চালু হবে
    end_date TIMESTAMP, -- টাস্কের মেয়াদ কবে শেষ হবে
    status task_status_enum DEFAULT 'Active', -- কারেন্ট স্ট্যাটাস
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ১. টাস্ক সাবমিশন স্ট্যাটাসের জন্য ENUM তৈরি (যদি আগে তৈরি করা না থাকে)
CREATE TYPE submission_status_enum AS ENUM ('Pending', 'Approved', 'Rejected');

-- ২. task_submissions টেবিল তৈরি
CREATE TABLE task_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, -- কোন টাস্ক
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- কোন ইউজার
    proof TEXT, -- ইউজার যদি কোনো স্ক্রিনশট বা টেক্সট প্রুফ দেয় (যেমন: টেলিগ্রাম ইউজারনেম বা ইমেজের লিংক)
    status submission_status_enum DEFAULT 'Pending', -- শুরুতে পেন্ডিং থাকবে
    reviewed_by UUID REFERENCES users(id), -- কোন অ্যাডমিন এটা রিভিউ করলো
    reviewed_at TIMESTAMP, -- রিভিউ করার সময়
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, task_id) -- একজন ইউজার একটি টাস্ক একবারই সাবমিট করতে পারবে
);


// quiz modules
-- ১. কুইজ ক্যাটাগরি টেবিল তৈরি
CREATE TABLE quiz_categories (
    id SERIAL PRIMARY KEY, -- ১, ২, ৩ এভাবে অটো-ইনক্রিমেন্ট আইডি
    title VARCHAR(255) UNIQUE NOT NULL, -- কুইজের টাইটেল বা বিষয় (যেমন: "General Knowledge")
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ২. 🚀 অ্যাপের জন্য কিছু ডিফল্ট কুইজ বিষয় এখনই ডাটাবেজে ইনসার্ট (Seed) করে নাও:
INSERT INTO quiz_categories (title) VALUES
('General Knowledge'),
('Science & Technology'),
('Crypto & Blockchain'),
('History & Geography')
ON CONFLICT (title) DO NOTHING;

-- ১. কুইজ ডিফিকাল্টি এবং স্ট্যাটাসের জন্য ENUM টাইপ তৈরি করা
CREATE TYPE quiz_difficulty_enum AS ENUM ('Easy', 'Medium', 'Hard');
CREATE TYPE quiz_status_enum AS ENUM ('Active', 'Inactive');

-- ২. quizzes টেবিল তৈরি
CREATE TABLE quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id INT NOT NULL REFERENCES quiz_categories(id) ON DELETE CASCADE, -- কোন ক্যাটাগরির কুইজ
    title VARCHAR(255) NOT NULL, -- কুইজের নাম (যেমন: "Bitcoin Basics Quiz")
    reward_coin INT NOT NULL DEFAULT 0, -- এই কুইজ পুরোটা শেষ করলে কত কয়েন বোনাস পাবে
    time_limit INT NOT NULL DEFAULT 60, -- সেকেন্ডে কুইজের টোটাল সময় (যেমন: ৬০ বা ১২০ সেকেন্ড)
    difficulty quiz_difficulty_enum DEFAULT 'Easy', -- Easy, Medium, Hard
    status quiz_status_enum DEFAULT 'Active', -- Active নাকি Inactive
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ১. সঠিক উত্তরের অপশনগুলো ভ্যালিড রাখার জন্য একটি ENUM তৈরি (অপশনাল কিন্তু বেস্ট প্র্যাকটিস)
CREATE TYPE quiz_answer_enum AS ENUM ('A', 'B', 'C', 'D');

-- ২. quiz_questions টেবিল তৈরি
CREATE TABLE quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE, -- কোন কুইজ সেটের আন্ডারে এই প্রশ্ন
    question TEXT NOT NULL, -- মূল প্রশ্নটি
    option_a VARCHAR(255) NOT NULL,
    option_b VARCHAR(255) NOT NULL,
    option_c VARCHAR(255) NOT NULL,
    option_d VARCHAR(255) NOT NULL,
    correct_answer quiz_answer_enum NOT NULL, -- 'A', 'B', 'C', 'D' এর যেকোনো একটি
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quiz_histories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE, -- কোন কুইজ খেলেছে
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- কোন ইউজার খেলেছে
    score INT NOT NULL DEFAULT 0, -- ইউজার কতটি সঠিক উত্তর দিল
    reward_coin INT NOT NULL DEFAULT 0, -- এই কুইজ থেকে সে কত কয়েন জিতলো
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, quiz_id) -- একজন ইউজার একটি কুইজ মিশন একবারই কমপ্লিট করতে পারবে
);

// referral module 
CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- যে রেফার করেছে
    referred_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, -- নতুন ইউজার (১ জন ১ বারই রেফার হতে পারবে)
    level INT DEFAULT 1, -- রেফারেল লেভেল (1, 2 বা 3)
    reward_coin INT DEFAULT 0, -- এই রেফারের কারণে কত কয়েন বোনাস দেওয়া হলো
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

// withdrawal modules
-- ১. গেটওয়ে স্ট্যাটাসের জন্য ENUM তৈরি (Active মানে অ্যাপে দেখাবে, Inactive মানে সাময়িক বন্ধ)
CREATE TYPE method_status_enum AS ENUM ('Active', 'Inactive');

-- ২. withdrawal_methods টেবিল তৈরি
CREATE TABLE withdrawal_methods (
    id SERIAL PRIMARY KEY, -- ১, ২, ৩ এভাবে ছোট আইডি ট্র্যাকিংয়ের জন্য
    method_name VARCHAR(100) UNIQUE NOT NULL, -- যেমন: 'Bkash', 'Nagad', 'Binance_USDT'
    minimum_amount NUMERIC(10, 2) NOT NULL DEFAULT 1.00, -- সর্বনিম্ন কত ডলার/টাকা উইথড্র করা যাবে
    charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00, -- উইথড্র ফি বা প্রসেসিং চার্জ
    status method_status_enum DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ৩. 🚀 অ্যাপের জন্য প্রয়োজনীয় কিছু পেমেন্ট গেটওয়ে এখনই ডাটাবেজে ইনসার্ট (Seed) করে নাও:
INSERT INTO withdrawal_methods (method_name, minimum_amount, charge, status) VALUES
('Bkash', 50.00, 5.00, 'Active'), -- সর্বনিম্ন ৫০ টাকা উইথড্র, ৫ টাকা চার্জ
('Nagad', 50.00, 0.00, 'Active'), -- সর্বনিম্ন ৫০ টাকা উইথড্র, ০ চার্জ
('Binance_USDT', 5.00, 0.50, 'Active') -- সর্বনিম্ন ৫ ডলার উইথড্র, ০.৫০ ডলার চার্জ
ON CONFLICT (method_name) DO NOTHING;


-- ১. উইথড্রাল স্ট্যাটাসের জন্য ENUM তৈরি (যদি আগে তৈরি করা না থাকে)
CREATE TYPE withdraw_status_enum AS ENUM ('Pending', 'Approved', 'Rejected');

-- ২. withdrawals টেবিল তৈরি
CREATE TABLE withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- কোন ইউজার টাকা তুলছে
    payment_method VARCHAR(100) NOT NULL, -- যেমন: 'Bkash', 'Nagad'
    account_number VARCHAR(100) NOT NULL, -- ইউজারের পার্সোনাল বিকাশ/নগদ/বাইনান্স নাম্বার/এড্রেস
    amount NUMERIC(10, 2) NOT NULL, -- কত টাকা বা ডলার উইথড্র করছে
    status withdraw_status_enum DEFAULT 'Pending', -- ডিফল্ট পেন্ডিং
    admin_note TEXT, -- রিজেক্ট করলে অ্যাডমিন কারণ লিখে দিতে পারবে (যেমন: "Wrong account number")
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

// membership_plans modules

-- ১. মেম্বারশিপ প্ল্যান স্ট্যাটাসের জন্য ENUM তৈরি 
CREATE TYPE plan_status_enum AS ENUM ('Active', 'Inactive');

-- ২. membership_plans টেবিল তৈরি
CREATE TABLE membership_plans (
    id SERIAL PRIMARY KEY, -- ১, ২, ৩ এভাবে প্ল্যান আইডি ট্র্যাকিং
    title VARCHAR(100) UNIQUE NOT NULL, -- যেমন: 'Silver Miner', 'Gold Miner', 'Diamond VIP'
    duration INT NOT NULL, -- প্ল্যানের মেয়াদ দিন সংখ্যায় (যেমন: ৩০ দিন, ৯০ দিন)
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00, -- প্যাকেজের দাম (ডলার বা টাকায়)
    bonus_percentage INT NOT NULL DEFAULT 0, -- কত পারসেন্ট এক্সট্রা ইনকাম বুস্ট পাবে (যেমন: ২০ মানে ২০%)
    status plan_status_enum DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ৩. 🚀 অ্যাপের জন্য ৩টি আকর্ষক ডিফল্ট প্ল্যান এখনই ডাটাবেজে ইনসার্ট (Seed) করে নাও:
INSERT INTO membership_plans (title, duration, price, bonus_percentage, status) VALUES
('Starter Miner', 30, 10.00, 15, 'Active'),  -- ১০ ডলার, মেয়াদ ৩০ দিন, ১৫% এক্সট্রা ইনকাম বুস্ট
('Pro Gold Miner', 90, 25.00, 40, 'Active'), -- ২৫ ডলার, মেয়াদ ৯০ দিন, ৪Mapping০% এক্সট্রা ইনকাম বুস্ট
('Mega Diamond VIP', 365, 99.00, 100, 'Active') -- ৯৯ ডলার, মেয়াদ ১ বছর, ১০০% (দ্বিগুণ) ইনকাম বুস্ট
ON CONFLICT (title) DO NOTHING;


-- ১. সাবস্ক্রিপশন স্ট্যাটাসের জন্য ENUM তৈরি 
CREATE TYPE sub_status_enum AS ENUM ('Active', 'Expired', 'Cancelled');

-- ২. user_subscriptions টেবিল তৈরি
CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- কোন ইউজার কিনেছে
    membership_id INT NOT NULL REFERENCES membership_plans(id) ON DELETE CASCADE, -- কোন প্ল্যান কিনেছে
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- কেনার তারিখ
    end_date TIMESTAMP NOT NULL, -- মেয়াদ শেষ হওয়ার তারিখ
    status sub_status_enum DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- notification system -- 

-- ১. নোটিফিকেশন টাইপের জন্য ENUM তৈরি 
CREATE TYPE notification_type_enum AS ENUM ('All', 'Personal', 'Transactional');

-- ২. notifications টেবিল তৈরি
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- যদি টাইপ 'Personal' বা 'Transactional' হয়, তবে নির্দিষ্ট ইউজারের আইডি বসবে। 'All' হলে এটি NULL থাকবে।
    title VARCHAR(255) NOT NULL, -- নোটিফিকেশনের শিরোনাম
    body TEXT NOT NULL, -- নোটিফিকেশনের মূল মেসেজ
    image TEXT, -- ছবির লিঙ্ক/ইউআরএল
    notification_type notification_type_enum DEFAULT 'All',
    is_read BOOLEAN DEFAULT FALSE, -- ইউজার নোটিফিকেশনটি ওপেন করেছে কি না (ইন-অ্যাপ ইনবক্সের জন্য)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_notification_statuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE, -- কোন নোটিফিকেশন
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- কোন ইউজার
    is_read BOOLEAN DEFAULT TRUE, -- যেহেতু ক্লিক করার পরই এখানে ডাটা আসবে, তাই ডিফল্ট TRUE
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, notification_id) -- একজন ইউজার একটা নোটিফিকেশনে একবারই রিড স্ট্যাটাস দিতে পারবে
);

-- supports modules

-- ১. সাপোর্ট টিকিট প্রায়োরিটি এবং স্ট্যাটাসের জন্য ENUM তৈরি করা
CREATE TYPE ticket_priority_enum AS ENUM ('Low', 'Medium', 'High');
CREATE TYPE ticket_status_enum AS ENUM ('Open', 'In_Progress', 'Resolved', 'Closed');

-- ২. support_tickets টেবিল তৈরি
CREATE TABLE support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- কোন ইউজার কমপ্লেইন করেছে
    subject VARCHAR(255) NOT NULL, -- অভিযোগের মূল বিষয় (যেমন: "Withdrawal not received")
    category VARCHAR(100) NOT NULL, -- ক্যাটাগরি (যেমন: "Payment", "Quiz", "Account", "Bug")
    priority ticket_priority_enum DEFAULT 'Medium', -- Low, Medium, High
    status ticket_status_enum DEFAULT 'Open', -- শুরুতে এটি Open থাকবে
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ১. সেন্ডার টাইপের জন্য ENUM তৈরি করা
CREATE TYPE ticket_sender_enum AS ENUM ('User', 'Admin');

-- ২. ticket_messages টেবিল তৈরি
CREATE TABLE ticket_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE, -- কোন টিকিটের আন্ডারে চ্যাট হচ্ছে
    sender_type ticket_sender_enum NOT NULL, -- 'User' অথবা 'Admin'
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- যে মেসেজ পাঠিয়েছে তার আইডি
    message TEXT NOT NULL, -- মূল চ্যাট মেসেজ
    attachment TEXT, -- কোনো স্ক্রিনশট বা ফাইল লিঙ্ক থাকলে
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin Modules 
-- ১. অ্যাডমিন রোল এবং স্ট্যাটাসের জন্য ENUM তৈরি করা
CREATE TYPE admin_role_enum AS ENUM ('Super_Admin', 'Moderator', 'Support_Agent');
CREATE TYPE admin_status_enum AS ENUM ('Active', 'Inactive', 'Suspended');

-- ২. admins টেবিল তৈরি
CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role admin_role_enum DEFAULT 'Moderator',
    status admin_status_enum DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ১. admin_audit_logs টেবিল তৈরি
CREATE TABLE admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE, -- কোন অ্যাডমিন কাজটি করেছে
    action VARCHAR(100) NOT NULL, -- যেমন: 'UPDATE_BALANCE', 'APPROVE_WITHDRAWAL', 'DELETE_TASK'
    target_table VARCHAR(100) NOT NULL, -- কোন টেবিলে চেঞ্জ করা হয়েছে (যেমন: 'wallets', 'withdrawals')
    target_id VARCHAR(100), -- যে রো বা ডাটা চেঞ্জ হয়েছে তার আইডি (UUID বা INT)
    old_value JSONB, -- পরিবর্তনের আগের ডাটা (JSON ফরম্যাটে স্টোর হবে)
    new_value JSONB, -- পরিবর্তনের পরের ডাটা (JSON ফরম্যাটে স্টোর হবে)
    ip_address VARCHAR(45), -- অ্যাডমিনের আইপি এড্রেস (IPv4 বা IPv6 হ্যান্ডেল করার জন্য)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ১. app_settings টেবিল তৈরি
CREATE TABLE app_settings (
    id SERIAL PRIMARY KEY,
    app_name VARCHAR(100) NOT NULL DEFAULT 'Mega Miner App',
    app_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    minimum_withdraw NUMERIC(10, 2) NOT NULL DEFAULT 50.00, -- ডিফল্ট সর্বনিম্ন উইথড্র অ্যামাউন্ট
    coin_rate NUMERIC(10, 4) NOT NULL DEFAULT 0.01, -- যেমন: ১ কয়েন = ০.০১ টাকা/ডলার
    referral_bonus INT NOT NULL DEFAULT 100, -- রেফার করলে কত কয়েন পাবে
    daily_bonus INT NOT NULL DEFAULT 50, -- দৈনিক চেক-ইনে কত কয়েন পাবে
    maintenance_mode BOOLEAN DEFAULT FALSE, -- TRUE হলে অ্যাপে মেইনটেইন্যান্স স্ক্রিন শো করবে
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ২. 🔒 সিকিউরিটি লকিং ট্রিপল চেক: টেবিলে যাতে ১টির বেশি রো ইনসার্ট না হতে পারে
CREATE UNIQUE INDEX app_settings_single_row_idx ON app_settings ((id IS NOT NULL));

-- ৩. 🚀 অ্যাপের প্রথম ও একমাত্র ডিফল্ট কনফিগারেশন এখনই সিড (Seed) করে নাও:
INSERT INTO app_settings (id, app_name, app_version, minimum_withdraw, coin_rate, referral_bonus, daily_bonus, maintenance_mode)
VALUES (1, 'Mega Miner PRO', '1.0.0', 50.00, 0.0100, 100, 50, false)
ON CONFLICT (id) DO NOTHING;

-- user logs

CREATE TABLE user_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- কোন ইউজার কাজটি করেছে
    activity VARCHAR(150) NOT NULL, -- যেমন: 'LOGIN', 'SUBMIT_TASK', 'WITHDRAW_REQUEST'
    device VARCHAR(255), -- ইউজারের মোবাইল বা ওএস ডিটেইলস (যেমন: 'React-Native Android')
    ip VARCHAR(45), -- ইউজারের আইপি এড্রেস
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

