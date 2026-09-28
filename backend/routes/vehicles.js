const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { runQuery, getAll, getRow } = require('../database/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `vehicle-${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Povolené sú iba obrázky'));
    }
});

// List vehicles for this company (includes last known motohours)
router.get('/', async (req, res) => {
    try {
        const vehicles = await getAll(`
            SELECT v.*,
                GREATEST(
                    COALESCE((SELECT MAX(cs.motohours) FROM charging_sessions cs WHERE cs.vehicle_id = v.id), 0),
                    COALESCE(v.initial_motohours, 0)
                ) as last_motohours
            FROM vehicles v
            WHERE v.company_id = $1
            ORDER BY v.created_at ASC
        `, [req.user.company_id]);
        res.json({ vehicles });
    } catch (error) {
        console.error('Get vehicles error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

// Create vehicle (admin only)
router.post('/', upload.single('photo'), async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Iba administrátori môžu pridávať vozíky' });
        }

        const { name, initial_motohours } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Názov vozíka je povinný' });
        }

        const initialMh = parseFloat(initial_motohours) || 0;
        const photoPath = req.file ? `/uploads/${req.file.filename}` : null;

        const result = await runQuery(
            'INSERT INTO vehicles (company_id, name, photo_path, initial_motohours) VALUES ($1, $2, $3, $4) RETURNING id',
            [req.user.company_id, name.trim(), photoPath, initialMh]
        );

        const vehicle = await getRow('SELECT * FROM vehicles WHERE id = $1', [result.id]);
        res.status(201).json({ vehicle });
    } catch (error) {
        console.error('Create vehicle error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

// Update vehicle (admin only) — rename, correct the baseline reading, add or replace the photo
router.put('/:id', upload.single('photo'), async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Iba administrátori môžu upravovať vozíky' });
        }

        const vehicle = await getRow(
            'SELECT * FROM vehicles WHERE id = $1 AND company_id = $2',
            [req.params.id, req.user.company_id]
        );

        if (!vehicle) {
            return res.status(404).json({ error: 'Vozík nebol nájdený' });
        }

        const { name, initial_motohours } = req.body;

        if (name !== undefined && !name.trim()) {
            return res.status(400).json({ error: 'Názov vozíka je povinný' });
        }

        let initialMh = vehicle.initial_motohours;
        if (initial_motohours !== undefined && initial_motohours !== '') {
            initialMh = parseFloat(initial_motohours);
            if (isNaN(initialMh) || initialMh < 0) {
                return res.status(400).json({ error: 'Počiatočný stav musí byť kladné číslo' });
            }
        }

        let photoPath = vehicle.photo_path;
        if (req.file) {
            photoPath = `/uploads/${req.file.filename}`;
            if (vehicle.photo_path) {
                const oldPath = path.join(__dirname, '..', vehicle.photo_path);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
        }

        await runQuery(
            'UPDATE vehicles SET name = $1, initial_motohours = $2, photo_path = $3 WHERE id = $4',
            [name !== undefined ? name.trim() : vehicle.name, initialMh, photoPath, vehicle.id]
        );

        const updated = await getRow(`
            SELECT v.*,
                GREATEST(
                    COALESCE((SELECT MAX(cs.motohours) FROM charging_sessions cs WHERE cs.vehicle_id = v.id), 0),
                    COALESCE(v.initial_motohours, 0)
                ) as last_motohours
            FROM vehicles v WHERE v.id = $1
        `, [vehicle.id]);

        res.json({ message: 'Vozík bol upravený', vehicle: updated });
    } catch (error) {
        console.error('Update vehicle error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

// Delete vehicle (admin only)
router.delete('/:id', async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Iba administrátori môžu mazať vozíky' });
        }

        const vehicle = await getRow(
            'SELECT * FROM vehicles WHERE id = $1 AND company_id = $2',
            [req.params.id, req.user.company_id]
        );

        if (!vehicle) {
            return res.status(404).json({ error: 'Vozík nebol nájdený' });
        }

        // Remove photo file if it exists
        if (vehicle.photo_path) {
            const filePath = path.join(__dirname, '..', vehicle.photo_path);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        // Delete all charging sessions for this vehicle
        await runQuery('DELETE FROM charging_sessions WHERE vehicle_id = $1', [req.params.id]);
        await runQuery('DELETE FROM vehicles WHERE id = $1', [req.params.id]);
        res.json({ message: 'Vozík a všetky jeho záznamy boli vymazané' });
    } catch (error) {
        console.error('Delete vehicle error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

module.exports = router;
