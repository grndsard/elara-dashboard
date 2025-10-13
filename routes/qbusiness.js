const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');
const qBusinessService = require('../utils/qbusiness-client');

const router = express.Router();

// Amazon Q Business query endpoint
router.post('/query', [
  authenticateToken,
  auditMiddleware('Q_BUSINESS_QUERY', null)
], async (req, res) => {
  try {
    const { query, conversationId } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, message: 'Query is required' });
    }

    // Check if Q Business is configured
    if (!await qBusinessService.isConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Amazon Q Business is not configured. Please contact your administrator.'
      });
    }

    // Send query to Q Business
    const result = await qBusinessService.query(query, req.user.id, conversationId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({
        success: false,
        message: result.message || 'Failed to process query'
      });
    }
  } catch (error) {
    console.error('Q Business query error:', error);
    res.status(500).json({ success: false, message: 'Failed to process query' });
  }
});

// Get Q Business configuration for embedding
router.get('/config', authenticateToken, async (req, res) => {
  try {
    // Test Q Business connection
    const connectionTest = await qBusinessService.testConnection();
    
    if (!connectionTest.success) {
      return res.json({
        success: true,
        data: {
          configured: false,
          message: `Amazon Q Business configuration error: ${connectionTest.message}`
        }
      });
    }

    // Check embed URL configuration
    if (!process.env.Q_BUSINESS_EMBED_URL || !process.env.Q_BUSINESS_EMBED_URL.startsWith('https://')) {
      return res.json({
        success: true,
        data: {
          configured: false,
          useApi: true,
          message: 'Embed URL not configured. Using API mode for Q Business integration.'
        }
      });
    }

    // Generate embed URL with user context
    const embedUrl = `${process.env.Q_BUSINESS_EMBED_URL}?applicationId=${process.env.Q_BUSINESS_APPLICATION_ID}&userId=${req.user.id}&userEmail=${req.user.email}`;

    res.json({
      success: true,
      data: {
        configured: true,
        embedUrl: embedUrl,
        applicationId: process.env.Q_BUSINESS_APPLICATION_ID,
        region: process.env.AWS_REGION,
        useApi: false
      }
    });
  } catch (error) {
    console.error('Q Business config error:', error);
    res.status(500).json({ success: false, message: 'Failed to get Q Business configuration' });
  }
});

// Get Q Business status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const connectionTest = await qBusinessService.testConnection();
    
    res.json({
      success: true,
      data: {
        configured: connectionTest.success,
        status: connectionTest.success ? 'ready' : 'error',
        message: connectionTest.message
      }
    });
  } catch (error) {
    console.error('Q Business status error:', error);
    res.status(500).json({ success: false, message: 'Failed to check Q Business status' });
  }
});

// Sync data to Q Business
router.post('/sync-data', [
  authenticateToken,
  auditMiddleware('Q_BUSINESS_SYNC', null)
], async (req, res) => {
  try {
    if (!await qBusinessService.isConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Amazon Q Business is not configured'
      });
    }

    const result = await qBusinessService.syncDataToQBusiness();
    res.json(result);
  } catch (error) {
    console.error('Q Business sync error:', error);
    res.status(500).json({ success: false, message: 'Failed to sync data' });
  }
});

module.exports = router;