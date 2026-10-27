const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { runQuery, getAll, getRow } = require('../database/database');
const { authenticateToken } = require('../middleware/auth');
const { parseId, text } = require('../utils/validation');

const router = express.Router();
router.use(authenticateToken);

const IMAGE_TYPES = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
};

class UploadError extends Error {}

const UPLOAD_DIR = path.join(__dirname, '../uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        cb(null, UPLOAD_DIR);
    },
    // Extension comes from the validated mimetype, never from the client's
    // file name — /uploads is served from the app's own origin
    filename: (req, file, cb) => {
        const ext = IMAGE_TYPES[file.mimetype];
        cb(null, `vehicle-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    }
});

const multerUpload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (IMAGE_TYPES[file.mimetype]) cb(null, true);
        else cb(new UploadError('Povolené sú iba obrázky (JPEG, PNG, WebP, GIF)'));
    }
});

// Multer/file-filter errors are client errors, not 500s
const uploadPhoto = (req, res, next) => {
    multerUpload.single('photo')(req, res, (err) => {
        if (!err) return next();
        if (err instanceof UploadError) return res.status(400).json({ error: err.message });
        if (err instanceof multer.MulterError) {
            const message = err.code === 'LIMIT_FILE_SIZE' ? 'Obrázok môže mať najviac 5 MB' : 'Neplatný súbor';
            return res.status(400).json({ error: message });
        }
        next(err);
    });
};

// Remove a stored photo; paths always come from our own DB column
const removePhoto = (photoPath) => {
    if (!photoPath) return;
    const filePath = path.join(UPLOAD_DIR, path.basename(photoPath));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
};

// Checked before multer so a non-admin upload never touches the disk
const requireAdmin = (message) => (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: message });
    next();
};

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
router.post('/', requireAdmin('Iba administrátori môžu pridávať vozíky'), uploadPhoto, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Iba administrátori môžu pridávať vozíky' });
        }

        const name = text(req.body.name, 255);
        if (!name) {
            removePhoto(req.file && req.file.filename);
            return res.status(400).json({ error: 'Názov vozíka je povinný' });
        }

        let initialMh = 0;
        const { initial_motohours } = req.body;
        if (initial_motohours !== undefined && initial_motohours !== '') {
            initialMh = typeof initial_motohours === 'string' ? Number(initial_motohours) : NaN;
            if (!Number.isFinite(initialMh) || initialMh < 0 || initialMh > 99999999) {
                removePhoto(req.file && req.file.filename);
                return res.status(400).json({ error: 'Počiatočný stav musí byť kladné číslo' });
            }
        }
        const photoPath = req.file ? `/uploads/${req.file.filename}` : null;

        const result = await runQuery(
            'INSERT INTO vehicles (company_id, name, photo_path, initial_motohours) VALUES ($1, $2, $3, $4) RETURNING id',
            [req.user.company_id, name, photoPath, initialMh]
        );

        const vehicle = await getRow('SELECT * FROM vehicles WHERE id = $1', [result.id]);
        res.status(201).json({ vehicle });
    } catch (error) {
        console.error('Create vehicle error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

// Update vehicle (admin only) — rename, correct the baseline reading, add or replace the photo
router.put('/:id', requireAdmin('Iba administrátori môžu upravovať vozíky'), uploadPhoto, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Iba administrátori môžu upravovať vozíky' });
        }

        const vehicleId = parseId(req.params.id);
        const vehicle = vehicleId && await getRow(
            'SELECT * FROM vehicles WHERE id = $1 AND company_id = $2',
            [vehicleId, req.user.company_id]
        );

        if (!vehicle) {
            return res.status(404).json({ error: 'Vozík nebol nájdený' });
        }

        const { initial_motohours } = req.body;
        const name = req.body.name === undefined ? vehicle.name : text(req.body.name, 255);

        if (!name) {
            removePhoto(req.file && req.file.filename);
            return res.status(400).json({ error: 'Názov vozíka je povinný' });
        }

        let initialMh = vehicle.initial_motohours;
        if (initial_motohours !== undefined && initial_motohours !== '') {
            initialMh = typeof initial_motohours === 'string' ? Number(initial_motohours) : NaN;
            if (!Number.isFinite(initialMh) || initialMh < 0 || initialMh > 99999999) {
                removePhoto(req.file && req.file.filename);
                return res.status(400).json({ error: 'Počiatočný stav musí byť kladné číslo' });
            }
        }

        let photoPath = vehicle.photo_path;
        if (req.file) {
            photoPath = `/uploads/${req.file.filename}`;
            removePhoto(vehicle.photo_path);
        }

        await runQuery(
            'UPDATE vehicles SET name = $1, initial_motohours = $2, photo_path = $3 WHERE id = $4',
            [name, initialMh, photoPath, vehicle.id]
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

        const vehicleId = parseId(req.params.id);
        const vehicle = vehicleId && await getRow(
            'SELECT * FROM vehicles WHERE id = $1 AND company_id = $2',
            [vehicleId, req.user.company_id]
        );

        if (!vehicle) {
            return res.status(404).json({ error: 'Vozík nebol nájdený' });
        }

        removePhoto(vehicle.photo_path);

        // Delete all charging sessions for this vehicle
        await runQuery('DELETE FROM charging_sessions WHERE vehicle_id = $1', [vehicle.id]);
        await runQuery('DELETE FROM vehicles WHERE id = $1', [vehicle.id]);
        res.json({ message: 'Vozík a všetky jeho záznamy boli vymazané' });
    } catch (error) {
        console.error('Delete vehicle error:', error);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

module.exports = router;
