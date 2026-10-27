const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool, getRow, runQuery } = require('../database/database');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { loginPerMinute, loginPerHour, registerPerHour, inviteLookup } = require('../middleware/rateLimits');
const { text, passwordProblem } = require('../utils/validation');

const router = express.Router();

// Registration route
// With invite_token: join that company as regular user
// Without invite_token: create new company, become admin
router.post('/register', registerPerHour, async (req, res) => {
    const body = req.body || {};
    const username = text(body.username, 50);
    const { password, invite_token } = body;

    if (!username || typeof password !== 'string' || !password) {
        return res.status(400).json({ error: 'Používateľské meno a heslo sú povinné' });
    }

    if (/[\u0000-\u001f\u007f]/.test(username)) {
        return res.status(400).json({ error: 'Používateľské meno obsahuje nepovolené znaky' });
    }

    const problem = passwordProblem(password);
    if (problem) {
        return res.status(400).json({ error: problem });
    }

    if (invite_token !== undefined && invite_token !== null && invite_token !== ''
        && (typeof invite_token !== 'string' || invite_token.length > 255)) {
        return res.status(400).json({ error: 'Neplatný alebo použitý pozývací kód' });
    }

    // Hash before opening the transaction — nothing is written if this fails
    let passwordHash;
    let client;
    try {
        passwordHash = await bcrypt.hash(password, 10);
        client = await pool.connect();
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ error: 'Interná chyba servera' });
    }

    try {
        await client.query('BEGIN');

        const existingUser = await client.query('SELECT id FROM users WHERE username = $1', [username]);
        if (existingUser.rows.length) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Používateľ s týmto menom už existuje' });
        }

        let companyId;
        let role;

        if (invite_token) {
            // Claim the invite atomically so it can only be used once
            const invite = await client.query(
                'UPDATE invites SET used = TRUE WHERE token = $1 AND used = FALSE RETURNING company_id',
                [invite_token]
            );
            if (!invite.rows.length) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Neplatný alebo použitý pozývací kód' });
            }
            companyId = invite.rows[0].company_id;
            role = 'user';
        } else {
            const company = await client.query(
                'INSERT INTO companies (name) VALUES ($1) RETURNING id',
                [username + "'s Company"]
            );
            companyId = company.rows[0].id;
            role = 'admin';
        }

        const result = await client.query(
            'INSERT INTO users (username, password_hash, role, company_id) VALUES ($1, $2, $3, $4) RETURNING id, username',
            [username, passwordHash, role, companyId]
        );

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Používateľ bol úspešne vytvorený',
            user: { id: result.rows[0].id, username: result.rows[0].username, role }
        });

    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Používateľ s týmto menom už existuje' });
        }
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    } finally {
        client.release();
    }
});

// Login route
router.post('/login', loginPerHour, loginPerMinute, async (req, res) => {
    try {
        const { username, password } = req.body || {};

        if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
            return res.status(400).json({ error: 'Používateľské meno a heslo sú povinné' });
        }

        // bcrypt only looks at the first 72 bytes; never accept a longer string
        if (username.length > 255 || Buffer.byteLength(password, 'utf8') > 72) {
            return res.status(401).json({ error: 'Neplatné používateľské meno alebo heslo' });
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
router.get('/invite/:token', inviteLookup, async (req, res) => {
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
