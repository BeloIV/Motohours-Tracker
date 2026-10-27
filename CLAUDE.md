# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Docker (primary workflow)
```bash
bash scripts/set-jwt-secret.sh         # once: writes JWT_SECRET into .env (compose refuses to start without it)
docker compose up -d --build           # production: nginx serves the built SPA on :5002, proxies /api + /uploads
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build   # Vite hot reload on :5002 (LAN only)
docker compose logs -f backend
```
Switching between prod and dev needs `docker compose down` first (no `-v`).

### Tests
```bash
scripts/test.sh                        # jest + supertest in throwaway containers with their own Postgres
scripts/test.sh tests/auth             # one file
```
Never run the tests against the running deployment's database.

### Secrets / DB credentials
- `scripts/set-jwt-secret.sh [--rotate]` — random `JWT_SECRET` in `.env`; `--rotate` logs everybody out.
- `scripts/rotate-db-credentials.sh` — moves the backend to the non-superuser role `motohours_app` (owner of all tables) and rotates both DB passwords into `.env`. Backups (DB dump + `.env`) go to `backups/` (git-ignored).

### Adding Users
```bash
# Via Docker (recommended):
./add-user.sh <username> <password>

# Via script directly in container:
docker-compose exec backend node scripts/add-user-with-hash.js <username> <password>
```

## Architecture

This is a full-stack motohours/battery tracker for forklifts with three Docker services:

- **database** (PostgreSQL, no published port): Schema initialized from `database/init.sql`, migrated on backend start (`initializeDatabase`)
- **backend** (Node.js 22/Express, no published port, runs as uid 1000): REST API at `/api/*`, photos at `/uploads/*`
- **frontend** (nginx serving the Vite build on host port 5002 → public `regulus.bytboyzserver.xyz` via NPM + Cloudflare): proxies `/api` and `/uploads` to the backend, sets CSP/HSTS, rate-limits `/api/auth/login`

### Backend (`backend/`)
- `server.js` — Express app: helmet, global rate limit, `trust proxy` = 1 (nginx overwrites X-Forwarded-For), no CORS (same origin), mounts routes at `/api/auth`, `/api/charging`, `/api/vehicles`
- `start.js` — refuses to start without a ≥32-char non-default `JWT_SECRET` (`config.js`), waits for the DB, runs `initializeDatabase`
- `middleware/rateLimits.js` — login 10 failed/min + 50 failed/h per IP (successful logins don't count), register 10/h, invite lookup 30/min
- `utils/validation.js` — `parseId`, `text`, `passwordProblem` (min 10 chars, not only digits, max 72 bytes); wrong input types → 400, never 500
- `middleware/auth.js` — JWT verification (HS256 only) and token generation; tokens expire in 24h. `req.user` (role, company) is re-read from the DB on every request, so deleting a user or changing a role takes effect immediately
- `database/database.js` — PostgreSQL connection pool with helper functions `runQuery`, `getAll`, `getRow`
- `routes/auth.js` — Login, register, `/auth/me`, invites (`POST /auth/invite`, `GET /auth/invite/:token`)
- `routes/charging.js` — Charging session start/stop/patch/delete + `/charging/stats` per-vehicle overview. Motohours (odometer) and battery % are recorded when charging starts, battery % again when it stops. One active session per vehicle.
  - `PATCH /charging/:id` corrects `motohours`, `battery_start` and `battery_end` on any session; allowed for the starter, whoever stopped it, or an admin. `battery_end` is rejected while the session is still running. An odometer edit must stay between the neighbouring readings for that vehicle (previous session or `initial_motohours` below, next session above), so the hours-driven deltas can never go negative.
  - `DELETE /charging/:id` works on completed sessions only, and only for the starter (`user_id`), whoever stopped it (`stopped_by`), or an admin.
  - `GET /charging/:id/history` returns the audit trail for one session. Every PATCH writes one `charging_session_changes` row per field that actually changed (an edit that changes nothing writes nothing and answers "Bez zmeny"); the rows cascade away with the session.
- `routes/vehicles.js` — Vehicle CRUD (admin only for create/update/delete, checked before the upload is written), photo upload via multer: JPEG/PNG/WebP/GIF only, ≤5 MB, file extension derived from the mimetype (never the client file name). `PUT /vehicles/:id` renames, corrects `initial_motohours`, and adds or replaces the photo (the previous file is unlinked).

### Frontend (`frontend/src/`)
- `main.jsx` — Wraps app in `AuthProvider` and `Toaster`
- `contexts/AuthContext.jsx` — Global auth state, axios base URL config (`VITE_API_URL` env var or `/api` proxy in dev), JWT stored in `localStorage`
- `App.jsx` — Routes between Login/Register and Dashboard based on `isAuthenticated`
- `components/Dashboard.jsx` — Main view after login; assembles ChargingControl, ChargingTable, MotohoursStats, VehicleManager, InvitePanel

### API URL Configuration
- The frontend always calls `/api` relatively (same origin). Production: nginx (`frontend/nginx.conf`) proxies it; dev: the Vite proxy in `vite.config.js`.
- `routes/auth.js` register creates company + user + invite claim in one transaction.

### Database Schema
Tables: `users` (id, username, password_hash, role, company_id), `companies`, `invites`, `vehicles` (id, company_id, name, photo_path, initial_motohours), `charging_sessions` (id, user_id, vehicle_id, start_time, stop_time, duration_minutes, status, motohours DECIMAL, battery_start INT 0-100, battery_end INT 0-100, stopped_by), `charging_session_changes` (id, session_id, user_id, field, old_value, new_value, changed_at). `user_id` is whoever started the session and `stopped_by` whoever ended it — often different people; both are surfaced in the session detail dialog.

There is no separate entries table — motohours and battery levels live on the charging session. Hours driven in a period are derived as the odometer delta **per vehicle** (`charging_sessions.motohours`, falling back to `vehicles.initial_motohours` before the first session). Never sum those deltas across vehicles — a fleet total of odometer hours is meaningless; `/charging/stats` returns one row per vehicle with today / this week / this month.

### Authentication Flow
All `/api/charging` and `/api/vehicles` routes require `Authorization: Bearer <token>`. The frontend `AuthContext` attaches the token via axios request interceptor and logs out only on 401 (403 = not allowed, e.g. not an admin).

### UI Notes
- UI text is in Slovak (e.g., error messages, button labels)
- Design system documented in `frontend/DESIGN_SYSTEM.md`
- Own sessions are marked with an orange edge in the charging log; clicking a row opens the session detail (who started, who stopped, duration, odometer, battery)
