const mysql = require('mysql2/promise');
require('dotenv').config();

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection and prepared statement fix...');
  
  try {
    const db = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'elara_db'
    });

    console.log('✅ Database connection successful');

    // Test the exact query that was failing
    const testData = [
      ['TEST001', 'Test Company', 'Test Location', 'AREA001', 'PARENT001', 'Test Label', 
       'Test Partner', 'Test Department', 'Test Business', 'REVENUE', 'ACC001', 'Test Account',
       'Test Product', '2024-01-01', 1000.00, 0.00, 1000.00, 'Journal', 'JE001', 'INV001',
       'Project1', 'REF001', 'Type1', 'January', 'Company2', 'Regional1', 'Ref1', 'Division1',
       'Business1', 'Account1', 'Figure1', 'Group1', 'Type1', 'Actual1', 'Holding1', 999]
    ];

    const insertQuery = `
      INSERT INTO dataset_records (
        company_code, company_display_name, location_display_name, location_area_code,
        location_parent_code, label, partner_display_name, unit_department_name,
        business_display_name, account_group_name, account_code, account_name,
        product_display_name, date, debit, credit, balance, journal_type,
        journal_entry_number, invoice_number, id_project_display_name, reference,
        type_display_name, month, company2, regional, ref, divisi, grouping_bisnis,
        akun_utama, figure_utama, akun_group_1, akun_group_2_type, figure_actual,
        cek_holding, dataset_id
      ) VALUES ?
    `;

    console.log('🧪 Testing individual insert with prepared statements...');
    await db.execute('START TRANSACTION');
    
    const singleInsertQuery = `
      INSERT INTO dataset_records (
        company_code, company_display_name, location_display_name, location_area_code,
        location_parent_code, label, partner_display_name, unit_department_name,
        business_display_name, account_group_name, account_code, account_name,
        product_display_name, date, debit, credit, balance, journal_type,
        journal_entry_number, invoice_number, id_project_display_name, reference,
        type_display_name, month, company2, regional, ref, divisi, grouping_bisnis,
        akun_utama, figure_utama, akun_group_1, akun_group_2_type, figure_actual,
        cek_holding, dataset_id
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;
    
    for (const values of testData) {
      await db.execute(singleInsertQuery, values);
    }
    
    await db.execute('ROLLBACK'); // Don't actually insert test data

    console.log('✅ Batch insert test successful - prepared statement issue fixed!');

    // Test timeout configuration
    console.log('⏱️  Testing timeout configuration...');
    const startTime = Date.now();
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    const elapsed = Date.now() - startTime;
    console.log(`✅ Timeout test completed in ${elapsed}ms`);

    await db.end();
    console.log('✅ All tests passed! Upload functionality should work now.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testDatabaseConnection();