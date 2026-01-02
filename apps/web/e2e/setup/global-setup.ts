import { execSync } from 'child_process';
import bcrypt from 'bcrypt';
import { db } from '@fantasy-football/database';

async function globalSetup() {
  console.log('Setting up E2E test environment...');

  // Ensure the database is migrated
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://dev_user:dev_password@localhost:5432/fantasy_football_dev';

  // Create test user in database
  try {
    // Clear existing test user
    await db.user.deleteMany({
      where: { email: 'test@example.com' }
    });

    // Create test user
    const hashedPassword = await bcrypt.hash('testpassword123', 10);
    await db.user.create({
      data: {
        email: 'test@example.com',
        password: hashedPassword,
        name: 'Test User',
      },
    });

    console.log('Test user created successfully');

    await db.$disconnect();
  } catch (error) {
    console.error('Error setting up test user:', error);
  }
}

export default globalSetup;
