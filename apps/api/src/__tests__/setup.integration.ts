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

  console.log('Integration test setup complete. Using DATABASE_URL from environment.');
});

afterAll(async () => {
  // Cleanup: Drop test database after all tests
  console.log('Tearing down test database...');

  // Note: In production, you might want to keep the test DB for debugging
  // Uncomment to drop the test database:
  // execSync('psql -U dev_user -h localhost -c "DROP DATABASE IF EXISTS fantasy_football_test;"');
});

beforeEach(async () => {
  // Clear tables before each test to ensure isolation
  // Delete in order to respect foreign key constraints
  await db.injuryAlert.deleteMany();
  await db.waiverRecommendation.deleteMany();
  await db.tradeRecommendation.deleteMany();
  await db.opponentProfile.deleteMany();
  await db.transaction.deleteMany();
  await db.roster.deleteMany();
  await db.league.deleteMany();
  await db.user.deleteMany();
  await db.playerProjection.deleteMany();
  await db.player.deleteMany();
});

afterEach(async () => {
  // Cleanup after each test
});
