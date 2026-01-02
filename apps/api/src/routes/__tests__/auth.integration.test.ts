import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { build } from '../../server-test-helper';
import type { FastifyInstance } from 'fastify';
import { db } from '@fantasy-football/database';
import bcrypt from 'bcrypt';

/**
 * Integration tests for Auth endpoints
 *
 * Tests the complete authentication flow with real database interactions
 */

describe('Auth API Integration Tests', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    // Build a test server instance
    server = await build();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'newuser@test.com',
          password: 'securepassword123',
          name: 'New User',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe('newuser@test.com');
      expect(body.user.name).toBe('New User');
      expect(body.token).toBeDefined();
      expect(body.user.password).toBeUndefined(); // Password should not be returned
    });

    it('should reject duplicate email registration', async () => {
      // First registration
      await server.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'duplicate@test.com',
          password: 'password123',
          name: 'User One',
        },
      });

      // Attempt duplicate registration
      const response = await server.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'duplicate@test.com',
          password: 'differentpassword',
          name: 'User Two',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('User already exists');
    });

    it('should reject weak passwords (< 8 characters)', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'weakpass@test.com',
          password: 'weak',
          name: 'Weak Pass User',
        },
      });

      expect(response.statusCode).toBe(400);
      // Zod validation error
    });

    it('should reject invalid email format', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email: 'not-an-email',
          password: 'password123',
          name: 'Invalid Email',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should enforce rate limiting (max 5 requests per minute)', async () => {
      // Make 6 registration attempts
      const promises = Array.from({ length: 6 }, (_, i) =>
        server.inject({
          method: 'POST',
          url: '/auth/register',
          payload: {
            email: `ratelimit${i}@test.com`,
            password: 'password123',
            name: `User ${i}`,
          },
        })
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponse = responses.find((r) => r.statusCode === 429);
      expect(rateLimitedResponse).toBeDefined();
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Create a user directly in the database for login tests
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      await db.user.create({
        data: {
          email: 'logintest@test.com',
          password: hashedPassword,
          name: 'Login Test User',
        },
      });
    });

    it('should login with correct credentials', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'logintest@test.com',
          password: 'correctpassword',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.user).toBeDefined();
      expect(body.token).toBeDefined();
      expect(body.user.email).toBe('logintest@test.com');
    });

    it('should reject login with incorrect password', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'logintest@test.com',
          password: 'wrongpassword',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid credentials');
    });

    it('should reject login with non-existent email', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'nonexistent@test.com',
          password: 'anypassword',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid credentials');
    });

    it('should return valid JWT token', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'logintest@test.com',
          password: 'correctpassword',
        },
      });

      const body = JSON.parse(response.body);
      const token = body.token;

      // Verify token can be used for authenticated requests
      const authResponse = await server.inject({
        method: 'GET',
        url: '/leagues',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(authResponse.statusCode).toBe(200);
    });
  });
});
