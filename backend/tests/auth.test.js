const jwt = require('jsonwebtoken');
const { api, pool, resetDb, createUser, count, freshIp } = require('./helpers');

beforeEach(resetDb);
afterAll(() => pool.end());

const register = (body, ip = freshIp()) =>
    api().post('/api/auth/register').set('X-Forwarded-For', ip).send(body);
const login = (body, ip = freshIp()) =>
    api().post('/api/auth/login').set('X-Forwarded-For', ip).send(body);

describe('tokens', () => {
    test('token signed with the old default secret is rejected', async () => {
        const user = await createUser('alice');
        const forged = jwt.sign(
            { id: user.id, username: 'alice', role: 'admin', company_id: user.company_id },
            'your-super-secret-jwt-key-change-this-in-production'
        );
        const res = await api().get('/api/auth/me').set('Authorization', `Bearer ${forged}`);
        expect(res.status).toBe(401);
    });

    test('alg "none" token is rejected', async () => {
        const user = await createUser('alice');
        const unsigned = jwt.sign({ id: user.id }, null, { algorithm: 'none' });
        const res = await api().get('/api/vehicles').set('Authorization', `Bearer ${unsigned}`);
        expect(res.status).toBe(401);
    });

    test('token of a deleted user stops working immediately', async () => {
        const user = await createUser('alice');
        await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
        const res = await api().get('/api/vehicles').set('Authorization', `Bearer ${user.token}`);
        expect(res.status).toBe(401);
    });

    test('role comes from the database, not from the token', async () => {
        const user = await createUser('alice', { role: 'admin' });
        await pool.query("UPDATE users SET role = 'user' WHERE id = $1", [user.id]);
        const res = await api().delete('/api/vehicles/1').set('Authorization', `Bearer ${user.token}`);
        expect(res.status).toBe(403);
    });

    test('missing token is 401', async () => {
        expect((await api().get('/api/charging')).status).toBe(401);
        expect((await api().get('/api/vehicles')).status).toBe(401);
    });
});

describe('registration', () => {
    test('creates a company and an admin', async () => {
        const res = await register({ username: 'bob', password: 'Abcdefgh12' });
        expect(res.status).toBe(201);
        expect(res.body.user.role).toBe('admin');
        expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
        const row = await pool.query("SELECT password_hash FROM users WHERE username = 'bob'");
        expect(row.rows[0].password_hash).toMatch(/^\$2[aby]\$/);
    });

    test.each([
        ['empty body', {}],
        ['short password', { username: 'bob', password: 'Abc12' }],
        ['digits only', { username: 'bob', password: '1234567890123' }],
        ['over 72 bytes', { username: 'bob', password: 'ž'.repeat(37) }],
        ['array password', { username: 'bob', password: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] }],
        ['object username', { username: { x: 1 }, password: 'Abcdefgh12' }],
        ['control characters', { username: 'bo\u0000b', password: 'Abcdefgh12' }],
        ['too long username', { username: 'b'.repeat(51), password: 'Abcdefgh12' }],
        ['object invite', { username: 'bob', password: 'Abcdefgh12', invite_token: { $ne: 1 } }],
        ['unknown invite', { username: 'bob', password: 'Abcdefgh12', invite_token: 'nope' }],
    ])('rejects %s with 400 and writes nothing', async (_, body) => {
        const res = await register(body);
        expect(res.status).toBe(400);
        expect(await count('companies')).toBe(0);
        expect(await count('users')).toBe(0);
    });

    test('malformed JSON is 400, not 500', async () => {
        const res = await api().post('/api/auth/register')
            .set('X-Forwarded-For', freshIp())
            .set('Content-Type', 'application/json')
            .send('{bad json');
        expect(res.status).toBe(400);
    });

    test('duplicate username is 400', async () => {
        await createUser('bob');
        const res = await register({ username: 'bob', password: 'Abcdefgh12' });
        expect(res.status).toBe(400);
        expect(await count('companies')).toBe(1);
    });

    test('invite joins the company as user and works only once', async () => {
        const admin = await createUser('alice');
        const inv = await api().post('/api/auth/invite').set('Authorization', `Bearer ${admin.token}`);
        expect(inv.status).toBe(201);

        const first = await register({ username: 'bob', password: 'Abcdefgh12', invite_token: inv.body.token });
        expect(first.status).toBe(201);
        expect(first.body.user.role).toBe('user');
        const bob = await pool.query("SELECT company_id FROM users WHERE username = 'bob'");
        expect(bob.rows[0].company_id).toBe(admin.company_id);

        const second = await register({ username: 'carol', password: 'Abcdefgh12', invite_token: inv.body.token });
        expect(second.status).toBe(400);
    });

    test('concurrent use of one invite creates only one user', async () => {
        const admin = await createUser('alice');
        const inv = await api().post('/api/auth/invite').set('Authorization', `Bearer ${admin.token}`);
        const results = await Promise.all(['u1', 'u2', 'u3'].map(u =>
            register({ username: u, password: 'Abcdefgh12', invite_token: inv.body.token })));
        expect(results.filter(r => r.status === 201)).toHaveLength(1);
        expect(await count('users')).toBe(2);
    });

    test('only admins can create invites', async () => {
        const admin = await createUser('alice');
        const user = await createUser('bob', { role: 'user', companyId: admin.company_id });
        const res = await api().post('/api/auth/invite').set('Authorization', `Bearer ${user.token}`);
        expect(res.status).toBe(403);
    });

    test('11th registration from one IP within an hour is 429', async () => {
        const ip = freshIp();
        for (let i = 0; i < 10; i++) {
            expect((await register({ username: `u${i}`, password: 'Abcdefgh12' }, ip)).status).toBe(201);
        }
        const res = await register({ username: 'u10', password: 'Abcdefgh12' }, ip);
        expect(res.status).toBe(429);
        expect(res.body.error).toBeDefined();
        expect((await register({ username: 'u11', password: 'Abcdefgh12' })).status).toBe(201);
    });
});

