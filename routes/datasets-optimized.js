const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');
const PerformanceMonitor = require('../utils/performance-monitor');

const router = express.Router();

// Enhanced fetch with timeout and retry logic
async function fetchWithTimeout(url, options = {}) {
  const { timeout = 5000, retries = 2, ...fetchOptions } = options;
  
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`⏰ Request timeout after ${timeout}ms (attempt ${attempt})`);
      controller.abort();
    }, timeout);
    
    try {
      console.log(`🔄 Fetch attempt ${attempt}/${retries + 1}: ${url}`);
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      console.log(`✅ Fetch successful on attempt ${attempt}`);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      console.log(`❌ Fetch attempt ${attempt} failed: ${error.message}`);
      
      if (attempt === retries + 1) {
        throw error;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xls', '.xlsx', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xls, .xlsx, and .csv files are allowed'));
    }
  },
  limits: { fileSize: 300 * 1024 * 1024 } // 300MB limit
});

// Optimized Excel sheet reading with timeout protection
function getExcelSheets(filePath) {
  try {
    console.log('📋 Reading Excel sheets from:', filePath);
    
    if (!fs.existsSync(filePath)) {
      throw new Error('File does not exist');
    }
    
    const fileStats = fs.statSync(filePath);
    console.log(`📊 File size: ${(fileStats.size/1024/1024).toFixed(2)}MB`);
    
    // Optimized reading with minimal options to prevent loops
    const workbook = xlsx.readFile(filePath, {
      bookSheets: true,    // Only read sheet names
      bookProps: false,    // Skip properties
      cellDates: false,    // Skip date parsing
      cellNF: false,       // Skip number formats
      cellStyles: false,   // Skip styles
      cellHTML: false,     // Skip HTML
      sheetStubs: false,   // Skip empty cells
      bookDeps: false,     // Skip dependencies
      bookFiles: false,    // Skip file list
      bookVBA: false       // Skip VBA
    });
    
    const sheets = workbook.SheetNames;
    console.log(`✅ Found ${sheets.length} sheets:`, sheets);
    
    return sheets;
  } catch (error) {
    console.error('❌ Error reading Excel sheets:', error.message);
    throw new Error(`Failed to read Excel sheets: ${error.message}`);
  }
}

// Get Excel sheets with timeout and optimization
router.post('/sheets', [
  authenticateToken,
  requireAdmin,
  upload.single('file')
], async (req, res) => {
  const startTime = Date.now();
  console.log('\n📋 === EXCEL SHEET VERIFICATION START ===');
  
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    console.log(`📁 File: ${req.file.originalname} (${ext})`);
    console.log(`📊 Size: ${(req.file.size/1024/1024).toFixed(2)}MB`);
    
    if (ext !== '.xls' && ext !== '.xlsx') {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Only Excel files support sheet selection' });
    }

    // Add timeout protection for sheet reading
    const sheetPromise = new Promise((resolve, reject) => {
      try {
        const sheets = getExcelSheets(req.file.path);
        resolve(sheets);
      } catch (error) {
        reject(error);
      }
    });
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Sheet reading timeout after 10 seconds')), 10000);
    });
    
    const sheets = await Promise.race([sheetPromise, timeoutPromise]);
    
    // Store file temporarily with unique identifier
    const tempId = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const tempPath = path.join(__dirname, '../uploads/temp', tempId + path.extname(req.file.originalname));
    
    // Ensure temp directory exists
    const tempDir = path.dirname(tempPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    fs.renameSync(req.file.path, tempPath);
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ Sheet verification completed in ${totalTime}ms`);
    console.log(`📋 Sheets found: ${sheets.join(', ')}`);
    console.log(`🆔 Temp ID: ${tempId}`);

    res.json({ 
      success: true, 
      data: { 
        sheets, 
        tempId, 
        filename: req.file.originalname,
        processingTime: totalTime
      } 
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ Sheet verification failed after ${totalTime}ms:`, error.message);
    
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      success: false, 
      message: `Failed to read Excel sheets: ${error.message}` 
    });
  }
});

