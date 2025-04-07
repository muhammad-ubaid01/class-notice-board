const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  connectionString: process.env.POSTGRES_URL,
  // For local development without SSL
  ssl: process.env.NODE_ENV === 'production' ? { 
    rejectUnauthorized: false 
  } : true
});

module.exports = pool;
