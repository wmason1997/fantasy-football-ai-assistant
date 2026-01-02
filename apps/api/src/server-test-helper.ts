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

  // Register plugins
  await server.register(cors, {
    origin: config.frontendUrl,
    credentials: true,
  });

  await server.register(jwt, {
    secret: config.jwtSecret,
  });

  await server.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
  });

  await server.register(authPlugin);

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

  return server;
}
