const fs = require('fs');
const path = require('path');
const { api, pool, resetDb, createUser, createVehicle, count } = require('./helpers');

const UPLOADS = path.join(__dirname, '../uploads');
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6300010000050001', 'hex');

let a, b, vehicleA, vehicleB;

beforeEach(async () => {
    await resetDb();
    a = await createUser('alice');
    b = await createUser('bob');
    vehicleA = await createVehicle(a.company_id, 'A1');
    vehicleB = await createVehicle(b.company_id, 'B1');
});
afterAll(() => pool.end());

const as = (user) => ({ Authorization: `Bearer ${user.token}` });

async function startSession(user, vehicle, motohours = 150) {
    return api().post('/api/charging/start').set(as(user))
        .send({ vehicle_id: vehicle.id, motohours, battery_start: 20 });
}

describe('company isolation', () => {
    test('vehicle list shows only own company', async () => {
        const res = await api().get('/api/vehicles').set(as(a));
        expect(res.body.vehicles.map(v => v.id)).toEqual([vehicleA.id]);
    });

    test("cannot update or delete another company's vehicle", async () => {
        expect((await api().put(`/api/vehicles/${vehicleB.id}`).set(as(a)).field('name', 'hacked')).status).toBe(404);
        expect((await api().delete(`/api/vehicles/${vehicleB.id}`).set(as(a))).status).toBe(404);
        const row = await pool.query('SELECT name FROM vehicles WHERE id = $1', [vehicleB.id]);
        expect(row.rows[0].name).toBe('B1');
    });

    test("cannot start or stop charging on another company's vehicle", async () => {
        expect((await startSession(a, vehicleB)).status).toBe(404);
        expect((await startSession(b, vehicleB)).status).toBe(201);
        const stop = await api().post('/api/charging/stop').set(as(a)).send({ vehicle_id: vehicleB.id, battery_end: 90 });
        expect(stop.status).toBe(400);
        const row = await pool.query("SELECT status FROM charging_sessions WHERE vehicle_id = $1", [vehicleB.id]);
        expect(row.rows[0].status).toBe('active');
    });

    test("sessions, history, stats and delete never reach another company's data", async () => {
        await startSession(b, vehicleB);
        await api().post('/api/charging/stop').set(as(b)).send({ vehicle_id: vehicleB.id, battery_end: 90 });
        const sid = (await pool.query('SELECT id FROM charging_sessions')).rows[0].id;

        expect((await api().get('/api/charging').set(as(a))).body.sessions).toEqual([]);
        expect((await api().get('/api/charging/active').set(as(a))).body.sessions).toEqual([]);
        expect((await api().get(`/api/charging/${sid}/history`).set(as(a))).status).toBe(404);
        expect((await api().delete(`/api/charging/${sid}`).set(as(a))).status).toBe(404);
        const stats = await api().get('/api/charging/stats').set(as(a));
        expect(stats.body.vehicles.map(v => v.id)).toEqual([vehicleA.id]);
        expect(await count('charging_sessions')).toBe(1);
    });
});

describe('input types', () => {
    test.each([
        ['SQL-ish vehicle_id', { vehicle_id: '1 OR 1=1', motohours: 150, battery_start: 20 }],
        ['array vehicle_id', { vehicle_id: [1], motohours: 150, battery_start: 20 }],
        ['object motohours', { vehicle_id: 'VID', motohours: { a: 1 }, battery_start: 20 }],
        ['fractional battery', { vehicle_id: 'VID', motohours: 150, battery_start: 20.5 }],
        ['battery over 100', { vehicle_id: 'VID', motohours: 150, battery_start: 101 }],
        ['Infinity motohours', { vehicle_id: 'VID', motohours: 'Infinity', battery_start: 20 }],
    ])('start with %s → 400', async (_, body) => {
        if (body.vehicle_id === 'VID') body.vehicle_id = vehicleA.id;
        expect((await api().post('/api/charging/start').set(as(a)).send(body)).status).toBe(400);
        expect(await count('charging_sessions')).toBe(0);
    });

    test.each(['abc', '0', '-1', '99999999999', '1e3'])('session id %s → 404', async (id) => {
        expect((await api().get(`/api/charging/${id}/history`).set(as(a))).status).toBe(404);
        expect((await api().delete(`/api/charging/${id}`).set(as(a))).status).toBe(404);
    });
});

describe('photo uploads', () => {
    const listUploads = () => (fs.existsSync(UPLOADS) ? fs.readdirSync(UPLOADS) : []);
    afterEach(() => {
        for (const f of listUploads()) if (f.startsWith('vehicle-')) fs.unlinkSync(path.join(UPLOADS, f));
    });

    test('extension comes from the image type, never from the file name', async () => {
        const res = await api().post('/api/vehicles').set(as(a))
            .field('name', 'X').attach('photo', PNG, { filename: 'evil.html', contentType: 'image/png' });
        expect(res.status).toBe(201);
        expect(res.body.vehicle.photo_path).toMatch(/^\/uploads\/vehicle-\d+-[0-9a-f]{12}\.png$/);
    });

    test.each([
        ['text/html', 'x.html'],
        ['image/svg+xml', 'x.svg'],
        ['application/octet-stream', 'x.png'],
    ])('%s is rejected with 400', async (type, filename) => {
        const res = await api().post('/api/vehicles').set(as(a))
            .field('name', 'X').attach('photo', Buffer.from('<svg onload=alert(1)>'), { filename, contentType: type });
        expect(res.status).toBe(400);
        expect(listUploads()).toEqual([]);
    });

    test('file over 5 MB is 400', async () => {
        const res = await api().post('/api/vehicles').set(as(a))
            .field('name', 'X').attach('photo', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'big.png', contentType: 'image/png' });
        expect(res.status).toBe(400);
    });

    test('non-admin upload is refused before anything is written', async () => {
        const user = await createUser('carol', { role: 'user', companyId: a.company_id });
        const res = await api().post('/api/vehicles').set(as(user))
            .field('name', 'X').attach('photo', PNG, { filename: 'x.png', contentType: 'image/png' });
        expect(res.status).toBe(403);
        expect(listUploads()).toEqual([]);
    });

    test('invalid name removes the already uploaded photo', async () => {
        const res = await api().post('/api/vehicles').set(as(a))
            .field('name', '   ').attach('photo', PNG, { filename: 'x.png', contentType: 'image/png' });
        expect(res.status).toBe(400);
        expect(listUploads()).toEqual([]);
    });
});
