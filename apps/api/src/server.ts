import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { config } from './config';
import authPlugin from './plugins/auth';
import authRoutes from './routes/auth';
import leagueRoutes from './routes/leagues';
import playerRoutes from './routes/players';
import tradeRoutes from './routes/trades';
import waiverRoutes from './routes/waivers';
import injuryRoutes from './routes/injuries';
import { ZodError } from 'zod';
import { connectRedis, disconnectRedis, cacheService } from './services/cache';
import { schedulerService } from './services/scheduler';
import { injuryMonitorService } from './services/injuryMonitor';
import { db } from '@fantasy-football/database';

const server = Fastify({
  logger: {
    level: config.nodeEnv === 'development' ? 'info' : 'warn',
  },
});

// Decorate server with Prisma client
server.decorate('prisma', db);

// Register plugins
server.register(cors, {
  origin: config.frontendUrl,
  credentials: true,
});

server.register(jwt, {
  secret: config.jwtSecret,
});

server.register(rateLimit, {
  global: true,
  max: 100,
  timeWindow: '1 minute',
});

server.register(authPlugin);

// Error handler for Zod validation errors
server.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: 'Validation Error',
      details: error.errors,
    });
  }

  // Log error and send generic message
  server.log.error(error);
  return reply.status(error.statusCode || 500).send({
    error: error.message || 'Internal Server Error',
  });
});

// Health check endpoint
server.get('/health', async () => {
  const redisHealthy = await cacheService.healthCheck();
  return {
    status: redisHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    redis: redisHealthy ? 'connected' : 'disconnected',
  };
});

// Register routes
server.register(authRoutes, { prefix: '/auth' });
server.register(leagueRoutes, { prefix: '/leagues' });
server.register(playerRoutes, { prefix: '/players' });
server.register(tradeRoutes, { prefix: '/trades' });
server.register(waiverRoutes, { prefix: '/waivers' });
server.register(injuryRoutes, { prefix: '/injuries' });

const start = async () => {
  try {
    // Connect to Redis
    await connectRedis();
    console.log('✓ Redis connected');

    // Start scheduler service
    schedulerService.start();

    // Note: Injury monitor can be started via POST /injuries/start-monitoring
    // It only runs during game windows (Thu 6-11PM, Sun 12-11PM, Mon 6-11PM ET)
    // Uncomment to auto-start on server launch:
    // injuryMonitorService.start();

    // Start server
    await server.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`🚀 API server running on port ${config.port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  console.log('\nShutting down gracefully...');
  try {
    schedulerService.stop();
    injuryMonitorService.stop();
    await server.close();
    await disconnectRedis();
    console.log('✓ Server closed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