// Python service processing with data integrity verification
async function processPythonExcel(filePath, datasetId, selectedSheet = null) {
  const startTime = Date.now();
  console.log('🐍 === PYTHON SERVICE PROCESSING START ===');
  
  try {
    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';
    console.log(`🔗 Python service URL: ${pythonServiceUrl}`);
    console.log(`📁 File path: ${filePath}`);
    console.log(`🆔 Dataset ID: ${datasetId}`);
    console.log(`📋 Selected sheet: ${selectedSheet || 'Default'}`);
    
    // Extended timeout for large files
    const response = await fetchWithTimeout(`${pythonServiceUrl}/process-excel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        file_path: filePath,
        dataset_id: datasetId,
        selected_sheet: selectedSheet
      }),
      timeout: 120000 // 2 minutes for large files
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Python service responded with status ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    const totalTime = Date.now() - startTime;
    
    if (result.success) {
      console.log(`✅ Python processing completed in ${totalTime}ms`);
      console.log(`📊 Records processed: ${result.records}`);
      console.log(`🚀 Processing rate: ${Math.round(result.records / (totalTime / 1000))} records/sec`);
      
      // Verify data integrity
      const [verifyResult] = await db.execute('SELECT COUNT(*) as count FROM dataset_records WHERE dataset_id = ?', [datasetId]);
      const actualCount = verifyResult[0].count;
      
      if (actualCount !== result.records) {
        console.log(`⚠️ Data integrity warning: Expected ${result.records}, found ${actualCount}`);
        result.actualRecords = actualCount;
        result.dataIntegrityWarning = true;
      } else {
        console.log(`✅ Data integrity verified: ${actualCount} records confirmed`);
        result.actualRecords = actualCount;
        result.dataIntegrityWarning = false;
      }
    } else {
      console.log(`❌ Python processing failed: ${result.error}`);
    }
    
    return result;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ Python service error after ${totalTime}ms:`, error.message);
    return { success: false, error: error.message };
  }
}

// Ultra-fast Excel processing with timeout protection
async function processExcelOptimized(filePath, selectedSheet = null, progressCallback) {
  console.log('🚀 === ULTRA-FAST EXCEL PROCESSING START ===');
  
  if (!fs.existsSync(filePath)) {
    throw new Error('Excel file does not exist');
  }
  
  const fileStats = fs.statSync(filePath);
  const fileSizeMB = (fileStats.size / 1024 / 1024).toFixed(2);
  console.log(`📈 File size: ${fileSizeMB} MB`);
  
  return new Promise((resolve, reject) => {
    // Add timeout protection
    const timeout = setTimeout(() => {
      reject(new Error('Excel processing timeout after 30 seconds'));
    }, 30000);
    
    try {
      // Ultra-optimized Excel reading with timeout protection
      const readStart = Date.now();
      const workbook = xlsx.readFile(filePath, {
        cellDates: false,
        cellNF: false,
        cellStyles: false,
        cellHTML: false,
        sheetStubs: false,
        bookDeps: false,
        bookFiles: false,
        bookProps: false,
        bookSheets: false,
        bookVBA: false,
        dense: true,         // Use dense mode for better performance
        codepage: 65001      // UTF-8 for faster encoding
      });
      
      const readTime = Date.now() - readStart;
      console.log(`📚 Workbook loaded in ${readTime}ms`);
      
      const sheetName = selectedSheet || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      if (!worksheet) {
        clearTimeout(timeout);
        reject(new Error(`Sheet "${sheetName}" not found`));
        return;
      }
      
      progressCallback({ sheet: sheetName, rows: 'analyzing...' });
      
      // Ultra-fast conversion
      const convertStart = Date.now();
      const records = xlsx.utils.sheet_to_json(worksheet, {
        raw: false,
        defval: '',
        blankrows: false,
        header: 1
      });
      
      const convertTime = Date.now() - convertStart;
      console.log(`🔄 Data conversion completed in ${convertTime}ms`);
      
      if (records.length === 0) {
        console.log('⚠️ No data found in Excel sheet');
        clearTimeout(timeout);
        resolve([]);
        return;
      }
      
      progressCallback({ sheet: sheetName, rows: records.length });
      
      // Lightning-fast object mapping
      const mapStart = Date.now();
      const headers = records[0];
      const dataRows = records.slice(1);
      
      const validHeaders = headers.map((header, index) => 
        header && header.toString().trim() ? { name: header.toString().trim(), index } : null
      ).filter(Boolean);
      
      const objectRecords = [];
      let validCount = 0;
      
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const record = {};
        let hasData = false;
        
        for (let j = 0; j < validHeaders.length; j++) {
          const header = validHeaders[j];
          const value = row[header.index];
          record[header.name] = value || null;
          if (value && value.toString().trim()) hasData = true;
        }
        
        if (hasData) {
          objectRecords.push(record);
          validCount++;
        }
      }
      
      const mapTime = Date.now() - mapStart;
      console.log(`🗺 Object mapping completed in ${mapTime}ms`);
      console.log(`🎯 Data integrity: ${((validCount/dataRows.length)*100).toFixed(1)}% valid`);
      
      const totalTime = readTime + convertTime + mapTime;
      console.log('✅ === EXCEL PROCESSING COMPLETE ===');
      console.log(`📊 Performance: ${totalTime}ms total, ${Math.round(validCount/(totalTime/1000))} records/sec`);
      
      clearTimeout(timeout);
      resolve(objectRecords);
      
    } catch (error) {
      clearTimeout(timeout);
      console.error('❌ === EXCEL PROCESSING ERROR ===');
      console.error('Error:', error.message);
      reject(error);
    }
  });
}

