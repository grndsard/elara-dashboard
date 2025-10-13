const os = require('os');

class MemoryProcessor {
  constructor() {
    this.maxMemoryUsage = 0.8; // 80% of available memory
    this.chunkSize = 10000; // Default chunk size
  }

  getAvailableMemory() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const availableForProcessing = totalMem * this.maxMemoryUsage - usedMem;
    
    return {
      total: totalMem,
      free: freeMem,
      used: usedMem,
      available: Math.max(0, availableForProcessing)
    };
  }

  calculateOptimalChunkSize(dataSize, recordCount) {
    const memory = this.getAvailableMemory();
    const avgRecordSize = dataSize / recordCount;
    const maxRecords = Math.floor(memory.available / (avgRecordSize * 2)); // 2x buffer
    
    return Math.min(Math.max(1000, maxRecords), 50000); // Between 1K-50K records
  }

  async processInMemoryChunks(data, processor, options = {}) {
    const chunkSize = options.chunkSize || this.calculateOptimalChunkSize(
      JSON.stringify(data).length, 
      data.length
    );
    
    const results = [];
    
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const result = await processor(chunk, i, chunkSize);
      results.push(result);
      
      // Force garbage collection if available
      if (global.gc) global.gc();
    }
    
    return results;
  }

  monitorMemoryUsage() {
    const usage = process.memoryUsage();
    const system = this.getAvailableMemory();
    
    return {
      heap: {
        used: Math.round(usage.heapUsed / 1024 / 1024),
        total: Math.round(usage.heapTotal / 1024 / 1024)
      },
      system: {
        used: Math.round(system.used / 1024 / 1024),
        available: Math.round(system.available / 1024 / 1024)
      }
    };
  }
}

module.exports = new MemoryProcessor();