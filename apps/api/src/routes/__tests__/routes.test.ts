import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Mock database — prisma and db must be the same reference (as in the real module)
vi.mock('@fantasy-football/database', () => {
  const mockDb = {
    user: { findUnique: vi.fn(), create: vi.fn() },
    league: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    roster: { deleteMany: vi.fn(), create: vi.fn() },
    player: { findUnique: vi.fn(), findMany: vi.fn() },
    tradeRecommendation: { findMany: vi.fn(), findUnique: vi.fn() },
    waiverRecommendation: { findMany: vi.fn(), findUnique: vi.fn() },
    injuryAlert: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    transaction: { findFirst: vi.fn(), create: vi.fn() },
  };
  return { prisma: mockDb, db: mockDb };
});

// Mock external services
vi.mock('../../services/sleeper', () => ({
  sleeperService: {
    getLeague: vi.fn(),
    getRosters: vi.fn(),
    getLeagueUsers: vi.fn(),
    getUserByUsername: vi.fn(),
    getUserLeagues: vi.fn(),
    getMatchups: vi.fn(),
    getTransactions: vi.fn(),
    getPlayers: vi.fn(),
    getTrendingPlayers: vi.fn(),
    getNflState: vi.fn(),
  },
}));

vi.mock('../../services/tradeAnalyzer', () => ({
  tradeAnalyzerService: {
    generateTradePackages: vi.fn().mockResolvedValue([]),
    saveRecommendations: vi.fn(),
  },
}));

vi.mock('../../services/waiverOptimizer', () => ({
  waiverOptimizerService: {
    generateRecommendations: vi.fn().mockResolvedValue([]),
    saveRecommendations: vi.fn(),
  },
}));

vi.mock('../../services/opponentLearning', () => ({
  opponentLearningService: {
    initializeOpponentProfiles: vi.fn(),
    syncLeagueTransactions: vi.fn(),
  },
}));

vi.mock('../../services/injuryMonitor', () => ({
  injuryMonitorService: {
    startMonitoring: vi.fn(),
    stopMonitoring: vi.fn(),
    getStatus: vi.fn().mockReturnValue({
      isMonitoring: false,
      intervalMs: null,
      lastCheck: null,
    }),
    getUpcomingGames: vi.fn().mockResolvedValue([]),
    checkInjuries: vi.fn(),
  },
}));

vi.mock('../../services/sync', () => ({
  syncService: {
    initialLeagueSync: vi.fn(),
    syncLeagueData: vi.fn(),
    syncPlayers: vi.fn(),
  },
}));

vi.mock('../../services/scheduler', () => ({
  getCurrentWeekAndSeason: vi.fn().mockReturnValue({ week: 1, season: 2025 }),
}));

import { build } from '../../server-test-helper';
import { prisma } from '@fantasy-football/database';
import bcrypt from 'bcrypt';

// Use prisma (same as db via mock) for setting up test mocks
const db = prisma as any;

