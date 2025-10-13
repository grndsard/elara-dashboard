const express = require('express');
const XLSX = require('xlsx');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../middleware/audit');
const logger = require('../utils/logger');

const router = express.Router();

// Get audit trail
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, action, user_id, startDate, endDate } = req.query;
    
    let whereConditions = [];
    let params = [];
    
    if (action) {
      whereConditions.push('a.action = ?');
      params.push(action);
    }
    
    if (user_id) {
      whereConditions.push('a.user_id = ?');
      params.push(user_id);
    }
    
    if (startDate) {
      whereConditions.push('DATE(a.timestamp) >= ?');
      params.push(startDate);
    }
    
    if (endDate) {
      whereConditions.push('DATE(a.timestamp) <= ?');
      params.push(endDate);
    }
    
    // Default to current day if no date filters specified
    if (!startDate && !endDate) {
      whereConditions.push('DATE(a.timestamp) = CURDATE()');
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get filter options
    const [actions] = await db.execute(
      'SELECT DISTINCT action FROM audit_trail ORDER BY action'
    );
    
    const [users] = await db.execute(
      'SELECT DISTINCT u.id, u.fullname FROM audit_trail a JOIN users u ON a.user_id = u.id ORDER BY u.fullname'
    );
    
    // Get total count
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM audit_trail a LEFT JOIN users u ON a.user_id = u.id ${whereClause}`,
      params
    );
    
    // Get paginated results
    const offset = (page - 1) * limit;
    const [auditRecords] = await db.execute(
      `SELECT 
        a.id, a.user_id, u.fullname as username, a.action, a.table_name, a.record_id,
        a.old_values, a.new_values, a.ip_address, a.user_agent, a.timestamp
       FROM audit_trail a
       LEFT JOIN users u ON a.user_id = u.id
       ${whereClause} 
       ORDER BY a.timestamp DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    // Parse JSON fields
    const processedRecords = auditRecords.map(record => ({
      ...record,
      old_values: record.old_values ? JSON.parse(record.old_values) : null,
      new_values: record.new_values ? JSON.parse(record.new_values) : null
    }));

    res.json({
      success: true,
      data: processedRecords,
      filters: {
        actions: actions.map(a => a.action),
        users: users.map(u => ({ id: u.id, name: u.fullname }))
      },
      pagination: {
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    logger.error('Get audit trail error', { error: error.message, filters: req.query, ip: req.ip });
    res.status(500).json({ success: false, message: 'Failed to fetch audit trail' });
  }
});

// Get audit statistics
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Actions by type
    const [actionStats] = await db.execute(`
      SELECT action, COUNT(*) as count 
      FROM audit_trail 
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY action 
      ORDER BY count DESC 
      LIMIT 10
    `);

    // Activity by user
    const [userStats] = await db.execute(`
      SELECT username, COUNT(*) as count 
      FROM audit_trail 
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY username 
      ORDER BY count DESC 
      LIMIT 10
    `);

    // Daily activity
    const [dailyStats] = await db.execute(`
      SELECT 
        DATE(timestamp) as date, 
        COUNT(*) as count 
      FROM audit_trail 
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(timestamp) 
      ORDER BY date DESC
    `);

    res.json({
      success: true,
      data: {
        actionStats,
        userStats,
        dailyStats
      }
    });
  } catch (error) {
    logger.error('Get audit stats error', { error: error.message, ip: req.ip });
    res.status(500).json({ success: false, message: 'Failed to fetch audit statistics' });
  }
});

// Log user action
router.post('/log', authenticateToken, async (req, res) => {
  try {
    const { action, details, data } = req.body;
    
    await logAudit(
      req.user.id,
      req.user.fullname || req.user.email,
      action,
      null,
      null,
      null,
      data,
      req,
      details
    );
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Log audit error', { error: error.message, ip: req.ip });
    res.status(500).json({ success: false, message: 'Failed to log action' });
  }
});

// Export audit trail to Excel
router.get('/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { action, username, startDate, endDate } = req.query;
    
    let whereConditions = [];
    let params = [];
    
    if (action) {
      whereConditions.push('action LIKE ?');
      params.push(`%${action}%`);
    }
    
    if (username) {
      whereConditions.push('username LIKE ?');
      params.push(`%${username}%`);
    }
    
    if (startDate) {
      whereConditions.push('DATE(timestamp) >= ?');
      params.push(startDate);
    }
    
    if (endDate) {
      whereConditions.push('DATE(timestamp) <= ?');
      params.push(endDate);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get all matching records (limit to 10000 for performance)
    const [auditRecords] = await db.execute(
      `SELECT 
        id, user_id, username, action, table_name, record_id,
        old_values, new_values, change_details, ip_address, user_agent, details, timestamp
       FROM audit_trail ${whereClause} 
       ORDER BY timestamp DESC 
       LIMIT 10000`,
      params
    );

    // Process records for Excel export
    const excelData = auditRecords.map(record => {
      const changeDetails = record.change_details ? JSON.parse(record.change_details) : [];
      const changesText = changeDetails.map(change => 
        `${change.field}: "${change.oldValue}" → "${change.newValue}"`
      ).join('; ');
      
      return {
        'ID': record.id,
        'User ID': record.user_id,
        'Username': record.username,
        'Action': record.action,
        'Table': record.table_name || '',
        'Record ID': record.record_id || '',
        'Changes': changesText || '',
        'IP Address': record.ip_address || '',
        'User Agent': record.user_agent || '',
        'Details': record.details || '',
        'Timestamp': record.timestamp
      };
    });

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths
    const colWidths = [
      { wch: 8 },   // ID
      { wch: 10 },  // User ID
      { wch: 20 },  // Username
      { wch: 25 },  // Action
      { wch: 15 },  // Table
      { wch: 12 },  // Record ID
      { wch: 50 },  // Changes
      { wch: 15 },  // IP Address
      { wch: 30 },  // User Agent
      { wch: 30 },  // Details
      { wch: 20 }   // Timestamp
    ];
    worksheet['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Trail');
    
    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Log the export action
    await logAudit(
      req.user.id,
      req.user.fullname || req.user.email,
      'AUDIT_EXPORT',
      'audit_trail',
      null,
      null,
      { filters: req.query, recordCount: auditRecords.length },
      req,
      `Exported ${auditRecords.length} audit records`
    );
    
    // Set response headers
    const filename = `audit_trail_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length);
    
    res.send(excelBuffer);
  } catch (error) {
    logger.error('Export audit trail error', { error: error.message, filters: req.query, ip: req.ip });
    res.status(500).json({ success: false, message: 'Failed to export audit trail' });
  }
});

module.exports = router;