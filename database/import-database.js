require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function importDatabase() {
    console.log('========================================');
    console.log(' Elara Database Import Script');
    console.log('========================================\n');

    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true
    };

    console.log(`Database: ${process.env.DB_NAME || 'elara_db'}`);
    console.log(`Host: ${dbConfig.host}`);
    console.log(`Port: ${dbConfig.port}`);
    console.log(`User: ${dbConfig.user}\n`);

    try {
        // Read SQL file
        const sqlFile = path.join(__dirname, 'elara_db_import.sql');
        const sqlContent = fs.readFileSync(sqlFile, 'utf8');

        // Connect to MySQL
        console.log('Connecting to MySQL...');
        const connection = await mysql.createConnection(dbConfig);

        // Execute SQL
        console.log('Importing database...');
        await connection.execute(sqlContent);

        await connection.end();

        console.log('\n✅ Database imported successfully!\n');
        console.log('Default login credentials:');
        console.log('Email: admin@elara.com');
        console.log('Password: Admin123!\n');
        console.log('User account:');
        console.log('Email: user@elara.com');
        console.log('Password: User123!\n');

    } catch (error) {
        console.error('\n❌ Database import failed!');
        console.error('Error:', error.message);
        console.error('\nPlease check your MySQL connection and credentials.\n');
        process.exit(1);
    }
}

importDatabase();