// Test setup file
require('dotenv').config({ path: '.env.test' });

// Mock database for tests
jest.mock('../config/database', () => ({
  execute: jest.fn(),
  query: jest.fn()
}));

// Global test timeout
jest.setTimeout(10000);