describe('login', () => {
    test('valid credentials return a token', async () => {
        await createUser('alice');
        const res = await login({ username: 'alice', password: 'Abcdefgh12' });
        expect(res.status).toBe(200);
        expect(jwt.verify(res.body.token, process.env.JWT_SECRET).username).toBe('alice');
    });

    test.each([
        ['wrong password', { username: 'alice', password: 'wrongwrong' }, 401],
        ['unknown user', { username: 'nobody', password: 'Abcdefgh12' }, 401],
        ['object password', { username: 'alice', password: { length: 10 } }, 400],
        ['array username', { username: ['alice'], password: 'Abcdefgh12' }, 400],
        ['over 72 bytes', { username: 'alice', password: 'Abcdefgh12' + 'x'.repeat(70) }, 401],
    ])('%s → %i', async (_, body, status) => {
        await createUser('alice');
        expect((await login(body)).status).toBe(status);
    });

    test('bcrypt 72-byte truncation cannot be used to log in with a longer string', async () => {
        const base = 'A1' + 'x'.repeat(70);          // exactly 72 bytes
        await createUser('alice', { password: base });
        expect((await login({ username: 'alice', password: base })).status).toBe(200);
        expect((await login({ username: 'alice', password: base + 'anything' })).status).toBe(401);
    });

    test('brute force from one IP is 429 while another IP still gets 401', async () => {
        await createUser('alice');
        const ip = freshIp();
        const codes = [];
        for (let i = 0; i < 11; i++) {
            codes.push((await login({ username: 'alice', password: 'wrongwrong' }, ip)).status);
        }
        expect(codes.slice(0, 10)).toEqual(Array(10).fill(401));
        expect(codes[10]).toBe(429);
        expect((await login({ username: 'alice', password: 'wrongwrong' })).status).toBe(401);
    });

    test('successful logins do not count towards the limit', async () => {
        await createUser('alice');
        const ip = freshIp();
        for (let i = 0; i < 15; i++) {
            expect((await login({ username: 'alice', password: 'Abcdefgh12' }, ip)).status).toBe(200);
        }
    });
});
