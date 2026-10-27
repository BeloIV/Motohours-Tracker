const rateLimit = require('express-rate-limit');

// Client IP comes from nginx (X-Forwarded-For overwritten with the real
// address, 'trust proxy' = 1 in server.js).
const tooMany = (req, res) => {
    res.status(429).json({ error: 'Príliš veľa pokusov, skúste to neskôr' });
};

// Only failed logins count: a whole warehouse shares one public IP, and
// colleagues logging in successfully must not lock each other out.
const loginPerMinute = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: tooMany
});

const loginPerHour = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 50,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: tooMany
});

// Invited colleagues often sign up together from the same network
const registerPerHour = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: tooMany
});

// Invite lookups are unauthenticated — slow down token guessing
const inviteLookup = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: tooMany
});

module.exports = { loginPerMinute, loginPerHour, registerPerHour, inviteLookup };
