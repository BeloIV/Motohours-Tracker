const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ quiet: true });

const authRoutes = require('./routes/auth');
const chargingRoutes = require('./routes/charging');
const vehiclesRoutes = require('./routes/vehicles');

const app = express();
const PORT = process.env.PORT || 3000;

// Exactly one proxy hop: the frontend nginx, which overwrites X-Forwarded-For
// with the real client address. The backend port is not published.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Security middleware
app.use(helmet());

// Rate limiting — generous limit for a LAN app
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 2000
});
app.use(limiter);

// No CORS: the SPA and the API share one origin behind nginx

// Body parsing middleware
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
// Express 5 leaves req.body undefined when no parser matched (e.g. no body)
app.use((req, res, next) => {
    if (req.body === undefined) req.body = {};
    next();
});

// Serve uploaded vehicle photos (same origin through nginx)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { dotfiles: 'deny', index: false }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/charging', chargingRoutes);
app.use('/api/vehicles', vehiclesRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        message: 'Motohours Tracker Backend is running'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    // Malformed JSON, oversized body, … — client errors from body-parser
    if (err.status && err.status >= 400 && err.status < 500) {
        return res.status(err.status).json({ error: 'Neplatná požiadavka' });
    }
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Tests import the app without opening a port
if (require.main === module || process.env.START_SERVER !== 'false') {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    });
}

module.exports = app; 