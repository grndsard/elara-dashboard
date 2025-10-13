require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || ''
};

async function createDatabase() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    await connection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'elara_db'}`);
    console.log('Database created successfully');
  } catch (error) {
    console.error('Error creating database:', error);
  } finally {
    await connection.end();
  }
}

async function runMigrations() {
  const connection = await mysql.createConnection({
    ...dbConfig,
    database: process.env.DB_NAME || 'elara_db'
  });

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

    // Entitas table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS entitas (
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

    // Users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        fullname VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        password VARCHAR(255) NOT NULL,
        department VARCHAR(100),
        division VARCHAR(100),
        role ENUM('admin', 'user') DEFAULT 'user',
        status ENUM('active', 'inactive') DEFAULT 'active',
        profile_photo VARCHAR(255),
        force_password_change BOOLEAN DEFAULT FALSE,
        reset_token VARCHAR(255),
        reset_token_expires DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_status (status),
        INDEX idx_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Dataset records table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS dataset_records (
        id INT PRIMARY KEY AUTO_INCREMENT,
        company_code VARCHAR(50),
        company_display_name VARCHAR(255),
        location_display_name VARCHAR(255),
        location_area_code VARCHAR(50),
        location_parent_code VARCHAR(50),
        label VARCHAR(255),
        partner_display_name VARCHAR(255),
        unit_department_name VARCHAR(255),
        business_display_name VARCHAR(255),
        account_group_name VARCHAR(255),
        account_code VARCHAR(50),
        account_name VARCHAR(255),
        product_display_name VARCHAR(255),
        date DATE,
        debit DECIMAL(15,2) DEFAULT 0,
        credit DECIMAL(15,2) DEFAULT 0,
        balance DECIMAL(15,2) DEFAULT 0,
        journal_type VARCHAR(100),
        journal_entry_number VARCHAR(100),
        invoice_number VARCHAR(100),
        id_project_display_name VARCHAR(255),
        reference VARCHAR(255),
        type_display_name VARCHAR(255),
        month VARCHAR(20),
        company2 VARCHAR(255),
        regional VARCHAR(255),
        ref VARCHAR(255),
        divisi VARCHAR(255),
        grouping_bisnis VARCHAR(255),
        akun_utama VARCHAR(255),
        figure_utama VARCHAR(255),
        akun_group_1 VARCHAR(255),
        akun_group_2_type VARCHAR(255),
        figure_actual VARCHAR(255),
        cek_holding VARCHAR(255),
        dataset_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_company_code (company_code),
        INDEX idx_date (date),
        INDEX idx_debit (debit),
        INDEX idx_credit (credit),
        INDEX idx_dataset_id (dataset_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Datasets table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS datasets (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        uploader_id INT NOT NULL,
        upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        record_count INT DEFAULT 0,
        status ENUM('processing', 'completed', 'failed') DEFAULT 'processing',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_uploader_id (uploader_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Audit trail table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS audit_trail (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT,
        username VARCHAR(255) NOT NULL,
        action VARCHAR(255) NOT NULL,
        table_name VARCHAR(100),
        record_id INT,
        old_values JSON,
        new_values JSON,
        ip_address VARCHAR(45),
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_timestamp (timestamp),
        INDEX idx_action (action)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Add foreign key constraints
    try {
      await connection.execute(`
        ALTER TABLE datasets 
        ADD CONSTRAINT fk_datasets_uploader 
        FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE CASCADE
      `);
    } catch (e) { /* Ignore if exists */ }
    
    try {
      await connection.execute(`
        ALTER TABLE dataset_records 
        ADD CONSTRAINT fk_dataset_records_dataset 
        FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
      `);
    } catch (e) { /* Ignore if exists */ }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await connection.end();
  }
}

async function main() {
  await createDatabase();
  await runMigrations();
  process.exit(0);
}

main();