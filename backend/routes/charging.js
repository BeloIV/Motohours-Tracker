const express = require('express');
const { runQuery, getAll, getRow } = require('../database/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all charging sessions
router.get('/', async (req, res) => {
    try {
        const sessions = await getAll(`
            SELECT 
                cs.id,
                cs.start_time,
                cs.stop_time,
                cs.duration_minutes,
                cs.status,
                cs.created_at,
                u.username as user_name
            FROM charging_sessions cs
            JOIN users u ON cs.user_id = u.id
            ORDER BY cs.created_at DESC
        `);

        // Format duration for display
        const formattedSessions = sessions.map(session => {
            let durationText = '-';
            if (session.duration_minutes) {
                const hours = Math.floor(session.duration_minutes / 60);
                const minutes = session.duration_minutes % 60;
                if (hours > 0) {
                    durationText = `${hours}h ${minutes}m`;
                } else {
                    durationText = `${minutes}m`;
                }
            }
            return {
                ...session,
                duration_text: durationText
            };
        });

        res.json({ sessions: formattedSessions });
    } catch (error) {
        console.error('Get charging sessions error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

// Start charging session
router.post('/start', async (req, res) => {
    try {
        const userId = req.user.id;

        // Check if there's already an active session
        const activeSession = await getRow(
            'SELECT * FROM charging_sessions WHERE status = $1',
            ['active']
        );

        if (activeSession) {
            const user = await getRow('SELECT username FROM users WHERE id = $1', [activeSession.user_id]);
            return res.status(400).json({ 
                error: `${user.username} už má aktívnu nabíjaciu reláciu` 
            });
        }

        const startTime = new Date().toISOString();
        const result = await runQuery(
            'INSERT INTO charging_sessions (user_id, start_time, status) VALUES ($1, $2, $3) RETURNING id',
            [userId, startTime, 'active']
        );

        // Get the created session with user info
        const session = await getRow(`
            SELECT 
                cs.id,
                cs.start_time,
                cs.stop_time,
                cs.duration_minutes,
                cs.status,
                cs.created_at,
                u.username as user_name
            FROM charging_sessions cs
            JOIN users u ON cs.user_id = u.id
            WHERE cs.id = $1
        `, [result.id]);

        res.status(201).json({ 
            message: 'Nabíjacia relácia bola úspešne spustená',
            session 
        });

    } catch (error) {
        console.error('Start charging error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

// Stop charging session (any active session)
router.post('/stop', async (req, res) => {
    try {
        // Find any active charging session
        const activeSession = await getRow(
            'SELECT * FROM charging_sessions WHERE status = $1',
            ['active']
        );

        if (!activeSession) {
            return res.status(400).json({ error: 'Žiadna aktívna nabíjacia relácia na zastavenie' });
        }

        const stopTime = new Date().toISOString();
        const startTime = new Date(activeSession.start_time);
        const durationMs = new Date(stopTime) - startTime;
        const durationMinutes = Math.floor(durationMs / (1000 * 60));

        await runQuery(
            'UPDATE charging_sessions SET stop_time = $1, duration_minutes = $2, status = $3 WHERE id = $4',
            [stopTime, durationMinutes, 'completed', activeSession.id]
        );

        // Get the updated session with user info
        const session = await getRow(`
            SELECT 
                cs.id,
                cs.start_time,
                cs.stop_time,
                cs.duration_minutes,
                cs.status,
                cs.created_at,
                u.username as user_name
            FROM charging_sessions cs
            JOIN users u ON cs.user_id = u.id
            WHERE cs.id = $1
        `, [activeSession.id]);

        // Format duration
        let durationText = '-';
        if (session.duration_minutes) {
            const hours = Math.floor(session.duration_minutes / 60);
            const minutes = session.duration_minutes % 60;
            if (hours > 0) {
                durationText = `${hours}h ${minutes}m`;
            } else {
                durationText = `${minutes}m`;
            }
        }

        const message = session.user_name === req.user.username 
            ? `Vaše nabíjanie bolo zastavené! Trvanie: ${durationText}`
            : `Nabíjanie používateľa ${session.user_name} bolo zastavené používateľom ${req.user.username}! Trvanie: ${durationText}`;

        res.json({ 
            message,
            session: { ...session, duration_text: durationText }
        });

    } catch (error) {
        console.error('Stop charging error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

// Get active charging session
router.get('/active', async (req, res) => {
    try {
        const activeSession = await getRow(`
            SELECT 
                cs.id,
                cs.start_time,
                cs.stop_time,
                cs.duration_minutes,
                cs.status,
                cs.created_at,
                u.username as user_name
            FROM charging_sessions cs
            JOIN users u ON cs.user_id = u.id
            WHERE cs.status = $1
        `, ['active']);

        res.json({ session: activeSession });
    } catch (error) {
        console.error('Get active session error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

// Delete charging session (only own completed sessions)
router.delete('/:id', async (req, res) => {
    try {
        const sessionId = req.params.id;
        const userId = req.user.id;

        // Check if session exists and belongs to user
        const session = await getRow(
            'SELECT * FROM charging_sessions WHERE id = $1 AND user_id = $2',
            [sessionId, userId]
        );

        if (!session) {
            return res.status(404).json({ error: 'Relácia nebola nájdená alebo prístup zamietnutý' });
        }

        if (session.status === 'active') {
            return res.status(400).json({ error: 'Nie je možné vymazať aktívnu nabíjaciu reláciu' });
        }

        await runQuery('DELETE FROM charging_sessions WHERE id = $1', [sessionId]);

        res.json({ message: 'Nabíjacia relácia bola úspešne vymazaná' });

    } catch (error) {
        console.error('Delete charging session error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});



module.exports = router; 