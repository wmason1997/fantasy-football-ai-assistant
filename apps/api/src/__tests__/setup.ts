import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

/**
 * Global test setup for unit tests
 *
 * This file runs before all unit tests
 */

beforeAll(async () => {
  // Setup that runs once before all tests
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key';
});

afterAll(async () => {
  // Cleanup that runs once after all tests
});

beforeEach(() => {
  // Setup that runs before each test
});

afterEach(() => {
  // Cleanup that runs after each test
});
