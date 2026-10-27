const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config');
const { getRow } = require('../database/database');

const JWT_SECRET = getJwtSecret();

// Middleware to verify JWT token. Role and company are re-read from the
// database on every request, so a deleted user or a changed role takes
// effect immediately instead of when the 24h token expires.
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, async (err, payload) => {
        if (err || !Number.isInteger(payload.id)) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        try {
            const user = await getRow(
                'SELECT id, username, role, company_id FROM users WHERE id = $1',
                [payload.id]
            );
            if (!user) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }
            req.user = user;
            next();
        } catch (error) {
            next(error);
        }
    });
};

// Generate JWT token
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            role: user.role,
            company_id: user.company_id
        },
        JWT_SECRET,
        { expiresIn: '24h', algorithm: 'HS256' }
    );
};

module.exports = {
    authenticateToken,
    generateToken
};
