const express = require('express');
const bcrypt = require('bcryptjs');
const { getRow } = require('../database/database');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

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