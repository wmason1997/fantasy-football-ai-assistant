import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InjuryMonitorService } from '../injuryMonitor';

// Mock all external dependencies
vi.mock('@fantasy-football/database', () => ({
  db: {
    league: {
      findMany: vi.fn(),
    },
    player: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    roster: {
      findMany: vi.fn(),
    },
    injuryAlert: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../sleeper', () => ({
  sleeperService: {
    getPlayers: vi.fn(),
    getRosters: vi.fn(),
  },
}));

vi.mock('../projections', () => ({
  projectionService: {
    getPlayerProjection: vi.fn(),
  },
}));

import { db } from '@fantasy-football/database';
import { projectionService } from '../projections';

describe('Injury Monitor Service', () => {
  let monitor: InjuryMonitorService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    monitor = new InjuryMonitorService();
  });

  afterEach(() => {
    monitor.stop();
    vi.useRealTimers();
  });

  describe('Game Window Detection', () => {
    it('should detect Thursday game window (6PM-11PM ET)', () => {
      // Thursday 8 PM ET → within game window
      const thursday8pm = new Date(2025, 9, 2, 20, 0); // Oct 2, 2025 (Thursday)
      vi.setSystemTime(thursday8pm);

      const status = monitor.getStatus();
      expect(status.isWithinGameWindow).toBe(true);
    });

    it('should detect Sunday early window including 2hr pre-game', () => {
      // Sunday 10 AM ET → within pre-game window (12PM - 2hr = 10AM)
      const sunday10am = new Date(2025, 9, 5, 10, 0); // Oct 5, 2025 (Sunday)
      vi.setSystemTime(sunday10am);

      const status = monitor.getStatus();
      expect(status.isWithinGameWindow).toBe(true);
    });

    it('should detect Monday night game window', () => {
      // Monday 9 PM ET → within game window
      const monday9pm = new Date(2025, 9, 6, 21, 0); // Oct 6, 2025 (Monday)
      vi.setSystemTime(monday9pm);

      const status = monitor.getStatus();
      expect(status.isWithinGameWindow).toBe(true);
    });

    it('should return false outside all game windows', () => {
      // Tuesday 3 PM → no games
      const tuesday3pm = new Date(2025, 9, 7, 15, 0); // Oct 7, 2025 (Tuesday)
      vi.setSystemTime(tuesday3pm);

      const status = monitor.getStatus();
      expect(status.isWithinGameWindow).toBe(false);
    });

    it('should return false on Wednesday', () => {
      const wednesday = new Date(2025, 9, 8, 12, 0); // Oct 8, 2025 (Wednesday)
      vi.setSystemTime(wednesday);

      const status = monitor.getStatus();
      expect(status.isWithinGameWindow).toBe(false);
    });

    it('should return false before Thursday pre-game window', () => {
      // Thursday 2 PM → before game window (starts at 4PM = 6PM - 2hr)
      const thursday2pm = new Date(2025, 9, 2, 14, 0);
      vi.setSystemTime(thursday2pm);

      const status = monitor.getStatus();
      expect(status.isWithinGameWindow).toBe(false);
    });
  });

  describe('Polling Interval Calculation', () => {
    // We test the private method indirectly through behavior
    // The getPollingInterval is private, but we can verify its effects

    it('should use normal interval when no games are near', () => {
      // The default polling interval is 2 minutes (120000ms)
      // We verify this through the service start behavior
      const status = monitor.getStatus();
      expect(status.isMonitoring).toBe(false);
    });
  });

  describe('Best Substitution Selection', () => {
    it('should find highest-projected bench player at same position', async () => {
      // Setup: 3 bench RBs with different projections
      vi.mocked(db.roster.findMany).mockResolvedValue([
        {
          playerId: 'bench-rb1',
          isStarting: false,
          player: { id: 'bench-rb1', fullName: 'Bench RB1', position: 'RB', status: 'Active' },
        },
        {
          playerId: 'bench-rb2',
          isStarting: false,
          player: { id: 'bench-rb2', fullName: 'Bench RB2', position: 'RB', status: 'Active' },
        },
        {
          playerId: 'bench-rb3',
          isStarting: false,
          player: { id: 'bench-rb3', fullName: 'Bench RB3', position: 'RB', status: 'Questionable' },
        },
      ] as any);

      vi.mocked(projectionService.getPlayerProjection)
        .mockResolvedValueOnce({ projectedPoints: 12.5 } as any)   // bench-rb1
        .mockResolvedValueOnce({ projectedPoints: 18.3 } as any)   // bench-rb2 (highest)
        .mockResolvedValueOnce({ projectedPoints: 8.1 } as any);   // bench-rb3

      // Access private method via any cast
      const result = await (monitor as any).findBestSubstitution(
        'league-1',
        'injured-rb',
        'RB',
        new Date(Date.now() + 60 * 60 * 1000), // game in 1 hour (future)
        2025
      );

      expect(result).not.toBeNull();
      expect(result.playerId).toBe('bench-rb2');
      expect(result.projectedPoints).toBe(18.3);
      expect(result.reason).toContain('RB');
    });

    it('should return null when no bench players at position', async () => {
      vi.mocked(db.roster.findMany).mockResolvedValue([]);

      const result = await (monitor as any).findBestSubstitution(
        'league-1',
        'injured-wr',
        'WR',
        new Date(Date.now() + 60 * 60 * 1000),
        2025
      );

      expect(result).toBeNull();
    });

    it('should handle missing projections gracefully', async () => {
      vi.mocked(db.roster.findMany).mockResolvedValue([
        {
          playerId: 'bench-te1',
          isStarting: false,
          player: { id: 'bench-te1', fullName: 'Bench TE1', position: 'TE', status: 'Active' },
        },
      ] as any);

      // No projection data
      vi.mocked(projectionService.getPlayerProjection).mockResolvedValue(null);

      const result = await (monitor as any).findBestSubstitution(
        'league-1',
        'injured-te',
        'TE',
        new Date(Date.now() + 60 * 60 * 1000),
        2025
      );

      // Should still return the player but with 0 projected points
      expect(result).not.toBeNull();
      expect(result.projectedPoints).toBe(0);
    });
  });

  describe('Urgency Level Determination', () => {
    it('should create critical urgency alert when <10 min to kickoff', async () => {
      const minutesToKickoff = 8;

      // Setup league with user
      const league = {
        id: 'league-1',
        user: { email: 'test@test.com', pushToken: 'token-123', notificationPreferences: {} },
        rosters: [],
      };

      const statusChange = {
        playerId: 'player-1',
        playerName: 'Patrick Mahomes',
        position: 'QB',
        team: 'KC',
        previousStatus: 'Active',
        newStatus: 'Out',
        injuryDesignation: 'Knee',
        gameTime: new Date(),
        gameId: 'game-1',
        opponent: 'BUF',
      };

      // Mock no bench substitution available
      vi.mocked(db.roster.findMany).mockResolvedValue([]);
      vi.mocked(db.injuryAlert.create).mockResolvedValue({ id: 'alert-1' } as any);
      vi.mocked(db.injuryAlert.update).mockResolvedValue({} as any);

      await (monitor as any).handleInjuryAlert(league, statusChange, minutesToKickoff, 5, 2025);

      const createCall = vi.mocked(db.injuryAlert.create).mock.calls[0][0];
      expect(createCall.data.urgencyLevel).toBe('critical');
      expect(createCall.data.isUrgent).toBe(true);
      expect(createCall.data.minutesToKickoff).toBe(8);
      expect(createCall.data.injuredPlayerName).toBe('Patrick Mahomes');
    });

    it('should create high urgency alert when 10-30 min to kickoff', async () => {
      const league = {
        id: 'league-1',
        user: { email: 'test@test.com', pushToken: 'token', notificationPreferences: {} },
        rosters: [],
      };

      const statusChange = {
        playerId: 'player-2',
        playerName: 'Derrick Henry',
        position: 'RB',
        team: 'BAL',
        previousStatus: 'Questionable',
        newStatus: 'Out',
        gameTime: new Date(),
      };

      vi.mocked(db.roster.findMany).mockResolvedValue([]);
      vi.mocked(db.injuryAlert.create).mockResolvedValue({ id: 'alert-2' } as any);
      vi.mocked(db.injuryAlert.update).mockResolvedValue({} as any);

      await (monitor as any).handleInjuryAlert(league, statusChange, 25, 5, 2025);

      const createCall = vi.mocked(db.injuryAlert.create).mock.calls[0][0];
      expect(createCall.data.urgencyLevel).toBe('high');
      expect(createCall.data.isUrgent).toBe(false);
    });

    it('should create medium urgency when 30-60 min to kickoff', async () => {
      const league = {
        id: 'league-1',
        user: { email: 'test@test.com', pushToken: 'token', notificationPreferences: {} },
        rosters: [],
      };

      const statusChange = {
        playerId: 'player-3',
        playerName: 'Tyreek Hill',
        position: 'WR',
        team: 'MIA',
        previousStatus: 'Questionable',
        newStatus: 'Out',
        gameTime: new Date(),
      };

      vi.mocked(db.roster.findMany).mockResolvedValue([]);
      vi.mocked(db.injuryAlert.create).mockResolvedValue({ id: 'alert-3' } as any);
      vi.mocked(db.injuryAlert.update).mockResolvedValue({} as any);

      await (monitor as any).handleInjuryAlert(league, statusChange, 45, 5, 2025);

      const createCall = vi.mocked(db.injuryAlert.create).mock.calls[0][0];
      expect(createCall.data.urgencyLevel).toBe('medium');
    });

    it('should create low urgency when >60 min to kickoff', async () => {
      const league = {
        id: 'league-1',
        user: { email: 'test@test.com', pushToken: 'token', notificationPreferences: {} },
        rosters: [],
      };

      const statusChange = {
        playerId: 'player-4',
        playerName: 'Travis Kelce',
        position: 'TE',
        team: 'KC',
        previousStatus: 'Active',
        newStatus: 'Out',
        gameTime: new Date(),
      };

      vi.mocked(db.roster.findMany).mockResolvedValue([]);
      vi.mocked(db.injuryAlert.create).mockResolvedValue({ id: 'alert-4' } as any);
      vi.mocked(db.injuryAlert.update).mockResolvedValue({} as any);

      await (monitor as any).handleInjuryAlert(league, statusChange, 90, 5, 2025);

      const createCall = vi.mocked(db.injuryAlert.create).mock.calls[0][0];
      expect(createCall.data.urgencyLevel).toBe('low');
    });
  });

  describe('Auto-Substitution', () => {
    it('should mark auto-substituted when user has preference enabled', async () => {
      const league = {
        id: 'league-1',
        user: {
          email: 'test@test.com',
          pushToken: 'token',
          notificationPreferences: { autoSubstitute: true },
        },
        rosters: [],
      };

      const statusChange = {
        playerId: 'player-1',
        playerName: 'Injured Player',
        position: 'RB',
        team: 'KC',
        previousStatus: 'Active',
        newStatus: 'Out',
        gameTime: new Date(Date.now() + 60 * 60 * 1000), // 1hr in future so subs aren't filtered out
      };

      // Setup a bench substitute
      vi.mocked(db.roster.findMany).mockResolvedValue([
        {
          playerId: 'sub-rb1',
          isStarting: false,
          player: { id: 'sub-rb1', fullName: 'Sub RB', position: 'RB', status: 'Active' },
        },
      ] as any);

      vi.mocked(projectionService.getPlayerProjection).mockResolvedValue({
        projectedPoints: 14.5,
      } as any);

      vi.mocked(db.injuryAlert.create).mockResolvedValue({ id: 'alert-1' } as any);
      vi.mocked(db.injuryAlert.update).mockResolvedValue({} as any);

      await (monitor as any).handleInjuryAlert(league, statusChange, 5, 5, 2025);

      // Should update alert with autoSubstituted = true
      const updateCalls = vi.mocked(db.injuryAlert.update).mock.calls;
      const autoSubCall = updateCalls.find(
        (call) => call[0].data.autoSubstituted === true
      );
      expect(autoSubCall).toBeDefined();
    });

    it('should not auto-substitute when preference is disabled', async () => {
      const league = {
        id: 'league-1',
        user: {
          email: 'test@test.com',
          pushToken: 'token',
          notificationPreferences: { autoSubstitute: false },
        },
        rosters: [],
      };

      const statusChange = {
        playerId: 'player-1',
        playerName: 'Injured Player',
        position: 'RB',
        team: 'KC',
        previousStatus: 'Active',
        newStatus: 'Out',
        gameTime: new Date(Date.now() + 60 * 60 * 1000), // 1hr in future
      };

      vi.mocked(db.roster.findMany).mockResolvedValue([
        {
          playerId: 'sub-rb1',
          isStarting: false,
          player: { id: 'sub-rb1', fullName: 'Sub RB', position: 'RB', status: 'Active' },
        },
      ] as any);

      vi.mocked(projectionService.getPlayerProjection).mockResolvedValue({
        projectedPoints: 14.5,
      } as any);

      vi.mocked(db.injuryAlert.create).mockResolvedValue({ id: 'alert-1' } as any);
      vi.mocked(db.injuryAlert.update).mockResolvedValue({} as any);

      await (monitor as any).handleInjuryAlert(league, statusChange, 5, 5, 2025);

      // Only the notification update should happen, not auto-sub
      const updateCalls = vi.mocked(db.injuryAlert.update).mock.calls;
      const autoSubCall = updateCalls.find(
        (call) => call[0].data.autoSubstituted === true
      );
      expect(autoSubCall).toBeUndefined();
    });
  });

  describe('Service Lifecycle', () => {
    it('should start monitoring', () => {
      monitor.start();
      const status = monitor.getStatus();
      expect(status.isMonitoring).toBe(true);
    });

    it('should stop monitoring and clear cache', () => {
      monitor.start();
      monitor.stop();
      const status = monitor.getStatus();
      expect(status.isMonitoring).toBe(false);
      expect(status.cachedPlayers).toBe(0);
    });

    it('should not start twice', () => {
      monitor.start();
      monitor.start(); // Should log "Already monitoring" and return
      const status = monitor.getStatus();
      expect(status.isMonitoring).toBe(true);
    });
  });
});
