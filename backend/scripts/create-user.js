#!/usr/bin/env node

const bcrypt = require('bcryptjs');
const { pool } = require('../database/database');

async function createUser(username, password) {
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
        const passwordHash = await bcrypt.hash(password, 10);

        // Insert new user
        const result = await pool.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
            [username, passwordHash]
        );

        console.log(`✅ Created user: ${result.rows[0].username} (ID: ${result.rows[0].id})`);

    } catch (error) {
        console.error('Error creating user:', error);
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length !== 2) {
        console.log('Usage: node create-user.js <username> <password>');
        console.log('Example: node create-user.js admin password123');
        process.exit(1);
    }

    const [username, password] = args;

    console.log('Creating user...');
    await createUser(username, password);
    
    // Close database connection
    await pool.end();
    console.log('Database connection closed');
}

main().catch(console.error); 