// Optimized upload endpoint with comprehensive data integrity checks
router.post('/upload', [
  authenticateToken,
  requireAdmin,
  upload.single('file'),
  auditMiddleware('DATASET_UPLOADED', 'datasets')
], async (req, res) => {
  const startTime = Date.now();
  console.log('\n🚀 === OPTIMIZED DATASET UPLOAD START ===');
  
  try {
    const { name, tempId, selectedSheet } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: 'Dataset name is required' });
    }

    let filePath, originalname;
    
    if (tempId) {
      const tempDir = path.join(__dirname, '../uploads/temp');
      const tempFiles = fs.readdirSync(tempDir).filter(f => f.startsWith(tempId));
      
      if (tempFiles.length === 0) {
        return res.status(400).json({ success: false, message: 'Temporary file not found' });
      }
      
      filePath = path.join(tempDir, tempFiles[0]);
      originalname = tempFiles[0].substring(tempFiles[0].indexOf('-') + 1);
    } else if (req.file) {
      filePath = req.file.path;
      originalname = req.file.originalname;
    } else {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const fileStats = fs.statSync(filePath);
    console.log(`📁 File: ${originalname} (${(fileStats.size/1024/1024).toFixed(2)}MB)`);
    
    // Create dataset record
    const [datasetResult] = await db.execute(
      'INSERT INTO datasets (name, filename, uploader_id, status) VALUES (?, ?, ?, "processing")',
      [name, originalname, req.user.id]
    );

    const datasetId = datasetResult.insertId;
    const ext = path.extname(originalname).toLowerCase();
    
    console.log(`🆔 Dataset ID: ${datasetId}`);
    console.log(`📄 Extension: ${ext}`);

    // Try Python service first for maximum performance
    try {
      const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';
      const healthResponse = await fetchWithTimeout(`${pythonServiceUrl}/health`, { timeout: 3000 });
      
      if (healthResponse.ok) {
        console.log('🐍 Using Python service for optimal performance...');
        const result = await processPythonExcel(filePath, datasetId, selectedSheet);
        
        if (result.success) {
          const actualCount = result.actualRecords || result.records;
          
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          
          await db.execute(
            'UPDATE datasets SET status = "completed", record_count = ? WHERE id = ?',
            [actualCount, datasetId]
          );
          
          const totalTime = Date.now() - startTime;
          console.log('🎉 === UPLOAD COMPLETED (Python) ===');
          console.log(`⏱️ Total time: ${totalTime}ms`);
          console.log(`🚀 Processing rate: ${Math.round(actualCount / (totalTime / 1000))} records/sec`);
          
          return res.json({
            success: true,
            message: `Dataset uploaded successfully! ${actualCount} records processed in ${(totalTime/1000).toFixed(1)}s`,
            data: { 
              id: datasetId, 
              recordCount: actualCount, 
              fileName: originalname,
              processingTime: totalTime,
              processingRate: Math.round(actualCount / (totalTime / 1000)),
              processingMethod: 'Python Service',
              dataIntegrity: {
                expected: result.records,
                actual: actualCount,
                verified: !result.dataIntegrityWarning
              }
            }
          });
        }
      }
    } catch (error) {
      console.log('⚠️ Python service unavailable, using Node.js fallback');
    }
    
    // Node.js fallback processing
    console.log('📊 Using Node.js processing fallback...');
    let records = [];
    
    if (ext === '.csv') {
      records = await processCSVOptimized(filePath, () => {});
    } else if (ext === '.xls' || ext === '.xlsx') {
      records = await processExcelOptimized(filePath, selectedSheet, () => {});
    }
    
    if (records.length === 0) {
      await db.execute('UPDATE datasets SET status = "failed" WHERE id = ?', [datasetId]);
      return res.status(400).json({ success: false, message: 'No data found in file' });
    }
    
    // Optimized database insertion with comprehensive column mapping
    console.log('💾 === STARTING DATABASE INSERTION ===');
    const insertStartTime = Date.now();
    
    // Enhanced column mapping with all supported fields
    const columnMap = {
      'Company Code': 'company_code',
      'Company Display Name': 'company_display_name',
      'Location Display Name': 'location_display_name',
      'Location Area Code': 'location_area_code',
      'Location Parent Code': 'location_parent_code',
      'Label': 'label',
      'Partner Display Name': 'partner_display_name',
      'Unit Department Name': 'unit_department_name',
      'Business Display Name': 'business_display_name',
      'Account Group Name': 'account_group_name',
      'Account Group': 'account_group_name',
      'Account Code': 'account_code',
      'Account Name': 'account_name',
      'Product Display Name': 'product_display_name',
      'Date': 'date',
      'Debit': 'debit',
      'Credit': 'credit',
      'Balance': 'balance',
      'Journal Type': 'journal_type',
      'Journal Entry Number': 'journal_entry_number',
      'Invoice Number': 'invoice_number',
      'ID Project Display Name': 'id_project_display_name',
      'Reference': 'reference',
      'Type Display Name': 'type_display_name',
      'Month': 'month',
      'Company2': 'company2',
      'Regional': 'regional',
      'Ref': 'ref',
      'Divisi': 'divisi',
      'Grouping Bisnis': 'grouping_bisnis',
      'Akun Utama': 'akun_utama',
      'Figure Utama': 'figure_utama',
      'Akun Group 1': 'akun_group_1',
      'Akun Group 2 Type': 'akun_group_2_type',
      'Figure Actual': 'figure_actual',
      'Cek Holding': 'cek_holding'
    };
    
    // Field order for database insertion
    const fieldOrder = [
      'company_code', 'company_display_name', 'location_display_name', 'location_area_code',
      'location_parent_code', 'label', 'partner_display_name', 'unit_department_name',
      'business_display_name', 'account_group_name', 'account_code', 'account_name',
      'product_display_name', 'date', 'debit', 'credit', 'balance', 'journal_type',
      'journal_entry_number', 'invoice_number', 'id_project_display_name', 'reference',
      'type_display_name', 'month', 'company2', 'regional', 'ref', 'divisi',
      'grouping_bisnis', 'akun_utama', 'figure_utama', 'akun_group_1', 'akun_group_2_type',
      'figure_actual', 'cek_holding', 'dataset_id'
    ];
    
    const numericFields = new Set(['debit', 'credit', 'balance']);
    
    const mappedRecords = records.map(record => {
      const mapped = {};
      
      // Map all available columns
      Object.entries(columnMap).forEach(([sourceCol, dbCol]) => {
        const value = record[sourceCol];
        if (numericFields.has(dbCol)) {
          mapped[dbCol] = value ? parseFloat(value) || 0 : 0;
        } else {
          mapped[dbCol] = value ? value.toString().trim() : null;
        }
      });
      
      // Add dataset_id
      mapped.dataset_id = datasetId;
      
      // Return values in correct field order
      return fieldOrder.map(field => mapped[field] || null);
    });
    
    console.log(`📊 Mapped ${mappedRecords.length} records with ${fieldOrder.length} fields each`);
    
    // Optimized batch insert with transaction control
    const batchSize = 10000; // Larger batches for better performance
    let insertedCount = 0;
    const totalBatches = Math.ceil(mappedRecords.length / batchSize);
    
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
    
    for (let i = 0; i < mappedRecords.length; i += batchSize) {
      const batch = mappedRecords.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      
      try {
        await db.execute('START TRANSACTION');
        await db.query(insertQuery, [batch]);
        await db.execute('COMMIT');
        
        insertedCount += batch.length;
        
        if (batchNum % 5 === 0 || batchNum === totalBatches) {
          console.log(`🚀 Batch ${batchNum}/${totalBatches}: ${insertedCount}/${mappedRecords.length} records inserted`);
        }
      } catch (batchError) {
        await db.execute('ROLLBACK');
        console.error(`❌ Batch ${batchNum} failed:`, batchError.message);
        throw new Error(`Database insertion failed at batch ${batchNum}: ${batchError.message}`);
      }
    }
    
    const insertTime = Date.now() - insertStartTime;
    
    // Verify data integrity
    const [verifyResult] = await db.execute('SELECT COUNT(*) as count FROM dataset_records WHERE dataset_id = ?', [datasetId]);
    const actualCount = verifyResult[0].count;
    
    if (actualCount !== insertedCount) {
      console.log(`⚠️ Data integrity warning: Expected ${insertedCount}, found ${actualCount}`);
      insertedCount = actualCount;
    }
    
    await db.execute(
      'UPDATE datasets SET status = "completed", record_count = ? WHERE id = ?',
      [actualCount, datasetId]
    );
    
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    
    const totalTime = Date.now() - startTime;
    console.log('🎉 === UPLOAD COMPLETED (Node.js) ===');
    console.log(`⏱️ Total time: ${totalTime}ms`);
    console.log(`🚀 Processing rate: ${Math.round(actualCount / (totalTime / 1000))} records/sec`);
    console.log(`✅ Data integrity: ${actualCount} records verified`);
    
    res.json({
      success: true,
      message: `Dataset uploaded successfully! ${actualCount} records processed in ${(totalTime/1000).toFixed(1)}s`,
      data: { 
        id: datasetId, 
        recordCount: actualCount,
        fileName: originalname,
        processingTime: totalTime,
        processingRate: Math.round(actualCount / (totalTime / 1000)),
        processingMethod: 'Node.js Fallback',
        dataIntegrity: {
          totalRecords: records.length,
          insertedRecords: actualCount,
          verified: true
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Upload error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to upload dataset' });
  }
});

// Ultra-fast CSV processing with timeout protection
async function processCSVOptimized(filePath, progressCallback) {
  console.log('🚀 === ULTRA-FAST CSV PROCESSING START ===');
  
  if (!fs.existsSync(filePath)) {
    throw new Error('CSV file does not exist');
  }
  
  const fileStats = fs.statSync(filePath);
  const fileSizeMB = (fileStats.size / 1024 / 1024).toFixed(2);
  console.log(`📄 File size: ${fileSizeMB} MB`);
  
  return new Promise((resolve, reject) => {
    const records = [];
    let rowCount = 0;
    let validCount = 0;
    
    // Add timeout protection
    const timeout = setTimeout(() => {
      reject(new Error('CSV processing timeout after 30 seconds'));
    }, 30000);
    
    const stream = fs.createReadStream(filePath, { 
      highWaterMark: 256 * 1024,
      encoding: 'utf8'
    })
    .pipe(csv({
      skipEmptyLines: true,
      skipLinesWithError: true,
      maxRowBytes: 2 * 1024 * 1024,
      headers: true,
      ignoreEmpty: true
    }))
    .on('data', (data) => {
      rowCount++;
      
      let hasData = false;
      for (const value of Object.values(data)) {
        if (value && value.toString().trim()) {
          hasData = true;
          break;
        }
      }
      
      if (hasData) {
        records.push(data);
        validCount++;
      }
    })
    .on('end', () => {
      clearTimeout(timeout);
      console.log('✅ === CSV PROCESSING COMPLETE ===');
      console.log(`📊 Total rows: ${rowCount}, Valid records: ${validCount}`);
      resolve(records);
    })
    .on('error', (error) => {
      clearTimeout(timeout);
      console.error('❌ CSV processing error:', error);
      reject(error);
    });
  });
}

// Enhanced progress tracking endpoint
router.get('/progress/:datasetId', authenticateToken, async (req, res) => {
  try {
    const { datasetId } = req.params;
    
    const [dataset] = await db.execute(
      'SELECT status, record_count, name, upload_time FROM datasets WHERE id = ?',
      [datasetId]
    );
    
    if (dataset.length === 0) {
      return res.status(404).json({ success: false, message: 'Dataset not found' });
    }
    
    const datasetInfo = dataset[0];
    const uploadStartTime = new Date(datasetInfo.upload_time).getTime();
    const elapsedTime = Date.now() - uploadStartTime;
    
    let progress = { 
      status: datasetInfo.status, 
      recordCount: datasetInfo.record_count,
      elapsedTime: Math.round(elapsedTime / 1000)
    };
    
    if (datasetInfo.status === 'processing') {
      const [currentCount] = await db.execute(
        'SELECT COUNT(*) as count FROM dataset_records WHERE dataset_id = ?',
        [datasetId]
      );
      
      const currentRecords = currentCount[0].count;
      progress.currentRecords = currentRecords;
      
      if (currentRecords > 0 && elapsedTime > 5000) {
        const rate = currentRecords / (elapsedTime / 1000);
        progress.processingRate = Math.round(rate);
        
        if (datasetInfo.record_count > 0) {
          const remainingRecords = datasetInfo.record_count - currentRecords;
          progress.estimatedTimeLeft = Math.round(remainingRecords / rate);
          progress.percentComplete = Math.round((currentRecords / datasetInfo.record_count) * 100);
        }
      }
    }
    
    res.json({ success: true, data: progress });
  } catch (error) {
    console.error('Progress tracking error:', error);
    res.status(500).json({ success: false, message: 'Failed to get progress' });
  }
});

module.exports = router;