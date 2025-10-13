require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'elara_db'
};

async function updateTables() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    // Departments table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL UNIQUE,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_name (name),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Divisions table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS divisions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL UNIQUE,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_name (name),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Insert default departments
    const departments = ['IT', 'Finance', 'HR', 'Operations', 'Marketing', 'Sales'];
    for (const dept of departments) {
      await connection.execute(`
        INSERT IGNORE INTO departments (name, status) VALUES (?, 'active')
      `, [dept]);
    }

    // Insert default divisions
    const divisions = ['Technology', 'Accounting', 'Human Resources', 'Business Operations', 'Digital Marketing', 'Business Development'];
    for (const div of divisions) {
      await connection.execute(`
        INSERT IGNORE INTO divisions (name, status) VALUES (?, 'active')
      `, [div]);
    }

    // Entity table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS entity (
        id INT PRIMARY KEY AUTO_INCREMENT,
        entity_name VARCHAR(255) NOT NULL,
        aka VARCHAR(255),
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_entity_name (entity_name),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Insert default entities
    const entities = [
      { entity_name: 'Elara Corporation', aka: 'Elara Corp' },
      { entity_name: 'Elara Subsidiary Ltd', aka: 'Elara Sub' },
      { entity_name: 'Elara Holdings', aka: 'Elara Hold' }
    ];
    for (const entity of entities) {
      await connection.execute(`
        INSERT IGNORE INTO entity (entity_name, aka, status) VALUES (?, ?, 'active')
      `, [entity.entity_name, entity.aka]);
    }

    console.log('Departments, divisions, and entity tables created successfully');
  } catch (error) {
    console.error('Update error:', error);
  } finally {
    await connection.end();
    process.exit(0);
  }
}

updateTables();