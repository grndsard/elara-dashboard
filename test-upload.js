const fs = require('fs');
const path = require('path');

// Create a simple test CSV file
const testCSV = `Company Code,Company Display Name,Account Group Name,Balance,Debit,Credit,Date
KAM,PT. Kinarya Alihdaya Mandiri,REVENUE,100000,0,100000,2025-01-01
KSL,KOPERASI TELEKOMUNIKASI SELULAR KISEL,REVENUE,200000,0,200000,2025-01-02
KSP,PT. Kinarya Selaras Piranti,REVENUE,150000,0,150000,2025-01-03`;

const testFilePath = path.join(__dirname, 'uploads', 'test-upload.csv');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Write test file
fs.writeFileSync(testFilePath, testCSV);

console.log('✅ Test CSV file created:', testFilePath);
console.log('📄 File size:', fs.statSync(testFilePath).size, 'bytes');
console.log('📋 Content preview:');
console.log(testCSV);
console.log('\n💡 You can now test upload with this file through the web interface');
console.log('🌐 Go to: http://localhost:3000/datasets');
console.log('📤 Upload the file: uploads/test-upload.csv');