const TEST_USER = {
  id: 'test-user-id-123',
  email: 'test@example.com',
  password: '',
  name: 'Test User',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const TEST_LEAGUE_ID = '550e8400-e29b-41d4-a716-446655440000';

/**
 * Route-level tests covering auth middleware, input validation,
 * and error responses across critical API endpoints.
 */
describe('Route-Level Tests', () => {
  let server: FastifyInstance;
  let authToken: string;

  beforeAll(async () => {
    TEST_USER.password = await bcrypt.hash('testpassword123', 10);

    server = await build();

    // Mock user lookup for JWT verification
    db.user.findUnique.mockImplementation(({ where }: any) => {
      if (where.id === TEST_USER.id || where.email === TEST_USER.email) {
        return Promise.resolve(TEST_USER);
      }
      return Promise.resolve(null);
    });

    // Generate a real JWT token
    authToken = server.jwt.sign({ userId: TEST_USER.id, email: TEST_USER.email });
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish the user mock after clearAllMocks
    db.user.findUnique.mockImplementation(({ where }: any) => {
      if (where.id === TEST_USER.id || where.email === TEST_USER.email) {
        return Promise.resolve(TEST_USER);
      }
      return Promise.resolve(null);
    });
  });

  // ─── Health Check ───────────────────────────────────────────────

  describe('GET /health', () => {
    it('should return ok status', async () => {
      const res = await server.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
    });
  });

  // ─── Auth Middleware ────────────────────────────────────────────

  describe('Auth Middleware', () => {
    const protectedRoutes = [
      { method: 'GET' as const, url: '/leagues' },
      { method: 'GET' as const, url: `/leagues/${TEST_LEAGUE_ID}` },
      { method: 'POST' as const, url: '/leagues/connect' },
      { method: 'GET' as const, url: '/trades/recommendations' },
      { method: 'GET' as const, url: '/waivers/recommendations' },
      { method: 'GET' as const, url: '/injuries/alerts' },
    ];

    for (const route of protectedRoutes) {
      it(`should return 401 for ${route.method} ${route.url} without token`, async () => {
        const res = await server.inject({
          method: route.method,
          url: route.url,
        });
        expect(res.statusCode).toBe(401);
      });

      it(`should return 401 for ${route.method} ${route.url} with invalid token`, async () => {
        const res = await server.inject({
          method: route.method,
          url: route.url,
          headers: { authorization: 'Bearer invalid-token-abc' },
        });
        expect(res.statusCode).toBe(401);
      });
    }
  });

  // ─── League Routes ─────────────────────────────────────────────

  describe('League Routes', () => {
    it('GET /leagues should return user leagues', async () => {
      db.league.findMany.mockResolvedValue([
        {
          id: TEST_LEAGUE_ID,
          userId: TEST_USER.id,
          leagueName: 'Test League',
          platform: 'sleeper',
          rosters: [],
          createdAt: new Date(),
        },
      ]);

      const res = await server.inject({
        method: 'GET',
        url: '/leagues',
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.leagues).toHaveLength(1);
      expect(body.leagues[0].leagueName).toBe('Test League');
    });

    it('GET /leagues/:id should return 404 for non-existent league', async () => {
      db.league.findFirst.mockResolvedValue(null);

      const res = await server.inject({
        method: 'GET',
        url: `/leagues/${TEST_LEAGUE_ID}`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('POST /leagues/connect should reject invalid body', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/leagues/connect',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it('POST /leagues/search should reject missing username', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/leagues/search',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─── Trade Routes ──────────────────────────────────────────────

  describe('Trade Routes', () => {
    it('GET /trades/recommendations should return 400 without leagueId', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/trades/recommendations',
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.message || body.error).toContain('leagueId');
    });

    it('GET /trades/recommendations should return 404 for non-owned league', async () => {
      db.league.findFirst.mockResolvedValue(null);

      const res = await server.inject({
        method: 'GET',
        url: `/trades/recommendations?leagueId=${TEST_LEAGUE_ID}`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('GET /trades/recommendations should return recommendations for valid league', async () => {
      db.league.findFirst.mockResolvedValue({
        id: TEST_LEAGUE_ID,
        userId: TEST_USER.id,
      });
      db.tradeRecommendation.findMany.mockResolvedValue([
        { id: 'rec-1', leagueId: TEST_LEAGUE_ID, status: 'pending' },
      ]);

      const res = await server.inject({
        method: 'GET',
        url: `/trades/recommendations?leagueId=${TEST_LEAGUE_ID}`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.recommendations).toBeDefined();
    });

    it('POST /trades/evaluate should reject invalid body', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/trades/evaluate',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { leagueId: 'not-a-uuid' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('POST /trades/recommendations/generate should reject missing leagueId', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/trades/recommendations/generate',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─── Waiver Routes ─────────────────────────────────────────────

  describe('Waiver Routes', () => {
    it('GET /waivers/recommendations should return 400 without leagueId', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/waivers/recommendations',
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.message || body.error).toContain('leagueId');
    });

    it('GET /waivers/recommendations should return 404 for non-owned league', async () => {
      db.league.findFirst.mockResolvedValue(null);

      const res = await server.inject({
        method: 'GET',
        url: `/waivers/recommendations?leagueId=${TEST_LEAGUE_ID}`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('GET /waivers/recommendations should return data for valid league', async () => {
      db.league.findFirst.mockResolvedValue({
        id: TEST_LEAGUE_ID,
        userId: TEST_USER.id,
      });
      db.waiverRecommendation.findMany.mockResolvedValue([]);

      const res = await server.inject({
        method: 'GET',
        url: `/waivers/recommendations?leagueId=${TEST_LEAGUE_ID}`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.recommendations).toBeDefined();
    });

    it('POST /waivers/recommendations/generate should reject invalid leagueId', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/waivers/recommendations/generate',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { leagueId: 'not-a-uuid' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─── Injury Routes ─────────────────────────────────────────────

  describe('Injury Routes', () => {
    it('GET /injuries/alerts should work with valid leagueId', async () => {
      db.league.findFirst.mockResolvedValue({
        id: TEST_LEAGUE_ID,
        userId: TEST_USER.id,
      });
      db.injuryAlert.findMany.mockResolvedValue([]);
      db.injuryAlert.count.mockResolvedValue(0);

      const res = await server.inject({
        method: 'GET',
        url: `/injuries/alerts?leagueId=${TEST_LEAGUE_ID}`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
    });

    it('GET /injuries/monitoring-status should return status', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/injuries/monitoring-status',
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBeDefined();
      expect(body.status.isMonitoring).toBe(false);
    });
  });
});
