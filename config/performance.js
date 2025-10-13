// Performance optimization configuration
module.exports = {
  // Upload timeouts (in milliseconds)
  timeouts: {
    sheetReading: 10000,      // 10 seconds (reduced from 30s)
    fileProcessing: 30000,    // 30 seconds (reduced from 60s)
    pythonService: 120000,    // 2 minutes (reduced from 5m)
    healthCheck: 3000         // 3 seconds
  },
  
  // Batch processing sizes
  batchSizes: {
    database: {
      small: 10000,           // < 50k records (increased from 2.5k)
      medium: 15000,          // 50k-100k records
      large: 25000            // > 100k records (increased from 10k)
    },
    memory: {
      chunkSize: 1024 * 1024, // 1MB chunks for file reading
      maxMemory: 512 * 1024 * 1024 // 512MB max memory usage
    }
  },
  
  // Connection pooling
  database: {
    connectionLimit: 20,      // Increased from 15
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true,
    idleTimeout: 300000
  },
  
  // File processing optimizations
  fileProcessing: {
    enableParallelProcessing: true,
    maxConcurrentUploads: 3,
    enableMemoryOptimization: true,
    enableProgressiveLoading: true
  },
  
  // Performance monitoring
  monitoring: {
    enableMetrics: true,
    logSlowQueries: true,
    slowQueryThreshold: 5000, // 5 seconds
    enablePerformanceLogging: true
  }
};