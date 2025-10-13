const logger = require('../utils/logger');

// Request logging middleware
function requestLogger(req, res, next) {
    const startTime = Date.now();
    
    // Log incoming request
    logger.info(`Incoming ${req.method} ${req.originalUrl}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id || 'anonymous'
    });

    // Override res.end to capture response time
    const originalEnd = res.end;
    res.end = function(...args) {
        const responseTime = Date.now() - startTime;
        logger.logRequest(req, res, responseTime);
        originalEnd.apply(this, args);
    };

    next();
}

// Error logging middleware
function errorLogger(err, req, res, next) {
    logger.error(`Unhandled error in ${req.method} ${req.originalUrl}`, {
        error: err.message,
        stack: err.stack,
        ip: req.ip,
        userId: req.user?.id || 'anonymous'
    });
    next(err);
}

module.exports = {
    requestLogger,
    errorLogger
};