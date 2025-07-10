const express = require('express');
const bcrypt = require('bcryptjs');
const { getRow, runQuery } = require('../database/database');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

// Registration route
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Používateľské meno a heslo sú povinné' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Heslo musí mať aspoň 6 znakov' });
        }

        // Check if user already exists
        const existingUser = await getRow(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );

        if (existingUser) {
            return res.status(400).json({ error: 'Používateľ s týmto menom už existuje' });
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user
        const result = await runQuery(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
            [username, passwordHash]
        );

        res.status(201).json({
            message: 'Používateľ bol úspešne vytvorený',
            user: {
                id: result.id,
                username: result.rows[0].username
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

// Login route
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Používateľské meno a heslo sú povinné' });
        }

        // Get user from database
        const user = await getRow(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );

        if (!user) {
            return res.status(401).json({ error: 'Neplatné používateľské meno alebo heslo' });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Neplatné používateľské meno alebo heslo' });
        }

        // Generate JWT token
        const token = generateToken(user);

        res.json({
            message: 'Prihlásenie úspešné',
            token,
            user: {
                id: user.id,
                username: user.username
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

// Get current user info
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Vyžaduje sa prístupový token' });
        }

        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

        jwt.verify(token, JWT_SECRET, async (err, decoded) => {
            if (err) {
                return res.status(403).json({ error: 'Neplatný alebo vypršaný token' });
            }

            const user = await getRow(
                'SELECT id, username, created_at FROM users WHERE id = $1',
                [decoded.id]
            );

            if (!user) {
                return res.status(404).json({ error: 'Používateľ nebol nájdený' });
            }

            res.json({ user });
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

// Get all users (for dropdown)
router.get('/users', async (req, res) => {
    try {
        const { getAll } = require('../database/database');
        const users = await getAll('SELECT id, username FROM users ORDER BY username');
        res.json({ users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

module.exports = router; 