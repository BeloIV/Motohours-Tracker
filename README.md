# Motohours Tracker

A web application for tracking motohours and battery capacity with user authentication and PostgreSQL database.

## Features

- **Automatic Date/Time Display**: Real-time clock showing current date and time
- **User-Specific Login**: Each user has their own password
- **Shared Data View**: All users can see all entries, but can only manage their own
- **Motohours Tracking**: Input field for motohours with decimal support
- **Battery Capacity**: Input field for battery percentage (0-100%)
- **Data Table**: Displays all entries with date/time, name, motohours, and battery capacity
- **Charging Control**: Start/stop charging buttons with session tracking
- **Charging Sessions Table**: Separate table showing all charging sessions with duration
- **Data Persistence**: All data is stored in PostgreSQL database
- **User Authentication**: Secure login with JWT tokens
- **Responsive Design**: Works on desktop and mobile devices
- **Logout Functionality**: Users can log out and switch accounts
- **Docker Support**: Easy deployment with Docker Compose

## Quick Start

### Using Docker (Recommended)

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd forklit-battery-checker
   ```

2. **Start the application**:
   ```bash
   docker-compose up -d
   ```

3. **Access the application**:
   - Frontend: http://localhost:5000
   - Backend API: http://localhost:3000

### Manual Setup

1. **Install dependencies**:
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd ../frontend
   npm install
   ```

2. **Set up PostgreSQL database**:
   - Install PostgreSQL 15
   - Create database and user (see `database/README.md`)
   - Copy `backend/env.example` to `backend/.env` and configure

3. **Start the services**:
   ```bash
   # Backend
   cd backend
   npm run dev
   
   # Frontend (in another terminal)
   cd frontend
   npm run dev
   ```

## How to Use

1. **Open the Application**: Navigate to http://localhost:5000
2. **Login**: 
   - Enter your username
   - Enter your password
   - Click "Login"
3. **Add Entries**: 
   - Enter motohours (supports decimals)
   - Enter battery capacity percentage
   - Click "Add Entry"
4. **Charging Control**:
   - Click "Start Charging" to begin a charging session
   - Click "Stop Any Charging" to end any active session (any user can stop any session)
   - Only one charging session can be active at a time across all users
5. **View Data**: 
   - All entries are displayed in the first table (your entries are highlighted in green)
   - All charging sessions are displayed in the second table (your sessions are highlighted in green)
6. **Manage Data**: 
   - Delete individual entries using the "Delete" button (only for your own entries)
   - Delete completed charging sessions using the "Delete" button (only for your own sessions)
   - Clear all your entries using the "Clear All Your Entries" button
   - Clear all your charging sessions using the "Clear All Your Charging Sessions" button
7. **Logout**: Click "Logout" to switch users or exit the application

## File Structure

```
forklit-battery-checker/
├── backend/           # Node.js backend API
│   ├── routes/        # API routes
│   ├── middleware/    # Authentication middleware
│   ├── database/      # Database configuration
│   └── server.js      # Express server
├── frontend/          # React frontend
│   ├── src/           # Source code
│   └── public/        # Static files
├── database/          # PostgreSQL setup
│   ├── Dockerfile     # Database container
│   └── init.sql       # Database schema
├── docker-compose.yml # Docker orchestration
└── README.md          # This file
```

## Customization

### Adding Users
Users can be added directly to the PostgreSQL database or through the API. The default users have been removed from the code for security.

### Environment Configuration
Copy `backend/env.example` to `backend/.env` and configure:
- Database connection settings
- JWT secret key
- Server port and environment

### Styling
Modify the frontend CSS files to change colors, fonts, and layout.

## Technical Details

- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL with connection pooling
- **Authentication**: JWT-based authentication
- **Frontend**: React with Vite
- **Containerization**: Docker and Docker Compose
- **Security**: Helmet.js, rate limiting, CORS protection

## Browser Compatibility

Works in all modern browsers:
- Chrome
- Firefox
- Safari
- Edge

## Database Schema

The application uses three main tables:

1. **users** - User accounts with hashed passwords
2. **entries** - Motohours and battery capacity records
3. **charging_sessions** - Battery charging session tracking

See `database/README.md` for detailed schema information.

## Security Features

- **Password Hashing**: All passwords are hashed using bcrypt
- **JWT Authentication**: Secure token-based authentication
- **SQL Injection Protection**: Parameterized queries
- **Rate Limiting**: API request rate limiting
- **CORS Protection**: Cross-origin request protection
- **Helmet.js**: Security headers

## Production Deployment

For production deployment:

1. Change the JWT secret in environment variables
2. Use strong database passwords
3. Configure proper CORS origins
4. Set up SSL/TLS certificates
5. Use environment-specific database configurations 