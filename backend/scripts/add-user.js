const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    user: process.env.DB_USER || 'motohours_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'motohours_db',
    password: process.env.DB_PASSWORD || 'motohours_password',
    port: process.env.DB_PORT || 5432,
});

async function addUser(username, password) {
    try {
        // Check if user already exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );

        if (existingUser.rows.length > 0) {
            console.log(`❌ User '${username}' already exists`);
            return;
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Insert user
        const result = await pool.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
            [username, passwordHash]
        );

        console.log(`✅ User '${username}' created successfully with ID: ${result.rows[0].id}`);
    } catch (error) {
        console.error('Error creating user:', error);
    } finally {
        await pool.end();
    }
}

// Get command line arguments
const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
    console.log('Usage: node add-user.js <username> <password>');
    console.log('Example: node add-user.js john mypassword123');
    process.exit(1);
}

addUser(username, password); 