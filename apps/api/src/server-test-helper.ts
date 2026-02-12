import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import sensible from '@fastify/sensible';
import { ZodError } from 'zod';
import { config } from './config';
import authPlugin from './plugins/auth';
import authRoutes from './routes/auth';
import leagueRoutes from './routes/leagues';
import playerRoutes from './routes/players';
import tradeRoutes from './routes/trades';
import waiverRoutes from './routes/waivers';
import injuryRoutes from './routes/injuries';
import { db } from '@fantasy-football/database';

/**
 * Build a Fastify server instance for testing
 *
 * This helper creates a server instance without starting it,
 * which is useful for integration testing with server.inject()
 */
export async function build() {
  const server = Fastify({
    logger: false, // Disable logging in tests
  });

  // Decorate server with Prisma client
  server.decorate('prisma', db);

  // Register plugins (match production server.ts)
  await server.register(sensible);

  await server.register(cors, {
    origin: config.frontendUrl,
    credentials: true,
  });

  await server.register(jwt, {
    secret: config.jwtSecret,
  });

  await server.register(rateLimit, {
    global: true,
    max: 1000, // Higher limit for tests to avoid rate limiting across test runs
    timeWindow: '1 minute',
  });

  await server.register(authPlugin);

  // Error handler for Zod validation errors (match production server.ts)
  server.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: error.errors,
      });
    }

    return reply.status(error.statusCode || 500).send({
      error: error.message || 'Internal Server Error',
    });
  });

  // Health check endpoint
  server.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });

  // Register routes
  await server.register(authRoutes, { prefix: '/auth' });
  await server.register(leagueRoutes, { prefix: '/leagues' });
  await server.register(playerRoutes, { prefix: '/players' });
  await server.register(tradeRoutes, { prefix: '/trades' });
  await server.register(waiverRoutes, { prefix: '/waivers' });
  await server.register(injuryRoutes, { prefix: '/injuries' });

  // Ensure all plugins and routes are loaded
  await server.ready();

  return server;
}
