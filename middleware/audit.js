const db = require('../config/database');
const logger = require('../utils/logger');

const logAudit = async (userId, username, action, tableName = null, recordId = null, oldValues = null, newValues = null, req = null, details = null) => {
  try {
    // Get change details for updates
    let changeDetails = null;
    if (oldValues && newValues && action.includes('UPDATE')) {
      changeDetails = getChangeDetails(oldValues, newValues);
    }

    await db.execute(`
      INSERT INTO audit_trail (user_id, username, action, table_name, record_id, old_values, new_values, change_details, ip_address, user_agent, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      username,
      action,
      tableName,
      recordId,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      changeDetails ? JSON.stringify(changeDetails) : null,
      req ? (req.ip || req.connection?.remoteAddress) : null,
      req ? req.get('User-Agent') : null,
      details
    ]);
    
    logger.info(`Audit logged: ${action}`, {
      userId,
      username,
      action,
      tableName,
      recordId,
      ip: req?.ip
    });
  } catch (error) {
    logger.error('Audit logging error', { error: error.message, action, userId });
  }
};

const getChangeDetails = (oldValues, newValues) => {
  const changes = [];
  const oldObj = typeof oldValues === 'string' ? JSON.parse(oldValues) : oldValues;
  const newObj = typeof newValues === 'string' ? JSON.parse(newValues) : newValues;
  
  // Skip certain fields from change tracking
  const skipFields = ['password', 'updated_at', 'oldValues'];
  
  for (const key in newObj) {
    if (skipFields.includes(key)) continue;
    
    const oldVal = oldObj[key];
    const newVal = newObj[key];
    
    if (oldVal !== newVal) {
      changes.push({
        field: key,
        oldValue: oldVal,
        newValue: newVal
      });
    }
  }
  
  return changes;
};

const auditMiddleware = (action, tableName = null) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log successful operations
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        const recordId = req.params.id || (typeof data === 'object' && data.data?.id) || null;
        
        logAudit(
          req.user.id,
          req.user.fullname || req.user.email,
          action,
          tableName,
          recordId,
          req.body.oldValues || null,
          req.body,
          req,
          req.auditDetails || null
        );
      }
      originalSend.call(this, data);
    };
    
    next();
  };
};

// Enhanced audit middleware for comprehensive tracking
const comprehensiveAudit = (req, res, next) => {
  if (!req.user) return next();
  
  // Skip logging for certain endpoints to avoid noise
  const skipPaths = ['/api/audit', '/api/profile'];
  if (skipPaths.some(path => req.originalUrl.startsWith(path))) {
    return next();
  }
  
  logAudit(
    req.user.id,
    req.user.fullname || req.user.email,
    `${req.method}_${req.originalUrl.replace('/api/', '').toUpperCase()}`,
    null,
    null,
    null,
    req.body,
    req,
    `${req.method} ${req.originalUrl}`
  );
  
  next();
};

module.exports = { logAudit, auditMiddleware, comprehensiveAudit, getChangeDetails };