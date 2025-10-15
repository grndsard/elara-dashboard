require('dotenv').config();
const mysql = require('mysql2/promise');

async function fixAuditTable() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'elara_db'
        });
        
        // Add missing column
        await connection.execute(`
            ALTER TABLE audit_trail 
            ADD COLUMN IF NOT EXISTS change_details TEXT AFTER new_values
        `);
        
        console.log('✅ Audit table fixed successfully!');
        await connection.end();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

fixAuditTable();