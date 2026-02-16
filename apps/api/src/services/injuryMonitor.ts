import { db } from '@fantasy-football/database';
import { sleeperService } from './sleeper';
import { projectionService } from './projections';

/**
 * NFL Game Schedule
 * Typical game windows during regular season
 */
const NFL_GAME_WINDOWS = {
  THURSDAY: {
    dayOfWeek: 4, // Thursday
    startHour: 18, // 6:00 PM ET
    endHour: 23, // 11:00 PM ET
  },
  SUNDAY_EARLY: {
    dayOfWeek: 0, // Sunday
    startHour: 12, // 12:00 PM ET (noon)
    endHour: 16, // 4:00 PM ET
  },
  SUNDAY_LATE: {
    dayOfWeek: 0, // Sunday
    startHour: 16, // 4:00 PM ET
    endHour: 20, // 8:00 PM ET
  },
  SUNDAY_NIGHT: {
    dayOfWeek: 0, // Sunday
    startHour: 20, // 8:00 PM ET
    endHour: 23, // 11:00 PM ET
  },
  MONDAY: {
    dayOfWeek: 1, // Monday
    startHour: 18, // 6:00 PM ET
    endHour: 23, // 11:00 PM ET
  },
};

/**
 * Polling intervals based on proximity to kickoff
 */
const POLLING_INTERVALS = {
  PRE_GAME_WINDOW: 2 * 60 * 60 * 1000, // 2 hours before game (no polling yet)
  NORMAL: 2 * 60 * 1000, // 2 minutes during game window
  URGENT: 1 * 60 * 1000, // 1 minute when <30 min to kickoff
  POST_GAME: 5 * 60 * 1000, // 5 minutes after game starts (slower)
};

/**
 * Game information
 */
interface GameInfo {
  gameId: string;
  gameTime: Date;
  homeTeam: string;
  awayTeam: string;
  isActive: boolean;
}

/**
 * Player status change
 */
interface StatusChange {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  previousStatus: string;
  newStatus: string;
  injuryDesignation?: string;
  gameTime: Date;
  gameId?: string;
  opponent?: string;
}

/**
 * Substitution recommendation
 */
interface SubstitutionRecommendation {
  playerId: string;
  playerName: string;
  position: string;
  projectedPoints: number;
  gameTime: Date;
  reason: string;
}

/**
 * Injury Monitoring Service
 * Monitors player statuses during game windows and sends alerts
 */
export class InjuryMonitorService {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;
  private playerStatusCache: Map<string, string> = new Map();

