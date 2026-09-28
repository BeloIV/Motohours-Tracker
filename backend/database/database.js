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

        // Charging sessions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS charging_sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                start_time TIMESTAMP NOT NULL,
                stop_time TIMESTAMP,
                duration_minutes INTEGER,
                status VARCHAR(50) DEFAULT 'active',
                motohours DECIMAL(10,2),
                battery_start INTEGER,
                battery_end INTEGER,
                stopped_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Charging sessions table ready');

        // Audit trail for corrections made to a charging session — one row per
        // changed field, so a session's history reads as a list of edits
        await pool.query(`
            CREATE TABLE IF NOT EXISTS charging_session_changes (
                id SERIAL PRIMARY KEY,
                session_id INTEGER NOT NULL REFERENCES charging_sessions(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                field VARCHAR(50) NOT NULL,
                old_value VARCHAR(50),
                new_value VARCHAR(50),
                changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Charging session audit table ready');

        // Companies table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS companies (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Companies table ready');

        // Invites table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS invites (
                id SERIAL PRIMARY KEY,
                token VARCHAR(255) UNIQUE NOT NULL,
                company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                used BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Invites table ready');

        // Vehicles table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS vehicles (
                id SERIAL PRIMARY KEY,
                company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                photo_path VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Vehicles table ready');

        // Charging sessions now carry the odometer reading and battery levels
        await pool.query(`ALTER TABLE charging_sessions ADD COLUMN IF NOT EXISTS vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL`);
        await pool.query(`ALTER TABLE charging_sessions ADD COLUMN IF NOT EXISTS motohours DECIMAL(10,2)`);
        await pool.query(`ALTER TABLE charging_sessions ADD COLUMN IF NOT EXISTS battery_start INTEGER`);
        await pool.query(`ALTER TABLE charging_sessions ADD COLUMN IF NOT EXISTS battery_end INTEGER`);
        await pool.query(`ALTER TABLE charging_sessions ADD COLUMN IF NOT EXISTS stopped_by INTEGER REFERENCES users(id) ON DELETE SET NULL`);
        await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS initial_motohours DECIMAL(10,2) DEFAULT 0`);
        await pool.query('CREATE INDEX IF NOT EXISTS idx_vehicles_company_id ON vehicles(company_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_charging_sessions_vehicle_id ON charging_sessions(vehicle_id)');

        // Migration: entries are gone — carry each vehicle's last odometer reading
        // over to vehicles.initial_motohours, then drop the table.
        const entriesTable = await pool.query(`SELECT to_regclass('public.entries') as t`);
        if (entriesTable.rows[0].t) {
            await pool.query(`
                UPDATE vehicles v
                SET initial_motohours = GREATEST(COALESCE(v.initial_motohours, 0), sub.max_mh)
                FROM (
                    SELECT vehicle_id, MAX(motohours) as max_mh
                    FROM entries WHERE vehicle_id IS NOT NULL
                    GROUP BY vehicle_id
                ) sub
                WHERE v.id = sub.vehicle_id
            `);
            await pool.query(`DROP TABLE entries`);
            console.log('✅ Migrated entries into vehicles.initial_motohours and dropped entries table');
        }

        // Add role and company_id to users if not present
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)`);
        console.log('✅ Users columns updated');

        // Migration: create a company for any existing user without one, make them admin
        const orphaned = await pool.query(`SELECT id, username FROM users WHERE company_id IS NULL`);
        for (const user of orphaned.rows) {
            const company = await pool.query(
                `INSERT INTO companies (name) VALUES ($1) RETURNING id`,
                [user.username + "'s Company"]
            );
            await pool.query(
                `UPDATE users SET company_id = $1, role = 'admin' WHERE id = $2`,
                [company.rows[0].id, user.id]
            );
        }
        if (orphaned.rows.length > 0) {
            console.log(`✅ Migrated ${orphaned.rows.length} existing user(s) to companies`);
        }

        // Create indexes for better performance
        await pool.query('CREATE INDEX IF NOT EXISTS idx_charging_sessions_user_id ON charging_sessions(user_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_charging_sessions_status ON charging_sessions(status)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_charging_sessions_created_at ON charging_sessions(created_at)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_session_changes_session_id ON charging_session_changes(session_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token)');
        console.log('✅ Database indexes created');
        console.log('✅ Connected to PostgreSQL database');

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