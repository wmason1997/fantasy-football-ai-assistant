import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { config } from './config';
import authPlugin from './plugins/auth';
import authRoutes from './routes/auth';
import leagueRoutes from './routes/leagues';
import { ZodError } from 'zod';

const server = Fastify({
  logger: {
    level: config.nodeEnv === 'development' ? 'info' : 'warn',
  },
});

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
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register routes
server.register(authRoutes, { prefix: '/auth' });
server.register(leagueRoutes, { prefix: '/leagues' });

const start = async () => {
  try {
    await server.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`🚀 API server running on port ${config.port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
