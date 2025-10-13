require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'elara_db'
};

async function renameTable() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    // Check if entitas table exists
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'entitas'
    `, [dbConfig.database]);

    if (tables.length > 0) {
      // Rename entitas table to entity
      await connection.execute('RENAME TABLE entitas TO entity');
      console.log('Successfully renamed table "entitas" to "entity"');
    } else {
      console.log('Table "entitas" does not exist, no rename needed');
    }

  } catch (error) {
    console.error('Rename error:', error);
  } finally {
    await connection.end();
    process.exit(0);
  }
}

renameTable();