const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getRow, runQuery } = require('../database/database');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Registration route
// With invite_token: join that company as regular user
// Without invite_token: create new company, become admin
router.post('/register', async (req, res) => {
    try {
        const { username, password, invite_token } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Používateľské meno a heslo sú povinné' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Heslo musí mať aspoň 6 znakov' });
        }

        const existingUser = await getRow('SELECT id FROM users WHERE username = $1', [username]);
        if (existingUser) {
            return res.status(400).json({ error: 'Používateľ s týmto menom už existuje' });
        }

        let companyId;
        let role;
        let invite = null;

        if (invite_token) {
            invite = await getRow(
                'SELECT * FROM invites WHERE token = $1 AND used = FALSE',
                [invite_token]
            );
            if (!invite) {
                return res.status(400).json({ error: 'Neplatný alebo použitý pozývací kód' });
            }
            companyId = invite.company_id;
            role = 'user';
        } else {
            const company = await runQuery(
                'INSERT INTO companies (name) VALUES ($1) RETURNING id',
                [username + "'s Company"]
            );
            companyId = company.id;
            role = 'admin';
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const result = await runQuery(
            'INSERT INTO users (username, password_hash, role, company_id) VALUES ($1, $2, $3, $4) RETURNING id, username',
            [username, passwordHash, role, companyId]
        );

        if (invite) {
            await runQuery('UPDATE invites SET used = TRUE WHERE id = $1', [invite.id]);
        }

        res.status(201).json({
            message: 'Používateľ bol úspešne vytvorený',
            user: { id: result.id, username: result.rows[0].username, role }
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

        const user = await getRow('SELECT * FROM users WHERE username = $1', [username]);

        if (!user) {
            return res.status(401).json({ error: 'Neplatné používateľské meno alebo heslo' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Neplatné používateľské meno alebo heslo' });
        }

        const token = generateToken(user);

        res.json({
            message: 'Prihlásenie úspešné',
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                company_id: user.company_id
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

// Get current user info
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await getRow(
            'SELECT id, username, role, company_id, created_at FROM users WHERE id = $1',
            [req.user.id]
        );

        if (!user) {
            return res.status(404).json({ error: 'Používateľ nebol nájdený' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

// Generate invite token (admin only)
router.post('/invite', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Iba administrátori môžu pozývať používateľov' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        await runQuery(
            'INSERT INTO invites (token, company_id, created_by) VALUES ($1, $2, $3)',
            [token, req.user.company_id, req.user.id]
        );

        res.status(201).json({ token });
    } catch (error) {
        console.error('Create invite error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

// Validate invite token — public route used to show company name on register form
router.get('/invite/:token', async (req, res) => {
    try {
        const invite = await getRow(`
            SELECT i.token, i.used, c.name as company_name
            FROM invites i
            JOIN companies c ON i.company_id = c.id
            WHERE i.token = $1
        `, [req.params.token]);

        if (!invite || invite.used) {
            return res.status(404).json({ error: 'Neplatný alebo použitý pozývací kód' });
        }

        res.json({ company_name: invite.company_name });
    } catch (error) {
        console.error('Validate invite error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

module.exports = router;
