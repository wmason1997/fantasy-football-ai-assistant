import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { db } from '@fantasy-football/database';

/**
 * Global test setup for integration tests
 *
 * This file runs before all integration tests.
 * In CI, the database and migrations are handled by the workflow.
 * Locally, ensure DATABASE_URL is set and migrations are run before tests.
 */

beforeAll(async () => {
  // Use environment variables (CI provides these, locally use .env)
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required for integration tests');
  }

  // Set defaults for optional env vars if not provided
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

  console.log('Integration test setup starting...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^@]+@/, ':***@'));

  // Test database connection
  try {
    await db.$connect();
    console.log('Database connection successful');
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }

  console.log('Integration test setup complete.');
});

afterAll(async () => {
  console.log('Tearing down test database connection...');
  try {
    await db.$disconnect();
    console.log('Database disconnected successfully');
  } catch (error) {
    console.error('Error disconnecting database:', error);
  }
});

beforeEach(async () => {
  // Clear tables before each test to ensure isolation
  // Delete in order to respect foreign key constraints
  console.log('Clearing database tables...');
  const tables = [
    'injuryAlert', 'waiverRecommendation', 'tradeRecommendation',
    'opponentProfile', 'transaction', 'roster', 'league', 'user',
    'playerWeekStats', 'playerProjection', 'player'
  ];

  for (const table of tables) {
    try {
      // @ts-ignore - dynamic table access
      await db[table].deleteMany();
      console.log(`  Cleared ${table}`);
    } catch (error) {
      console.error(`  Error clearing ${table}:`, error);
      // Continue with other tables instead of failing immediately
    }
  }
  console.log('Database cleanup complete');
});

afterEach(async () => {
  // Cleanup after each test
});
