require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'elara_db'
};

async function updateAuditTable() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    // Check if change_details column exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'audit_trail' AND COLUMN_NAME = 'change_details'
    `, [process.env.DB_NAME || 'elara_db']);

    if (columns.length === 0) {
      // Add change_details column
      await connection.execute(`
        ALTER TABLE audit_trail 
        ADD COLUMN change_details JSON NULL AFTER new_values,
        ADD COLUMN details TEXT NULL AFTER user_agent
      `);
      console.log('Added change_details and details columns to audit_trail table');
    }

    // Add indexes for better performance
    await connection.execute(`
      CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_trail(user_id)
    `);
    
    await connection.execute(`
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_trail(action)
    `);
    
    await connection.execute(`
      CREATE INDEX IF NOT EXISTS idx_audit_table_name ON audit_trail(table_name)
    `);
    
    await connection.execute(`
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_trail(timestamp)
    `);

    console.log('Audit trail table updated successfully');
  } catch (error) {
    console.error('Update audit table error:', error);
  } finally {
    await connection.end();
    process.exit(0);
  }
}

updateAuditTable();