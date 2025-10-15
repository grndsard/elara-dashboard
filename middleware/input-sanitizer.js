const validator = require('validator');
const logger = require('../utils/logger');

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  const correlationId = logger.addCorrelationId(req);
  
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body, correlationId);
  }
  
  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query, correlationId);
  }
  
  next();
};

const sanitizeObject = (obj, correlationId) => {
  const sanitized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Basic XSS protection
      sanitized[key] = validator.escape(value.trim());
      
      // Log potential XSS attempts
      if (value !== sanitized[key]) {
        logger.warn('Potential XSS attempt detected', {
          correlationId,
          field: key,
          original: value,
          sanitized: sanitized[key]
        });
      }
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, correlationId);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

// File upload validation
const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return next();
  }
  
  const allowedTypes = ['.xls', '.xlsx', '.csv'];
  const maxSize = 300 * 1024 * 1024; // 300MB
  const file = req.file;
  
  // Check file extension
  const ext = require('path').extname(file.originalname).toLowerCase();
  if (!allowedTypes.includes(ext)) {
    logger.warn('Invalid file type upload attempt', {
      correlationId: req.correlationId,
      filename: file.originalname,
      extension: ext,
      ip: req.ip
    });
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Only .xls, .xlsx, and .csv files are allowed.'
    });
  }
  
  // Check file size
  if (file.size > maxSize) {
    logger.warn('File size limit exceeded', {
      correlationId: req.correlationId,
      filename: file.originalname,
      size: file.size,
      maxSize,
      ip: req.ip
    });
    return res.status(413).json({
      success: false,
      message: 'File size exceeds 300MB limit.'
    });
  }
  
  // Basic filename sanitization
  const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  if (sanitizedFilename !== file.originalname) {
    logger.info('Filename sanitized', {
      correlationId: req.correlationId,
      original: file.originalname,
      sanitized: sanitizedFilename
    });
    file.originalname = sanitizedFilename;
  }
  
  next();
};

module.exports = {
  sanitizeInput,
  validateFileUpload
};