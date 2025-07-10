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

async function addUserWithHash(username, password) {
    try {
        console.log(`🔄 Adding user: ${username}`);
        
        // Check if user already exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );

        if (existingUser.rows.length > 0) {
            console.log(`❌ User '${username}' already exists`);
            return;
        }

        // Hash password automatically
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        console.log(`🔐 Password hashed successfully`);

        // Insert user
        const result = await pool.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
            [username, passwordHash]
        );

        console.log(`✅ User '${username}' created successfully!`);
        console.log(`   ID: ${result.rows[0].id}`);
        console.log(`   Username: ${result.rows[0].username}`);
        console.log(`   Password: ${password} (plain text for reference)`);
        
    } catch (error) {
        console.error('❌ Error creating user:', error.message);
    } finally {
        await pool.end();
    }
}

// Get command line arguments
const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
    console.log('Usage: node add-user-with-hash.js <username> <password>');
    console.log('Example: node add-user-with-hash.js john mypassword123');
    console.log('');
    console.log('This script will automatically hash the password for you!');
    process.exit(1);
}

addUserWithHash(username, password); 