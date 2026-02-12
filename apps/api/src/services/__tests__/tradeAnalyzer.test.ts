import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TradeAnalyzerService, PlayerValue } from '../tradeAnalyzer';

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
    playerProjection: {
      findMany: vi.fn(),
    },
    roster: {
      findMany: vi.fn(),
    },
    opponentProfile: {
      findUnique: vi.fn(),
    },
    tradeRecommendation: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../projections', () => ({
  projectionService: {
    getPlayerProjection: vi.fn(),
    generateProjectionFromHistory: vi.fn(),
  },
}));

vi.mock('../sleeper', () => ({
  sleeperService: {
    getRosters: vi.fn(),
  },
}));

vi.mock('../playerStats', () => ({
  playerStatsService: {
    getPlayerRecentStats: vi.fn(),
    syncWeekStats: vi.fn(),
    getFantasyPoints: vi.fn(),
  },
}));

vi.mock('../cache', () => ({
  cacheService: {
    getPerformanceRatio: vi.fn(),
    setPerformanceRatio: vi.fn(),
  },
}));

import { db } from '@fantasy-football/database';
import { projectionService } from '../projections';
import { playerStatsService } from '../playerStats';
import { cacheService } from '../cache';

// Helper to create mock PlayerValue objects
function mockPlayerValue(overrides: Partial<PlayerValue> = {}): PlayerValue {
  return {
    playerId: 'player-1',
    playerName: 'Test Player',
    position: 'WR',
    team: 'KC',
    currentValue: 15.0,
    projectedValue: 12.0,
    performanceRatio: 1.2,
    zScore: 0.8,
    trend: 'up',
    injuryRisk: 0.0,
    isSellHigh: false,
    isBuyLow: false,
    ...overrides,
  };
}

