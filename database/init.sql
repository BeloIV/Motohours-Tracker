-- Initialize PostgreSQL database for Motohours Tracker

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    company_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create charging sessions table
-- Motohours (odometer) and battery level are captured when charging starts,
-- the battery level again when charging stops. user_id is whoever started the
-- session, stopped_by whoever ended it — they are not always the same person.
CREATE TABLE IF NOT EXISTS charging_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    vehicle_id INTEGER,
    start_time TIMESTAMP NOT NULL,
    stop_time TIMESTAMP,
    duration_minutes INTEGER,
    status VARCHAR(50) DEFAULT 'active',
    motohours DECIMAL(10,2),
    battery_start INTEGER,
    battery_end INTEGER,
    stopped_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Audit trail: one row per corrected field on a charging session
CREATE TABLE IF NOT EXISTS charging_session_changes (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES charging_sessions(id) ON DELETE CASCADE,
    user_id INTEGER,
    field VARCHAR(50) NOT NULL,
    old_value VARCHAR(50),
    new_value VARCHAR(50),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_charging_sessions_user_id ON charging_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_charging_sessions_vehicle_id ON charging_sessions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_charging_sessions_status ON charging_sessions(status);
CREATE INDEX IF NOT EXISTS idx_charging_sessions_created_at ON charging_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_session_changes_session_id ON charging_session_changes(session_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
