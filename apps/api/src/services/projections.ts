import { db } from '@fantasy-football/database';
import { cacheService, CACHE_TTL } from './cache';

/**
 * Interface for player projection data
 */
export interface PlayerProjectionData {
  playerId: string;
  week: number;
  season: number;
  projectedPoints: number;
  stats?: {
    // QB stats
    passingYards?: number;
    passingTDs?: number;
    interceptions?: number;
    rushingYards?: number;
    rushingTDs?: number;
    // RB/WR/TE stats
    receptions?: number;
    receivingYards?: number;
    receivingTDs?: number;
    targets?: number;
    // K stats
    fieldGoalsMade?: number;
    fieldGoalsAttempted?: number;
    extraPointsMade?: number;
    // DST stats
    sacks?: number;
    fumblesRecovered?: number;
    safeties?: number;
    touchdowns?: number;
    pointsAllowed?: number;
  };
  confidence?: number;
  source?: string;
}

/**
 * Service for syncing and managing player projections
 */
export class ProjectionService {
  /**
   * Fetch projections from external API
   *
   * NOTE: This is a placeholder. In production, integrate with:
   * - FantasyPros API (https://www.fantasypros.com/api/)
   * - ESPN API projections
   * - Yahoo Sports API
   * - FantasyData API
   * - Or build custom ML projection model
   *
   * For MVP, we could use a simple algorithm based on:
   * - Recent performance averages
   * - Historical data trends
   * - Opponent strength
   */
  private async fetchProjectionsFromExternalAPI(
    week: number,
    season: number
  ): Promise<PlayerProjectionData[]> {
    // TODO: Replace with actual API integration
    // Example API call structure:
    /*
    const response = await fetch(
      `https://api.fantasypros.com/v2/projections?week=${week}&season=${season}`,
      {
        headers: {
          'x-api-key': process.env.FANTASYPROS_API_KEY,
        },
      }
    );
    const data = await response.json();
    return this.transformExternalDataToProjections(data);
    */

    console.warn(
      `⚠️  No external projection API configured. Using placeholder projections for week ${week}, season ${season}`
    );
    console.warn(
      '   To enable real projections, integrate with FantasyPros, ESPN, or Yahoo API'
    );

    // Return empty array for now - projections need to come from external source
    return [];
  }

  /**
   * Generate basic projections based on historical data
   * This is a fallback method when no external API is available
   */
  private async generateBasicProjections(
    week: number,
    season: number
  ): Promise<PlayerProjectionData[]> {
    // Get all active players
    const players = await db.player.findMany({
      where: {
        status: {
          in: ['Active', 'Questionable'],
        },
      },
    });

    // Generate basic projections (this would be replaced with ML model)
    const projections: PlayerProjectionData[] = players.map((player) => {
      // Simple position-based average projections
      let projectedPoints = 0;
      const stats: any = {};

      switch (player.position) {
        case 'QB':
          projectedPoints = 18.5;
          stats.passingYards = 250;
          stats.passingTDs = 1.8;
          stats.interceptions = 0.8;
          stats.rushingYards = 15;
          stats.rushingTDs = 0.2;
          break;
        case 'RB':
          projectedPoints = 12.0;
          stats.rushingYards = 65;
          stats.rushingTDs = 0.5;
          stats.receptions = 3;
          stats.receivingYards = 25;
          stats.receivingTDs = 0.15;
          stats.targets = 4;
          break;
        case 'WR':
          projectedPoints = 11.0;
          stats.receptions = 5;
          stats.receivingYards = 65;
          stats.receivingTDs = 0.5;
          stats.targets = 7;
          break;
        case 'TE':
          projectedPoints = 8.5;
          stats.receptions = 4;
          stats.receivingYards = 45;
          stats.receivingTDs = 0.4;
          stats.targets = 5;
          break;
        case 'K':
          projectedPoints = 8.0;
          stats.fieldGoalsMade = 1.5;
          stats.fieldGoalsAttempted = 2;
          stats.extraPointsMade = 2.5;
          break;
        case 'DEF':
          projectedPoints = 7.0;
          stats.sacks = 2.5;
          stats.interceptions = 0.8;
          stats.fumblesRecovered = 0.6;
          stats.safeties = 0.05;
          stats.touchdowns = 0.3;
          stats.pointsAllowed = 21;
          break;
        default:
          projectedPoints = 0;
      }

      return {
        playerId: player.id,
        week,
        season,
        projectedPoints,
        stats,
        confidence: 0.5,
        source: 'basic_algorithm',
      };
    });

    return projections;
  }

