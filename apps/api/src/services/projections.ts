import { db } from '@fantasy-football/database';
import { cacheService, CACHE_TTL } from './cache';
import { playerStatsService } from './playerStats';

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
   * Generate projections using historical stats where available,
   * falling back to position averages for players without enough data
   */
  private async generateHistoricalProjections(
    week: number,
    season: number
  ): Promise<PlayerProjectionData[]> {
    const players = await db.player.findMany({
      where: {
        status: { in: ['Active', 'Questionable'] },
      },
    });

    console.log(`Generating projections for ${players.length} active players...`);

    const projections: PlayerProjectionData[] = [];
    let historicalCount = 0;
    let fallbackCount = 0;

    // Process in batches of 50 to avoid overwhelming DB
    for (let i = 0; i < players.length; i += 50) {
      const batch = players.slice(i, i + 50);

      const batchResults = await Promise.all(
        batch.map(async (player) => {
          // Try historical projection first (only for in-season weeks)
          if (week > 0) {
            const historical = await this.generateProjectionFromHistory(
              player.id,
              season,
              week
            );
            if (historical) {
              return { projection: historical, isHistorical: true };
            }
          }
          // Fall back to position average
          return {
            projection: this.fallbackToPositionAverage(player, week, season),
            isHistorical: false,
          };
        })
      );

      for (const { projection, isHistorical } of batchResults) {
        projections.push(projection);
        if (isHistorical) historicalCount++;
        else fallbackCount++;
      }
    }

    console.log(
      `Projections generated: ${historicalCount} from history, ${fallbackCount} from position averages`
    );

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
      // Use historical stats where available, position averages as fallback
      projections = await this.generateHistoricalProjections(week, season);
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
    if (weeks.length === 0) return null;

    // Fetch actual stats for the given weeks
    const actualStats = await db.playerWeekStats.findMany({
      where: {
        playerId,
        season,
        week: { in: weeks },
      },
    });

    if (actualStats.length < 2) return null;

    // Fetch projections for the same weeks
    const projections = await db.playerProjection.findMany({
      where: {
        playerId,
        season,
        week: { in: weeks },
      },
    });

    // Build a map of week -> projected points
    const projectionMap = new Map(
      projections.map((p) => [p.week, p.projectedPoints])
    );

    // Calculate average actual and projected across weeks where we have both
    let totalActual = 0;
    let totalProjected = 0;
    let matchedWeeks = 0;

    for (const stat of actualStats) {
      const projected = projectionMap.get(stat.week);
      if (projected != null && projected > 0) {
        totalActual += stat.pprPoints ?? 0;
        totalProjected += projected;
        matchedWeeks++;
      }
    }

    if (matchedWeeks < 2 || totalProjected === 0) return null;

    const avgActual = totalActual / matchedWeeks;
    const avgProjected = totalProjected / matchedWeeks;

    return avgActual / avgProjected;
  }

  /**
   * Generate projection from historical performance data
   * Uses weighted moving average + trend detection + bias correction
   *
   * Algorithm (IMPROVED):
   * 1. Fetch recent stats (last 4-6 weeks)
   * 2. If < 2 games: fallback to position average
   * 3. Calculate weighted average (recent games weighted higher)
   * 4. Detect elite player status (top performers)
   * 5. Detect trend (linear regression)
   * 6. Apply position-specific bias correction
   * 7. Apply injury discount (improved)
   * 8. Calculate confidence based on consistency and position
   */
  async generateProjectionFromHistory(
    playerId: string,
    season: number,
    currentWeek: number,
    lookbackWeeks: number = 6
  ): Promise<PlayerProjectionData | null> {
    // 1. Fetch recent stats
    const recentStats = await playerStatsService.getPlayerRecentStats(
      playerId,
      season,
      currentWeek,
      lookbackWeeks
    );

    // Get player info
    const player = await db.player.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      return null;
    }

    // 2. Insufficient data fallback
    if (recentStats.length < 2) {
      return this.fallbackToPositionAverage(player, currentWeek, season);
    }

    const points = recentStats.map(s => s.pprPoints ?? 0);

    // 3. Weighted average calculation
    const weights = [0.35, 0.30, 0.20, 0.10, 0.05];
    let weightedSum = 0;
    let totalWeight = 0;

    recentStats.slice(0, 5).forEach((stat, i) => {
      const weight = weights[i] ?? 0.05;
      const pts = stat.pprPoints ?? 0;
      weightedSum += pts * weight;
      totalWeight += weight;
    });

    const baseProjection = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // 4. Elite player detection - identify top performers
    const isElitePlayer = this.detectElitePlayer(points, player.position);

    // 5. Trend detection
    const trendMultiplier = this.calculateTrend(points, isElitePlayer);

    // 6. Apply trend adjustment
    let projection = baseProjection * trendMultiplier;

    // 7. Position-specific bias correction (from validation data)
    // Overall bias was -7.34, but varies by position:
    // QB: -12.36 bias, RB: -6.53, WR: -7.09, TE: -5.54
    const biasCorrection = this.getPositionBiasCorrection(player.position, isElitePlayer);
    projection *= biasCorrection;

    // 8. Apply improved injury discount
    if (player.status === 'Questionable') {
      // Reduced from 0.9 to 0.95 - was too aggressive
      projection *= 0.95;
    } else if (player.status === 'Doubtful') {
      projection *= 0.6; // Increased from 0.5
    } else if (player.status === 'Out') {
      projection = 0;
    }

    // 9. Calculate position-aware confidence
    const confidence = this.calculateConfidence(points, player.position);

    return {
      playerId: player.id,
      week: currentWeek,
      season,
      projectedPoints: projection,
      confidence,
      source: 'historical_analysis',
    };
  }

  /**
   * Detect if player is an elite performer
   * Elite = consistently high scoring (avg > position threshold)
   */
  private detectElitePlayer(points: number[], position: string): boolean {
    if (points.length < 3) return false;

    const avgPoints = points.reduce((sum, p) => sum + p, 0) / points.length;

    // Position-specific elite thresholds (based on validation data)
    const eliteThresholds: Record<string, number> = {
      QB: 22.0,  // Elite QBs average 22+ PPR points
      RB: 16.0,  // Elite RBs average 16+ PPR points
      WR: 15.0,  // Elite WRs average 15+ PPR points
      TE: 12.0,  // Elite TEs average 12+ PPR points
      K: 10.0,
      DEF: 10.0,
    };

    const threshold = eliteThresholds[position] ?? 15.0;
    return avgPoints >= threshold;
  }

  /**
   * Get position-specific bias correction multiplier
   * Based on validation results showing systematic under-projection
   * Tuned to balance bias reduction vs variance increase
   */
  private getPositionBiasCorrection(position: string, isElite: boolean): number {
    // Fine-tuned corrections - less aggressive to reduce variance
    // Goal: reduce bias while minimizing MAE increase
    const baseCorrections: Record<string, number> = {
      QB: 1.40,   // QB had -12.36 bias (reduced from 1.50)
      RB: 1.28,   // RB had -6.53 bias (reduced from 1.35)
      WR: 1.30,   // WR had -7.09 bias (reduced from 1.38)
      TE: 1.26,   // TE had -5.54 bias (reduced from 1.32)
      K: 1.32,
      DEF: 1.32,
    };

    let correction = baseCorrections[position] ?? 1.32;

    // Elite players need additional boost (they were most under-projected)
    // But more conservative now
    if (isElite) {
      correction *= 1.08; // Reduced from 1.10 to 1.08
    }

    return correction;
  }

  /**
   * Calculate trend using linear regression
   * Returns multiplier between 0.85 and 1.20 (increased ceiling for elite players)
   */
  private calculateTrend(points: number[], isElite: boolean = false): number {
    if (points.length < 2) return 1.0;

    const n = points.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    // Reverse to have most recent first for proper trend calculation
    const reversedPoints = [...points].reverse();

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += reversedPoints[i];
      sumXY += i * reversedPoints[i];
      sumXX += i * i;
    }

    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) return 1.0;

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const avgPoints = sumY / n;

    if (avgPoints === 0) return 1.0;

    // Convert slope to percentage change
    const slopePercent = slope / avgPoints;

    // Convert to multiplier
    const multiplier = 1.0 + slopePercent;

    // Elite players get higher ceiling (up to 1.20 vs 1.15)
    const maxMultiplier = isElite ? 1.20 : 1.15;
    const minMultiplier = 0.85;

    return Math.max(minMultiplier, Math.min(maxMultiplier, multiplier));
  }

  /**
   * Calculate confidence based on consistency (coefficient of variation)
   * Position-aware: QBs are more volatile, TEs more consistent
   * Returns value between 0.3 and 1.0
   */
  private calculateConfidence(points: number[], position: string = ''): number {
    if (points.length < 2) return 0.3;

    const mean = points.reduce((sum, p) => sum + p, 0) / points.length;

    if (mean === 0) return 0.3;

    const variance =
      points.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / points.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean; // Coefficient of variation

    // Position-specific adjustments
    // QBs and WRs are more volatile → lower confidence baseline
    // RBs and TEs are more consistent → higher confidence baseline
    let adjustedCV = cv;
    if (position === 'QB' || position === 'WR') {
      adjustedCV *= 0.9; // Slightly reduce penalty for QB/WR volatility
    } else if (position === 'TE' || position === 'RB') {
      adjustedCV *= 1.1; // Slightly increase confidence for consistent positions
    }

    // CV < 0.2 = high confidence, CV > 0.5 = low confidence
    const confidence = Math.max(0.3, Math.min(1.0, 1.0 - adjustedCV));

    return confidence;
  }

  /**
   * Fallback to position average when insufficient data
   * Now includes bias correction for better accuracy
   */
  private fallbackToPositionAverage(
    player: any,
    week: number,
    season: number
  ): PlayerProjectionData {
    let baseProjection = 0;
    const stats: any = {};

    switch (player.position) {
      case 'QB':
        baseProjection = 18.5;
        stats.passingYards = 250;
        stats.passingTDs = 1.8;
        stats.interceptions = 0.8;
        stats.rushingYards = 15;
        stats.rushingTDs = 0.2;
        break;
      case 'RB':
        baseProjection = 12.0;
        stats.rushingYards = 65;
        stats.rushingTDs = 0.5;
        stats.receptions = 3;
        stats.receivingYards = 25;
        stats.receivingTDs = 0.15;
        stats.targets = 4;
        break;
      case 'WR':
        baseProjection = 11.0;
        stats.receptions = 5;
        stats.receivingYards = 65;
        stats.receivingTDs = 0.5;
        stats.targets = 7;
        break;
      case 'TE':
        baseProjection = 8.5;
        stats.receptions = 4;
        stats.receivingYards = 45;
        stats.receivingTDs = 0.4;
        stats.targets = 5;
        break;
      case 'K':
        baseProjection = 8.0;
        stats.fieldGoalsMade = 1.5;
        stats.fieldGoalsAttempted = 2;
        stats.extraPointsMade = 2.5;
        break;
      case 'DEF':
        baseProjection = 7.0;
        stats.sacks = 2.5;
        stats.interceptions = 0.8;
        stats.fumblesRecovered = 0.6;
        stats.safeties = 0.05;
        stats.touchdowns = 0.3;
        stats.pointsAllowed = 21;
        break;
      default:
        baseProjection = 0;
    }

    // Apply bias correction to fallback projections too
    // Use conservative correction (not elite) since we don't have performance data
    const biasCorrection = this.getPositionBiasCorrection(player.position, false);
    const projectedPoints = baseProjection * biasCorrection;

    return {
      playerId: player.id,
      week,
      season,
      projectedPoints,
      stats,
      confidence: 0.2, // Low confidence for fallback
      source: 'position_average',
    };
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
