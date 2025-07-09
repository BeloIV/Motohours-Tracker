# Setup Guide - PostgreSQL Migration

This guide will help you set up the Motohours Tracker application with PostgreSQL database.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 16+ (for local development)
- PostgreSQL 15+ (for local development without Docker)

## Quick Start with Docker

1. **Clone and navigate to the project**:
   ```bash
   cd forklit-battery-checker
   ```

2. **Start all services**:
   ```bash
   docker-compose up -d
   ```

3. **Create initial users** (optional):
   ```bash
   # Connect to the database container
   docker exec -it motohours-postgres psql -U motohours_user -d motohours_db
   
   # Or use the script (if running locally)
   cd backend
   node scripts/create-user.js admin password123
   ```

4. **Access the application**:
   - Frontend: http://localhost:5000
   - Backend API: http://localhost:3000
   - Database: localhost:5432

## Local Development Setup

### 1. Database Setup

#### Option A: Local PostgreSQL
1. Install PostgreSQL 15
2. Create database and user:
   ```sql
   CREATE DATABASE motohours_db;
   CREATE USER motohours_user WITH PASSWORD 'motohours_password';
   GRANT ALL PRIVILEGES ON DATABASE motohours_db TO motohours_user;
   ```
3. Run the initialization script:
   ```bash
   psql -U motohours_user -d motohours_db -f database/init.sql
   ```

#### Option B: Docker Database Only
```bash
docker-compose up -d database
```

### 2. Backend Setup

1. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp env.example .env
   # Edit .env with your database settings
   ```

3. **Start the backend**:
   ```bash
   npm run dev
   ```

### 3. Frontend Setup

1. **Install dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Start the frontend**:
   ```bash
   npm run dev
   ```

## Creating Users

### Using the Script
```bash
cd backend
node scripts/create-user.js <username> <password>
```

### Using PostgreSQL Directly
```bash
# Connect to database
psql -U motohours_user -d motohours_db

# Create user (password will be hashed)
INSERT INTO users (username, password_hash) 
VALUES ('admin', '$2a$10$...'); -- Use bcrypt hash
```

### Using Docker
```bash
# Connect to database container
docker exec -it motohours-postgres psql -U motohours_user -d motohours_db

# Create user
INSERT INTO users (username, password_hash) 
VALUES ('admin', '$2a$10$...'); -- Use bcrypt hash
```

## Database Schema

The application uses three main tables:

### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Entries Table
```sql
CREATE TABLE entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    motohours DECIMAL(10,2) NOT NULL,
    battery_capacity INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

### Charging Sessions Table
```sql
CREATE TABLE charging_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    start_time TIMESTAMP NOT NULL,
    stop_time TIMESTAMP,
    duration_minutes INTEGER,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

## Environment Variables

### Backend (.env)
```env
NODE_ENV=development
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
FRONTEND_URL=http://localhost:5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=motohours_db
DB_USER=motohours_user
DB_PASSWORD=motohours_password
```

### Docker Compose
The Docker Compose file automatically sets these environment variables for the database service.

## Troubleshooting

### Database Connection Issues
1. Check if PostgreSQL is running
2. Verify connection credentials in `.env`
3. Ensure database and user exist
4. Check firewall settings

### Docker Issues
1. Check if Docker containers are running: `docker ps`
2. View logs: `docker-compose logs`
3. Restart services: `docker-compose restart`

### Permission Issues
1. Ensure database user has proper permissions
2. Check file permissions for `.env` file
3. Verify Docker volume permissions

## Migration from SQLite

If you're migrating from the old SQLite version:

1. Export data from SQLite (if needed)
2. Set up PostgreSQL as described above
3. Import data using the provided scripts or manual SQL
4. Update application configuration
5. Test all functionality

## Security Notes

- Change default passwords in production
- Use strong JWT secrets
- Configure proper CORS origins
- Set up SSL/TLS in production
- Regular database backups
- Monitor database logs

## Production Deployment

1. Use environment-specific configurations
2. Set up proper logging
3. Configure monitoring
4. Set up automated backups
5. Use production-grade PostgreSQL settings
6. Configure proper firewall rules 