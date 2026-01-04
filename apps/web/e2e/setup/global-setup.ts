import { execSync } from 'child_process';
import bcrypt from 'bcrypt';
import { db } from '@fantasy-football/database';

async function globalSetup() {
  console.log('Setting up E2E test environment...');

  // Ensure the database is migrated
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://dev_user:dev_password@localhost:5432/fantasy_football_dev';

  // Create test user and test league in database
  try {
    // Clear existing test user and their leagues
    const existingUser = await db.user.findUnique({
      where: { email: 'test@example.com' },
      include: { leagues: true }
    });

    if (existingUser) {
      // Delete leagues first (due to foreign key constraints)
      await db.league.deleteMany({
        where: { userId: existingUser.id }
      });
      // Then delete user
      await db.user.delete({
        where: { id: existingUser.id }
      });
    }

    // Create test user
    const hashedPassword = await bcrypt.hash('testpassword123', 10);
    const user = await db.user.create({
      data: {
        email: 'test@example.com',
        password: hashedPassword,
        name: 'Test User',
      },
    });

    // Create a test league for the user
    await db.league.create({
      data: {
        userId: user.id,
        platform: 'sleeper',
        platformLeagueId: 'test_league_123',
        leagueName: 'Test League',
        teamName: 'Test Team',
        platformTeamId: 'test_team_123',
        scoringSettings: {
          scoringType: 'ppr',
          season: 2025,
        },
        rosterSettings: {
          totalTeams: 12,
        },
        faabBudget: 100,
        currentFaab: 100,
      },
    });

    console.log('Test user and test league created successfully');

    await db.$disconnect();
  } catch (error) {
    console.error('Error setting up test environment:', error);
  }
}

export default globalSetup;
