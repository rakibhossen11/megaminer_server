const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('../src/config/db');
// console.log(db);

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const otpRoutes = require('./routes/profileRoutes');


const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors());
app.use(express.json());

// রাউট ম্যাপ
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/device', deviceRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/token', require('./routes/tokenRoutes'));
app.use('/api/wallet', require('./routes/walletRoutes'));
app.use('/api/transaction', require('./routes/transactionRoutes'));
app.use('/api/tx-types', require('./routes/typeRoutes'));
app.use('/api/reward', require('./routes/rewardRoutes'));
app.use('/api/task', require('./routes/taskRoutes'));
app.use('/api/quiz', require('./routes/quizRoutes'));
app.use('/api/referral', require('./routes/referralRoutes'));



app.get('/', (req, res) => {
  res.json({ message: "Server is Live!" });
});

// app.listen(PORT, () => {
//   console.log(`📡 Server running on http://localhost:${PORT}`);
// });

app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});

app.get('/', (req, res) => {
    res.json({
        message: 'Ghorchai API Server',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            health: '/health'
        }
    });
});