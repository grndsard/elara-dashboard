const db = require('../config/database');

// Comprehensive audit middleware for all requests
const comprehensiveAuditMiddleware = (req, res, next) => {
  // Store original methods
  const originalSend = res.send;
  const originalJson = res.json;
  
  // Track request start time
  req.auditStartTime = Date.now();
  
  // Override response methods to capture response data
  res.send = function(data) {
    logRequestAudit(req, res, data);
    return originalSend.call(this, data);
  };
  
  res.json = function(data) {
    logRequestAudit(req, res, data);
    return originalJson.call(this, data);
  };
  
  next();
};

async function logRequestAudit(req, res, responseData) {
  try {
    // Skip audit logging for certain routes to avoid noise
    const skipRoutes = [
      '/api/dashboard/data',
      '/health',
      '/favicon.ico',
      '/css/',
      '/js/',
      '/images/'
    ];
    
    if (skipRoutes.some(route => req.path.includes(route))) {
      return;
    }
    
    const duration = Date.now() - req.auditStartTime;
    const userId = req.user?.id || null;
    const userName = req.user?.fullname || 'Anonymous';
    
    // Determine action type based on method and path
    let action = `${req.method}_${req.path.replace(/\/api\//, '').replace(/\//g, '_').toUpperCase()}`;
    
    // Parse response to determine success/failure
    let isSuccess = res.statusCode < 400;
    let responseInfo = {};
    
    try {
      if (typeof responseData === 'string') {
        responseInfo = JSON.parse(responseData);
      } else {
        responseInfo = responseData;
      }
      isSuccess = responseInfo.success !== false && res.statusCode < 400;
    } catch (e) {
      // Response is not JSON, use status code only
    }
    
    // Extract relevant request data
    const requestInfo = {
      method: req.method,
      path: req.path,
      query: req.query,
      body: sanitizeRequestBody(req.body),
      params: req.params,
      duration_ms: duration,
      status_code: res.statusCode,
      success: isSuccess
    };
    
    // Log to audit trail
    await db.execute(
      `INSERT INTO audit_trail (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        action,
        'system_requests',
        null,
        JSON.stringify(requestInfo),
        JSON.stringify({
          response_status: res.statusCode,
          success: isSuccess,
          duration_ms: duration
        }),
        req.ip,
        req.get('User-Agent')
      ]
    );
  } catch (error) {
    console.error('Audit logging error:', error);
  }
}

// Sanitize request body to remove sensitive data
function sanitizeRequestBody(body) {
  if (!body || typeof body !== 'object') return body;
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'currentPassword', 'token', 'resetToken'];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

// Specific CRUD audit middleware
const crudAuditMiddleware = (action, tableName) => {
  return async (req, res, next) => {
    // Store original method
    const originalJson = res.json;
    
    res.json = function(data) {
      // Log CRUD operation
      logCrudOperation(req, res, action, tableName, data);
      return originalJson.call(this, data);
    };
    
    next();
  };
};

async function logCrudOperation(req, res, action, tableName, responseData) {
  try {
    const userId = req.user?.id;
    const recordId = req.params?.id || responseData?.data?.id;
    
    let oldValues = null;
    let newValues = null;
    
    // Capture old values for updates and deletes
    if (action === 'UPDATE' || action === 'DELETE') {
      oldValues = req.body?.oldValues || req.originalData;
    }
    
    // Capture new values for creates and updates
    if (action === 'CREATE' || action === 'UPDATE') {
      newValues = sanitizeRequestBody(req.body);
    }
    
    const auditDetails = {
      action_type: action,
      table_affected: tableName,
      record_id: recordId,
      request_method: req.method,
      request_path: req.path,
      success: responseData?.success !== false && res.statusCode < 400,
      error_message: responseData?.message || null
    };
    
    await db.execute(
      `INSERT INTO audit_trail (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        `${action}_${tableName.toUpperCase()}`,
        tableName,
        recordId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : JSON.stringify(auditDetails),
        req.ip,
        req.get('User-Agent')
      ]
    );
  } catch (error) {
    console.error('CRUD audit logging error:', error);
  }
}

module.exports = {
  comprehensiveAuditMiddleware,
  crudAuditMiddleware
};