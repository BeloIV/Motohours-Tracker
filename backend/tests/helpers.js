// Shared setup: runs against the throwaway Postgres started by scripts/test.sh,
// never against a deployment's database.
process.env.JWT_SECRET = process.env.JWT_SECRET || 't'.repeat(64);
process.env.START_SERVER = 'false';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, initializeDatabase } = require('../database/database');
const app = require('../server');

let ipCounter = 0;
// Every call gets its own client IP so per-IP limits don't leak between tests
const freshIp = () => `10.1.${Math.floor(++ipCounter / 250)}.${ipCounter % 250 + 1}`;

async function resetDb() {
    await initializeDatabase();
    await pool.query('TRUNCATE charging_session_changes, charging_sessions, invites, vehicles, users, companies RESTART IDENTITY CASCADE');
}

async function createCompany(name) {
    const r = await pool.query('INSERT INTO companies (name) VALUES ($1) RETURNING id', [name]);
    return r.rows[0].id;
}

async function createUser(username, { role = 'admin', companyId, password = 'Abcdefgh12' } = {}) {
    const company = companyId || await createCompany(`${username}'s Company`);
    const hash = await bcrypt.hash(password, 4);
    const r = await pool.query(
        'INSERT INTO users (username, password_hash, role, company_id) VALUES ($1, $2, $3, $4) RETURNING id, username, role, company_id',
        [username, hash, role, company]
    );
    const user = r.rows[0];
    user.token = jwt.sign({ id: user.id, username, role, company_id: company }, process.env.JWT_SECRET, { expiresIn: '1h' });
    return user;
}

async function createVehicle(companyId, name = 'Vozík') {
    const r = await pool.query(
        'INSERT INTO vehicles (company_id, name, initial_motohours) VALUES ($1, $2, 100) RETURNING *',
        [companyId, name]
    );
    return r.rows[0];
}

async function count(table) {
    const r = await pool.query(`SELECT count(*)::int AS n FROM ${table}`);
    return r.rows[0].n;
}

const api = () => request(app);

module.exports = { api, pool, resetDb, createCompany, createUser, createVehicle, count, freshIp };
