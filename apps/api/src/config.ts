import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-me',
  sleeperApiBaseUrl: process.env.SLEEPER_API_BASE_URL || 'https://api.sleeper.app/v1',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
};
