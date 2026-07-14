const { Pool } = require('pg');
require('dotenv').config();
// console.log(process.env.DB_DATABASE);

// কানেকশন পুল তৈরি (এটি হাই-পারফরম্যান্স অ্যাপের জন্য বেস্ট)
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// console.log(pool);

pool.on('connect', () => {
  console.log('🐘 PostgreSQL Database Connected Successfully!');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};