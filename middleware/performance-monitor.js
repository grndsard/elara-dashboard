const logger = require('../utils/logger');

// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();
  const correlationId = logger.addCorrelationId(req);
  
  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;
    
    // Log slow requests (>1000ms)
    if (responseTime > 1000) {
      logger.warn('Slow request detected', {
        correlationId,
        method: req.method,
        url: req.originalUrl,
        responseTime: `${responseTime}ms`,
        statusCode: res.statusCode,
        ip: req.ip
      });
    }
    
    // Log request details
    logger.logRequest(req, res, responseTime);
    
    // Call original end method
    originalEnd.apply(this, args);
  };
  
  next();
};

// Memory usage monitoring
const monitorMemoryUsage = () => {
  const usage = process.memoryUsage();
  const memoryMB = {
    rss: Math.round(usage.rss / 1024 / 1024),
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
    external: Math.round(usage.external / 1024 / 1024)
  };
  
  // Alert if memory usage is high
  if (memoryMB.heapUsed > 500) { // 500MB threshold
    logger.warn('High memory usage detected', {
      memory: memoryMB,
      uptime: process.uptime()
    });
  }
  
  return memoryMB;
};

// Start memory monitoring
setInterval(monitorMemoryUsage, 60000); // Check every minute

module.exports = {
  performanceMonitor,
  monitorMemoryUsage
};