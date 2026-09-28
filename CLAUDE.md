# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Docker (primary workflow)
```bash
docker-compose up -d          # Start all services
docker-compose down           # Stop all services
docker-compose logs -f        # Follow logs
docker-compose logs backend   # Backend logs only
```

### Backend (manual)
```bash
cd backend && npm install
cd backend && npm run dev     # nodemon with hot reload
cd backend && npm start       # production mode
```

### Frontend (manual)
```bash
cd frontend && npm install
cd frontend && npm run dev    # Vite dev server on port 5002
cd frontend && npm run build  # Build to dist/
```

### Adding Users
```bash
# Via Docker (recommended):
./add-user.sh <username> <password>

# Via script directly in container:
docker-compose exec backend node scripts/add-user-with-hash.js <username> <password>
```

## Architecture

This is a full-stack motohours/battery tracker for forklifts with three Docker services:

- **database** (PostgreSQL on host port 5436): Schema initialized from `database/init.sql`
- **backend** (Node.js/Express on host port 3002): REST API at `/api/*`
- **frontend** (React/Vite served as static files on host port 5002)

### Backend (`backend/`)
- `server.js` — Express app: helmet, rate-limiting, CORS, mounts routes at `/api/auth`, `/api/charging`, `/api/vehicles`
- `middleware/auth.js` — JWT verification middleware (`authenticateToken`) and token generation; tokens expire in 24h
- `database/database.js` — PostgreSQL connection pool with helper functions `runQuery`, `getAll`, `getRow`
- `routes/auth.js` — Login, register, `/auth/me`, `/auth/users` (public user list)
- `routes/charging.js` — Charging session start/stop/patch/delete + `/charging/stats` per-vehicle overview. Motohours (odometer) and battery % are recorded when charging starts, battery % again when it stops. One active session per vehicle.
  - `PATCH /charging/:id` corrects `motohours`, `battery_start` and `battery_end` on any session; allowed for the starter, whoever stopped it, or an admin. `battery_end` is rejected while the session is still running. An odometer edit must stay between the neighbouring readings for that vehicle (previous session or `initial_motohours` below, next session above), so the hours-driven deltas can never go negative.
  - `DELETE /charging/:id` works on completed sessions only, and only for the starter (`user_id`), whoever stopped it (`stopped_by`), or an admin.
  - `GET /charging/:id/history` returns the audit trail for one session. Every PATCH writes one `charging_session_changes` row per field that actually changed (an edit that changes nothing writes nothing and answers "Bez zmeny"); the rows cascade away with the session.
- `routes/vehicles.js` — Vehicle CRUD (admin only for create/update/delete), photo upload via multer. `PUT /vehicles/:id` renames, corrects `initial_motohours`, and adds or replaces the photo (the previous file is unlinked).

### Frontend (`frontend/src/`)
- `main.jsx` — Wraps app in `AuthProvider` and `Toaster`
- `contexts/AuthContext.jsx` — Global auth state, axios base URL config (`VITE_API_URL` env var or `/api` proxy in dev), JWT stored in `localStorage`
- `App.jsx` — Routes between Login/Register and Dashboard based on `isAuthenticated`
- `components/Dashboard.jsx` — Main view after login; assembles ChargingControl, ChargingTable, MotohoursStats, VehicleManager, InvitePanel

### API URL Configuration
- **Development**: Vite dev server proxies `/api` to backend (configure in `vite.config.js` if needed)
- **Production/Docker**: Set `VITE_API_URL` build arg; default fallback is `http://192.168.1.250:3002/api`
- CORS origins are hardcoded in `backend/server.js` — update when deploying to a new host

### Database Schema
Tables: `users` (id, username, password_hash, role, company_id), `companies`, `invites`, `vehicles` (id, company_id, name, photo_path, initial_motohours), `charging_sessions` (id, user_id, vehicle_id, start_time, stop_time, duration_minutes, status, motohours DECIMAL, battery_start INT 0-100, battery_end INT 0-100, stopped_by), `charging_session_changes` (id, session_id, user_id, field, old_value, new_value, changed_at). `user_id` is whoever started the session and `stopped_by` whoever ended it — often different people; both are surfaced in the session detail dialog.

There is no separate entries table — motohours and battery levels live on the charging session. Hours driven in a period are derived as the odometer delta **per vehicle** (`charging_sessions.motohours`, falling back to `vehicles.initial_motohours` before the first session). Never sum those deltas across vehicles — a fleet total of odometer hours is meaningless; `/charging/stats` returns one row per vehicle with today / this week / this month.

### Authentication Flow
All `/api/charging` and `/api/vehicles` routes require `Authorization: Bearer <token>`. The frontend `AuthContext` attaches the token via axios request interceptor and clears it on 401/403 responses.

### UI Notes
- UI text is in Slovak (e.g., error messages, button labels)
- Design system documented in `frontend/DESIGN_SYSTEM.md`
- Own sessions are marked with an orange edge in the charging log; clicking a row opens the session detail (who started, who stopped, duration, odometer, battery)
