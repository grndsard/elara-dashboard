const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body } = require('express-validator');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');
const { passwordPolicy, handleValidationErrors, sanitizeInput } = require('../utils/validation');

const router = express.Router();

// Configure multer for profile photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../public/images/profiles');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit
});

// Get user profile
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [users] = await db.execute(
      'SELECT id, fullname, email, phone, department, division, profile_photo, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: users[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// Update profile
router.put('/', [
  authenticateToken,
  body('fullname').trim().isLength({ min: 2, max: 255 }).withMessage('Full name must be between 2 and 255 characters'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('department').optional().trim().isLength({ max: 100 }).withMessage('Department must not exceed 100 characters'),
  body('division').optional().trim().isLength({ max: 100 }).withMessage('Division must not exceed 100 characters'),
  handleValidationErrors,
  auditMiddleware('PROFILE_UPDATED', 'users')
], async (req, res) => {
  try {
    const { fullname, phone, department, division } = req.body;

    // Get current profile for detailed audit
    const [currentProfile] = await db.execute(
      'SELECT fullname, phone, department, division FROM users WHERE id = ?',
      [req.user.id]
    );
    
    const oldValues = {
      fullname: currentProfile[0].fullname,
      phone: currentProfile[0].phone,
      department: currentProfile[0].department,
      division: currentProfile[0].division
    };
    
    const newValues = {
      fullname: sanitizeInput(fullname),
      phone: phone,
      department: sanitizeInput(department),
      division: sanitizeInput(division)
    };
    
    // Track specific changes
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
      'UPDATE users SET fullname = ?, phone = ?, department = ?, division = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newValues.fullname, newValues.phone, newValues.department, newValues.division, req.user.id]
    );
    
    // Enhanced audit logging for profile updates
    await db.execute(
      `INSERT INTO audit_trail (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        'PROFILE_UPDATE',
        'users',
        req.user.id,
        JSON.stringify({
          original_profile: oldValues,
          user_name: currentProfile[0].fullname
        }),
        JSON.stringify({
          updated_profile: newValues,
          changes_made: changes,
          fields_changed: Object.keys(changes)
        }),
        req.ip,
        req.get('User-Agent')
      ]
    );
    
    req.body.oldValues = currentProfile[0];

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

// Upload profile photo
router.post('/photo', [
  authenticateToken,
  upload.single('photo'),
  auditMiddleware('PROFILE_PHOTO_UPDATED', 'users')
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No photo uploaded' });
    }

    // Get current profile photo to delete old one
    const [users] = await db.execute(
      'SELECT profile_photo FROM users WHERE id = ?',
      [req.user.id]
    );

    const oldPhoto = users[0]?.profile_photo;
    const newPhotoPath = `/images/profiles/${req.file.filename}`;

    // Update database
    await db.execute(
      'UPDATE users SET profile_photo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newPhotoPath, req.user.id]
    );
    
    // Detailed audit for photo upload
    await db.execute(
      `INSERT INTO audit_trail (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        'PROFILE_PHOTO_UPDATE',
        'users',
        req.user.id,
        JSON.stringify({
          old_photo: oldPhoto || 'No previous photo',
          file_removed: oldPhoto ? true : false
        }),
        JSON.stringify({
          new_photo: newPhotoPath,
          file_name: req.file.filename,
          file_size: req.file.size,
          mime_type: req.file.mimetype
        }),
        req.ip,
        req.get('User-Agent')
      ]
    );

    // Delete old photo file if exists
    if (oldPhoto && oldPhoto !== newPhotoPath) {
      const oldPhotoFullPath = path.join(__dirname, '../public', oldPhoto);
      if (fs.existsSync(oldPhotoFullPath)) {
        fs.unlinkSync(oldPhotoFullPath);
      }
    }

    res.json({
      success: true,
      message: 'Profile photo updated successfully',
      data: { photoUrl: newPhotoPath }
    });
  } catch (error) {
    console.error('Upload photo error:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ success: false, message: 'Failed to upload photo' });
  }
});

// Remove profile photo
router.post('/remove-photo', [
  authenticateToken,
  auditMiddleware('PROFILE_PHOTO_REMOVED', 'users')
], async (req, res) => {
  try {
    // Get current profile photo
    const [users] = await db.execute(
      'SELECT profile_photo FROM users WHERE id = ?',
      [req.user.id]
    );

    const oldPhoto = users[0]?.profile_photo;

    // Update database to remove photo
    await db.execute(
      'UPDATE users SET profile_photo = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [req.user.id]
    );

    // Delete photo file if exists
    if (oldPhoto) {
      const oldPhotoFullPath = path.join(__dirname, '../public', oldPhoto);
      if (fs.existsSync(oldPhotoFullPath)) {
        fs.unlinkSync(oldPhotoFullPath);
      }
    }

    res.json({
      success: true,
      message: 'Profile photo removed successfully'
    });
  } catch (error) {
    console.error('Remove photo error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove photo' });
  }
});

// Change password
router.post('/change-password', [
  authenticateToken,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  ...passwordPolicy,
  handleValidationErrors,
  auditMiddleware('PASSWORD_CHANGED', 'users')
], async (req, res) => {
  try {
    const { currentPassword, password } = req.body;

    // Get current password
    const [users] = await db.execute(
      'SELECT password FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, users[0].password);
    if (!isValidPassword) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    // Update password
    await db.execute(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, req.user.id]
    );
    
    // Detailed audit for password change
    await db.execute(
      `INSERT INTO audit_trail (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        'PASSWORD_CHANGE',
        'users',
        req.user.id,
        JSON.stringify({
          action: 'Password changed by user',
          previous_password_hash: '[REDACTED]'
        }),
        JSON.stringify({
          new_password_hash: '[REDACTED]',
          change_timestamp: new Date().toISOString(),
          initiated_by: 'user_self_service'
        }),
        req.ip,
        req.get('User-Agent')
      ]
    );

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
});

module.exports = router;