const memoryProcessor = require('../utils/memory-processor');
const parallelProcessor = require('../utils/parallel-processor');

describe('Memory Processor', () => {
  test('should calculate available memory', () => {
    const memory = memoryProcessor.getAvailableMemory();
    expect(memory).toHaveProperty('total');
    expect(memory).toHaveProperty('free');
    expect(memory).toHaveProperty('used');
    expect(memory).toHaveProperty('available');
  });

  test('should calculate optimal chunk size', () => {
    const chunkSize = memoryProcessor.calculateOptimalChunkSize(1000000, 10000);
    expect(chunkSize).toBeGreaterThan(0);
    expect(chunkSize).toBeLessThanOrEqual(50000);
  });
});

describe('Parallel Processor', () => {
  test('should get worker stats', () => {
    const stats = parallelProcessor.getWorkerStats();
    expect(stats).toHaveProperty('maxWorkers');
    expect(stats).toHaveProperty('activeWorkers');
    expect(stats).toHaveProperty('cpuCount');
  });

  test('should create chunks correctly', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const chunks = parallelProcessor.createChunks(data, 3);
    expect(chunks).toHaveLength(4);
    expect(chunks[0]).toEqual([1, 2, 3]);
    expect(chunks[3]).toEqual([10]);
  });
});