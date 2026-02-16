import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

const isProduction = process.env.NODE_ENV === 'production';

// Validate required env vars in production
if (isProduction) {
  const required = ['JWT_SECRET', 'DATABASE_URL', 'REDIS_URL'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables in production: ${missing.join(', ')}`
    );
  }
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-do-not-use-in-prod',
  sleeperApiBaseUrl: process.env.SLEEPER_API_BASE_URL || 'https://api.sleeper.app/v1',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
};
