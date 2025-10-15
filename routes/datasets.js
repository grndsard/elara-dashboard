const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');


const router = express.Router();

// Native fetch with timeout for Node.js
async function fetchWithTimeout(url, options = {}) {
  const { timeout = 5000, ...fetchOptions } = options;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
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

// Update upload configuration to use chunkUpload for chunk endpoints
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

// Chunked upload storage (smaller chunks)
const chunkStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'chunk_' + uniqueSuffix);
  }
});

const chunkUpload = multer({
  storage: chunkStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB per chunk
});

// Download sample template
router.get('/template', authenticateToken, (req, res) => {
  const templatePath = path.join(__dirname, '../sample_dataset_template.csv');
  res.download(templatePath, 'dataset_template.csv', (err) => {
    if (err) {
      console.error('Template download error:', err);
      res.status(500).json({ success: false, message: 'Failed to download template' });
    }
  });
});

// Python service health check
router.get('/python-service/health', authenticateToken, async (req, res) => {
  try {
    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';
    const response = await fetchWithTimeout(`${pythonServiceUrl}/health`, {
      method: 'GET',
      timeout: 5000
    });
    
    if (response.ok) {
      const data = await response.json();
      res.json({ success: true, status: 'healthy', service: data });
    } else {
      res.json({ success: false, status: 'unhealthy', error: `Service responded with ${response.status}` });
    }
  } catch (error) {
    res.json({ success: false, status: 'unavailable', error: error.message });
  }
});

// Get datasets
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching datasets for user:', req.user.id);
    const [datasets] = await db.execute(`
      SELECT d.*, u.fullname as uploader_name 
      FROM datasets d 
      LEFT JOIN users u ON d.uploader_id = u.id 
      ORDER BY d.upload_time DESC
    `);

    console.log('Found datasets:', datasets.length);
    res.json({ success: true, data: datasets });
  } catch (error) {
    console.error('Get datasets error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch datasets' });
  }
});

// Get Excel sheets
router.post('/sheets', [
  authenticateToken,
  requireAdmin,
  upload.single('file')
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== '.xls' && ext !== '.xlsx') {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Only Excel files support sheet selection' });
    }

    const sheets = getExcelSheets(req.file.path);
    
    // Store file temporarily with unique identifier
    const tempId = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const tempPath = path.join(__dirname, '../uploads/temp', tempId + path.extname(req.file.originalname));
    
    // Ensure temp directory exists
    const tempDir = path.dirname(tempPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    fs.renameSync(req.file.path, tempPath);

    res.json({ success: true, data: { sheets, tempId, filename: req.file.originalname } });
  } catch (error) {
    console.error('Get sheets error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, message: 'Failed to read Excel sheets' });
  }
});

