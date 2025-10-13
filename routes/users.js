const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');
const { sendNewUserEmail } = require('../utils/email');
const { userValidation, handleValidationErrors, sanitizeInput } = require('../utils/validation');
const logger = require('../utils/logger');

const router = express.Router();

// Get single user by ID
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [users] = await db.execute(
      'SELECT id, fullname, email, phone, department, division, role, status, created_at FROM users WHERE id = ?',
      [id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Log audit trail for user access
    await db.execute(
      `INSERT INTO audit_trail (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        'VIEW',
        'users',
        id,
        null,
        JSON.stringify({ accessed_user: users[0].fullname, accessed_email: users[0].email }),
        req.ip,
        req.get('User-Agent')
      ]
    );
    
    res.json({
      success: true,
      data: users[0]
    });
  } catch (error) {
    logger.error('Get user error', { error: error.message, userId: id, ip: req.ip });
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
});

// Get users with filters
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, department, division, status, page = 1, limit = 10 } = req.query;
    
    let whereConditions = [];
    let params = [];
    
    if (name) {
      whereConditions.push('fullname LIKE ?');
      params.push(`%${sanitizeInput(name)}%`);
    }
    
    if (department) {
      whereConditions.push('department = ?');
      params.push(department);
    }
    
    if (division) {
      whereConditions.push('division = ?');
      params.push(division);
    }
    
    if (status && ['active', 'inactive'].includes(status)) {
      whereConditions.push('status = ?');
      params.push(status);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get departments and divisions for filters
    const [departments] = await db.execute('SELECT name FROM departments WHERE status = "active" ORDER BY name');
    const [divisions] = await db.execute('SELECT name FROM divisions WHERE status = "active" ORDER BY name');
    
    // Get total count
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      params
    );
    
    // Get paginated results
    const offset = (page - 1) * limit;
    const [users] = await db.execute(
      `SELECT id, fullname, email, phone, department, division, role, status, created_at 
       FROM users ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({
      success: true,
      data: users,
      filters: {
        departments: departments.map(d => d.name),
        divisions: divisions.map(d => d.name)
      },
      pagination: {
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    logger.error('Get users error', { error: error.message, filters: req.query, ip: req.ip });
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

// Add new user
router.post('/', [
  authenticateToken,
  requireAdmin,
  ...userValidation,
  handleValidationErrors,
  auditMiddleware('USER_CREATED', 'users')
], async (req, res) => {
  try {
    const { fullname, email, phone, department, division } = req.body;

    // Check if email already exists
    const [existingUsers] = await db.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    // Generate random password
    const tempPassword = crypto.randomBytes(8).toString('hex') + 'A1!';
    const hashedPassword = await bcrypt.hash(tempPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    const [result] = await db.execute(
      `INSERT INTO users (fullname, email, phone, department, division, password, role, status, force_password_change)
       VALUES (?, ?, ?, ?, ?, ?, 'user', 'active', TRUE)`,
      [sanitizeInput(fullname), email, phone, sanitizeInput(department), sanitizeInput(division), hashedPassword]
    );

    // Send welcome email with credentials
    await sendNewUserEmail(email, tempPassword, fullname);

    res.status(201).json({
      success: true,
      message: 'User created successfully. Login credentials sent to email.',
      data: { id: result.insertId }
    });
  } catch (error) {
    logger.error('Add user error', { error: error.message, email, ip: req.ip });
    res.status(500).json({ success: false, message: 'Failed to create user' });
  }
});

// Update user
router.put('/:id', [
  authenticateToken,
  requireAdmin,
  ...userValidation,
  handleValidationErrors,
  auditMiddleware('USER_UPDATED', 'users')
], async (req, res) => {
  try {
    const { id } = req.params;
    const { fullname, email, phone, department, division, status } = req.body;

    // Check if user exists
    const [existingUsers] = await db.execute(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if email is taken by another user
    const [emailCheck] = await db.execute(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, id]
    );

    if (emailCheck.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    // Capture detailed changes for audit
    const oldValues = {
      fullname: existingUsers[0].fullname,
      email: existingUsers[0].email,
      phone: existingUsers[0].phone,
      department: existingUsers[0].department,
      division: existingUsers[0].division,
      status: existingUsers[0].status
    };
    
    const newValues = {
      fullname: sanitizeInput(fullname),
      email: email,
      phone: phone,
      department: sanitizeInput(department),
      division: sanitizeInput(division),
      status: status
    };
    
    // Identify what changed
    const changes = {};
    Object.keys(newValues).forEach(key => {
      if (oldValues[key] !== newValues[key]) {
        changes[key] = {
          from: oldValues[key],
          to: newValues[key]
        };
      }
    });

    await db.execute(
      `UPDATE users SET 
        fullname = ?, email = ?, phone = ?, department = ?, division = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newValues.fullname, newValues.email, newValues.phone, newValues.department, newValues.division, newValues.status, id]
    );
    
    // Enhanced audit logging with detailed changes
    await db.execute(
      `INSERT INTO audit_trail (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        'UPDATE_USER',
        'users',
        id,
        JSON.stringify({
          original_values: oldValues,
          target_user: existingUsers[0].fullname
        }),
        JSON.stringify({
          updated_values: newValues,
          changes_made: changes,
          change_count: Object.keys(changes).length
        }),
        req.ip,
        req.get('User-Agent')
      ]
    );
    
    req.body.oldValues = existingUsers[0];

    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    logger.error('Update user error', { error: error.message, userId: id, ip: req.ip });
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

// Delete user
router.delete('/:id', [
  authenticateToken,
  requireAdmin,
  auditMiddleware('USER_DELETED', 'users')
], async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }

    const [existingUsers] = await db.execute(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    req.body.oldValues = existingUsers[0];

    await db.execute('DELETE FROM users WHERE id = ?', [id]);

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Delete user error', { error: error.message, userId: id, ip: req.ip });
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

module.exports = router;