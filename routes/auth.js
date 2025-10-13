const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body } = require('express-validator');
const db = require('../config/database');
const { sendPasswordResetEmail } = require('../utils/email');
const { passwordPolicy, emailValidation, handleValidationErrors } = require('../utils/validation');
const { logAudit } = require('../middleware/audit');
const logger = require('../utils/logger');

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for:', email);

    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const [users] = await db.execute(
      'SELECT id, fullname, email, password, role, status, force_password_change FROM users WHERE email = ?',
      [email]
    );
    
    console.log('Users found:', users.length);

    if (users.length === 0) {
      console.log('User not found');
      await logAudit(null, email, 'LOGIN_FAILED - User not found', null, null, null, null, req);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = users[0];
    console.log('User status:', user.status);

    if (user.status !== 'active') {
      console.log('Account inactive');
      await logAudit(user.id, user.fullname, 'LOGIN_FAILED - Account inactive', null, null, null, null, req);
      return res.status(401).json({ success: false, message: 'Account is inactive' });
    }

    console.log('Comparing password...');
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('Invalid password');
      await logAudit(user.id, user.fullname, 'LOGIN_FAILED - Invalid password', null, null, null, null, req);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    console.log('Creating JWT token...');
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Enhanced audit logging for login
    await db.execute(
      `INSERT INTO audit_trail (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        'LOGIN_SUCCESS',
        'users',
        user.id,
        null,
        JSON.stringify({ 
          login_time: new Date().toISOString(),
          user_agent: req.get('User-Agent'),
          ip_address: req.ip,
          role: user.role
        }),
        req.ip,
        req.get('User-Agent')
      ]
    );
    console.log('Login successful');

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        role: user.role,
        forcePasswordChange: user.force_password_change
      }
    });
  } catch (error) {
    console.error('Login error details:', error);
    logger.error('Login error', { error: error.message, email: req.body.email, ip: req.ip });
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// Forgot password
router.post('/forgot-password', [
  ...emailValidation,
  handleValidationErrors
], async (req, res) => {
  try {
    const { email } = req.body;
    console.log('Forgot password request for:', email);

    const [users] = await db.execute(
      'SELECT id, fullname, email FROM users WHERE email = ? AND status = "active"',
      [email]
    );

    console.log('Users found:', users.length);

    if (users.length === 0) {
      console.log('No user found with email:', email);
      // Don't reveal if email exists
      return res.json({ success: true, message: 'If the email exists, a reset link has been sent' });
    }

    const user = users[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    console.log('Generated reset token for user:', user.id);
    console.log('Token expires at:', resetTokenExpires);

    await db.execute(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
      [resetToken, resetTokenExpires, user.id]
    );

    console.log('Database updated, sending email...');
    
    try {
      await sendPasswordResetEmail(user.email, resetToken, user.fullname);
      console.log('Password reset email sent successfully');
      await logAudit(user.id, user.fullname, 'PASSWORD_RESET_REQUESTED', null, null, null, null, req);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Still return success to not reveal if email exists
      return res.json({ success: true, message: 'If the email exists, a reset link has been sent', debug: 'Email sending failed: ' + emailError.message });
    }

    res.json({ success: true, message: 'If the email exists, a reset link has been sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    logger.error('Forgot password error', { error: error.message, email: req.body.email, ip: req.ip });
    res.status(500).json({ success: false, message: 'Failed to process request' });
  }
});

// Reset password
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  ...passwordPolicy,
  handleValidationErrors
], async (req, res) => {
  try {
    const { token, password } = req.body;

    const [users] = await db.execute(
      'SELECT id, fullname, email FROM users WHERE reset_token = ? AND reset_token_expires > NOW() AND status = "active"',
      [token]
    );

    if (users.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    const user = users[0];
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    await db.execute(
      'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL, force_password_change = FALSE WHERE id = ?',
      [hashedPassword, user.id]
    );

    await logAudit(user.id, user.fullname, 'PASSWORD_RESET_COMPLETED', null, null, null, null, req);

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    logger.error('Reset password error', { error: error.message, token, ip: req.ip });
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
});

// Change password (for forced password change)
router.post('/change-password', [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  ...passwordPolicy,
  handleValidationErrors
], async (req, res) => {
  try {
    const { currentPassword, password } = req.body;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [users] = await db.execute(
      'SELECT id, fullname, password FROM users WHERE id = ? AND status = "active"',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const user = users[0];
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    
    if (!isValidPassword) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    await db.execute(
      'UPDATE users SET password = ?, force_password_change = FALSE WHERE id = ?',
      [hashedPassword, user.id]
    );

    await logAudit(user.id, user.fullname, 'PASSWORD_CHANGED', null, null, null, null, req);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error', { error: error.message, userId: decoded?.userId, ip: req.ip });
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
});

// Test email configuration
router.post('/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    await sendPasswordResetEmail(email, 'test-token', 'Test User');
    res.json({ success: true, message: 'Test email sent successfully' });
  } catch (error) {
    logger.error('Test email error', { error: error.message, ip: req.ip });
    res.status(500).json({ success: false, message: `Email test failed: ${error.message}` });
  }
});

module.exports = router;