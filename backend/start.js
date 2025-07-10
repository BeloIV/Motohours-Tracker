const { Pool } = require('pg');
const { initializeDatabase } = require('./database/database.js');

// Function to wait for database to be ready
async function waitForDatabase() {
    const pool = new Pool({
        user: process.env.DB_USER || 'motohours_user',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'motohours_db',
        password: process.env.DB_PASSWORD || 'motohours_password',
        port: process.env.DB_PORT || 5432,
        max: 1,
        connectionTimeoutMillis: 5000,
    });

    let retries = 30; // 30 retries * 2 seconds = 60 seconds max wait
    const retryInterval = 2000; // 2 seconds

    while (retries > 0) {
        try {
            console.log(`🔄 Attempting to connect to database... (${retries} retries left)`);
            await pool.query('SELECT 1');
            console.log('✅ Database connection successful!');
            await pool.end();
            return true;
        } catch (error) {
            console.log(`❌ Database connection failed: ${error.message}`);
            retries--;
            if (retries > 0) {
                console.log(`⏳ Waiting ${retryInterval/1000} seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, retryInterval));
            }
        }
    }

    console.error('❌ Failed to connect to database after all retries');
    await pool.end();
    return false;
}

// Start the application
async function startApp() {
    console.log('🚀 Starting Motohours Tracker Backend...');
    
    // Wait for database to be ready
    const dbReady = await waitForDatabase();
    if (!dbReady) {
        console.error('❌ Cannot start application without database connection');
        process.exit(1);
    }

    // Initialize database tables
    try {
        console.log('🔄 Initializing database tables...');
        await initializeDatabase();
        console.log('✅ Database initialization complete');
    } catch (error) {
        console.error('❌ Failed to initialize database:', error);
        process.exit(1);
    }

    // Import and start the server
    require('./server.js');
}

startApp().catch(error => {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
}); 