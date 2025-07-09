# PostgreSQL Database Setup

This directory contains the PostgreSQL database configuration for the Motohours Tracker application.

## Files

- `Dockerfile` - Docker configuration for PostgreSQL 15
- `init.sql` - Database initialization script with schema and indexes

## Database Schema

### Tables

1. **users** - User accounts
   - `id` (SERIAL PRIMARY KEY)
   - `username` (VARCHAR(255) UNIQUE)
   - `password_hash` (VARCHAR(255))
   - `created_at` (TIMESTAMP)

2. **entries** - Motohours and battery capacity entries
   - `id` (SERIAL PRIMARY KEY)
   - `user_id` (INTEGER, FOREIGN KEY)
   - `motohours` (DECIMAL(10,2))
   - `battery_capacity` (INTEGER)
   - `created_at` (TIMESTAMP)

3. **charging_sessions** - Battery charging sessions
   - `id` (SERIAL PRIMARY KEY)
   - `user_id` (INTEGER, FOREIGN KEY)
   - `start_time` (TIMESTAMP)
   - `stop_time` (TIMESTAMP)
   - `duration_minutes` (INTEGER)
   - `status` (VARCHAR(50))
   - `created_at` (TIMESTAMP)

## Environment Variables

The database uses the following environment variables:

- `POSTGRES_DB` - Database name (default: motohours_db)
- `POSTGRES_USER` - Database user (default: motohours_user)
- `POSTGRES_PASSWORD` - Database password (default: motohours_password)

## Running with Docker

The database is configured to run as part of the Docker Compose setup. The data is persisted in a Docker volume named `postgres_data`.

## Manual Setup

If you want to run PostgreSQL manually:

1. Install PostgreSQL 15
2. Create a database named `motohours_db`
3. Create a user `motohours_user` with password `motohours_password`
4. Run the `init.sql` script to create the schema 