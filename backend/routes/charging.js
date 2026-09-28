const express = require('express');
const { runQuery, getAll, getRow } = require('../database/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// Shared projection for a charging session row
const SESSION_SELECT = `
    SELECT
        cs.id,
        cs.start_time,
        cs.stop_time,
        cs.duration_minutes,
        cs.status,
        cs.created_at,
        cs.vehicle_id,
        cs.motohours,
        cs.battery_start,
        cs.battery_end,
        cs.user_id,
        cs.stopped_by,
        u.username as user_name,
        su.username as stopped_by_name,
        v.name as vehicle_name,
        v.photo_path as vehicle_photo
    FROM charging_sessions cs
    JOIN users u ON cs.user_id = u.id
    LEFT JOIN users su ON cs.stopped_by = su.id
    LEFT JOIN vehicles v ON cs.vehicle_id = v.id
`;

const formatDuration = (minutes) => {
    if (!minutes) return '-';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// Last known odometer reading for a vehicle: highest recorded value, falling
// back to the vehicle's initial reading
async function getLastMotohours(vehicleId) {
    const row = await getRow(`
        SELECT GREATEST(
            COALESCE((SELECT MAX(cs.motohours) FROM charging_sessions cs WHERE cs.vehicle_id = v.id), 0),
            COALESCE(v.initial_motohours, 0)
        ) as last_mh
        FROM vehicles v WHERE v.id = $1
    `, [vehicleId]);
    return row ? parseFloat(row.last_mh) : 0;
}

// Get all charging sessions scoped to company
router.get('/', async (req, res) => {
    try {
        const sessions = await getAll(
            `${SESSION_SELECT} WHERE u.company_id = $1 ORDER BY cs.created_at DESC`,
            [req.user.company_id]
        );

        const formattedSessions = sessions.map(s => ({
            ...s,
            duration_text: formatDuration(s.duration_minutes)
        }));

        res.json({ sessions: formattedSessions });
    } catch (error) {
        console.error('Get charging sessions error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

// Start charging session (one active session per vehicle)
router.post('/start', async (req, res) => {
    try {
        const { vehicle_id, motohours, battery_start } = req.body;
        const userId = req.user.id;

        if (!vehicle_id) {
            return res.status(400).json({ error: 'Vyberte vozík na nabíjanie' });
        }

        if (motohours === undefined || motohours === null || motohours === '') {
            return res.status(400).json({ error: 'Zadajte motohodiny' });
        }

        if (battery_start === undefined || battery_start === null || battery_start === '') {
            return res.status(400).json({ error: 'Zadajte stav batérie pred nabíjaním' });
        }

        const mh = parseFloat(motohours);
        const batteryStart = parseInt(battery_start);

        if (isNaN(mh) || mh < 0) {
            return res.status(400).json({ error: 'Motohodiny musia byť kladné číslo' });
        }

        if (isNaN(batteryStart) || batteryStart < 0 || batteryStart > 100) {
            return res.status(400).json({ error: 'Stav batérie musí byť medzi 0 a 100' });
        }

        // Vehicle must belong to the user's company
        const vehicle = await getRow(
            'SELECT id FROM vehicles WHERE id = $1 AND company_id = $2',
            [vehicle_id, req.user.company_id]
        );

        if (!vehicle) {
            return res.status(404).json({ error: 'Vozík nebol nájdený' });
        }

        // Check if this vehicle is already charging
        const vehicleActive = await getRow(
            `SELECT cs.* FROM charging_sessions cs WHERE cs.status = 'active' AND cs.vehicle_id = $1`,
            [vehicle_id]
        );

        if (vehicleActive) {
            return res.status(400).json({ error: 'Tento vozík sa už nabíja' });
        }

        // Odometer validation: new reading must be >= last known reading
        const lastMh = await getLastMotohours(vehicle_id);
        if (mh < lastMh) {
            return res.status(400).json({
                error: `Motohodiny nemôžu byť nižšie ako posledná hodnota (${lastMh})`
            });
        }

        const startTime = new Date().toISOString();
        const result = await runQuery(
            `INSERT INTO charging_sessions (user_id, start_time, status, vehicle_id, motohours, battery_start)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [userId, startTime, 'active', vehicle_id, mh, batteryStart]
        );

        const session = await getRow(`${SESSION_SELECT} WHERE cs.id = $1`, [result.id]);

        res.status(201).json({
            message: 'Nabíjacia relácia bola úspešne spustená',
            session
        });

    } catch (error) {
        console.error('Start charging error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

// Stop active charging session for a specific vehicle
router.post('/stop', async (req, res) => {
    try {
        const { vehicle_id, battery_end } = req.body;

        if (!vehicle_id) {
            return res.status(400).json({ error: 'Vyberte vozík na zastavenie nabíjania' });
        }

        if (battery_end === undefined || battery_end === null || battery_end === '') {
            return res.status(400).json({ error: 'Zadajte stav batérie po nabíjaní' });
        }

        const batteryEnd = parseInt(battery_end);
        if (isNaN(batteryEnd) || batteryEnd < 0 || batteryEnd > 100) {
            return res.status(400).json({ error: 'Stav batérie musí byť medzi 0 a 100' });
        }

        const activeSession = await getRow(`
            SELECT cs.* FROM charging_sessions cs
            JOIN users u ON cs.user_id = u.id
            WHERE cs.status = 'active' AND cs.vehicle_id = $1 AND u.company_id = $2
        `, [vehicle_id, req.user.company_id]);

        if (!activeSession) {
            return res.status(400).json({ error: 'Tento vozík sa nenabíja' });
        }

        const stopTime = new Date().toISOString();
        const durationMinutes = Math.floor((new Date(stopTime) - new Date(activeSession.start_time)) / 60000);

        await runQuery(
            'UPDATE charging_sessions SET stop_time = $1, duration_minutes = $2, status = $3, battery_end = $4, stopped_by = $5 WHERE id = $6',
            [stopTime, durationMinutes, 'completed', batteryEnd, req.user.id, activeSession.id]
        );

        const session = await getRow(`${SESSION_SELECT} WHERE cs.id = $1`, [activeSession.id]);

        const durationText = formatDuration(session.duration_minutes);
        const charged = session.battery_start !== null
            ? ` (${session.battery_start}% → ${session.battery_end}%)`
            : '';
        const message = session.user_name === req.user.username
            ? `Vaše nabíjanie bolo zastavené! Trvanie: ${durationText}${charged}`
            : `Nabíjanie používateľa ${session.user_name} bolo zastavené používateľom ${req.user.username}! Trvanie: ${durationText}${charged}`;

        res.json({ message, session: { ...session, duration_text: durationText } });

    } catch (error) {
        console.error('Stop charging error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

// Get all active charging sessions for this company
router.get('/active', async (req, res) => {
    try {
        const activeSessions = await getAll(
            `${SESSION_SELECT} WHERE cs.status = 'active' AND u.company_id = $1 ORDER BY cs.start_time ASC`,
            [req.user.company_id]
        );

        res.json({ sessions: activeSessions });
    } catch (error) {
        console.error('Get active sessions error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

// Hours driven per vehicle in a period, as the odometer delta between the last
// reading before the period and the highest reading inside it. Summing this
// across vehicles would be meaningless, so it stays per vehicle.
// periodStart / periodEnd are ISO date strings (exclusive end)
async function getHoursDrivenPerVehicle(companyId, periodStart, periodEnd) {
    const rows = await getAll(`
        WITH in_period AS (
            SELECT cs.vehicle_id, MAX(cs.motohours) as max_mh, COUNT(*) as cnt
            FROM charging_sessions cs
            JOIN users u ON cs.user_id = u.id
            WHERE u.company_id = $1
              AND cs.motohours IS NOT NULL
              AND cs.created_at >= $2::timestamptz
              AND cs.created_at < $3::timestamptz
            GROUP BY cs.vehicle_id
        ),
        before_period AS (
            SELECT DISTINCT ON (cs.vehicle_id)
                cs.vehicle_id, cs.motohours as last_mh
            FROM charging_sessions cs
            JOIN users u ON cs.user_id = u.id
            WHERE u.company_id = $1
              AND cs.motohours IS NOT NULL
              AND cs.created_at < $2::timestamptz
            ORDER BY cs.vehicle_id, cs.created_at DESC
        )
        SELECT
            v.id as vehicle_id,
            COALESCE(GREATEST(ip.max_mh - COALESCE(bp.last_mh, v.initial_motohours, 0), 0), 0) as hours,
            COALESCE(ip.cnt, 0) as charge_count
        FROM vehicles v
        LEFT JOIN in_period ip ON ip.vehicle_id = v.id
        LEFT JOIN before_period bp ON bp.vehicle_id = v.id
        WHERE v.company_id = $1
    `, [companyId, periodStart, periodEnd]);

    return rows.reduce((acc, row) => {
        acc[row.vehicle_id] = {
            hours: parseFloat(row.hours),
            charge_count: parseInt(row.charge_count)
        };
        return acc;
    }, {});
}

// Per-vehicle motohours overview scoped to company
router.get('/stats', async (req, res) => {
    try {
        const companyId = req.user.company_id;

        const now = new Date();
        const y = now.getUTCFullYear(), mo = now.getUTCMonth(), dd = now.getUTCDate();
        const dow = (now.getUTCDay() + 6) % 7; // Mon=0, Sun=6

        const todayStart     = new Date(Date.UTC(y, mo, dd)).toISOString();
        const todayEnd       = new Date(Date.UTC(y, mo, dd + 1)).toISOString();
        const thisWeekStart  = new Date(Date.UTC(y, mo, dd - dow)).toISOString();
        const thisMonthStart = new Date(Date.UTC(y, mo, 1)).toISOString();

        const vehicles = await getAll(`
            SELECT v.id, v.name,
                GREATEST(
                    COALESCE((SELECT MAX(cs.motohours) FROM charging_sessions cs WHERE cs.vehicle_id = v.id), 0),
                    COALESCE(v.initial_motohours, 0)
                ) as last_motohours
            FROM vehicles v
            WHERE v.company_id = $1
            ORDER BY v.created_at ASC
        `, [companyId]);

        const [today, thisWeek, thisMonth] = await Promise.all([
            getHoursDrivenPerVehicle(companyId, todayStart, todayEnd),
            getHoursDrivenPerVehicle(companyId, thisWeekStart, todayEnd),
            getHoursDrivenPerVehicle(companyId, thisMonthStart, todayEnd),
        ]);

        const empty = { hours: 0, charge_count: 0 };

        res.json({
            vehicles: vehicles.map(v => ({
                id: v.id,
                name: v.name,
                last_motohours: parseFloat(v.last_motohours),
                today: today[v.id] || empty,
                thisWeek: thisWeek[v.id] || empty,
                thisMonth: thisMonth[v.id] || empty
            }))
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

// Who corrected what on this session, oldest first
router.get('/:id/history', async (req, res) => {
    try {
        const session = await getRow(`
            SELECT cs.id FROM charging_sessions cs
            JOIN users u ON cs.user_id = u.id
            WHERE cs.id = $1 AND u.company_id = $2
        `, [req.params.id, req.user.company_id]);

        if (!session) {
            return res.status(404).json({ error: 'Relácia nebola nájdená' });
        }

        const changes = await getAll(`
            SELECT c.id, c.field, c.old_value, c.new_value, c.changed_at, u.username as user_name
            FROM charging_session_changes c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.session_id = $1
            ORDER BY c.changed_at ASC, c.id ASC
        `, [req.params.id]);

        res.json({ changes });
    } catch (error) {
        console.error('Get session history error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

// Delete charging session (creator, whoever stopped it, or an admin)
router.delete('/:id', async (req, res) => {
    try {
        const session = await getRow(`
            SELECT cs.* FROM charging_sessions cs
            JOIN users u ON cs.user_id = u.id
            WHERE cs.id = $1 AND u.company_id = $2
        `, [req.params.id, req.user.company_id]);

        if (!session) {
            return res.status(404).json({ error: 'Relácia nebola nájdená alebo prístup zamietnutý' });
        }

        if (session.status === 'active') {
            return res.status(400).json({ error: 'Nie je možné vymazať aktívnu nabíjaciu reláciu' });
        }

        const allowed = req.user.role === 'admin'
            || session.user_id === req.user.id
            || session.stopped_by === req.user.id;

        if (!allowed) {
            return res.status(403).json({ error: 'Vymazať záznam môže iba ten, kto nabíjanie spustil alebo zastavil' });
        }

        await runQuery('DELETE FROM charging_sessions WHERE id = $1', [req.params.id]);

        res.json({ message: 'Nabíjacia relácia bola úspešne vymazaná' });

    } catch (error) {
        console.error('Delete charging session error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

module.exports = router;
