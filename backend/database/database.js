const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// PostgreSQL connection configuration
const pool = new Pool({
    user: process.env.DB_USER || 'motohours_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'motohours_db',
    password: process.env.DB_PASSWORD || 'motohours_password',
    port: process.env.DB_PORT || 5432,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test the connection
pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Initialize database tables
async function initializeDatabase() {
    try {
        // Users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Users table ready');

        // Entries table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS entries (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                motohours DECIMAL(10,2) NOT NULL,
                battery_capacity INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Entries table ready');

        // Charging sessions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS charging_sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                start_time TIMESTAMP NOT NULL,
                stop_time TIMESTAMP,
                duration_minutes INTEGER,
                status VARCHAR(50) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Charging sessions table ready');

        // Create indexes for better performance
        await pool.query('CREATE INDEX IF NOT EXISTS idx_entries_user_id ON entries(user_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_charging_sessions_user_id ON charging_sessions(user_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_charging_sessions_status ON charging_sessions(status)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
        console.log('✅ Database indexes created');

    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
}

// Helper function to run queries with promises
async function runQuery(sql, params = []) {
    try {
        const result = await pool.query(sql, params);
        return { 
            id: result.rows[0]?.id || null, 
            changes: result.rowCount,
            rows: result.rows
        };
    } catch (error) {
        throw error;
    }
}

// Helper function to get single row
async function getRow(sql, params = []) {
    try {
        const result = await pool.query(sql, params);
        return result.rows[0] || null;
    } catch (error) {
        throw error;
    }
}

// Helper function to get multiple rows
async function getAll(sql, params = []) {
    try {
        const result = await pool.query(sql, params);
        return result.rows;
    } catch (error) {
        throw error;
    }
}

module.exports = {
    pool,
    runQuery,
    getRow,
    getAll,
    initializeDatabase
}; 