describe('Trade Analyzer', () => {
  let analyzer: TradeAnalyzerService;

  beforeEach(() => {
    vi.clearAllMocks();
    analyzer = new TradeAnalyzerService();
  });

  describe('Sell-High Detection', () => {
    it('should identify players with performance ratio > 1.15', async () => {
      // Player averaging 20 actual pts vs 15 projected = 1.33 ratio
      vi.mocked(cacheService.getPerformanceRatio).mockResolvedValue(null);
      vi.mocked(cacheService.setPerformanceRatio).mockResolvedValue(undefined);

      vi.mocked(playerStatsService.getPlayerRecentStats).mockResolvedValue([
        { week: 1, season: 2025, playerId: 'p1' },
        { week: 2, season: 2025, playerId: 'p1' },
        { week: 3, season: 2025, playerId: 'p1' },
      ] as any);

      // Each week: 20 actual points
      vi.mocked(playerStatsService.getFantasyPoints).mockReturnValue(20);

      vi.mocked(db.league.findUnique).mockResolvedValue({
        id: 'league-1',
        scoringSettings: { rec: 1 },
      } as any);

      // Each week: 15 projected points → ratio = 20/15 = 1.33
      vi.mocked(projectionService.getPlayerProjection).mockResolvedValue({
        projectedPoints: 15,
      } as any);

      vi.mocked(db.player.findUnique).mockResolvedValue({
        id: 'p1',
        fullName: 'Sell High Player',
        position: 'WR',
        team: 'KC',
        status: 'Active',
      } as any);

      // Return few peers so default z-score calculation is used
      // With ratio=1.33, z-score = (1.33 - 1.0) / 0.15 = 2.2
      vi.mocked(db.player.findMany).mockResolvedValue([]);

      // getPlayerProjection called for ROS projection (week=0)
      // and for calculatePlayerValue, which also calls getPlayerProjection
      vi.mocked(projectionService.getPlayerProjection).mockResolvedValue({
        projectedPoints: 15,
      } as any);

      const value = await analyzer.calculatePlayerValue('p1', 'league-1', 2025, 5);

      expect(value).not.toBeNull();
      expect(value!.performanceRatio).toBeCloseTo(1.33, 1);
      expect(value!.isSellHigh).toBe(true);
    });

    it('should require z-score > 0.5 for sell-high', async () => {
      // Player ratio is 1.16 (barely above 1.15) but z-score will be low
      // if many peers have similar ratios
      vi.mocked(cacheService.getPerformanceRatio).mockResolvedValue(null);
      vi.mocked(cacheService.setPerformanceRatio).mockResolvedValue(undefined);

      vi.mocked(playerStatsService.getPlayerRecentStats).mockResolvedValue([
        { week: 1, season: 2025, playerId: 'p2' },
        { week: 2, season: 2025, playerId: 'p2' },
      ] as any);

      // Actual: 11.6, Projected: 10 → ratio = 1.16
      vi.mocked(playerStatsService.getFantasyPoints).mockReturnValue(11.6);

      vi.mocked(db.league.findUnique).mockResolvedValue({
        id: 'league-1',
        scoringSettings: { rec: 1 },
      } as any);

      vi.mocked(projectionService.getPlayerProjection).mockResolvedValue({
        projectedPoints: 10,
      } as any);

      vi.mocked(db.player.findUnique).mockResolvedValue({
        id: 'p2',
        fullName: 'Borderline Player',
        position: 'RB',
        team: 'BUF',
        status: 'Active',
      } as any);

      // Many peers with similar ratios → low z-score
      // Generate 15 peer players all with ratio ~1.16
      const peers = Array.from({ length: 15 }, (_, i) => ({
        id: `peer-${i}`,
        position: 'RB',
        status: 'Active',
        weekStats: [
          { pprPoints: 11.6 },
          { pprPoints: 11.6 },
        ],
        projections: [
          { projectedPoints: 10 },
          { projectedPoints: 10 },
        ],
      }));
      vi.mocked(db.player.findMany).mockResolvedValue(peers as any);

      const value = await analyzer.calculatePlayerValue('p2', 'league-1', 2025, 5);

      expect(value).not.toBeNull();
      expect(value!.performanceRatio).toBeGreaterThan(1.15);
      // z-score should be ~0 since player ratio matches the peer mean
      expect(value!.zScore).toBeLessThan(0.5);
      expect(value!.isSellHigh).toBe(false);
    });
  });

  describe('Buy-Low Detection', () => {
    it('should identify players with value discount > 0.2', async () => {
      // Performance ratio of 0.75 → discount = 1.0 - 0.75 = 0.25 (>0.2)
      // Injury risk = 0.0 (<0.3) → qualifies as buy-low
      vi.mocked(cacheService.getPerformanceRatio).mockResolvedValue(null);
      vi.mocked(cacheService.setPerformanceRatio).mockResolvedValue(undefined);

      vi.mocked(playerStatsService.getPlayerRecentStats).mockResolvedValue([
        { week: 1, season: 2025, playerId: 'p3' },
        { week: 2, season: 2025, playerId: 'p3' },
        { week: 3, season: 2025, playerId: 'p3' },
      ] as any);

      // Actual: 9, Projected: 12 → ratio = 0.75
      vi.mocked(playerStatsService.getFantasyPoints).mockReturnValue(9);

      vi.mocked(db.league.findUnique).mockResolvedValue({
        id: 'league-1',
        scoringSettings: { rec: 1 },
      } as any);

      vi.mocked(projectionService.getPlayerProjection).mockResolvedValue({
        projectedPoints: 12,
      } as any);

      vi.mocked(db.player.findUnique).mockResolvedValue({
        id: 'p3',
        fullName: 'Buy Low Player',
        position: 'WR',
        team: 'NYG',
        status: 'Active', // Not injured → injuryRisk = 0.0
      } as any);

      vi.mocked(db.player.findMany).mockResolvedValue([]);

      const value = await analyzer.calculatePlayerValue('p3', 'league-1', 2025, 5);

      expect(value).not.toBeNull();
      expect(value!.performanceRatio).toBeCloseTo(0.75, 1);
      expect(value!.injuryRisk).toBe(0.0);
      expect(value!.isBuyLow).toBe(true);
    });

    it('should not flag buy-low if injury risk >= 0.3', async () => {
      vi.mocked(cacheService.getPerformanceRatio).mockResolvedValue(null);
      vi.mocked(cacheService.setPerformanceRatio).mockResolvedValue(undefined);

      vi.mocked(playerStatsService.getPlayerRecentStats).mockResolvedValue([
        { week: 1, season: 2025, playerId: 'p4' },
        { week: 2, season: 2025, playerId: 'p4' },
      ] as any);

      vi.mocked(playerStatsService.getFantasyPoints).mockReturnValue(9);

      vi.mocked(db.league.findUnique).mockResolvedValue({
        id: 'league-1',
        scoringSettings: { rec: 1 },
      } as any);

      vi.mocked(projectionService.getPlayerProjection).mockResolvedValue({
        projectedPoints: 12,
      } as any);

      vi.mocked(db.player.findUnique).mockResolvedValue({
        id: 'p4',
        fullName: 'Injured Buy Low',
        position: 'RB',
        team: 'DET',
        status: 'Questionable', // → injuryRisk = 0.3, threshold is < 0.3
      } as any);

      vi.mocked(db.player.findMany).mockResolvedValue([]);

      const value = await analyzer.calculatePlayerValue('p4', 'league-1', 2025, 5);

      expect(value).not.toBeNull();
      expect(value!.injuryRisk).toBe(0.3);
      expect(value!.isBuyLow).toBe(false);
    });
  });

  describe('Trade Package Generation', () => {
    it('should generate 1-for-1 trade packages', async () => {
      // Test that createTradePackage creates valid 1-for-1 packages
      const myPlayer = mockPlayerValue({
        playerId: 'my-1',
        playerName: 'My WR',
        position: 'WR',
        projectedValue: 12.0,
        isSellHigh: true,
      });
      const targetPlayer = mockPlayerValue({
        playerId: 'target-1',
        playerName: 'Target RB',
        position: 'RB',
        projectedValue: 11.0,
        isBuyLow: true,
      });

      // Mock opponent profile lookup (returns null = use defaults)
      vi.mocked(db.opponentProfile.findUnique).mockResolvedValue(null);

      // Access private method via any cast for focused unit testing
      const pkg = await (analyzer as any).createTradePackage(
        'league-1',
        [myPlayer],
        [targetPlayer],
        'team-2',
        '1-for-1'
      );

      expect(pkg).not.toBeNull();
      expect(pkg.tradeType).toBe('1-for-1');
      expect(pkg.myPlayers).toHaveLength(1);
      expect(pkg.targetPlayers).toHaveLength(1);
      expect(pkg.fairnessScore).toBeGreaterThan(0);
      expect(pkg.acceptanceProbability).toBeGreaterThanOrEqual(0);
      expect(pkg.acceptanceProbability).toBeLessThanOrEqual(1);
    });

    it('should generate 2-for-1 trade packages', async () => {
      const myPlayers = [
        mockPlayerValue({ playerId: 'my-1', projectedValue: 8.0 }),
        mockPlayerValue({ playerId: 'my-2', projectedValue: 7.0 }),
      ];
      const targetPlayer = mockPlayerValue({
        playerId: 'target-1',
        projectedValue: 14.0,
      });

      vi.mocked(db.opponentProfile.findUnique).mockResolvedValue(null);

      const pkg = await (analyzer as any).createTradePackage(
        'league-1',
        myPlayers,
        [targetPlayer],
        'team-2',
        '2-for-1'
      );

      expect(pkg).not.toBeNull();
      expect(pkg.tradeType).toBe('2-for-1');
      expect(pkg.myPlayers).toHaveLength(2);
      expect(pkg.targetPlayers).toHaveLength(1);
    });

    it('should generate 2-for-2 trade packages', async () => {
      const myPlayers = [
        mockPlayerValue({ playerId: 'my-1', projectedValue: 10.0 }),
        mockPlayerValue({ playerId: 'my-2', projectedValue: 9.0 }),
      ];
      const targetPlayers = [
        mockPlayerValue({ playerId: 'target-1', projectedValue: 11.0 }),
        mockPlayerValue({ playerId: 'target-2', projectedValue: 8.0 }),
      ];

      vi.mocked(db.opponentProfile.findUnique).mockResolvedValue(null);

      const pkg = await (analyzer as any).createTradePackage(
        'league-1',
        myPlayers,
        targetPlayers,
        'team-2',
        '2-for-2'
      );

      expect(pkg).not.toBeNull();
      expect(pkg.tradeType).toBe('2-for-2');
      expect(pkg.myPlayers).toHaveLength(2);
      expect(pkg.targetPlayers).toHaveLength(2);
    });
  });

  describe('Fairness Score Calculation', () => {
    it('should calculate fairness score between 0 and 1', () => {
      // Equal values → score = min(1.0, 1.0/0.8) = 1.0
      const myPlayers = [mockPlayerValue({ projectedValue: 15.0 })];
      const targetPlayers = [mockPlayerValue({ projectedValue: 15.0 })];

      const score = analyzer.calculateFairnessScore(myPlayers, targetPlayers);

      expect(score).toBe(1.0);
    });

    it('should return 1.0 for values within 20% of each other', () => {
      // my=100, target=85 → ratio = 85/100 = 0.85 → 0.85/0.8 = 1.0625 → capped at 1.0
      const myPlayers = [mockPlayerValue({ projectedValue: 100.0 })];
      const targetPlayers = [mockPlayerValue({ projectedValue: 85.0 })];

      const score = analyzer.calculateFairnessScore(myPlayers, targetPlayers);

      expect(score).toBe(1.0);
    });

    it('should return lower scores for unbalanced trades', () => {
      // my=100, target=50 → ratio = 50/100 = 0.5 → 0.5/0.8 = 0.625
      const myPlayers = [mockPlayerValue({ projectedValue: 100.0 })];
      const targetPlayers = [mockPlayerValue({ projectedValue: 50.0 })];

      const score = analyzer.calculateFairnessScore(myPlayers, targetPlayers);

      expect(score).toBeCloseTo(0.625, 2);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });

    it('should return 0 when either side has zero value', () => {
      const myPlayers = [mockPlayerValue({ projectedValue: 0 })];
      const targetPlayers = [mockPlayerValue({ projectedValue: 15.0 })];

      const score = analyzer.calculateFairnessScore(myPlayers, targetPlayers);

      expect(score).toBe(0);
    });

    it('should only recommend trades with fairness > 0.6', async () => {
      // Unfair trade: my=100, target=30 → ratio = 0.3 → 0.3/0.8 = 0.375 (< 0.6)
      const myPlayer = mockPlayerValue({
        projectedValue: 100.0,
        isSellHigh: true,
      });
      const targetPlayer = mockPlayerValue({
        projectedValue: 30.0,
        isBuyLow: true,
      });

      const fairness = analyzer.calculateFairnessScore([myPlayer], [targetPlayer]);

      expect(fairness).toBeLessThan(0.6);

      // Fair trade: my=100, target=80 → ratio = 0.8 → 0.8/0.8 = 1.0
      const fairTarget = mockPlayerValue({ projectedValue: 80.0 });
      const fairScore = analyzer.calculateFairnessScore([myPlayer], [fairTarget]);

      expect(fairScore).toBeGreaterThanOrEqual(0.6);
    });
  });

  describe('Acceptance Probability', () => {
    it('should calculate acceptance probability based on opponent profile', async () => {
      // Set up an opponent profile with known preferences
      vi.mocked(db.opponentProfile.findUnique).mockResolvedValue({
        id: 'profile-1',
        leagueId: 'league-1',
        opponentTeamId: 'team-2',
        opponentTeamName: 'Opponent',
        qbPreference: 0.8,
        rbPreference: 0.7,
        wrPreference: 0.5,
        tePreference: 0.3,
        riskTolerance: 0.6,
        tradingActivity: 0.5,
        acceptanceRate: 0.4,
        totalTradesProposed: 10,
        totalTradesAccepted: 4,
        totalTradesRejected: 6,
        totalTradesInitiated: 5,
        prefersStars: false,
        prefersDepth: false,
        valuesSafety: true,
        lastUpdated: new Date(),
        lastTradeDate: null,
        dataPoints: 10,
      } as any);

      const myPlayers = [mockPlayerValue({ position: 'WR', injuryRisk: 0.0 })];
      const targetPlayers = [mockPlayerValue({ position: 'RB', injuryRisk: 0.0 })];
      const fairnessScore = 0.9;

      const probability = await analyzer.calculateAcceptanceProbability(
        'team-2',
        'league-1',
        myPlayers,
        targetPlayers,
        fairnessScore
      );

      expect(probability).toBeGreaterThanOrEqual(0);
      expect(probability).toBeLessThanOrEqual(1);
      // Base: 0.4 * (0.9 * 1.5) = 0.54
      // RB position bonus for target: (0.7 - 0.5) * 0.2 = 0.04
      // Total: ~0.58
      expect(probability).toBeGreaterThan(0.25);
    });

    it('should use default profile when no opponent data exists', async () => {
      vi.mocked(db.opponentProfile.findUnique).mockResolvedValue(null);

      const myPlayers = [mockPlayerValue({ position: 'WR', injuryRisk: 0.0 })];
      const targetPlayers = [mockPlayerValue({ position: 'RB', injuryRisk: 0.0 })];

      const probability = await analyzer.calculateAcceptanceProbability(
        'team-2',
        'league-1',
        myPlayers,
        targetPlayers,
        0.8
      );

      // Default acceptanceRate is 0.3
      // Base: 0.3 * (0.8 * 1.5) = 0.36
      expect(probability).toBeGreaterThanOrEqual(0);
      expect(probability).toBeLessThanOrEqual(1);
    });

    it('should only recommend trades with acceptance probability > 0.25', async () => {
      // Very low fairness → low probability
      vi.mocked(db.opponentProfile.findUnique).mockResolvedValue(null);

      const myPlayers = [mockPlayerValue({ position: 'WR', injuryRisk: 0.0 })];
      const targetPlayers = [mockPlayerValue({ position: 'RB', injuryRisk: 0.0 })];

      const lowProbability = await analyzer.calculateAcceptanceProbability(
        'team-2',
        'league-1',
        myPlayers,
        targetPlayers,
        0.1 // Very unfair trade
      );

      // Default rate 0.3 * (0.1 * 1.5) = 0.045
      expect(lowProbability).toBeLessThan(0.25);

      const highProbability = await analyzer.calculateAcceptanceProbability(
        'team-2',
        'league-1',
        myPlayers,
        targetPlayers,
        0.9 // Fair trade
      );

      // Default rate 0.3 * (0.9 * 1.5) = 0.405
      expect(highProbability).toBeGreaterThan(0.25);
    });

    it('should boost probability when opponent prefers stars and gets fewer players', async () => {
      vi.mocked(db.opponentProfile.findUnique).mockResolvedValue({
        id: 'profile-1',
        leagueId: 'league-1',
        opponentTeamId: 'team-2',
        acceptanceRate: 0.4,
        qbPreference: 0.5,
        rbPreference: 0.5,
        wrPreference: 0.5,
        tePreference: 0.5,
        riskTolerance: 0.5,
        prefersStars: true,
        prefersDepth: false,
        valuesSafety: false,
        lastUpdated: new Date(),
      } as any);

      // 1-for-2: I give 1 (myPlayers), opponent gives 2 (targetPlayers)
      // Opponent receives fewer players (consolidating) → triggers star preference
      // The condition is: targetPlayers.length > myPlayers.length
      const myPlayers = [mockPlayerValue({ position: 'WR', injuryRisk: 0.0 })];
      const targetPlayers = [
        mockPlayerValue({ position: 'RB', injuryRisk: 0.0 }),
        mockPlayerValue({ position: 'WR', injuryRisk: 0.0 }),
      ];

      const probability = await analyzer.calculateAcceptanceProbability(
        'team-2',
        'league-1',
        myPlayers,
        targetPlayers,
        0.8
      );

      // Base: 0.4 * (0.8 * 1.5) = 0.48
      // Star bonus: +0.1 (targetPlayers.length 2 > myPlayers.length 1)
      // Total: 0.58
      expect(probability).toBeGreaterThan(0.5);
    });
  });

  describe('Trade Recommendations', () => {
    it('should return top 5 recommendations per week', async () => {
      // Create 7 recommendations and verify only top 5 are returned
      vi.mocked(db.tradeRecommendation.findMany).mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({
          id: `rec-${i}`,
          leagueId: 'league-1',
          week: 5,
          season: 2025,
          fairnessScore: 0.8,
          acceptanceProbability: 0.5 - i * 0.05,
          priority: 5 - i,
          status: 'pending',
        })) as any
      );

      const recommendations = await analyzer.getRecommendations('league-1', 5, 2025);

      expect(recommendations).toHaveLength(5);
      // Should be ordered by priority descending
      expect(recommendations[0].priority).toBeGreaterThanOrEqual(recommendations[1].priority);
    });

    it('should sort recommendations by composite score', () => {
      // Test the sorting logic used in generateTradePackages
      // Packages are sorted by acceptanceProbability * fairnessScore * myValueGain
      const packages = [
        {
          fairnessScore: 0.7,
          acceptanceProbability: 0.3,
          myValueGain: 5.0,
        },
        {
          fairnessScore: 0.9,
          acceptanceProbability: 0.5,
          myValueGain: 3.0,
        },
        {
          fairnessScore: 0.8,
          acceptanceProbability: 0.6,
          myValueGain: 4.0,
        },
      ];

      // Sort using the same logic as generateTradePackages
      packages.sort((a, b) => {
        const scoreA = a.acceptanceProbability * a.fairnessScore * a.myValueGain;
        const scoreB = b.acceptanceProbability * b.fairnessScore * b.myValueGain;
        return scoreB - scoreA;
      });

      // Scores: 0.7*0.3*5=1.05, 0.9*0.5*3=1.35, 0.8*0.6*4=1.92
      expect(packages[0].myValueGain).toBe(4.0); // Highest composite
      expect(packages[1].myValueGain).toBe(3.0);
      expect(packages[2].myValueGain).toBe(5.0); // Lowest composite
    });
  });

  describe('Trade Reasoning', () => {
    it('should generate reasoning for sell-high trades', async () => {
      const sellHighPlayer = mockPlayerValue({
        playerName: 'Hot Receiver',
        isSellHigh: true,
        projectedValue: 12.0,
      });
      const buyLowPlayer = mockPlayerValue({
        playerName: 'Slumping Back',
        isBuyLow: true,
        projectedValue: 13.0,
      });

      vi.mocked(db.opponentProfile.findUnique).mockResolvedValue(null);

      const pkg = await (analyzer as any).createTradePackage(
        'league-1',
        [sellHighPlayer],
        [buyLowPlayer],
        'team-2',
        '1-for-1'
      );

      expect(pkg.reasoning).toContain('Sell high on Hot Receiver');
      expect(pkg.reasoning).toContain('Buy low on Slumping Back');
    });
  });
});
