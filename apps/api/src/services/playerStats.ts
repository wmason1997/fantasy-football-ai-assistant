import { db } from '@fantasy-football/database';
import { sleeperService } from './sleeper';
import { cacheService } from './cache';

/**
 * Sleeper API stats response format
 */
interface SleeperStats {
  [playerId: string]: {
    pts_ppr?: number;
    pts_half_ppr?: number;
    pts_std?: number;
    pass_yd?: number;
    pass_td?: number;
    pass_int?: number;
    pass_2pt?: number;
    rush_yd?: number;
    rush_td?: number;
    rush_2pt?: number;
    rec?: number;
    rec_yd?: number;
    rec_td?: number;
    rec_2pt?: number;
    fum_lost?: number;
    [key: string]: any; // Additional stats
  };
}

/**
 * Sync result for tracking success
 */
interface SyncResult {
  success: boolean;
  playersProcessed: number;
  playersWithStats: number;
  errors: string[];
}

/**
 * Player Week Stats Service
 * Handles fetching, storing, and retrieving weekly player statistics from Sleeper API
 */
export class PlayerStatsService {
  /**
   * Fetch and store stats for all players for a specific week
   * Uses single Sleeper API call: GET /stats/nfl/regular/{season}/{week}
   */
  async syncWeekStats(season: number, week: number): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      playersProcessed: 0,
      playersWithStats: 0,
      errors: [],
    };

    try {
      console.log(`[PlayerStats] Syncing week ${week} stats for ${season} season...`);

      // Fetch all stats for this week from Sleeper
      const stats = await sleeperService.getWeekStats(season, week);

      if (!stats) {
        result.success = false;
        result.errors.push('Failed to fetch stats from Sleeper API');
        return result;
      }

      // Process in batches of 100 to avoid overwhelming database
      const playerIds = Object.keys(stats);
      result.playersProcessed = playerIds.length;

      for (let i = 0; i < playerIds.length; i += 100) {
        const batch = playerIds.slice(i, i + 100);

        await Promise.all(
          batch.map(async (playerId) => {
            const playerStats = stats[playerId];

            // Skip if no meaningful stats
            if (!playerStats || Object.keys(playerStats).length === 0) {
              return;
            }

            try {
              // Check if player exists in our database (only fantasy-relevant positions are synced)
              const playerExists = await db.player.findUnique({
                where: { id: playerId },
                select: { id: true },
              });

              if (!playerExists) {
                // Skip players not in our database (non-fantasy positions, practice squad, etc.)
                return;
              }

              // Upsert to database
              await db.playerWeekStats.upsert({
                where: {
                  playerId_week_season_source: {
                    playerId,
                    week,
                    season,
                    source: 'sleeper',
                  },
                },
                create: {
                  playerId,
                  week,
                  season,
                  stats: playerStats as any,
                  pprPoints: playerStats.pts_ppr ?? null,
                  halfPprPoints: playerStats.pts_half_ppr ?? null,
                  stdPoints: playerStats.pts_std ?? null,
                  source: 'sleeper',
                },
                update: {
                  stats: playerStats as any,
                  pprPoints: playerStats.pts_ppr ?? null,
                  halfPprPoints: playerStats.pts_half_ppr ?? null,
                  stdPoints: playerStats.pts_std ?? null,
                  updatedAt: new Date(),
                },
              });

              result.playersWithStats++;

              // Cache for fast retrieval
              await cacheService.setPlayerWeekStats(
                playerId,
                week,
                season,
                playerStats,
              );
            } catch (error) {
              result.errors.push(
                `Failed to upsert stats for player ${playerId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              );
            }
          }),
        );
      }

      console.log(
        `[PlayerStats] Synced ${result.playersWithStats}/${result.playersProcessed} players for week ${week}`,
      );

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(
        `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return result;
    }
  }

  /**
   * Get player stats for recent weeks (with caching)
   */
  async getPlayerRecentStats(
    playerId: string,
    season: number,
    currentWeek: number,
    lookbackWeeks: number = 4,
  ) {
    const startWeek = Math.max(1, currentWeek - lookbackWeeks);

    // Try cache first for each week
    const cachedStats = await Promise.all(
      Array.from({ length: currentWeek - startWeek }, (_, i) => startWeek + i).map((week) =>
        cacheService.getPlayerWeekStats(playerId, week, season),
      ),
    );

    // If all cached, return
    if (cachedStats.every((s) => s !== null)) {
      return cachedStats.filter((s) => s !== null);
    }

    // Otherwise fetch from database
    const stats = await db.playerWeekStats.findMany({
      where: {
        playerId,
        season,
        week: { gte: startWeek, lt: currentWeek },
      },
      orderBy: { week: 'desc' },
    });

    // Cache the results
    for (const stat of stats) {
      await cacheService.setPlayerWeekStats(
        playerId,
        stat.week,
        season,
        stat.stats as any,
      );
    }

    return stats;
  }

  /**
   * Get stats for a single player and week
   */
  async getPlayerWeekStat(playerId: string, week: number, season: number) {
    // Try cache first
    const cached = await cacheService.getPlayerWeekStats(playerId, week, season);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const stat = await db.playerWeekStats.findUnique({
      where: {
        playerId_week_season_source: {
          playerId,
          week,
          season,
          source: 'sleeper',
        },
      },
    });

    // Cache if found
    if (stat) {
      await cacheService.setPlayerWeekStats(playerId, week, season, stat.stats as any);
    }

    return stat;
  }

  /**
   * Calculate fantasy points using custom league scoring
   * For non-standard scoring leagues
   */
  calculateCustomPoints(
    rawStats: Record<string, number>,
    scoringSettings: Record<string, number>,
  ): number {
    let points = 0;

    // Standard stat mappings
    const statMappings: Record<string, number> = {
      pass_yd: rawStats.pass_yd ?? 0,
      pass_td: rawStats.pass_td ?? 0,
      pass_int: rawStats.pass_int ?? 0,
      pass_2pt: rawStats.pass_2pt ?? 0,
      rush_yd: rawStats.rush_yd ?? 0,
      rush_td: rawStats.rush_td ?? 0,
      rush_2pt: rawStats.rush_2pt ?? 0,
      rec: rawStats.rec ?? 0,
      rec_yd: rawStats.rec_yd ?? 0,
      rec_td: rawStats.rec_td ?? 0,
      rec_2pt: rawStats.rec_2pt ?? 0,
      fum_lost: rawStats.fum_lost ?? 0,
    };

    // Calculate base points
    for (const [stat, value] of Object.entries(statMappings)) {
      const multiplier = scoringSettings[stat] ?? 0;
      points += value * multiplier;
    }

    // Bonus scoring
    if (scoringSettings.bonus_pass_yd_300 && rawStats.pass_yd && rawStats.pass_yd >= 300) {
      points += scoringSettings.bonus_pass_yd_300;
    }
    if (scoringSettings.bonus_pass_yd_400 && rawStats.pass_yd && rawStats.pass_yd >= 400) {
      points += scoringSettings.bonus_pass_yd_400;
    }
    if (scoringSettings.bonus_rush_yd_100 && rawStats.rush_yd && rawStats.rush_yd >= 100) {
      points += scoringSettings.bonus_rush_yd_100;
    }
    if (scoringSettings.bonus_rush_yd_200 && rawStats.rush_yd && rawStats.rush_yd >= 200) {
      points += scoringSettings.bonus_rush_yd_200;
    }
    if (scoringSettings.bonus_rec_yd_100 && rawStats.rec_yd && rawStats.rec_yd >= 100) {
      points += scoringSettings.bonus_rec_yd_100;
    }
    if (scoringSettings.bonus_rec_yd_200 && rawStats.rec_yd && rawStats.rec_yd >= 200) {
      points += scoringSettings.bonus_rec_yd_200;
    }

    return points;
  }

  /**
   * Detect scoring type from league settings
   * Returns 'ppr', 'half_ppr', 'std', or 'custom'
   */
  detectScoringType(scoringSettings: Record<string, number>): string {
    const recPoints = scoringSettings.rec ?? 0;

    if (recPoints === 1) return 'ppr';
    if (recPoints === 0.5) return 'half_ppr';
    if (recPoints === 0) return 'std';

    return 'custom';
  }

  /**
   * Get fantasy points for a player's week based on league scoring
   */
  getFantasyPoints(
    stats: any,
    scoringSettings: Record<string, number>,
  ): number | null {
    if (!stats) return null;

    const scoringType = this.detectScoringType(scoringSettings);

    // Use pre-calculated points if standard scoring
    if (scoringType === 'ppr' && stats.pprPoints !== null) {
      return stats.pprPoints;
    }
    if (scoringType === 'half_ppr' && stats.halfPprPoints !== null) {
      return stats.halfPprPoints;
    }
    if (scoringType === 'std' && stats.stdPoints !== null) {
      return stats.stdPoints;
    }

    // Calculate custom points
    const rawStats =
      typeof stats.stats === 'object' ? stats.stats : JSON.parse(stats.stats || '{}');
    return this.calculateCustomPoints(rawStats, scoringSettings);
  }
}

// Export singleton instance
export const playerStatsService = new PlayerStatsService();
