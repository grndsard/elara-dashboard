const os = require('os');

class PerformanceMonitor {
  static getMemoryUsage() {
    const used = process.memoryUsage();
    const total = os.totalmem();
    const free = os.freemem();
    
    return {
      heap: {
        used: Math.round(used.heapUsed / 1024 / 1024 * 100) / 100,
        total: Math.round(used.heapTotal / 1024 / 1024 * 100) / 100
      },
      system: {
        used: Math.round((total - free) / 1024 / 1024 * 100) / 100,
        total: Math.round(total / 1024 / 1024 * 100) / 100,
        free: Math.round(free / 1024 / 1024 * 100) / 100
      }
    };
  }

  static logPerformance(operation, startTime, recordCount = 0) {
    const duration = Date.now() - startTime;
    const memory = this.getMemoryUsage();
    const rate = recordCount > 0 ? Math.round(recordCount / (duration / 1000)) : 0;
    
    console.log(`🚀 ${operation} Performance:`);
    console.log(`   Duration: ${duration}ms`);
    if (recordCount > 0) {
      console.log(`   Records: ${recordCount.toLocaleString()}`);
      console.log(`   Rate: ${rate.toLocaleString()} records/sec`);
    }
    console.log(`   Memory: ${memory.heap.used}MB heap, ${memory.system.used}MB system`);
  }

  static async measureAsync(operation, asyncFn, recordCount = 0) {
    const startTime = Date.now();
    const result = await asyncFn();
    this.logPerformance(operation, startTime, recordCount);
    return result;
  }
}

module.exports = PerformanceMonitor;