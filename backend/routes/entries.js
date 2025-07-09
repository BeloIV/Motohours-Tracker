const express = require('express');
const { runQuery, getAll, getRow } = require('../database/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all entries
router.get('/', async (req, res) => {
    try {
        const entries = await getAll(`
            SELECT 
                e.id,
                e.motohours,
                e.battery_capacity,
                e.created_at,
                u.username as user_name
            FROM entries e
            JOIN users u ON e.user_id = u.id
            ORDER BY e.created_at DESC
        `);

        res.json({ entries });
    } catch (error) {
        console.error('Get entries error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

// Create new entry
router.post('/', async (req, res) => {
    try {
        const { motohours, battery_capacity } = req.body;
        const userId = req.user.id;

        if (!motohours || !battery_capacity) {
            return res.status(400).json({ error: 'Motohodiny a kapacita batérie sú povinné' });
        }

        if (motohours < 0) {
            return res.status(400).json({ error: 'Motohodiny musia byť kladné' });
        }

        if (battery_capacity < 0 || battery_capacity > 100) {
            return res.status(400).json({ error: 'Kapacita batérie musí byť medzi 0 a 100' });
        }

        const result = await runQuery(
            'INSERT INTO entries (user_id, motohours, battery_capacity) VALUES ($1, $2, $3) RETURNING id',
            [userId, motohours, battery_capacity]
        );

        // Get the created entry with user info
        const entry = await getRow(`
            SELECT 
                e.id,
                e.motohours,
                e.battery_capacity,
                e.created_at,
                u.username as user_name
            FROM entries e
            JOIN users u ON e.user_id = u.id
            WHERE e.id = $1
        `, [result.id]);

        res.status(201).json({ 
            message: 'Záznam bol úspešne vytvorený',
            entry 
        });

    } catch (error) {
        console.error('Create entry error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

// Delete entry (only own entries)
router.delete('/:id', async (req, res) => {
    try {
        const entryId = req.params.id;
        const userId = req.user.id;

        // Check if entry exists and belongs to user
        const entry = await getRow(
            'SELECT * FROM entries WHERE id = $1 AND user_id = $2',
            [entryId, userId]
        );

        if (!entry) {
            return res.status(404).json({ error: 'Záznam nebol nájdený alebo prístup zamietnutý' });
        }

        await runQuery('DELETE FROM entries WHERE id = $1', [entryId]);

        res.json({ message: 'Záznam bol úspešne vymazaný' });

    } catch (error) {
        console.error('Delete entry error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});



// Get entries for specific user
router.get('/user/:userId', async (req, res) => {
    try {
        const targetUserId = req.params.userId;
        const currentUserId = req.user.id;

        // Check if user exists
        const user = await getRow('SELECT id, username FROM users WHERE id = $1', [targetUserId]);
        if (!user) {
            return res.status(404).json({ error: 'Používateľ nebol nájdený' });
        }

        const entries = await getAll(`
            SELECT 
                e.id,
                e.motohours,
                e.battery_capacity,
                e.created_at,
                u.username as user_name
            FROM entries e
            JOIN users u ON e.user_id = u.id
            WHERE e.user_id = $1
            ORDER BY e.created_at DESC
        `, [targetUserId]);

        res.json({ 
            entries,
            user: {
                id: user.id,
                username: user.username
            }
        });

    } catch (error) {
        console.error('Get user entries error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

module.exports = router; 