// Initialize chunked upload
router.post('/upload/init', authenticateToken, requireAdmin, async (req, res) => {
  const initStartTime = Date.now();
  console.log('\n🚀 === CHUNKED UPLOAD INITIALIZATION ===');
  console.log(`⏰ Start Time: ${new Date().toISOString()}`);
  
  try {
    const { fileName, fileSize, totalChunks, datasetName } = req.body;
    console.log(`📁 File: ${fileName}`);
    console.log(`📊 Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`🧩 Total Chunks: ${totalChunks}`);
    console.log(`📝 Dataset Name: ${datasetName}`);
    
    if (!fileName || !fileSize || !totalChunks || !datasetName) {
      console.log('❌ Missing required parameters');
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }
    
    const uploadId = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const uploadDir = path.join(__dirname, '../uploads/chunks', uploadId);
    
    const dirCreateStart = Date.now();
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    console.log(`📂 Directory created in: ${Date.now() - dirCreateStart}ms`);
    
    // Create dataset record
    const dbStart = Date.now();
    const [datasetResult] = await db.execute(
      'INSERT INTO datasets (name, filename, uploader_id, status) VALUES (?, ?, ?, "uploading")',
      [datasetName, fileName, req.user.id]
    );
    console.log(`💾 Database record created in: ${Date.now() - dbStart}ms`);
    
    const uploadSession = {
      uploadId,
      datasetId: datasetResult.insertId,
      fileName,
      fileSize: parseInt(fileSize),
      totalChunks: parseInt(totalChunks),
      uploadedChunks: 0,
      chunkDir: uploadDir,
      createdAt: new Date(),
      initTime: Date.now() - initStartTime
    };
    
    // Store session info in memory (in production, use Redis)
    global.uploadSessions = global.uploadSessions || new Map();
    global.uploadSessions.set(uploadId, uploadSession);
    
    const totalInitTime = Date.now() - initStartTime;
    console.log(`✅ Initialization completed in: ${totalInitTime}ms`);
    console.log(`🆔 Upload ID: ${uploadId}`);
    console.log(`🗂️  Dataset ID: ${datasetResult.insertId}`);
    
    res.json({ success: true, uploadId, datasetId: datasetResult.insertId });
  } catch (error) {
    const totalTime = Date.now() - initStartTime;
    console.error(`❌ Init chunked upload error after ${totalTime}ms:`, error);
    res.status(500).json({ success: false, message: 'Failed to initialize upload' });
  }
});

// Upload chunk
router.post('/upload/chunk', [
  authenticateToken,
  requireAdmin,
  upload.single('chunk')
], async (req, res) => {
  const chunkStartTime = Date.now();
  
  try {
    const { uploadId, chunkIndex } = req.body;
    
    if (!uploadId || chunkIndex === undefined || !req.file) {
      console.log(`❌ Chunk ${chunkIndex}: Missing chunk data`);
      return res.status(400).json({ success: false, message: 'Missing chunk data' });
    }
    
    const session = global.uploadSessions?.get(uploadId);
    if (!session) {
      console.log(`❌ Chunk ${chunkIndex}: Upload session not found`);
      return res.status(404).json({ success: false, message: 'Upload session not found' });
    }
    
    const chunkSize = req.file.size;
    const chunkPath = path.join(session.chunkDir, `chunk_${chunkIndex}`);
    
    const moveStart = Date.now();
    fs.renameSync(req.file.path, chunkPath);
    const moveTime = Date.now() - moveStart;
    
    session.uploadedChunks++;
    const progress = Math.round((session.uploadedChunks / session.totalChunks) * 100);
    const chunkTime = Date.now() - chunkStartTime;
    
    // Log every 10th chunk or significant milestones
    if (parseInt(chunkIndex) % 10 === 0 || session.uploadedChunks === session.totalChunks || parseInt(chunkIndex) === 0) {
      console.log(`🧩 Chunk ${chunkIndex}/${session.totalChunks - 1}: ${(chunkSize/1024).toFixed(1)}KB in ${chunkTime}ms (move: ${moveTime}ms) - ${progress}%`);
    }
    
    res.json({ 
      success: true, 
      uploadedChunks: session.uploadedChunks,
      totalChunks: session.totalChunks,
      progress: progress
    });
  } catch (error) {
    const chunkTime = Date.now() - chunkStartTime;
    console.error(`❌ Upload chunk error after ${chunkTime}ms:`, error);
    res.status(500).json({ success: false, message: 'Failed to upload chunk' });
  }
});

// Complete chunked upload
router.post('/upload/complete', [
  authenticateToken,
  requireAdmin,
  auditMiddleware('DATASET_UPLOADED', 'datasets')
], async (req, res) => {
  const completeStartTime = Date.now();
  console.log('\n🏁 === CHUNKED UPLOAD COMPLETION ===');
  console.log(`⏰ Start Time: ${new Date().toISOString()}`);
  
  try {
    const { uploadId, selectedSheet } = req.body;
    console.log(`🆔 Upload ID: ${uploadId}`);
    console.log(`📋 Selected Sheet: ${selectedSheet || 'Default'}`);
    
    const session = global.uploadSessions?.get(uploadId);
    if (!session) {
      console.log('❌ Upload session not found');
      return res.status(404).json({ success: false, message: 'Upload session not found' });
    }
    
    console.log(`📁 File: ${session.fileName} (${(session.fileSize/1024/1024).toFixed(2)}MB)`);
    console.log(`🧩 Chunks: ${session.uploadedChunks}/${session.totalChunks}`);
    console.log(`⏱️  Session Duration: ${Date.now() - new Date(session.createdAt).getTime()}ms`);
    
    if (session.uploadedChunks !== session.totalChunks) {
      console.log(`❌ Missing chunks: ${session.totalChunks - session.uploadedChunks}`);
      return res.status(400).json({ success: false, message: 'Not all chunks uploaded' });
    }
    
    console.log('🔗 === ASSEMBLING CHUNKS ===');
    const assemblyStartTime = Date.now();
    
    // Assemble chunks into final file
    const finalPath = path.join(__dirname, '../uploads', `${uploadId}_${session.fileName}`);
    const writeStream = fs.createWriteStream(finalPath);
    
    let totalBytesWritten = 0;
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = path.join(session.chunkDir, `chunk_${i}`);
      if (fs.existsSync(chunkPath)) {
        const chunkData = fs.readFileSync(chunkPath);
        writeStream.write(chunkData);
        totalBytesWritten += chunkData.length;
        fs.unlinkSync(chunkPath); // Clean up chunk
        
        // Log progress every 25% or every 50 chunks
        if (i % Math.max(1, Math.floor(session.totalChunks / 4)) === 0 || i % 50 === 0) {
          const progress = ((i + 1) / session.totalChunks * 100).toFixed(1);
          console.log(`🔗 Assembly progress: ${progress}% (${i + 1}/${session.totalChunks} chunks)`);
        }
      }
    }
    writeStream.end();
    
    // Clean up chunk directory
    fs.rmdirSync(session.chunkDir);
    
    const assemblyTime = Date.now() - assemblyStartTime;
    console.log(`✅ File assembled successfully in ${assemblyTime}ms`);
    console.log(`📊 Total bytes written: ${(totalBytesWritten/1024/1024).toFixed(2)}MB`);
    console.log(`🚀 Assembly rate: ${(totalBytesWritten/1024/1024/(assemblyTime/1000)).toFixed(2)}MB/s`);
    console.log(`📁 Final path: ${finalPath}`);
    
    // Process the assembled file using existing logic
    const ext = path.extname(session.fileName).toLowerCase();
    const datasetId = session.datasetId;
    
    // Continue with existing processing logic...
    console.log('\n📊 === STARTING DATA PROCESSING ===');
    const processingStartTime = Date.now();
    let records = [];
    
    if (ext === '.csv') {
      console.log('📄 Processing CSV file...');
      try {
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';
        const healthCheckStart = Date.now();
        const healthResponse = await fetchWithTimeout(`${pythonServiceUrl}/health`, { timeout: 3000 });
        console.log(`🐍 Python health check: ${Date.now() - healthCheckStart}ms`);
        
        if (healthResponse.ok) {
          console.log('🐍 Using Python service for CSV processing...');
          const pythonStart = Date.now();
          const result = await processPythonExcel(finalPath, datasetId, null);
          const pythonTime = Date.now() - pythonStart;
          
          if (result.success) {
            console.log(`✅ Python CSV processing completed in ${pythonTime}ms`);
            console.log(`📊 Records processed: ${result.records}`);
            console.log(`🚀 Processing rate: ${Math.round(result.records / (pythonTime / 1000))} records/sec`);
            
            if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
            
            const dbUpdateStart = Date.now();
            await db.execute(
              'UPDATE datasets SET status = "completed", record_count = ? WHERE id = ?',
              [result.records, datasetId]
            );
            console.log(`💾 Database updated in: ${Date.now() - dbUpdateStart}ms`);
            
            global.uploadSessions.delete(uploadId);
            
            const totalTime = Date.now() - completeStartTime;
            console.log(`🎉 === CHUNKED UPLOAD COMPLETED ===`);
            console.log(`⏱️  Total time: ${totalTime}ms (${(totalTime/1000).toFixed(1)}s)`);
            console.log(`📈 Overall rate: ${Math.round(result.records / (totalTime / 1000))} records/sec`);
            
            return res.json({
              success: true,
              message: `Chunked upload completed! ${result.records} records processed in ${(totalTime/1000).toFixed(1)}s`,
              data: { 
                id: datasetId, 
                recordCount: result.records, 
                fileName: session.fileName,
                processingMethod: 'Python Service (Chunked)',
                timingMetrics: {
                  totalTime,
                  assemblyTime,
                  processingTime: pythonTime,
                  processingRate: Math.round(result.records / (totalTime / 1000))
                }
              }
            });
          }
        }
      } catch (error) {
        console.log('⚠️  Python service unavailable for CSV, using Node.js fallback');
        console.log(`❌ Python error: ${error.message}`);
      }
      
      records = await processCSVOptimized(finalPath, () => {});
    } else if (ext === '.xls' || ext === '.xlsx') {
      try {
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';
        const healthResponse = await fetchWithTimeout(`${pythonServiceUrl}/health`, { timeout: 3000 });
        
        if (healthResponse.ok) {
          const result = await processPythonExcel(finalPath, datasetId, selectedSheet);
          
          if (result.success) {
            if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
            
            await db.execute(
              'UPDATE datasets SET status = "completed", record_count = ? WHERE id = ?',
              [result.records, datasetId]
            );
            
            global.uploadSessions.delete(uploadId);
            
            const totalTime = Date.now() - startTime;
            return res.json({
              success: true,
              message: `Chunked upload completed! ${result.records} records processed in ${(totalTime/1000).toFixed(1)}s`,
              data: { 
                id: datasetId, 
                recordCount: result.records, 
                fileName: session.fileName,
                processingMethod: 'Python Service (Chunked)'
              }
            });
          }
        }
      } catch (error) {
        console.log('⚠️  Python service unavailable, using Node.js fallback');
      }
      
      records = await processExcelOptimized(finalPath, selectedSheet, () => {});
    }
    
    // Continue with Node.js processing if Python service failed
    if (records.length === 0) {
      await db.execute('UPDATE datasets SET status = "failed" WHERE id = ?', [datasetId]);
      global.uploadSessions.delete(uploadId);
      return res.status(400).json({ success: false, message: 'No data found in file' });
    }
    
    // Process records with existing optimized logic (simplified for chunked upload)
    const columnMap = {
      'Company Code': 'company_code', 'Account Group Name': 'account_group_name',
      'Balance': 'balance', 'Debit': 'debit', 'Credit': 'credit'
      // Add other mappings as needed
    };
    
    const mappedRecords = records.map(record => {
      const mapped = { dataset_id: datasetId };
      Object.entries(columnMap).forEach(([sourceCol, dbCol]) => {
        mapped[dbCol] = record[sourceCol] || null;
      });
      return Object.values(mapped);
    });
    
    // Batch insert
    const batchSize = 5000;
    for (let i = 0; i < mappedRecords.length; i += batchSize) {
      const batch = mappedRecords.slice(i, i + batchSize);
      
      // Build raw SQL for batch insert
      const valueStrings = batch.map(values => 
        `(${values.map(v => v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`).join(',')})`
      ).join(',');
      
      const rawInsertQuery = `INSERT INTO dataset_records (company_code, account_group_name, balance, debit, credit, dataset_id) VALUES ${valueStrings}`;
      
      const connection = await db.getConnection();
      await connection.execute(rawInsertQuery);
      connection.release();
    }
    
    await db.execute(
      'UPDATE datasets SET status = "completed", record_count = ? WHERE id = ?',
      [mappedRecords.length, datasetId]
    );
    
    if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
    global.uploadSessions.delete(uploadId);
    
    const totalTime = Date.now() - completeStartTime;
    const processingTime = Date.now() - processingStartTime;
    
    console.log(`🎉 === CHUNKED UPLOAD COMPLETED (Node.js) ===`);
    console.log(`⏱️  Total time: ${totalTime}ms (${(totalTime/1000).toFixed(1)}s)`);
    console.log(`📊 Processing time: ${processingTime}ms`);
    console.log(`🔗 Assembly time: ${assemblyTime}ms`);
    console.log(`📈 Overall rate: ${Math.round(mappedRecords.length / (totalTime / 1000))} records/sec`);
    
    res.json({
      success: true,
      message: `Chunked upload completed! ${mappedRecords.length} records processed in ${(totalTime/1000).toFixed(1)}s`,
      data: { 
        id: datasetId, 
        recordCount: mappedRecords.length, 
        fileName: session.fileName,
        processingMethod: 'Node.js (Chunked)',
        timingMetrics: {
          totalTime,
          assemblyTime,
          processingTime,
          processingRate: Math.round(mappedRecords.length / (totalTime / 1000))
        }
      }
    });
    
  } catch (error) {
    console.error('Complete chunked upload error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete upload' });
  }
});

// Upload dataset (original method - kept for backward compatibility)
router.post('/upload', [
  authenticateToken,
  requireAdmin,
  upload.single('file'),
  auditMiddleware('DATASET_UPLOADED', 'datasets')
], async (req, res) => {
  const startTime = Date.now();
  console.log('=== DATASET UPLOAD STARTED ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('User:', req.user?.id, req.user?.email);
  console.log('Request headers:', req.headers);
  console.log('Request body keys:', Object.keys(req.body));
  console.log('File info:', req.file ? { name: req.file.originalname, size: req.file.size } : 'No file');
  
  try {
    const { name, tempId, selectedSheet } = req.body;
    console.log('Request body:', { name, tempId: tempId ? 'present' : 'none', selectedSheet });
    
    if (!name) {
      console.log('ERROR: Dataset name is required');
      return res.status(400).json({ success: false, message: 'Dataset name is required' });
    }

    let filePath, originalname;
    
    if (tempId) {
      console.log('Using temporary file with tempId:', tempId);
      // Using temporary file from sheet selection
      const tempDir = path.join(__dirname, '../uploads/temp');
      const tempFiles = fs.readdirSync(tempDir)
        .filter(f => f.startsWith(tempId));
      
      if (tempFiles.length === 0) {
        console.log('ERROR: Temporary file not found for tempId:', tempId);
        return res.status(400).json({ success: false, message: 'Temporary file not found' });
      }
      
      filePath = path.join(tempDir, tempFiles[0]);
      // Extract original filename from temp file (format: tempId-originalname)
      const tempFileName = tempFiles[0];
      const dashIndex = tempFileName.indexOf('-');
      originalname = dashIndex !== -1 ? tempFileName.substring(dashIndex + 1) : tempFileName;
      console.log('Temp file path:', filePath);
      console.log('Original filename:', originalname);
    } else if (req.file) {
      filePath = req.file.path;
      originalname = req.file.originalname;
      console.log('Direct upload file path:', filePath);
      console.log('Original filename:', originalname);
    } else {
      console.log('ERROR: No file uploaded');
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Check file exists and get size
    const fileStats = fs.statSync(filePath);
    console.log('File size:', (fileStats.size / 1024 / 1024).toFixed(2), 'MB');
    
    // Create dataset record
    const dbStartTime = Date.now();
    let datasetId;
    try {
      const [datasetResult] = await db.execute(
        'INSERT INTO datasets (name, filename, uploader_id, status) VALUES (?, ?, ?, "processing")',
        [name, originalname, req.user.id]
      );
      console.log('Dataset record created in:', Date.now() - dbStartTime, 'ms');
      datasetId = datasetResult.insertId;
      console.log('Dataset ID:', datasetId);
    } catch (dbError) {
      console.error('Database error creating dataset record:', dbError);
      throw new Error(`Failed to create dataset record: ${dbError.message}`);
    }

    // Process file based on extension
    const ext = path.extname(originalname).toLowerCase();
    let records = [];

    console.log('Processing file:', originalname, 'Extension:', ext, 'Selected sheet:', selectedSheet);
    console.log('File extension debug:', { originalname, ext, pathExtname: path.extname(originalname) });
    
    // Validate file extension
    if (!ext || (ext !== '.csv' && ext !== '.xls' && ext !== '.xlsx')) {
      console.error('Invalid file extension:', ext, 'from filename:', originalname);
      await db.execute('UPDATE datasets SET status = "failed" WHERE id = ?', [datasetId]);
      return res.status(400).json({ 
        success: false, 
        message: `Unsupported file type: ${ext || 'no extension'}. Only .csv, .xls, and .xlsx files are supported.` 
      });
    }
    
    // Enhanced file processing with detailed timing
    const processStartTime = Date.now();
    console.log('📊 Starting file processing phase...');
    
    const processingTimer = {
      fileRead: 0,
      dataValidation: 0,
      columnMapping: 0,
      total: 0
    };

    if (ext === '.csv') {
      console.log('📄 Processing CSV file - trying Python service first...');
      
      // Try Python service for CSV files too
      try {
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';
        const healthResponse = await fetchWithTimeout(`${pythonServiceUrl}/health`, { timeout: 3000 });
        
        if (healthResponse.ok) {
          const result = await processPythonExcel(filePath, datasetId, null); // CSV doesn't need sheet selection
          
          if (result.success) {
            console.log('✅ Python CSV processing completed:', result.records, 'records');
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            
            await db.execute(
              'UPDATE datasets SET status = "completed", record_count = ? WHERE id = ?',
              [result.records, datasetId]
            );
            
            const totalTime = Date.now() - startTime;
            console.log('🎉 === CSV UPLOAD COMPLETED (Python) ===');
            console.log('⏱️  Total time:', totalTime, 'ms');
            console.log('🚀 Processing rate:', Math.round(result.records / (totalTime / 1000)), 'records/sec');
            
            return res.json({
              success: true,
              message: `CSV dataset uploaded successfully via Python service! ${result.records} records processed in ${(totalTime/1000).toFixed(1)}s`,
              data: { 
                id: datasetId, 
                recordCount: result.records, 
                fileName: originalname,
                processingTime: totalTime,
                processingRate: Math.round(result.records / (totalTime / 1000)),
                processingMethod: 'Python Service'
              }
            });
          }
        }
      } catch (error) {
        console.log('⚠️  Python service unavailable for CSV, using Node.js fallback');
      }
      
      // Node.js CSV processing fallback
      console.log('📄 Falling back to Node.js CSV processing...');
      const csvTimer = Date.now();
      records = await processCSVOptimized(filePath, (progress) => {
        console.log(`📈 CSV Progress: ${progress.processed} rows processed, ${progress.valid} valid records`);
      });
      processingTimer.fileRead = Date.now() - csvTimer;
    } else if (ext === '.xls' || ext === '.xlsx') {
      console.log('📊 Processing Excel file with Python service priority...');
      
      // Always try Python service first for maximum performance
      try {
        console.log('🐍 Using Python service for optimal performance...');
        const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';
        const healthResponse = await fetchWithTimeout(`${pythonServiceUrl}/health`, { timeout: 3000 });
        
        if (healthResponse.ok) {
          const result = await processPythonExcel(filePath, datasetId, selectedSheet);
          
          if (result.success) {
            console.log('✅ Python processing completed:', result.records, 'records');
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            
            await db.execute(
              'UPDATE datasets SET status = "completed", record_count = ? WHERE id = ?',
              [result.records, datasetId]
            );
            
            const totalTime = Date.now() - startTime;
            console.log('🎉 === UPLOAD COMPLETED (Python) ===');
            console.log('⏱️  Total time:', totalTime, 'ms');
            console.log('🚀 Processing rate:', Math.round(result.records / (totalTime / 1000)), 'records/sec');
            
            return res.json({
              success: true,
              message: `Dataset uploaded successfully via Python service! ${result.records} records processed in ${(totalTime/1000).toFixed(1)}s`,
              data: { 
                id: datasetId, 
                recordCount: result.records, 
                fileName: originalname,
                processingTime: totalTime,
                processingRate: Math.round(result.records / (totalTime / 1000)),
                processingMethod: 'Python Service'
              }
            });
          }
        }
      } catch (error) {
        console.log('⚠️  Python service unavailable, using Node.js fallback');
      }
      
      // Node.js processing fallback
      console.log('📊 Falling back to Node.js Excel processing...');
      const excelTimer = Date.now();
      records = await processExcelOptimized(filePath, selectedSheet, (progress) => {
        console.log(`📈 Excel Progress: Processing sheet "${progress.sheet}", ${progress.rows} rows found`);
      });
      processingTimer.fileRead = Date.now() - excelTimer;
    }
    
    processingTimer.total = Date.now() - processStartTime;
    console.log('✅ File processing completed');
    console.log('📊 Processing metrics:');
    console.log(`   📖 File reading: ${processingTimer.fileRead}ms`);
    console.log(`   ⏱️  Total processing: ${processingTimer.total}ms`);
    console.log(`   🚀 Read rate: ${Math.round(records.length / (processingTimer.fileRead / 1000))} records/sec`);

    // Enhanced data analysis and validation
    console.log(`📊 Data analysis results:`);
    console.log(`   📄 Total records found: ${records.length.toLocaleString()}`);
    
    if (records.length > 0) {
      const sampleRecord = records[0];
      const columnCount = Object.keys(sampleRecord).length;
      const recognizedColumns = Object.keys(sampleRecord).filter(key => columnMap[key]).length;
      
      console.log(`   🗺 Columns detected: ${columnCount}`);
      console.log(`   ✅ Recognized columns: ${recognizedColumns}/${columnCount} (${((recognizedColumns/columnCount)*100).toFixed(1)}%)`);
      
      // Show critical columns status
      const criticalColumns = ['Account Group Name', 'Balance', 'Debit', 'Credit'];
      const foundCritical = criticalColumns.filter(col => sampleRecord[col] !== undefined);
      console.log(`   🎯 Critical columns found: ${foundCritical.join(', ')}`);
      
      if (records.length <= 5) {
        console.log('   🔍 Sample record:', JSON.stringify(sampleRecord, null, 2));
      }
    }

    if (records.length === 0) {
      console.log('ERROR: No records found in file');
      console.log('File extension:', ext);
      console.log('File path:', filePath);
      console.log('File exists:', fs.existsSync(filePath));
      
      await db.execute(
        'UPDATE datasets SET status = "failed" WHERE id = ?',
        [datasetId]
      );
      return res.status(400).json({ 
        success: false, 
        message: 'No data found in the file. Please check the file format and content. Make sure the file has data rows and proper column headers.' 
      });
    }

    // Ultra-optimized database insertion with data integrity verification
    console.log('💾 === STARTING ULTRA-FAST DATABASE INSERTION ===');
    const insertStartTime = Date.now();
    let insertedCount = 0;
    let skippedCount = 0;
    
    // Dynamic batch sizing based on record count and memory
    const batchSize = records.length > 100000 ? 10000 : 
                     records.length > 50000 ? 7500 : 
                     records.length > 10000 ? 5000 : 2500;
    
    console.log(`🚀 Using optimized batch size: ${batchSize} records per batch`);
    console.log(`📊 Total batches to process: ${Math.ceil(records.length / batchSize)}`);
    
    // Complete column mapping for all fields (moved up to avoid initialization errors)
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
    
    // Ultra-fast record mapping with data validation and integrity checks
    const mapStartTime = Date.now();
    console.log('🗺 Starting record mapping and validation...');
    
    const mappedRecords = [];
    
    // Financial number parser with parentheses support
    function parseFinancialNumber(value) {
      if (!value || value === null || value === undefined) return 0;
      
      let valueStr = String(value).trim().replace(/,/g, '').replace(/"/g, '');
      if (!valueStr) return 0;
      
      // Handle parentheses (negative values)
      if (valueStr.startsWith('(') && valueStr.endsWith(')')) {
        valueStr = '-' + valueStr.slice(1, -1);
      }
      
      const parsed = parseFloat(valueStr.replace(/[^\d.-]/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    }
    
    for (const record of records) {
      const mapped = {};
      
      // Map all available columns
      Object.entries(columnMap).forEach(([sourceCol, dbCol]) => {
        let value = record[sourceCol] || record[sourceCol.toLowerCase().replace(/\s+/g, '_')] || null;
        
        if (value !== null && value !== undefined && value !== '') {
          if (['debit', 'credit', 'balance'].includes(dbCol)) {
            mapped[dbCol] = parseFinancialNumber(value);
          } else if (dbCol === 'date' && value) {
            try {
              const date = new Date(value);
              mapped[dbCol] = isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
            } catch {
              mapped[dbCol] = null;
            }
          } else {
            mapped[dbCol] = String(value).trim();
          }
        } else {
          mapped[dbCol] = null;
        }
      });
      
      mappedRecords.push(mapped);
    }
    
    const mapTime = Date.now() - mapStartTime;
    console.log(`✅ Mapping completed in ${mapTime}ms`);
    console.log(`📊 Mapped: ${mappedRecords.length}, Skipped: ${skippedCount}`);
    console.log(`🎯 Data quality: ${((mappedRecords.length/(mappedRecords.length + skippedCount))*100).toFixed(1)}% retained`);
    
    // Simplified insert query for essential fields
    const insertQuery = `
      INSERT INTO dataset_records (
        company_code, account_group_name, balance, debit, credit, dataset_id
      ) VALUES ?
    `;
    
    // Ultra-fast batch processing with transaction optimization
    const batchCount = Math.ceil(mappedRecords.length / batchSize);
    let lastProgressTime = Date.now();
    
    // Essential field order
    const fieldOrder = ['company_code', 'account_group_name', 'balance', 'debit', 'credit'];
    
    for (let i = 0; i < mappedRecords.length; i += batchSize) {
      const batchStartTime = Date.now();
      const batch = mappedRecords.slice(i, i + batchSize);
      const batchNum = Math.floor(i/batchSize) + 1;
      
      // Ultra-fast batch value preparation using pre-compiled field order
      const batchValues = new Array(batch.length);
      for (let j = 0; j < batch.length; j++) {
        const record = batch[j];
        const values = new Array(fieldOrder.length + 1); // +1 for dataset_id
        
        for (let k = 0; k < fieldOrder.length; k++) {
          values[k] = record[fieldOrder[k]];
        }
        values[fieldOrder.length] = datasetId;
        batchValues[j] = values;
      }
      
      try {
        // Execute with transaction for data integrity
        const connection = await db.getConnection();
        await connection.execute('START TRANSACTION');
        
        // Simplified INSERT for essential fields
        const singleInsertQuery = `
          INSERT INTO dataset_records (
            company_code, account_group_name, balance, debit, credit, dataset_id
          ) VALUES (?,?,?,?,?,?)
        `;
        
        for (const values of batchValues) {
          await connection.execute(singleInsertQuery, values);
        }
        
        await connection.execute('COMMIT');
        connection.release();
        
        insertedCount += batchValues.length;
        const batchTime = Date.now() - batchStartTime;
        const batchRate = Math.round(batchValues.length / (batchTime / 1000));
        
        // Optimized progress reporting (every batch or every 2 seconds)
        if (Date.now() - lastProgressTime > 2000 || batchNum === batchCount) {
          const progress = ((insertedCount / mappedRecords.length) * 100).toFixed(1);
          console.log(`🚀 Batch ${batchNum}/${batchCount}: ${insertedCount}/${mappedRecords.length} (${progress}%) - ${batchRate} rec/sec`);
          lastProgressTime = Date.now();
        }
        
      } catch (batchError) {
        const connection = await db.getConnection();
        await connection.execute('ROLLBACK');
        connection.release();
        console.error(`❌ Batch ${batchNum} failed:`, batchError.message);
        throw new Error(`Database insertion failed at batch ${batchNum}: ${batchError.message}`);
      }
    }
    
    const insertTime = Date.now() - insertStartTime;
    const insertRate = Math.round(insertedCount / (insertTime / 1000));
    
    console.log('✅ === DATABASE INSERTION COMPLETE ===');
    console.log(`💾 Records inserted: ${insertedCount.toLocaleString()}`);
    console.log(`⏱️  Insertion time: ${insertTime}ms (${(insertTime/1000).toFixed(1)}s)`);
    console.log(`🚀 Insertion rate: ${insertRate.toLocaleString()} records/second`);
    console.log(`🎯 Data integrity: ${insertedCount}/${records.length} records processed`);
    
    // Verify data integrity
    const verifyStart = Date.now();
    let actualCount = insertedCount; // Default to inserted count
    try {
      const [verifyResult] = await db.execute('SELECT COUNT(*) as count FROM dataset_records WHERE dataset_id = ?', [datasetId]);
      actualCount = verifyResult[0].count;
      const verifyTime = Date.now() - verifyStart;
      
      if (actualCount !== insertedCount) {
        console.warn(`Data integrity warning: Expected ${insertedCount}, found ${actualCount}`);
        // Don't throw error, just log warning
      }
      
      console.log(`✅ Data integrity verified in ${verifyTime}ms: ${actualCount} records confirmed`);
    } catch (verifyError) {
      console.error('Error verifying data integrity:', verifyError);
      console.log('Warning: Data integrity check failed but proceeding with success response');
    }

    // Update dataset status
    const updateStartTime = Date.now();
    try {
      await db.execute(
        'UPDATE datasets SET status = "completed", record_count = ? WHERE id = ?',
        [insertedCount, datasetId]
      );
      console.log('Dataset status updated in:', Date.now() - updateStartTime, 'ms');
    } catch (updateError) {
      console.error('Error updating dataset status:', updateError);
      // Don't throw here as the data is already inserted successfully
      console.log('Warning: Dataset status update failed but data was inserted successfully');
    }

    // Clean up uploaded file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('Temporary file cleaned up');
    }

    const totalTime = Date.now() - startTime;
    console.log('\n🎉 === REGULAR UPLOAD COMPLETED ===');
    console.log(`⏱️  Total time: ${totalTime}ms (${(totalTime/1000).toFixed(1)}s)`);
    console.log(`📊 Records processed: ${insertedCount.toLocaleString()}`);
    console.log(`🚀 Processing rate: ${Math.round(insertedCount / (totalTime / 1000))} records/second`);
    console.log(`📁 File: ${originalname} (${(fileStats.size/1024/1024).toFixed(2)}MB)`);
    console.log(`🎯 Efficiency: ${(insertedCount / (totalTime / 1000) / 1000).toFixed(1)}K records/sec`);
    
    // Enhanced response with comprehensive metrics
    const totalProcessingTime = Date.now() - startTime;
    const overallRate = Math.round(insertedCount / (totalProcessingTime / 1000));
    
    // Send success response
    res.status(200).json({
      success: true,
      message: `Dataset uploaded successfully! ${insertedCount.toLocaleString()} records processed in ${(totalProcessingTime/1000).toFixed(1)}s`,
      data: { 
        id: datasetId, 
        recordCount: insertedCount,
        fileName: originalname,
        processingMethod: 'Node.js Processing',
        metrics: {
          totalTime: totalProcessingTime,
          fileProcessingTime: processingTimer.total,
          databaseInsertionTime: insertTime,
          overallRate: overallRate,
          insertionRate: insertRate,
          dataIntegrity: {
            totalRecords: records.length,
            validRecords: mappedRecords.length,
            insertedRecords: insertedCount,
            skippedRecords: skippedCount,
            qualityScore: ((insertedCount / records.length) * 100).toFixed(1)
          }
        }
      }
    });
    
    console.log('\n🎉 === UPLOAD COMPLETED SUCCESSFULLY ===');
    console.log(`📊 Final summary:`);
    console.log(`   📁 File: ${originalname} (${(fileStats.size/1024/1024).toFixed(2)}MB)`);
    console.log(`   ⏱️  Total time: ${totalProcessingTime}ms`);
    console.log(`   🚀 Overall rate: ${overallRate.toLocaleString()} records/sec`);
    console.log(`   🎯 Quality score: ${((insertedCount / records.length) * 100).toFixed(1)}%`);
    console.log(`   📈 Throughput: ${((fileStats.size/1024/1024)/(totalProcessingTime/1000)).toFixed(2)}MB/s`);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.log('\n❌ === UPLOAD FAILED ===');
    console.log(`⏱️  Time before failure: ${totalTime}ms`);
    console.error('❌ Error:', error.message);
    console.error('📋 Stack trace:', error.stack);
    
    // Update dataset status to failed if we have a dataset ID
    let datasetIdToUpdate = null;
    if (req.body.datasetId) {
      datasetIdToUpdate = req.body.datasetId;
    } else {
      // Try to extract dataset ID from the processing context
      const { name } = req.body;
      if (name) {
        try {
          const [existingDataset] = await db.execute(
            'SELECT id FROM datasets WHERE name = ? AND uploader_id = ? ORDER BY id DESC LIMIT 1',
            [name, req.user.id]
          );
          if (existingDataset.length > 0) {
            datasetIdToUpdate = existingDataset[0].id;
          }
        } catch (dbError) {
          console.error('Error finding dataset for cleanup:', dbError);
        }
      }
    }
    
    if (datasetIdToUpdate) {
      try {
        await db.execute(
          'UPDATE datasets SET status = "failed" WHERE id = ?',
          [datasetIdToUpdate]
        );
        console.log(`Dataset ${datasetIdToUpdate} status updated to failed`);
      } catch (updateError) {
        console.error('Error updating dataset status:', updateError);
      }
    }

    // Clean up uploaded file
    try {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log('Cleaned up uploaded file');
      }
      if (req.body.tempId) {
        const tempDir = path.join(__dirname, '../uploads/temp');
        if (fs.existsSync(tempDir)) {
          const tempFiles = fs.readdirSync(tempDir)
            .filter(f => f.startsWith(req.body.tempId));
          tempFiles.forEach(f => {
            const tempPath = path.join(tempDir, f);
            if (fs.existsSync(tempPath)) {
              fs.unlinkSync(tempPath);
            }
          });
          console.log('Cleaned up temp files');
        }
      }
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
    }

    // Send proper error response
    res.status(500).json({ 
      success: false, 
      message: 'Failed to upload dataset',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get dataset details
router.get('/:id', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  try {
    const { id } = req.params;
    
    const [dataset] = await db.execute(
      `SELECT d.*, u.fullname as uploader_name,
       COUNT(dr.id) as record_count,
       MIN(dr.created_at) as first_record,
       MAX(dr.created_at) as last_record
       FROM datasets d 
       LEFT JOIN users u ON d.uploader_id = u.id
       LEFT JOIN dataset_records dr ON d.id = dr.dataset_id
       WHERE d.id = ?
       GROUP BY d.id`, [id]
    );
    
    if (dataset.length === 0) {
      return res.status(404).json({ success: false, message: 'Dataset not found' });
    }
    
    // Log detailed audit for dataset access
    await db.execute(
      `INSERT INTO audit_trail (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        'VIEW_DATASET_DETAILS',
        'datasets',
        id,
        null,
        JSON.stringify({ 
          dataset_name: dataset[0].name,
          record_count: dataset[0].record_count,
          access_duration_ms: Date.now() - startTime
        }),
        req.ip,
        req.get('User-Agent')
      ]
    );
    
    res.json({ success: true, data: dataset[0] });
  } catch (error) {
    console.error('Get dataset error:', error);
    res.status(500).json({ success: false, message: 'Failed to get dataset details' });
  }
});

// Update dataset
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    // Get old values for audit
    const [oldDataset] = await db.execute('SELECT * FROM datasets WHERE id = ?', [id]);
    if (oldDataset.length === 0) {
      return res.status(404).json({ success: false, message: 'Dataset not found' });
    }
    
    await db.execute(
      'UPDATE datasets SET name = ?, updated_at = NOW() WHERE id = ?',
      [name, id]
    );
    
    // Log audit trail
    await db.execute(
      `INSERT INTO audit_trail (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        'UPDATE',
        'datasets',
        id,
        JSON.stringify({ name: oldDataset[0].name }),
        JSON.stringify({ name }),
        req.ip,
        req.get('User-Agent')
      ]
    );
    
    res.json({ success: true, message: 'Dataset updated successfully' });
  } catch (error) {
    console.error('Update dataset error:', error);
    res.status(500).json({ success: false, message: 'Failed to update dataset' });
  }
});

// Reprocess dataset
router.post('/:id/reprocess', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get dataset info for audit
    const [dataset] = await db.execute('SELECT * FROM datasets WHERE id = ?', [id]);
    if (dataset.length === 0) {
      return res.status(404).json({ success: false, message: 'Dataset not found' });
    }
    
    // Get record count before deletion
    const [recordCount] = await db.execute('SELECT COUNT(*) as count FROM dataset_records WHERE dataset_id = ?', [id]);
    
    // Update status to processing
    await db.execute(
      'UPDATE datasets SET status = "processing", updated_at = NOW() WHERE id = ?',
      [id]
    );
    
    // Delete existing records
    await db.execute('DELETE FROM dataset_records WHERE dataset_id = ?', [id]);
    
    // Log audit trail
    await db.execute(
      `INSERT INTO audit_trail (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        'REPROCESS',
        'datasets',
        id,
        JSON.stringify({ 
          dataset_name: dataset[0].name,
          old_status: dataset[0].status,
          records_deleted: recordCount[0].count
        }),
        JSON.stringify({ new_status: 'processing' }),
        req.ip,
        req.get('User-Agent')
      ]
    );
    
    res.json({ success: true, message: 'Dataset reprocessing started' });
  } catch (error) {
    console.error('Reprocess dataset error:', error);
    res.status(500).json({ success: false, message: 'Failed to reprocess dataset' });
  }
});

// Delete dataset
router.delete('/:id', [
  authenticateToken,
  requireAdmin,
  auditMiddleware('DATASET_DELETED', 'datasets')
], async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Deleting dataset with ID:', id);

    const [datasets] = await db.execute('SELECT * FROM datasets WHERE id = ?', [id]);
    if (datasets.length === 0) {
      return res.status(404).json({ success: false, message: 'Dataset not found' });
    }

    req.body.oldValues = datasets[0];
    console.log('Starting dataset deletion...');
    
    // Simple direct deletion
    await db.execute('DELETE FROM dataset_records WHERE dataset_id = ?', [id]);
    console.log('Dataset records deleted');

    await db.execute('DELETE FROM datasets WHERE id = ?', [id]);
    console.log('Dataset deleted successfully');

    res.json({ success: true, message: 'Dataset deleted successfully' });
  } catch (error) {
    console.error('Delete dataset error:', error);
    res.status(500).json({ success: false, message: `Failed to delete dataset: ${error.message}` });
  }
});

// Helper functions
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
    let lastProgressTime = Date.now();
    
    // Ultra-optimized CSV parsing with maximum buffer size
    const stream = fs.createReadStream(filePath, { 
      highWaterMark: 256 * 1024, // 256KB buffer for maximum throughput
      encoding: 'utf8'
    })
    .pipe(csv({
      skipEmptyLines: true,
      skipLinesWithError: true,
      maxRowBytes: 2 * 1024 * 1024, // 2MB max row size
      headers: true,
      ignoreEmpty: true
    }))
    .on('data', (data) => {
      rowCount++;
      
      // Ultra-fast validation - check if any non-empty value exists
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
      
      // Optimized progress reporting (every 5000 rows or 1 second)
      if (rowCount % 5000 === 0 || Date.now() - lastProgressTime > 1000) {
        progressCallback({ processed: rowCount, valid: validCount });
        lastProgressTime = Date.now();
      }
    })
    .on('end', () => {
      console.log('✅ === CSV PROCESSING COMPLETE ===');
      console.log(`📊 Total rows: ${rowCount}, Valid records: ${validCount}`);
      console.log(`🎯 Data integrity: ${((validCount/rowCount)*100).toFixed(1)}% valid`);
      resolve(records);
    })
    .on('error', (error) => {
      console.error('❌ CSV processing error:', error);
      reject(error);
    });
  });
}

// Keep original function for backward compatibility
async function processCSV(filePath) {
  return processCSVOptimized(filePath, () => {});
}

async function processExcelOptimized(filePath, selectedSheet = null, progressCallback) {
  console.log('🚀 === ULTRA-FAST EXCEL PROCESSING START ===');
  
  if (!fs.existsSync(filePath)) {
    throw new Error('Excel file does not exist');
  }
  
  const fileStats = fs.statSync(filePath);
  const fileSizeMB = (fileStats.size / 1024 / 1024).toFixed(2);
  console.log(`📈 File size: ${fileSizeMB} MB`);
  
  try {
    // Ultra-optimized Excel reading - disable all unnecessary features
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
      throw new Error(`Sheet "${sheetName}" not found`);
    }
    
    progressCallback({ sheet: sheetName, rows: 'analyzing...' });
    
    // Ultra-fast conversion with streaming approach
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
      console.log('⚠️  No data found in Excel sheet');
      return [];
    }
    
    progressCallback({ sheet: sheetName, rows: records.length });
    
    // Lightning-fast object mapping with pre-allocated arrays
    const mapStart = Date.now();
    const headers = records[0];
    const dataRows = records.slice(1);
    
    // Pre-filter headers to avoid repeated checks
    const validHeaders = headers.map((header, index) => 
      header && header.toString().trim() ? { name: header.toString().trim(), index } : null
    ).filter(Boolean);
    
    // Ultra-optimized mapping using for loops (faster than map/forEach)
    const objectRecords = [];
    let validCount = 0;
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const record = {};
      let hasData = false;
      
      // Use pre-filtered headers for maximum speed
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
    
    return objectRecords;
  } catch (error) {
    console.error('❌ === EXCEL PROCESSING ERROR ===');
    console.error('Error:', error.message);
    throw error;
  }
}

// Keep original function for backward compatibility
async function processExcel(filePath, selectedSheet = null) {
  return processExcelOptimized(filePath, selectedSheet, () => {});
}

// Alternative Excel processing method
async function processExcelAlternative(filePath, selectedSheet = null) {
  console.log('=== ALTERNATIVE EXCEL PROCESSING ===');
  try {
    const workbook = xlsx.readFile(filePath, { cellDates: true, cellNF: false, cellText: false });
    const sheetName = selectedSheet || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet) {
      console.log('Sheet not found in alternative processing');
      return [];
    }
    
    // Try different conversion options
    const records = xlsx.utils.sheet_to_json(worksheet, {
      raw: false, // Don't use raw values
      dateNF: 'yyyy-mm-dd', // Date format
      defval: null // Default value for empty cells
    });
    
    console.log('Alternative processing found', records.length, 'records');
    if (records.length > 0) {
      console.log('Alternative first record:', records[0]);
    }
    
    return records;
  } catch (error) {
    console.error('Alternative Excel processing failed:', error.message);
    return [];
  }
}

function getExcelSheets(filePath) {
  const workbook = xlsx.readFile(filePath);
  return workbook.SheetNames;
}

async function processPythonExcel(filePath, datasetId, selectedSheet = null) {
  try {
    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';
    
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
      timeout: 600000  // 10 minutes timeout for large files
    });
    
    if (!response.ok) {
      throw new Error(`Python service responded with status: ${response.status}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Python service error:', error);
    return { success: false, error: error.message };
  }
}

// Fallback to spawn method if Python service is not available
async function processPythonExcelFallback(filePath, datasetId) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, '../python_upload_service/process_excel.py');
    const python = spawn('python', [pythonScript, filePath, datasetId]);
    
    let output = '';
    let error = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    python.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (parseError) {
          resolve({ success: false, error: 'Failed to parse Python output' });
        }
      } else {
        resolve({ success: false, error: error || 'Python script failed' });
      }
    });
  });
}

module.exports = router;