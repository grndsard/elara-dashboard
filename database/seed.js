require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/database');

async function seedData() {
  try {
    // Insert default departments
    const departments = ['IT', 'Finance', 'HR', 'Operations', 'Marketing', 'Sales'];
    for (const dept of departments) {
      await db.execute(`
        INSERT IGNORE INTO departments (name, status) VALUES (?, 'active')
      `, [dept]);
    }

    // Insert default divisions
    const divisions = ['Technology', 'Accounting', 'Human Resources', 'Business Operations', 'Digital Marketing', 'Business Development'];
    for (const div of divisions) {
      await db.execute(`
        INSERT IGNORE INTO divisions (name, status) VALUES (?, 'active')
      `, [div]);
    }

    // Insert default entitas
    const entitas = [
      { entity_name: 'Elara Corporation', aka: 'Elara Corp' },
      { entity_name: 'Elara Subsidiary Ltd', aka: 'Elara Sub' },
      { entity_name: 'Elara Holdings', aka: 'Elara Hold' }
    ];
    for (const entity of entitas) {
      await db.execute(`
        INSERT IGNORE INTO entitas (entity_name, aka, status) VALUES (?, ?, 'active')
      `, [entity.entity_name, entity.aka]);
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash('Admin123!', parseInt(process.env.BCRYPT_ROUNDS) || 12);
    
    await db.execute(`
      INSERT IGNORE INTO users (fullname, email, password, department, division, role, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      'System Administrator',
      'admin@elara.com',
      hashedPassword,
      'IT',
      'Technology',
      'admin',
      'active'
    ]);

    // Sample dataset records for testing
    const sampleRecords = [
      {
        company_code: 'COMP001',
        company_display_name: 'Elara Corp',
        date: '2024-01-15',
        debit: 0,
        credit: 150000,
        account_name: 'Revenue',
        month: 'January'
      },
      {
        company_code: 'COMP001',
        company_display_name: 'Elara Corp',
        date: '2024-01-15',
        debit: 75000,
        credit: 0,
        account_name: 'COGS',
        month: 'January'
      },
      {
        company_code: 'COMP002',
        company_display_name: 'Elara Subsidiary',
        date: '2024-01-20',
        debit: 0,
        credit: 200000,
        account_name: 'Revenue',
        month: 'January'
      },
      {
        company_code: 'COMP002',
        company_display_name: 'Elara Subsidiary',
        date: '2024-01-20',
        debit: 120000,
        credit: 0,
        account_name: 'COGS',
        month: 'January'
      }
    ];

    for (const record of sampleRecords) {
      await db.execute(`
        INSERT INTO dataset_records (
          company_code, company_display_name, date, debit, credit, account_name, month
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        record.company_code,
        record.company_display_name,
        record.date,
        record.debit,
        record.credit,
        record.account_name,
        record.month
      ]);
    }

    console.log('Seed data inserted successfully');
    console.log('Admin credentials: admin@elara.com / Admin123!');
  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    process.exit(0);
  }
}

seedData();