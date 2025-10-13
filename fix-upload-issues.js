const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function diagnoseAndFix() {
    console.log('🔍 === ELARA UPLOAD DIAGNOSTICS ===\n');
    
    try {
        // 1. Check database connection
        console.log('1. Testing database connection...');
        const db = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'elara_db'
        });
        
        const [rows] = await db.execute('SELECT COUNT(*) as count FROM datasets');
        console.log(`✅ Database connected - Found ${rows[0].count} datasets\n`);
        
        // 2. Check table structure
        console.log('2. Checking dataset_records table structure...');
        const [columns] = await db.execute('DESCRIBE dataset_records');
        console.log('✅ Table columns:', columns.map(c => c.Field).join(', '));
        
        // Check for foreign key constraints
        const [constraints] = await db.execute(`
            SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME 
            FROM information_schema.KEY_COLUMN_USAGE 
            WHERE TABLE_NAME = 'dataset_records' AND REFERENCED_TABLE_NAME IS NOT NULL
        `);
        
        if (constraints.length > 0) {
            console.log('⚠️  Foreign key constraints found:');
            constraints.forEach(c => {
                console.log(`   - ${c.COLUMN_NAME} -> ${c.REFERENCED_TABLE_NAME}`);
            });
        }
        console.log('');
        
        // 3. Check failed datasets
        console.log('3. Checking failed datasets...');
        const [failedDatasets] = await db.execute(`
            SELECT id, name, status, filename, upload_time, record_count 
            FROM datasets 
            WHERE status IN ('failed', 'processing') 
            ORDER BY upload_time DESC 
            LIMIT 10
        `);
        
        if (failedDatasets.length > 0) {
            console.log('❌ Failed/stuck datasets:');
            failedDatasets.forEach(d => {
                console.log(`   - ID: ${d.id}, Name: ${d.name}, Status: ${d.status}, File: ${d.filename}`);
            });
            
            // Reset failed datasets
            console.log('\n🔧 Resetting failed datasets to allow retry...');
            await db.execute(`UPDATE datasets SET status = 'pending' WHERE status IN ('failed', 'processing')`);
            console.log('✅ Reset completed');
        } else {
            console.log('✅ No failed datasets found');
        }
        console.log('');
        
        // 4. Check file permissions and uploads directory
        console.log('4. Checking file system...');
        const uploadsDir = path.join(__dirname, 'uploads');
        
        if (!fs.existsSync(uploadsDir)) {
            console.log('🔧 Creating uploads directory...');
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        // Check temp directory
        const tempDir = path.join(uploadsDir, 'temp');
        if (!fs.existsSync(tempDir)) {
            console.log('🔧 Creating temp directory...');
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Check chunks directory
        const chunksDir = path.join(uploadsDir, 'chunks');
        if (!fs.existsSync(chunksDir)) {
            console.log('🔧 Creating chunks directory...');
            fs.mkdirSync(chunksDir, { recursive: true });
        }
        
        console.log('✅ Upload directories ready\n');
        
        // 5. Test CSV file if exists
        const csvFiles = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.csv'));
        if (csvFiles.length > 0) {
            console.log('5. Testing CSV file processing...');
            const csvFile = path.join(uploadsDir, csvFiles[0]);
            const stats = fs.statSync(csvFile);
            console.log(`📄 Found CSV: ${csvFiles[0]} (${(stats.size/1024/1024).toFixed(2)} MB)`);
            
            // Try to read first few lines
            try {
                const content = fs.readFileSync(csvFile, 'utf8');
                const lines = content.split('\n').slice(0, 3);
                console.log('📋 First 3 lines:');
                lines.forEach((line, i) => {
                    console.log(`   ${i + 1}: ${line.substring(0, 100)}${line.length > 100 ? '...' : ''}`);
                });
            } catch (err) {
                console.log('❌ Error reading CSV:', err.message);
            }
        }
        console.log('');
        
        // 6. Check Python service
        console.log('6. Testing Python service...');
        try {
            const response = await fetch('http://localhost:5000/health');
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Python service is running:', data);
            } else {
                console.log('❌ Python service responded with error:', response.status);
            }
        } catch (err) {
            console.log('❌ Python service not accessible:', err.message);
            console.log('💡 Start Python service with: cd python_upload_service && python app.py');
        }
        console.log('');
        
        // 7. Environment check
        console.log('7. Environment configuration...');
        const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];
        const missingVars = requiredEnvVars.filter(v => !process.env[v]);
        
        if (missingVars.length > 0) {
            console.log('❌ Missing environment variables:', missingVars.join(', '));
        } else {
            console.log('✅ All required environment variables present');
        }
        
        console.log(`📊 Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
        console.log(`🐍 Python service: ${process.env.PYTHON_SERVICE_URL || 'http://localhost:5000'}`);
        console.log('');
        
        // 8. Recommendations
        console.log('🎯 === RECOMMENDATIONS ===');
        console.log('1. Ensure Python service is running: cd python_upload_service && python simple_app.py');
        console.log('2. Use smaller CSV files (<50MB) for testing');
        console.log('3. Check that CSV has required columns: Company Code, Account Group Name, Balance');
        console.log('4. Restart Node.js server after fixes');
        console.log('5. Monitor logs in real-time: tail -f logs/error.log');
        
        await db.end();
        
    } catch (error) {
        console.error('❌ Diagnostic error:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run diagnostics
diagnoseAndFix().then(() => {
    console.log('\n✅ Diagnostics completed');
    process.exit(0);
}).catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});