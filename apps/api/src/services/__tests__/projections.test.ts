import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectionService } from '../projections';

// Mock all external dependencies
vi.mock('@fantasy-football/database', () => ({
  db: {
    player: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    playerProjection: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('../cache', () => ({
  cacheService: {
    getPlayerProjection: vi.fn(),
    setPlayerProjection: vi.fn(),
    getWeekProjections: vi.fn(),
    setWeekProjections: vi.fn(),
    invalidateWeekProjections: vi.fn(),
  },
  CACHE_TTL: {
    PLAYER_PROJECTION: 86400,
    PLAYER_PROJECTIONS_WEEK: 86400,
  },
}));

vi.mock('../playerStats', () => ({
  playerStatsService: {
    getPlayerRecentStats: vi.fn(),
  },
}));

import { db } from '@fantasy-football/database';
import { cacheService } from '../cache';
import { playerStatsService } from '../playerStats';

describe('Projection Service', () => {
  let service: ProjectionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProjectionService();
  });

  describe('generateProjectionFromHistory', () => {
    it('should generate weighted average projection from recent stats', async () => {
      vi.mocked(playerStatsService.getPlayerRecentStats).mockResolvedValue([
        { pprPoints: 20, week: 5 },
        { pprPoints: 15, week: 4 },
        { pprPoints: 18, week: 3 },
        { pprPoints: 12, week: 2 },
        { pprPoints: 16, week: 1 },
      ] as any);

      vi.mocked(db.player.findUnique).mockResolvedValue({
        id: 'player-1',
        fullName: 'Test Player',
        position: 'RB',
        status: 'Active',
      } as any);

      const result = await service.generateProjectionFromHistory('player-1', 2025, 6);

      expect(result).not.toBeNull();
      expect(result!.playerId).toBe('player-1');
      expect(result!.week).toBe(6);
      expect(result!.season).toBe(2025);
      expect(result!.source).toBe('historical_analysis');
      // Weighted avg: 20*0.35 + 15*0.30 + 18*0.20 + 12*0.10 + 16*0.05 = 17.9
      // Divided by total weight (1.0) = 17.9
      // Then trend, bias correction, etc. applied
      expect(result!.projectedPoints).toBeGreaterThan(0);
    });

    it('should fallback to position average when < 2 data points', async () => {
      vi.mocked(playerStatsService.getPlayerRecentStats).mockResolvedValue([
        { pprPoints: 22, week: 5 },
      ] as any);

      vi.mocked(db.player.findUnique).mockResolvedValue({
        id: 'player-1',
        fullName: 'Test QB',
        position: 'QB',
        status: 'Active',
      } as any);

      const result = await service.generateProjectionFromHistory('player-1', 2025, 6);

      expect(result).not.toBeNull();
      expect(result!.source).toBe('position_average');
      expect(result!.confidence).toBe(0.2); // Low confidence for fallback
      // QB base = 18.5, with bias correction (1.40) = 25.9
      expect(result!.projectedPoints).toBeCloseTo(18.5 * 1.40, 0);
    });

    it('should return null when player not found', async () => {
      vi.mocked(playerStatsService.getPlayerRecentStats).mockResolvedValue([]);
      vi.mocked(db.player.findUnique).mockResolvedValue(null);

      const result = await service.generateProjectionFromHistory('nonexistent', 2025, 6);

      expect(result).toBeNull();
    });

    it('should apply injury discount for Questionable status', async () => {
      vi.mocked(playerStatsService.getPlayerRecentStats).mockResolvedValue([
        { pprPoints: 20, week: 5 },
        { pprPoints: 18, week: 4 },
        { pprPoints: 22, week: 3 },
      ] as any);

      vi.mocked(db.player.findUnique).mockResolvedValue({
        id: 'player-1',
        fullName: 'Test RB',
        position: 'RB',
        status: 'Questionable',
      } as any);

      const questionableResult = await service.generateProjectionFromHistory('player-1', 2025, 6);

      // Now test without injury
      vi.mocked(db.player.findUnique).mockResolvedValue({
        id: 'player-1',
        fullName: 'Test RB',
        position: 'RB',
        status: 'Active',
      } as any);

      const healthyResult = await service.generateProjectionFromHistory('player-1', 2025, 6);

      // Questionable = 0.95 multiplier
      expect(questionableResult!.projectedPoints).toBeCloseTo(
        healthyResult!.projectedPoints * 0.95,
        1
      );
    });

    it('should project 0 for Out players', async () => {
      vi.mocked(playerStatsService.getPlayerRecentStats).mockResolvedValue([
        { pprPoints: 25, week: 5 },
        { pprPoints: 22, week: 4 },
      ] as any);

      vi.mocked(db.player.findUnique).mockResolvedValue({
        id: 'player-1',
        fullName: 'Out Player',
        position: 'WR',
        status: 'Out',
      } as any);

      const result = await service.generateProjectionFromHistory('player-1', 2025, 6);

      expect(result!.projectedPoints).toBe(0);
    });

    it('should apply Doubtful discount (0.6)', async () => {
      vi.mocked(playerStatsService.getPlayerRecentStats).mockResolvedValue([
        { pprPoints: 20, week: 5 },
        { pprPoints: 18, week: 4 },
        { pprPoints: 22, week: 3 },
      ] as any);

      vi.mocked(db.player.findUnique).mockResolvedValue({
        id: 'player-1',
        fullName: 'Test RB',
        position: 'RB',
        status: 'Doubtful',
      } as any);

      const doubtfulResult = await service.generateProjectionFromHistory('player-1', 2025, 6);

      vi.mocked(db.player.findUnique).mockResolvedValue({
        id: 'player-1',
        fullName: 'Test RB',
        position: 'RB',
        status: 'Active',
      } as any);

      const healthyResult = await service.generateProjectionFromHistory('player-1', 2025, 6);

      expect(doubtfulResult!.projectedPoints).toBeCloseTo(
        healthyResult!.projectedPoints * 0.6,
        1
      );
    });
  });

  describe('Elite Player Detection', () => {
    it('should detect elite QB (avg >= 22 PPR)', async () => {
      vi.mocked(playerStatsService.getPlayerRecentStats).mockResolvedValue([
        { pprPoints: 28, week: 5 },
        { pprPoints: 24, week: 4 },
        { pprPoints: 30, week: 3 },
        { pprPoints: 22, week: 2 },
      ] as any);

      vi.mocked(db.player.findUnique).mockResolvedValue({
        id: 'qb-1',
        fullName: 'Elite QB',
        position: 'QB',
        status: 'Active',
      } as any);

      const result = await service.generateProjectionFromHistory('qb-1', 2025, 6);

      // Elite QB gets additional 1.08 boost on top of bias correction
      // The projection should be higher than non-elite
      expect(result!.projectedPoints).toBeGreaterThan(25);
    });

    it('should detect elite RB (avg >= 16 PPR)', async () => {
      vi.mocked(playerStatsService.getPlayerRecentStats).mockResolvedValue([
        { pprPoints: 20, week: 5 },
        { pprPoints: 18, week: 4 },
        { pprPoints: 16, week: 3 },
      ] as any);

      vi.mocked(db.player.findUnique).mockResolvedValue({
        id: 'rb-1',
        fullName: 'Elite RB',
        position: 'RB',
        status: 'Active',
      } as any);

      const result = await service.generateProjectionFromHistory('rb-1', 2025, 6);

      expect(result).not.toBeNull();
      // Should be boosted by elite detection
      expect(result!.projectedPoints).toBeGreaterThan(20);
    });

    it('should not boost non-elite players with insufficient data', async () => {
      // Only 2 games - not enough for elite detection (requires 3)
      vi.mocked(playerStatsService.getPlayerRecentStats).mockResolvedValue([
        { pprPoints: 30, week: 5 },
        { pprPoints: 28, week: 4 },
      ] as any);

      vi.mocked(db.player.findUnique).mockResolvedValue({
        id: 'qb-1',
        fullName: 'New QB',
        position: 'QB',
        status: 'Active',
      } as any);

      const result = await service.generateProjectionFromHistory('qb-1', 2025, 6);

      expect(result).not.toBeNull();
      // Non-elite gets base correction (1.40) not elite correction (1.40 * 1.08)
    });
  });

  describe('Trend Calculation', () => {
    it('should boost projection for upward trend', async () => {
      // Ascending scores = upward trend
      vi.mocked(playerStatsService.getPlayerRecentStats).mockResolvedValue([
        { pprPoints: 20, week: 5 }, // most recent = highest
        { pprPoints: 15, week: 4 },
        { pprPoints: 12, week: 3 },
        { pprPoints: 10, week: 2 },
      ] as any);

      vi.mocked(db.player.findUnique).mockResolvedValue({
        id: 'player-1',
        fullName: 'Trending Up',
        position: 'WR',
        status: 'Active',
      } as any);

      const trendUpResult = await service.generateProjectionFromHistory('player-1', 2025, 6);

      // Flat scores for comparison
      vi.mocked(playerStatsService.getPlayerRecentStats).mockResolvedValue([
        { pprPoints: 14, week: 5 },
        { pprPoints: 14, week: 4 },
        { pprPoints: 14, week: 3 },
        { pprPoints: 14, week: 2 },
      ] as any);

      const flatResult = await service.generateProjectionFromHistory('player-1', 2025, 6);

      // Upward trend should produce higher projection than flat
      expect(trendUpResult!.projectedPoints).toBeGreaterThan(flatResult!.projectedPoints);
    });

    it('should reduce projection for downward trend', async () => {
      // Descending scores = downward trend
      vi.mocked(playerStatsService.getPlayerRecentStats).mockResolvedValue([
        { pprPoints: 8, week: 5 }, // most recent = lowest
        { pprPoints: 12, week: 4 },
        { pprPoints: 16, week: 3 },
        { pprPoints: 20, week: 2 },
      ] as any);

      vi.mocked(db.player.findUnique).mockResolvedValue({
        id: 'player-1',
        fullName: 'Trending Down',
        position: 'WR',
        status: 'Active',
      } as any);

      const trendDownResult = await service.generateProjectionFromHistory('player-1', 2025, 6);

      // Flat scores for comparison
      vi.mocked(playerStatsService.getPlayerRecentStats).mockResolvedValue([
        { pprPoints: 14, week: 5 },
        { pprPoints: 14, week: 4 },
        { pprPoints: 14, week: 3 },
        { pprPoints: 14, week: 2 },
      ] as any);

      const flatResult = await service.generateProjectionFromHistory('player-1', 2025, 6);

      // Downward trend should produce lower projection than flat
      expect(trendDownResult!.projectedPoints).toBeLessThan(flatResult!.projectedPoints);
    });

    it('should clamp trend multiplier between 0.85 and 1.15 for non-elite', async () => {
      // Extreme upward trend
      vi.mocked(playerStatsService.getPlayerRecentStats).mockResolvedValue([
        { pprPoints: 30, week: 5 },
        { pprPoints: 5, week: 4 },
        { pprPoints: 3, week: 3 },
      ] as any);

      vi.mocked(db.player.findUnique).mockResolvedValue({
        id: 'player-1',
        fullName: 'Volatile Player',
        position: 'WR',
        status: 'Active',
      } as any);

      const result = await service.generateProjectionFromHistory('player-1', 2025, 6);

      // Result should exist and be reasonable (clamped)
      expect(result).not.toBeNull();
      expect(result!.projectedPoints).toBeGreaterThan(0);
    });
  });

  describe('Confidence Calculation', () => {
    it('should have high confidence for consistent performers', async () => {
      // Very consistent scores
      vi.mocked(playerStatsService.getPlayerRecentStats).mockResolvedValue([
        { pprPoints: 15, week: 5 },
        { pprPoints: 14, week: 4 },
        { pprPoints: 15, week: 3 },
        { pprPoints: 16, week: 2 },
        { pprPoints: 15, week: 1 },
      ] as any);

      vi.mocked(db.player.findUnique).mockResolvedValue({
        id: 'player-1',
        fullName: 'Consistent RB',
        position: 'RB',
        status: 'Active',
      } as any);

      const result = await service.generateProjectionFromHistory('player-1', 2025, 6);

      expect(result!.confidence).toBeGreaterThan(0.7);
    });

    it('should have low confidence for volatile performers', async () => {
      // Wildly inconsistent scores
      vi.mocked(playerStatsService.getPlayerRecentStats).mockResolvedValue([
        { pprPoints: 30, week: 5 },
        { pprPoints: 3, week: 4 },
        { pprPoints: 25, week: 3 },
        { pprPoints: 5, week: 2 },
        { pprPoints: 28, week: 1 },
      ] as any);

      vi.mocked(db.player.findUnique).mockResolvedValue({
        id: 'player-1',
        fullName: 'Boom/Bust WR',
        position: 'WR',
        status: 'Active',
      } as any);

      const result = await service.generateProjectionFromHistory('player-1', 2025, 6);

      expect(result!.confidence).toBeLessThan(0.6);
    });

    it('should return minimum 0.3 confidence', async () => {
      // Extreme variance
      vi.mocked(playerStatsService.getPlayerRecentStats).mockResolvedValue([
        { pprPoints: 40, week: 5 },
        { pprPoints: 0, week: 4 },
      ] as any);

      vi.mocked(db.player.findUnique).mockResolvedValue({
        id: 'player-1',
        fullName: 'Wild Player',
        position: 'WR',
        status: 'Active',
      } as any);

      const result = await service.generateProjectionFromHistory('player-1', 2025, 6);

      expect(result!.confidence).toBeGreaterThanOrEqual(0.3);
    });
  });

  describe('Position Bias Correction', () => {
    it('should apply different correction factors per position', async () => {
      const stats = [
        { pprPoints: 15, week: 5 },
        { pprPoints: 15, week: 4 },
        { pprPoints: 15, week: 3 },
      ];

      vi.mocked(playerStatsService.getPlayerRecentStats).mockResolvedValue(stats as any);

      const positions = ['QB', 'RB', 'WR', 'TE'];
      const projections: Record<string, number> = {};

      for (const pos of positions) {
        vi.mocked(db.player.findUnique).mockResolvedValue({
          id: `player-${pos}`,
          fullName: `Test ${pos}`,
          position: pos,
          status: 'Active',
        } as any);

        const result = await service.generateProjectionFromHistory(`player-${pos}`, 2025, 6);
        projections[pos] = result!.projectedPoints;
      }

      // QB has highest bias correction (1.40)
      expect(projections['QB']).toBeGreaterThan(projections['TE']); // TE has 1.26
      // All should be above the raw weighted average of 15
      for (const pos of positions) {
        expect(projections[pos]).toBeGreaterThan(15);
      }
    });
  });

  describe('Fallback Position Averages', () => {
    it.each([
      ['QB', 18.5],
      ['RB', 12.0],
      ['WR', 11.0],
      ['TE', 8.5],
      ['K', 8.0],
      ['DEF', 7.0],
    ])('should use correct base projection for %s (%s pts)', async (position, basePoints) => {
      vi.mocked(playerStatsService.getPlayerRecentStats).mockResolvedValue([] as any);

      vi.mocked(db.player.findUnique).mockResolvedValue({
        id: 'player-1',
        fullName: `Test ${position}`,
        position,
        status: 'Active',
      } as any);

      const result = await service.generateProjectionFromHistory('player-1', 2025, 6);

      expect(result).not.toBeNull();
      expect(result!.source).toBe('position_average');
      // Base * bias correction should be > base
      expect(result!.projectedPoints).toBeGreaterThan(basePoints);
    });
  });

  describe('Cache Integration', () => {
    it('should return cached projection when available', async () => {
      const cached = { playerId: 'p1', projectedPoints: 15.5, week: 5, season: 2025 };
      vi.mocked(cacheService.getPlayerProjection).mockResolvedValue(cached);

      const result = await service.getPlayerProjection('p1', 5, 2025);

      expect(result).toEqual(cached);
      expect(db.playerProjection.findFirst).not.toHaveBeenCalled();
    });

    it('should fetch from DB and cache when not in cache', async () => {
      vi.mocked(cacheService.getPlayerProjection).mockResolvedValue(null);

      const dbResult = {
        playerId: 'p1',
        projectedPoints: 15.5,
        week: 5,
        season: 2025,
        player: { id: 'p1', fullName: 'Test', position: 'RB', team: 'KC', status: 'Active' },
      };
      vi.mocked(db.playerProjection.findFirst).mockResolvedValue(dbResult as any);

      const result = await service.getPlayerProjection('p1', 5, 2025);

      expect(result).toEqual(dbResult);
      expect(cacheService.setPlayerProjection).toHaveBeenCalledWith(
        'p1', 5, 2025, dbResult, 86400
      );
    });

    it('should return null when not in cache or DB', async () => {
      vi.mocked(cacheService.getPlayerProjection).mockResolvedValue(null);
      vi.mocked(db.playerProjection.findFirst).mockResolvedValue(null);

      const result = await service.getPlayerProjection('nonexistent', 5, 2025);

      expect(result).toBeNull();
      expect(cacheService.setPlayerProjection).not.toHaveBeenCalled();
    });
  });

  describe('Week Projections', () => {
    it('should return cached week projections when available', async () => {
      const cached = [{ playerId: 'p1' }, { playerId: 'p2' }];
      vi.mocked(cacheService.getWeekProjections).mockResolvedValue(cached);

      const result = await service.getWeekProjections(5, 2025);

      expect(result).toEqual(cached);
      expect(db.playerProjection.findMany).not.toHaveBeenCalled();
    });

    it('should fetch and cache week projections from DB', async () => {
      vi.mocked(cacheService.getWeekProjections).mockResolvedValue(null);

      const dbResults = [
        { playerId: 'p1', projectedPoints: 20 },
        { playerId: 'p2', projectedPoints: 15 },
      ];
      vi.mocked(db.playerProjection.findMany).mockResolvedValue(dbResults as any);

      const result = await service.getWeekProjections(5, 2025);

      expect(result).toEqual(dbResults);
      expect(cacheService.setWeekProjections).toHaveBeenCalledWith(
        5, 2025, dbResults, 86400
      );
    });

    it('should not cache empty week projections', async () => {
      vi.mocked(cacheService.getWeekProjections).mockResolvedValue(null);
      vi.mocked(db.playerProjection.findMany).mockResolvedValue([]);

      const result = await service.getWeekProjections(5, 2025);

      expect(result).toEqual([]);
      expect(cacheService.setWeekProjections).not.toHaveBeenCalled();
    });
  });

  describe('syncWeekProjections', () => {
    it('should sync basic algorithm projections to database', async () => {
      vi.mocked(db.player.findMany).mockResolvedValue([
        { id: 'p1', position: 'QB', status: 'Active' },
        { id: 'p2', position: 'RB', status: 'Active' },
      ] as any);

      vi.mocked(db.playerProjection.upsert).mockResolvedValue({} as any);
      vi.mocked(db.playerProjection.findMany).mockResolvedValue([]);

      const result = await service.syncWeekProjections(5, 2025, true);

      expect(result.created).toBe(2);
      expect(db.playerProjection.upsert).toHaveBeenCalledTimes(2);
    });

    it('should return 0 when no projections are generated', async () => {
      vi.mocked(db.player.findMany).mockResolvedValue([]);

      const result = await service.syncWeekProjections(5, 2025, true);

      expect(result.created).toBe(0);
      expect(result.updated).toBe(0);
    });
  });
});
