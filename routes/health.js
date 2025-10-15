const express = require('express');
const db = require('../config/database');
const fetch = require('node-fetch');

const router = express.Router();

// Comprehensive health check endpoint
router.get('/', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {},
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };

  let overallHealthy = true;

  // Database health check
  try {
    const connection = await db.getConnection();
    await connection.execute('SELECT 1');
    connection.release();
    health.services.database = { status: 'healthy', responseTime: Date.now() };
  } catch (error) {
    health.services.database = { status: 'unhealthy', error: error.message };
    overallHealthy = false;
  }

  // Python upload service health check
  try {
    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';
    const startTime = Date.now();
    const response = await fetch(`${pythonServiceUrl}/health`, { timeout: 3000 });
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      health.services.pythonUploadService = { status: 'healthy', responseTime };
    } else {
      health.services.pythonUploadService = { status: 'unhealthy', error: `HTTP ${response.status}` };
      overallHealthy = false;
    }
  } catch (error) {
    health.services.pythonUploadService = { status: 'unhealthy', error: error.message };
    overallHealthy = false;
  }

  // Database service health check
  try {
    const dbServiceUrl = process.env.DB_SERVICE_URL || 'http://localhost:5001';
    const startTime = Date.now();
    const response = await fetch(`${dbServiceUrl}/health`, { timeout: 3000 });
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      health.services.databaseService = { status: 'healthy', responseTime };
    } else {
      health.services.databaseService = { status: 'unhealthy', error: `HTTP ${response.status}` };
      overallHealthy = false;
    }
  } catch (error) {
    health.services.databaseService = { status: 'unhealthy', error: error.message };
    overallHealthy = false;
  }

  health.status = overallHealthy ? 'healthy' : 'unhealthy';
  
  const statusCode = overallHealthy ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router;