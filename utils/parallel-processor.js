const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');

class ParallelProcessor {
  constructor() {
    this.maxWorkers = Math.min(os.cpus().length, 4); // Max 4 workers
    this.activeWorkers = new Set();
  }

  async processInParallel(data, processorFunction, options = {}) {
    const { chunkSize = 5000, maxWorkers = this.maxWorkers } = options;
    const chunks = this.createChunks(data, chunkSize);
    const workers = Math.min(maxWorkers, chunks.length);
    
    const results = [];
    const workerPromises = [];
    
    for (let i = 0; i < workers; i++) {
      const workerChunks = chunks.filter((_, index) => index % workers === i);
      if (workerChunks.length > 0) {
        const promise = this.createWorker(workerChunks, processorFunction);
        workerPromises.push(promise);
      }
    }
    
    const workerResults = await Promise.all(workerPromises);
    return workerResults.flat();
  }

  createChunks(data, chunkSize) {
    const chunks = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }
    return chunks;
  }

  async createWorker(chunks, processorFunction) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: { chunks, processorFunction: processorFunction.toString() }
      });
      
      this.activeWorkers.add(worker);
      
      worker.on('message', (result) => {
        this.activeWorkers.delete(worker);
        resolve(result);
      });
      
      worker.on('error', (error) => {
        this.activeWorkers.delete(worker);
        reject(error);
      });
      
      worker.on('exit', (code) => {
        this.activeWorkers.delete(worker);
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  }

  async terminateAllWorkers() {
    const terminationPromises = Array.from(this.activeWorkers).map(worker => 
      worker.terminate()
    );
    await Promise.all(terminationPromises);
    this.activeWorkers.clear();
  }

  getWorkerStats() {
    return {
      maxWorkers: this.maxWorkers,
      activeWorkers: this.activeWorkers.size,
      cpuCount: os.cpus().length
    };
  }
}

// Worker thread execution
if (!isMainThread) {
  const { chunks, processorFunction } = workerData;
  
  try {
    // Reconstruct function from string
    const processor = eval(`(${processorFunction})`);
    const results = [];
    
    for (const chunk of chunks) {
      const result = processor(chunk);
      results.push(result);
    }
    
    parentPort.postMessage(results);
  } catch (error) {
    parentPort.postMessage({ error: error.message });
  }
}

module.exports = new ParallelProcessor();