import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '@fantasy-football/database';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export default async function authRoutes(fastify: FastifyInstance) {
  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

  // Register new user
  fastify.post('/register', {
    config: {
      rateLimit: isDev ? {
        max: 1000,
        timeWindow: '1 minute',
      } : {
        max: 5,
        timeWindow: '1 minute',
      },
    },
    handler: async (request, reply) => {
      try {
        const body = registerSchema.parse(request.body);

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: body.email },
        });

        if (existingUser) {
          return reply.status(400).send({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(body.password, 10);

        // Create user
        const user = await prisma.user.create({
          data: {
            email: body.email,
            password: hashedPassword,
            name: body.name,
          },
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
          },
        });

        // Generate JWT
        const token = fastify.jwt.sign({
          userId: user.id,
          email: user.email,
        });

        return { user, token };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation failed',
            details: error.errors
          });
        }
        throw error;
      }
    },
  });

  // Login
  fastify.post('/login', {
    config: {
      rateLimit: isDev ? {
        max: 1000,
        timeWindow: '1 minute',
      } : {
        max: 5,
        timeWindow: '1 minute',
      },
    },
    handler: async (request, reply) => {
      try {
        const body = loginSchema.parse(request.body);

        // Find user
        const user = await prisma.user.findUnique({
          where: { email: body.email },
        });

        if (!user) {
          return reply.status(401).send({ error: 'Invalid credentials' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(body.password, user.password);

        if (!validPassword) {
          return reply.status(401).send({ error: 'Invalid credentials' });
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });

        // Generate JWT
        const token = fastify.jwt.sign({
          userId: user.id,
          email: user.email,
        });

        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          token,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation failed',
            details: error.errors
          });
        }
        throw error;
      }
    },
  });

  // Get current user (protected route)
  fastify.get('/me', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      const userId = (request.user as { userId: string; email: string }).userId;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          notificationPreferences: true,
        },
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return { user };
    },
  });
}