  /**
   * Check if current time is within a game window
   */
  private isWithinGameWindow(now: Date = new Date()): boolean {
    const dayOfWeek = now.getDay();
    const hour = now.getHours();

    for (const window of Object.values(NFL_GAME_WINDOWS)) {
      if (dayOfWeek === window.dayOfWeek) {
        // Start monitoring 2 hours before game window
        const monitoringStartHour = window.startHour - 2;
        if (hour >= monitoringStartHour && hour <= window.endHour) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get polling interval based on current time and game times
   */
  private getPollingInterval(upcomingGames: GameInfo[]): number {
    const now = new Date();

    // Find the nearest game
    let nearestGame: GameInfo | null = null;
    let minTimeToKickoff = Infinity;

    for (const game of upcomingGames) {
      const timeToKickoff = game.gameTime.getTime() - now.getTime();
      if (timeToKickoff > 0 && timeToKickoff < minTimeToKickoff) {
        minTimeToKickoff = timeToKickoff;
        nearestGame = game;
      }
    }

    if (!nearestGame) {
      return POLLING_INTERVALS.NORMAL;
    }

    const minutesToKickoff = minTimeToKickoff / (60 * 1000);

    // <30 minutes to kickoff = 1 minute polling
    if (minutesToKickoff < 30) {
      return POLLING_INTERVALS.URGENT;
    }

    // 30min - 2hr to kickoff = 2 minute polling
    if (minutesToKickoff < 120) {
      return POLLING_INTERVALS.NORMAL;
    }

    // >2hr to kickoff = slower polling
    return POLLING_INTERVALS.NORMAL;
  }

  /**
   * Get upcoming games for a specific week
   * Builds schedule from rostered players' teams distributed across standard NFL game windows
   */
  private async getUpcomingGames(week: number, season: number): Promise<GameInfo[]> {
    const games: GameInfo[] = [];
    const now = new Date();

    // Get all unique NFL teams from rostered players in active leagues
    const rosteredPlayers = await db.roster.findMany({
      where: { league: { isActive: true } },
      include: { player: { select: { team: true } } },
    });

    const activeTeams = [
      ...new Set(
        rosteredPlayers
          .map((r) => r.player?.team)
          .filter((t): t is string => !!t)
      ),
    ];

    if (activeTeams.length === 0) return [];

    // Pair teams up for matchups
    const teamPairs: Array<[string, string]> = [];
    for (let i = 0; i < activeTeams.length - 1; i += 2) {
      teamPairs.push([activeTeams[i], activeTeams[i + 1]]);
    }

    // Distribute across standard NFL game windows
    const thursday = this.getNextDayOfWeek(4);
    thursday.setHours(20, 15, 0, 0);

    const sundayEarly = this.getNextDayOfWeek(0);
    sundayEarly.setHours(13, 0, 0, 0);

    const sundayLate = this.getNextDayOfWeek(0);
    sundayLate.setHours(16, 25, 0, 0);

    const sundayNight = this.getNextDayOfWeek(0);
    sundayNight.setHours(20, 20, 0, 0);

    const monday = this.getNextDayOfWeek(1);
    monday.setHours(20, 15, 0, 0);

    for (let i = 0; i < teamPairs.length; i++) {
      const [home, away] = teamPairs[i];
      let gameTime: Date;
      let slot: string;

      if (i === 0) {
        gameTime = thursday;
        slot = 'TNF';
      } else if (i === teamPairs.length - 1) {
        gameTime = monday;
        slot = 'MNF';
      } else if (i === teamPairs.length - 2) {
        gameTime = sundayNight;
        slot = 'SNF';
      } else if (i <= teamPairs.length / 2) {
        gameTime = sundayEarly;
        slot = `SUN_EARLY_${i}`;
      } else {
        gameTime = sundayLate;
        slot = `SUN_LATE_${i}`;
      }

      games.push({
        gameId: `${season}_${week}_${slot}`,
        gameTime: new Date(gameTime),
        homeTeam: home,
        awayTeam: away,
        isActive: false,
      });
    }

    return games.filter((game) => game.gameTime > now);
  }

  /**
   * Get next occurrence of a specific day of week
   */
  private getNextDayOfWeek(targetDay: number): Date {
    const today = new Date();
    const currentDay = today.getDay();
    const daysUntilTarget = (targetDay + 7 - currentDay) % 7;
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
    return targetDate;
  }

  /**
   * Monitor player statuses for all active leagues
   */
  private async monitorPlayerStatuses(): Promise<void> {
    console.log(`[Injury Monitor] Running status check at ${new Date().toISOString()}`);

    try {
      // Get all active leagues
      const leagues = await db.league.findMany({
        where: { isActive: true },
        include: {
          user: true,
          rosters: {
            include: {
              player: true,
            },
          },
        },
      });

      if (leagues.length === 0) {
        console.log('[Injury Monitor] No active leagues to monitor');
        return;
      }

      const now = new Date();
      const currentWeek = this.getCurrentWeek();
      const currentSeason = now.getFullYear();

      // Get upcoming games
      const upcomingGames = await this.getUpcomingGames(currentWeek, currentSeason);

      // Check each league's roster
      for (const league of leagues) {
        await this.checkLeagueRoster(league, upcomingGames, currentWeek, currentSeason);
      }

      // Update polling interval based on game proximity
      const newInterval = this.getPollingInterval(upcomingGames);
      if (this.monitoringInterval && newInterval !== POLLING_INTERVALS.NORMAL) {
        console.log(`[Injury Monitor] Adjusting polling interval to ${newInterval / 1000}s`);
        this.restartMonitoring(newInterval);
      }
    } catch (error) {
      console.error('[Injury Monitor] Error during monitoring:', error);
    }
  }

  /**
   * Check roster for a specific league
   */
  private async checkLeagueRoster(
    league: any,
    upcomingGames: GameInfo[],
    week: number,
    season: number
  ): Promise<void> {
    for (const rosterEntry of league.rosters) {
      const player = rosterEntry.player;
      const playerId = player.id;

      // Get fresh player data from Sleeper
      const players = await sleeperService.getPlayers();
      const freshPlayerData = players[playerId];

      if (!freshPlayerData) {
        continue;
      }

      const previousStatus = this.playerStatusCache.get(playerId) || player.status || 'Active';
      const currentStatus = freshPlayerData.injury_status || 'Active';

      // Detect status change
      if (previousStatus !== currentStatus && currentStatus === 'Out') {
        // Find the player's game
        const playerTeam = freshPlayerData.team;
        const playerGame = upcomingGames.find(
          (g) => g.homeTeam === playerTeam || g.awayTeam === playerTeam
        );

        if (playerGame) {
          const minutesToKickoff = Math.floor(
            (playerGame.gameTime.getTime() - new Date().getTime()) / (60 * 1000)
          );

          // Only alert if within 2 hours of kickoff
          if (minutesToKickoff <= 120 && minutesToKickoff > -30) {
            const statusChange: StatusChange = {
              playerId,
              playerName: player.fullName,
              position: player.position,
              team: playerTeam,
              previousStatus,
              newStatus: currentStatus,
              injuryDesignation: freshPlayerData.injury_body_part,
              gameTime: playerGame.gameTime,
              gameId: playerGame.gameId,
              opponent: playerGame.homeTeam === playerTeam ? playerGame.awayTeam : playerGame.homeTeam,
            };

            await this.handleInjuryAlert(league, statusChange, minutesToKickoff, week, season);
          }
        }
      }

      // Update cache
      this.playerStatusCache.set(playerId, currentStatus);

      // Also update database
      await db.player.update({
        where: { id: playerId },
        data: {
          status: currentStatus,
          injuryDesignation: freshPlayerData.injury_body_part,
        },
      });
    }
  }

  /**
   * Handle injury alert - create alert, find substitution, send notification
   */
  private async handleInjuryAlert(
    league: any,
    statusChange: StatusChange,
    minutesToKickoff: number,
    week: number,
    season: number
  ): Promise<void> {
    console.log(
      `[Injury Alert] ${statusChange.playerName} is OUT - ${minutesToKickoff} min to kickoff`
    );

    // Find best substitution
    const substitution = await this.findBestSubstitution(
      league.id,
      statusChange.playerId,
      statusChange.position,
      statusChange.gameTime,
      season
    );

    // Determine urgency
    const isUrgent = minutesToKickoff < 10;
    const urgencyLevel =
      minutesToKickoff < 10
        ? 'critical'
        : minutesToKickoff < 30
        ? 'high'
        : minutesToKickoff < 60
        ? 'medium'
        : 'low';

    // Create injury alert
    const alert = await db.injuryAlert.create({
      data: {
        leagueId: league.id,
        week,
        season,
        injuredPlayerId: statusChange.playerId,
        injuredPlayerName: statusChange.playerName,
        position: statusChange.position,
        team: statusChange.team,
        previousStatus: statusChange.previousStatus,
        newStatus: statusChange.newStatus,
        injuryDesignation: statusChange.injuryDesignation,
        gameTime: statusChange.gameTime,
        gameId: statusChange.gameId,
        opponent: statusChange.opponent,
        minutesToKickoff,
        isUrgent,
        urgencyLevel,
        recommendedSubPlayerId: substitution?.playerId,
        recommendedSubPlayerName: substitution?.playerName,
        recommendedSubProjection: substitution?.projectedPoints,
        pushToken: league.user.pushToken,
      },
    });

    // Send push notification
    await this.sendPushNotification(league.user, alert, substitution);

    // Auto-substitute if enabled
    const notificationPrefs = league.user.notificationPreferences as any;
    if (notificationPrefs?.autoSubstitute && substitution) {
      console.log(
        `[Auto-Sub] Would auto-substitute ${statusChange.playerName} → ${substitution.playerName}`
      );
      // In production, this would make the actual lineup change via Sleeper API
      // However, Sleeper API doesn't support write operations
      await db.injuryAlert.update({
        where: { id: alert.id },
        data: { autoSubstituted: true },
      });
    }
  }

  /**
   * Find best bench player for substitution
   */
  private async findBestSubstitution(
    leagueId: string,
    injuredPlayerId: string,
    position: string,
    injuredPlayerGameTime: Date,
    season: number
  ): Promise<SubstitutionRecommendation | null> {
    // Get bench players at same position
    const roster = await db.roster.findMany({
      where: {
        leagueId,
        isStarting: false,
        player: {
          position,
          status: {
            in: ['Active', 'Questionable'],
          },
        },
      },
      include: {
        player: true,
      },
    });

    if (roster.length === 0) {
      return null;
    }

    // Get projections for each bench player
    const candidates: Array<{
      player: any;
      projection: number;
      gameTime: Date | null;
    }> = [];

    for (const rosterEntry of roster) {
      const proj = await projectionService.getPlayerProjection(
        rosterEntry.playerId,
        0,
        season
      );

      // In production, fetch actual game time for this player
      // For now, assume game time is later if not specified
      const playerGameTime = injuredPlayerGameTime; // Mock

      candidates.push({
        player: rosterEntry.player,
        projection: proj?.projectedPoints || 0,
        gameTime: playerGameTime,
      });
    }

    // Filter to players whose game hasn't started yet
    const now = new Date();
    const availableCandidates = candidates.filter(
      (c) => !c.gameTime || c.gameTime > now
    );

    if (availableCandidates.length === 0) {
      return null;
    }

    // Sort by projection (highest first), then by game time (latest first)
    availableCandidates.sort((a, b) => {
      if (b.projection !== a.projection) {
        return b.projection - a.projection;
      }
      if (!a.gameTime) return 1;
      if (!b.gameTime) return -1;
      return b.gameTime.getTime() - a.gameTime.getTime();
    });

    const best = availableCandidates[0];

    return {
      playerId: best.player.id,
      playerName: best.player.fullName,
      position: best.player.position,
      projectedPoints: best.projection,
      gameTime: best.gameTime!,
      reason: `Best available ${position} on your bench`,
    };
  }

  /**
   * Send push notification (placeholder - implement FCM integration)
   */
  private async sendPushNotification(
    user: any,
    alert: any,
    substitution: SubstitutionRecommendation | null
  ): Promise<void> {
    // TODO: Implement Firebase Cloud Messaging (FCM) integration
    console.log(`[Push Notification] Would send to ${user.email}:`);
    console.log(`  - ${alert.injuredPlayerName} is OUT (${alert.urgencyLevel} priority)`);
    if (substitution) {
      console.log(`  - Recommended sub: ${substitution.playerName} (${substitution.projectedPoints.toFixed(1)} pts)`);
    }

    // Update alert as notified
    await db.injuryAlert.update({
      where: { id: alert.id },
      data: {
        notificationSent: true,
        notificationSentAt: new Date(),
      },
    });

    // In production:
    /*
    const admin = require('firebase-admin');
    const message = {
      notification: {
        title: `🚨 ${alert.urgencyLevel.toUpperCase()}: ${alert.injuredPlayerName} OUT`,
        body: substitution
          ? `Sub recommendation: ${substitution.playerName} (${substitution.projectedPoints.toFixed(1)} pts)`
          : 'Check your lineup',
      },
      data: {
        alertId: alert.id,
        injuredPlayerId: alert.injuredPlayerId,
        substitutionPlayerId: substitution?.playerId || '',
      },
      token: user.pushToken,
    };
    await admin.messaging().send(message);
    */
  }

  /**
   * Get current NFL week (simplified)
   */
  private getCurrentWeek(): number {
    const now = new Date();
    const seasonStart = new Date(now.getFullYear(), 8, 1); // Sept 1
    const weeksSinceStart = Math.floor(
      (now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    return Math.max(1, Math.min(18, weeksSinceStart + 1));
  }

  /**
   * Start monitoring service
   */
  start(): void {
    if (this.isMonitoring) {
      console.log('[Injury Monitor] Already monitoring');
      return;
    }

    console.log('[Injury Monitor] Starting injury monitoring service...');
    this.isMonitoring = true;

    // Run initial check
    this.monitorPlayerStatuses();

    // Set up interval
    this.monitoringInterval = setInterval(() => {
      // Only monitor during game windows
      if (this.isWithinGameWindow()) {
        this.monitorPlayerStatuses();
      } else {
        console.log('[Injury Monitor] Outside game window - skipping check');
      }
    }, POLLING_INTERVALS.NORMAL);

    console.log('[Injury Monitor] Monitoring started');
  }

  /**
   * Stop monitoring service
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    this.playerStatusCache.clear();
    console.log('[Injury Monitor] Monitoring stopped');
  }

  /**
   * Restart monitoring with new interval
   */
  private restartMonitoring(newInterval: number): void {
    this.stop();
    this.isMonitoring = true;

    this.monitoringInterval = setInterval(() => {
      if (this.isWithinGameWindow()) {
        this.monitorPlayerStatuses();
      }
    }, newInterval);
  }

  /**
   * Get monitoring status
   */
  getStatus(): {
    isMonitoring: boolean;
    isWithinGameWindow: boolean;
    cachedPlayers: number;
  } {
    return {
      isMonitoring: this.isMonitoring,
      isWithinGameWindow: this.isWithinGameWindow(),
      cachedPlayers: this.playerStatusCache.size,
    };
  }
}

// Export singleton instance
export const injuryMonitorService = new InjuryMonitorService();
