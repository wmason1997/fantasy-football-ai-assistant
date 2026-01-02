import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { db } from '@fantasy-football/database';

/**
 * Global test setup for integration tests
 *
 * This file runs before all integration tests and sets up a test database
 */

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ||
  'postgresql://dev_user:dev_password@localhost:5432/fantasy_football_test';

beforeAll(async () => {
  // Set environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.REDIS_URL = 'redis://localhost:6379';

  console.log('Setting up test database...');

  // Create test database if it doesn't exist
  try {
    execSync('psql -U dev_user -h localhost -c "CREATE DATABASE fantasy_football_test;"', {
      stdio: 'ignore',
    });
  } catch (error) {
    // Database might already exist, ignore error
  }

  // Run migrations
  try {
    execSync('pnpm --filter database migrate', {
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('Migration failed:', error);
  }
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
