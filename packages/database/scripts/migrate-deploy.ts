#!/usr/bin/env ts-node

/**
 * Production Database Migration Script
 *
 * This script safely deploys database migrations to production.
 * It includes safety checks and verification steps.
 *
 * Usage:
 *   pnpm tsx packages/database/scripts/migrate-deploy.ts
 *
 * Environment Variables Required:
 *   DATABASE_URL - PostgreSQL connection string
 */

import { execSync } from 'child_process';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function checkDatabaseUrl(): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    log('❌ Error: DATABASE_URL environment variable is not set', 'red');
    log('Please set DATABASE_URL before running migrations.', 'yellow');
    log('Example: export DATABASE_URL="postgresql://user:password@host:port/database"', 'yellow');
    return false;
  }

  log('✓ DATABASE_URL is set', 'green');

  // Mask the password in the URL for logging
  const maskedUrl = process.env.DATABASE_URL.replace(
    /postgresql:\/\/([^:]+):([^@]+)@/,
    'postgresql://$1:****@'
  );
  log(`  Connection: ${maskedUrl}`, 'blue');

  return true;
}

async function checkMigrationStatus(): Promise<void> {
  log('\n📋 Checking current migration status...', 'yellow');

  try {
    execSync('npx prisma migrate status', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  } catch (error) {
    log('⚠️  Migration status check failed (this may be normal if no migrations exist yet)', 'yellow');
  }
}

async function confirmAction(message: string): Promise<boolean> {
  const answer = await prompt(`${message} (yes/no): `);
  return answer.toLowerCase() === 'yes';
}

async function runMigrations(): Promise<boolean> {
  log('\n🚀 Running database migrations...', 'yellow');

  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    log('\n✓ Migrations completed successfully!', 'green');
    return true;
  } catch (error) {
    log('\n❌ Migration failed!', 'red');
    log('Please review the error above and fix any issues.', 'yellow');
    return false;
  }
}

async function verifyMigrations(): Promise<void> {
  log('\n🔍 Verifying migration status...', 'yellow');

  try {
    execSync('npx prisma migrate status', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  } catch (error) {
    log('⚠️  Verification check completed with warnings', 'yellow');
  }
}

async function generatePrismaClient(): Promise<void> {
  const shouldGenerate = await confirmAction('\n🔧 Regenerate Prisma Client?');

  if (shouldGenerate) {
    log('\n📦 Generating Prisma Client...', 'yellow');

    try {
      execSync('npx prisma generate', {
        stdio: 'inherit',
        cwd: process.cwd(),
      });

      log('✓ Prisma Client generated successfully', 'green');
    } catch (error) {
      log('❌ Failed to generate Prisma Client', 'red');
    }
  }
}

async function main() {
  log('\n╔════════════════════════════════════════════╗', 'yellow');
  log('║  Production Database Migration Runner     ║', 'yellow');
  log('╚════════════════════════════════════════════╝', 'yellow');
  log('');

  // Step 1: Check DATABASE_URL
  const hasDbUrl = await checkDatabaseUrl();
  if (!hasDbUrl) {
    rl.close();
    process.exit(1);
  }

  // Step 2: Check current migration status
  await checkMigrationStatus();

  // Step 3: Confirm with user
  log('\n⚠️  WARNING: You are about to modify the production database schema', 'yellow');
  const shouldContinue = await confirmAction('\nAre you sure you want to continue?');

  if (!shouldContinue) {
    log('\n❌ Migration cancelled', 'red');
    rl.close();
    process.exit(0);
  }

  // Step 4: Backup confirmation
  log('\n⚠️  IMPORTANT: Ensure you have a recent database backup!', 'yellow');
  log('Railway provides automatic daily backups.', 'blue');
  log('Manual backup recommended for major schema changes.', 'blue');

  const hasBackup = await confirmAction('\nDo you have a recent backup?');

  if (!hasBackup) {
    log('\n❌ Please create a backup before proceeding.', 'red');
    log('Railway: Dashboard → Database → Backups → Create Backup', 'yellow');
    rl.close();
    process.exit(0);
  }

  // Step 5: Run migrations
  const success = await runMigrations();

  if (!success) {
    rl.close();
    process.exit(1);
  }

  // Step 6: Verify migrations
  await verifyMigrations();

  // Step 7: Generate Prisma Client (optional)
  await generatePrismaClient();

  // Success!
  log('\n╔════════════════════════════════════════════╗', 'green');
  log('║  Migration completed successfully!        ║', 'green');
  log('╚════════════════════════════════════════════╝', 'green');
  log('');
  log('Next steps:', 'yellow');
  log('1. Verify application is working correctly', 'blue');
  log('2. Monitor error logs for any issues', 'blue');
  log('3. Test critical user flows', 'blue');
  log('');

  rl.close();
  process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  log('\n❌ Unhandled error occurred:', 'red');
  console.error(error);
  rl.close();
  process.exit(1);
});

// Run the migration script
main().catch((error) => {
  log('\n❌ Migration script failed:', 'red');
  console.error(error);
  rl.close();
  process.exit(1);
});
