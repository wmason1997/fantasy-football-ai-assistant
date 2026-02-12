import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WaiverOptimizerService } from '../waiverOptimizer';

// Mock all external dependencies
vi.mock('@fantasy-football/database', () => ({
  db: {
    player: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    league: {
      findUnique: vi.fn(),
    },
    roster: {
      findMany: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
    },
    waiverRecommendation: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../projections', () => ({
  projectionService: {
    getPlayerProjection: vi.fn(),
  },
}));

vi.mock('../sleeper', () => ({
  sleeperService: {
    getRosters: vi.fn(),
  },
}));

vi.mock('../cache', () => ({
  cacheService: {
    get: vi.fn(),
    set: vi.fn(),
  },
  CACHE_TTL: { PROJECTIONS: 86400 },
}));

import { db } from '@fantasy-football/database';
import { projectionService } from '../projections';

describe('Waiver Optimizer', () => {
  let optimizer: WaiverOptimizerService;

  beforeEach(() => {
    vi.clearAllMocks();
    optimizer = new WaiverOptimizerService();
  });

  describe('FAAB Bid Calculation', () => {
    it('should calculate bid using the FAAB formula from CLAUDE.md', async () => {
      // Setup: league with 100 FAAB, no historical bids (defaults to 5)
      vi.mocked(db.league.findUnique).mockResolvedValue({
        id: 'league-1',
        currentFaab: 100,
      } as any);

      vi.mocked(db.transaction.findMany).mockResolvedValue([]);

      const result = await optimizer.calculateFAABBid(
        'league-1',
        'player-1',
        0.6,   // opportunityScore
        0.5,   // positionalNeed
        10,    // addTrendPercentage (< 20, no urgency)
        2025,
        5
      );

      // baseBid = 5 (default median)
      // baseBid *= (1 + 0.6 * 0.5) = 5 * 1.3 = 6.5
      // baseBid *= (1 + 0.5 * 0.3) = 6.5 * 1.15 = 7.475
      // No urgency (addTrend < 20)
      // maxBid = min(7.475, 100 * 0.4) = min(7.475, 40) = 7.475
      // recommendedBid = round(7.475) = 7

      expect(result.recommendedBid).toBe(7);
      expect(result.minBid).toBe(4); // round(7 * 0.5) = 4
      expect(result.maxBid).toBe(7);
      expect(result.medianHistoricalBid).toBe(5);
    });

    it('should apply urgency multiplier when add trend > 20%', async () => {
      vi.mocked(db.league.findUnique).mockResolvedValue({
        id: 'league-1',
        currentFaab: 100,
      } as any);

      vi.mocked(db.transaction.findMany).mockResolvedValue([]);

      const result = await optimizer.calculateFAABBid(
        'league-1',
        'player-1',
        0.6,   // opportunityScore
        0.5,   // positionalNeed
        25,    // addTrendPercentage (> 20, triggers urgency)
        2025,
        5
      );

      // baseBid = 5 * 1.3 * 1.15 = 7.475
      // Urgency: 7.475 * 1.2 = 8.97
      // maxBid = min(8.97, 40) = 8.97
      // recommendedBid = round(8.97) = 9

      expect(result.recommendedBid).toBe(9);
    });

    it('should never recommend more than 40% of remaining budget', async () => {
      // Low FAAB budget remaining
      vi.mocked(db.league.findUnique).mockResolvedValue({
        id: 'league-1',
        currentFaab: 10,
      } as any);

      vi.mocked(db.transaction.findMany).mockResolvedValue([]);

      const result = await optimizer.calculateFAABBid(
        'league-1',
        'player-1',
        0.9,   // High opportunity
        0.9,   // High need
        30,    // High urgency
        2025,
        5
      );

      // baseBid = 5 * 1.45 * 1.27 * 1.2 = 11.05
      // maxBid = min(11.05, 10 * 0.4) = min(11.05, 4) = 4

      expect(result.recommendedBid).toBeLessThanOrEqual(4);
      expect(result.maxBid).toBeLessThanOrEqual(4);
    });

    it('should recommend at least 1 for the bid', async () => {
      vi.mocked(db.league.findUnique).mockResolvedValue({
        id: 'league-1',
        currentFaab: 100,
      } as any);

      vi.mocked(db.transaction.findMany).mockResolvedValue([]);

      const result = await optimizer.calculateFAABBid(
        'league-1',
        'player-1',
        0.0,   // No opportunity
        0.0,   // No need
        0,     // No trend
        2025,
        5
      );

      // Even with low scores, minimum bid should be 1
      expect(result.recommendedBid).toBeGreaterThanOrEqual(1);
    });

    it('should use median of historical bids when available', async () => {
      vi.mocked(db.league.findUnique).mockResolvedValue({
        id: 'league-1',
        currentFaab: 100,
      } as any);

      // Historical waiver transactions with FAAB bids
      vi.mocked(db.transaction.findMany).mockResolvedValue([
        { transactionType: 'waiver', playersMoved: {}, metadata: { settings: { waiver_bid: 8 } } },
        { transactionType: 'waiver', playersMoved: {}, metadata: { settings: { waiver_bid: 12 } } },
        { transactionType: 'waiver', playersMoved: {}, metadata: { settings: { waiver_bid: 15 } } },
        { transactionType: 'waiver', playersMoved: {}, metadata: { settings: { waiver_bid: 6 } } },
        { transactionType: 'waiver', playersMoved: {}, metadata: { settings: { waiver_bid: 10 } } },
      ] as any);

      const result = await optimizer.calculateFAABBid(
        'league-1',
        'player-1',
        0.5,
        0.5,
        10,
        2025,
        5
      );

      // Sorted bids: [6, 8, 10, 12, 15] → median = 10
      expect(result.medianHistoricalBid).toBe(10);
    });
  });

  describe('Positional Need Assessment', () => {
    it('should identify critical need when not enough starters', async () => {
      // Roster with 0 QBs → critical need
      vi.mocked(db.roster.findMany).mockResolvedValue([
        { playerId: 'p1', player: { position: 'RB' } },
        { playerId: 'p2', player: { position: 'WR' } },
      ] as any);

      vi.mocked(db.league.findUnique).mockResolvedValue({
        id: 'league-1',
      } as any);

      vi.mocked(projectionService.getPlayerProjection).mockResolvedValue({
        projectedPoints: 10,
      } as any);

      const needs = await optimizer.analyzePositionalNeeds('league-1', 2025, 5);

      const qbNeed = needs.get('QB');
      expect(qbNeed).toBeDefined();
      expect(qbNeed!.needScore).toBe(1.0); // Critical: 0 players < 1 required
      expect(qbNeed!.currentStarters).toBe(0);
    });

    it('should identify high need when no bench depth', async () => {
      // Exactly 1 QB (minimum required) → high need, no depth
      vi.mocked(db.roster.findMany).mockResolvedValue([
        { playerId: 'p1', player: { position: 'QB' } },
        { playerId: 'p2', player: { position: 'RB' } },
        { playerId: 'p3', player: { position: 'RB' } },
        { playerId: 'p4', player: { position: 'WR' } },
        { playerId: 'p5', player: { position: 'WR' } },
        { playerId: 'p6', player: { position: 'TE' } },
      ] as any);

      vi.mocked(db.league.findUnique).mockResolvedValue({
        id: 'league-1',
      } as any);

      vi.mocked(projectionService.getPlayerProjection).mockResolvedValue({
        projectedPoints: 15,
      } as any);

      const needs = await optimizer.analyzePositionalNeeds('league-1', 2025, 5);

      const qbNeed = needs.get('QB');
      expect(qbNeed).toBeDefined();
      expect(qbNeed!.needScore).toBe(0.8); // High need: exactly at required count
      expect(qbNeed!.benchDepth).toBe(0);
    });

    it('should report low need when position is well-stocked', async () => {
      // 4 RBs when only 2 required → adequate depth
      vi.mocked(db.roster.findMany).mockResolvedValue([
        { playerId: 'p1', player: { position: 'RB' } },
        { playerId: 'p2', player: { position: 'RB' } },
        { playerId: 'p3', player: { position: 'RB' } },
        { playerId: 'p4', player: { position: 'RB' } },
      ] as any);

      vi.mocked(db.league.findUnique).mockResolvedValue({
        id: 'league-1',
      } as any);

      vi.mocked(projectionService.getPlayerProjection).mockResolvedValue({
        projectedPoints: 15,
      } as any);

      const needs = await optimizer.analyzePositionalNeeds('league-1', 2025, 5);

      const rbNeed = needs.get('RB');
      expect(rbNeed).toBeDefined();
      expect(rbNeed!.needScore).toBe(0.2); // Adequate depth
      expect(rbNeed!.benchDepth).toBe(2); // 4 total - 2 required
    });
  });
});