  /**
   * Sync projections for a specific week
   */
  async syncWeekProjections(
    week: number,
    season: number,
    useBasicAlgorithm: boolean = true
  ): Promise<{ created: number; updated: number }> {
    console.log(`Starting projection sync for week ${week}, season ${season}...`);

    let projections: PlayerProjectionData[];

    if (useBasicAlgorithm) {
      // Use basic algorithm as fallback
      projections = await this.generateBasicProjections(week, season);
    } else {
      // Fetch from external API
      projections = await this.fetchProjectionsFromExternalAPI(week, season);
    }

    if (projections.length === 0) {
      console.warn('No projections fetched. Skipping sync.');
      return { created: 0, updated: 0 };
    }

    let created = 0;
    let updated = 0;

    // Upsert projections to database
    for (const projection of projections) {
      const result = await db.playerProjection.upsert({
        where: {
          playerId_week_season_source: {
            playerId: projection.playerId,
            week: projection.week,
            season: projection.season,
            source: projection.source || 'basic_algorithm',
          },
        },
        create: {
          playerId: projection.playerId,
          week: projection.week,
          season: projection.season,
          projectedPoints: projection.projectedPoints,
          stats: projection.stats || {},
          confidence: projection.confidence || 0.5,
          source: projection.source || 'basic_algorithm',
        },
        update: {
          projectedPoints: projection.projectedPoints,
          stats: projection.stats || {},
          confidence: projection.confidence || 0.5,
          updatedAt: new Date(),
        },
      });

      // Determine if created or updated (Prisma doesn't tell us directly)
      // For simplicity, we'll just count all as created
      created++;

      // Cache the projection
      await cacheService.setPlayerProjection(
        projection.playerId,
        projection.week,
        projection.season,
        result,
        CACHE_TTL.PLAYER_PROJECTION
      );
    }

    // Cache all week projections
    const weekProjections = await db.playerProjection.findMany({
      where: { week, season },
      include: {
        player: {
          select: {
            id: true,
            fullName: true,
            position: true,
            team: true,
          },
        },
      },
    });

    await cacheService.setWeekProjections(
      week,
      season,
      weekProjections,
      CACHE_TTL.PLAYER_PROJECTIONS_WEEK
    );

    console.log(
      `✓ Projection sync complete. Created/Updated: ${created}, Week: ${week}, Season: ${season}`
    );

    return { created, updated };
  }

  /**
   * Get projection for a specific player and week
   * Checks cache first, then database
   */
  async getPlayerProjection(
    playerId: string,
    week: number,
    season: number
  ): Promise<any | null> {
    // Check cache first
    const cached = await cacheService.getPlayerProjection(playerId, week, season);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const projection = await db.playerProjection.findFirst({
      where: {
        playerId,
        week,
        season,
      },
      include: {
        player: {
          select: {
            id: true,
            fullName: true,
            position: true,
            team: true,
            status: true,
          },
        },
      },
    });

    if (projection) {
      // Cache for next time
      await cacheService.setPlayerProjection(
        playerId,
        week,
        season,
        projection,
        CACHE_TTL.PLAYER_PROJECTION
      );
    }

    return projection;
  }

  /**
   * Get all projections for a specific week
   * Checks cache first, then database
   */
  async getWeekProjections(week: number, season: number): Promise<any[]> {
    // Check cache first
    const cached = await cacheService.getWeekProjections(week, season);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const projections = await db.playerProjection.findMany({
      where: { week, season },
      include: {
        player: {
          select: {
            id: true,
            fullName: true,
            position: true,
            team: true,
            status: true,
          },
        },
      },
      orderBy: {
        projectedPoints: 'desc',
      },
    });

    if (projections.length > 0) {
      // Cache for next time
      await cacheService.setWeekProjections(
        week,
        season,
        projections,
        CACHE_TTL.PLAYER_PROJECTIONS_WEEK
      );
    }

    return projections;
  }

  /**
   * Get projections for multiple players
   */
  async getPlayersProjections(
    playerIds: string[],
    week: number,
    season: number
  ): Promise<any[]> {
    const projections = await db.playerProjection.findMany({
      where: {
        playerId: { in: playerIds },
        week,
        season,
      },
      include: {
        player: {
          select: {
            id: true,
            fullName: true,
            position: true,
            team: true,
            status: true,
          },
        },
      },
    });

    return projections;
  }

  /**
   * Get top projected players by position for a week
   */
  async getTopProjectedPlayers(
    week: number,
    season: number,
    position?: string,
    limit: number = 50
  ): Promise<any[]> {
    const projections = await db.playerProjection.findMany({
      where: {
        week,
        season,
        ...(position && {
          player: {
            position,
          },
        }),
      },
      include: {
        player: {
          select: {
            id: true,
            fullName: true,
            position: true,
            team: true,
            status: true,
          },
        },
      },
      orderBy: {
        projectedPoints: 'desc',
      },
      take: limit,
    });

    return projections;
  }

  /**
   * Calculate performance ratio for a player
   * (Actual points / Projected points) - used for sell-high/buy-low detection
   *
   * @param playerId Player ID
   * @param weeks Array of week numbers to analyze
   * @param season Season year
   * @returns Performance ratio or null if insufficient data
   */
  async calculatePerformanceRatio(
    playerId: string,
    weeks: number[],
    season: number
  ): Promise<number | null> {
    // TODO: This would need actual game stats from Sleeper API
    // For now, return null as placeholder
    //
    // In production:
    // 1. Fetch actual points scored from game stats
    // 2. Fetch projected points for those weeks
    // 3. Calculate ratio: avgActualPoints / avgProjectedPoints

    return null;
  }

  /**
   * Invalidate projection cache for a specific week
   */
  async invalidateWeekCache(week: number, season: number): Promise<void> {
    await cacheService.invalidateWeekProjections(week, season);
  }
}

// Export singleton instance
export const projectionService = new ProjectionService();
