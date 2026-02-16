import { db } from '@fantasy-football/database';
import { projectionService } from './projections';
import { sleeperService } from './sleeper';
import { playerStatsService } from './playerStats';
import { cacheService } from './cache';

/**
 * Player value data for trade analysis
 */
export interface PlayerValue {
  playerId: string;
  playerName: string;
  position: string;
  team?: string;
  currentValue: number; // Average points over recent weeks
  projectedValue: number; // ROS (rest of season) projection
  performanceRatio: number; // actualPoints / projectedPoints
  zScore: number; // Standard deviations from mean
  trend: 'up' | 'down' | 'stable';
  injuryRisk: number; // 0.0 to 1.0
  isSellHigh: boolean;
  isBuyLow: boolean;
}

/**
 * Trade package proposal
 */
export interface TradePackage {
  myPlayers: PlayerValue[];
  targetPlayers: PlayerValue[];
  targetTeamId: string;
  targetTeamName: string;
  fairnessScore: number;
  acceptanceProbability: number;
  myValueGain: number;
  targetValueGain: number;
  tradeType: '1-for-1' | '2-for-1' | '1-for-2' | '2-for-2';
  reasoning: string;
  confidence: number;
}

/**
 * Opponent profile for trade acceptance prediction
 */
export interface OpponentData {
  teamId: string;
  teamName: string;
  qbPreference: number;
  rbPreference: number;
  wrPreference: number;
  tePreference: number;
  riskTolerance: number;
  acceptanceRate: number;
  prefersStars: boolean;
  prefersDepth: boolean;
}

/**
 * Trade Analyzer Service
 * Implements sell-high/buy-low detection and trade package generation
 */
export class TradeAnalyzerService {
  /**
   * Calculate player's performance ratio
   * Compares actual points to projected points over last N weeks
   */
  async calculatePerformanceRatio(
    playerId: string,
    leagueId: string,
    season: number,
    currentWeek: number,
    weeksToAnalyze: number = 4
  ): Promise<{ ratio: number; zScore: number } | null> {
    // Try cache first
    const cached = await cacheService.getPerformanceRatio(playerId, season, currentWeek);
    if (cached) {
      return cached;
    }

    // 1. Fetch recent actual stats
    let recentStats = await playerStatsService.getPlayerRecentStats(
      playerId,
      season,
      currentWeek,
      weeksToAnalyze
    );

    // If insufficient data, try on-demand fetch
    if (recentStats.length < 2) {
      console.log(
        `[TradeAnalyzer] Insufficient stats for player ${playerId}, attempting on-demand fetch...`
      );

      // Try to sync recent weeks
      for (let week = Math.max(1, currentWeek - weeksToAnalyze); week < currentWeek; week++) {
        await playerStatsService.syncWeekStats(season, week).catch(err => {
          console.error(`Failed to sync week ${week}:`, err);
        });
      }

      // Retry fetch
      recentStats = await playerStatsService.getPlayerRecentStats(
        playerId,
        season,
        currentWeek,
        weeksToAnalyze
      );

      if (recentStats.length < 2) {
        console.log(
          `[TradeAnalyzer] Still insufficient data for player ${playerId} after on-demand fetch`
        );
        return null;
      }
    }

    // 2. Get league scoring settings
    const league = await db.league.findUnique({
      where: { id: leagueId },
    });

    if (!league || !league.scoringSettings) {
      console.error(`[TradeAnalyzer] League ${leagueId} not found or missing scoring settings`);
      return null;
    }

    const scoringSettings = league.scoringSettings as Record<string, number>;

    // 3. Calculate average actual points
    const actualPoints = recentStats.map((stat) =>
      playerStatsService.getFantasyPoints(stat, scoringSettings) ?? 0
    );

    const avgActual = actualPoints.reduce((a, b) => a + b, 0) / actualPoints.length;

    // 4. Get historical projections for those weeks (or generate them)
    const projectedPoints: number[] = [];

    for (const stat of recentStats) {
      let projection = await projectionService.getPlayerProjection(
        playerId,
        stat.week,
        season
      );

      // If no projection exists, generate one from history
      if (!projection) {
        const generated = await projectionService.generateProjectionFromHistory(
          playerId,
          season,
          stat.week
        );
        if (generated) {
          projectedPoints.push(generated.projectedPoints);
        }
      } else {
        projectedPoints.push(projection.projectedPoints);
      }
    }

    if (projectedPoints.length === 0) {
      console.log(`[TradeAnalyzer] No projections available for player ${playerId}`);
      return null;
    }

    const avgProjected =
      projectedPoints.reduce((a, b) => a + b, 0) / projectedPoints.length;

    // 5. Calculate ratio
    if (avgProjected < 0.5) {
      console.log(`[TradeAnalyzer] Average projected points too low (${avgProjected.toFixed(2)}) for player ${playerId}`);
      return null;
    }

    const ratio = avgActual / avgProjected;

    // 6. Calculate z-score vs position peers
    const player = await db.player.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      return null;
    }

    const zScore = await this.calculatePositionZScore(
      player.position,
      ratio,
      season,
      currentWeek,
      weeksToAnalyze
    );

    const result = { ratio, zScore };

    // Cache the result
    await cacheService.setPerformanceRatio(playerId, season, currentWeek, result);

    return result;
  }

  /**
   * Calculate position z-score
   * Compare player's ratio against all players at same position
   */
  private async calculatePositionZScore(
    position: string,
    playerRatio: number,
    season: number,
    currentWeek: number,
    weeksToAnalyze: number
  ): Promise<number> {
    // Get all players at this position with recent stats
    const players = await db.player.findMany({
      where: {
        position,
        status: { in: ['Active', 'Questionable'] },
      },
      include: {
        weekStats: {
          where: {
            season,
            week: {
              gte: Math.max(1, currentWeek - weeksToAnalyze),
              lt: currentWeek,
            },
          },
        },
        projections: {
          where: {
            season,
            week: {
              gte: Math.max(1, currentWeek - weeksToAnalyze),
              lt: currentWeek,
            },
          },
        },
      },
    });

    // Calculate ratios for all players with sufficient data
    const ratios: number[] = [];

    for (const player of players) {
      if (player.weekStats.length < 2 || player.projections.length < 2) {
        continue; // Skip players with insufficient data
      }

      const avgActual =
        player.weekStats.reduce((sum, s) => sum + (s.pprPoints ?? 0), 0) /
        player.weekStats.length;
      const avgProj =
        player.projections.reduce((sum, p) => sum + p.projectedPoints, 0) /
        player.projections.length;

      if (avgProj > 0) {
        ratios.push(avgActual / avgProj);
      }
    }

    // If not enough peer data, use default distribution
    if (ratios.length < 10) {
      // Assume normal distribution centered at 1.0 with std dev of 0.15
      return (playerRatio - 1.0) / 0.15;
    }

    // Calculate z-score from actual peer distribution
    const mean = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
    const variance =
      ratios.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / ratios.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    return (playerRatio - mean) / stdDev;
  }

  /**
   * Calculate player's current value based on recent performance
   */
  async calculatePlayerValue(
    playerId: string,
    leagueId: string,
    season: number,
    currentWeek: number
  ): Promise<PlayerValue | null> {
    // Get player data
    const player = await db.player.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      return null;
    }

    // Get ROS (rest of season) projection
    const rosProjection = await projectionService.getPlayerProjection(
      playerId,
      0, // Week 0 = season-long
      season
    );

    if (!rosProjection) {
      return null;
    }

    // Calculate performance ratio
    const perfData = await this.calculatePerformanceRatio(
      playerId,
      leagueId,
      season,
      currentWeek
    );
    const performanceRatio = perfData?.ratio || 1.0;
    const zScore = perfData?.zScore || 0;

    // Calculate current value (simplified - in production, use recent weeks average)
    const currentValue = rosProjection.projectedPoints * performanceRatio;

    // Determine injury risk based on status
    let injuryRisk = 0.0;
    if (player.status === 'Out') injuryRisk = 1.0;
    else if (player.status === 'Doubtful') injuryRisk = 0.8;
    else if (player.status === 'Questionable') injuryRisk = 0.3;

    // Determine trend
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (performanceRatio > 1.1) trend = 'up';
    else if (performanceRatio < 0.9) trend = 'down';

    // Sell-high criteria: performing >15% above projection AND z-score > 0.5
    const isSellHigh = performanceRatio > 1.15 && zScore > 0.5;

    // Buy-low criteria: undervalued >20% AND injury risk < 0.3
    const currentValueDiscount = 1.0 - performanceRatio;
    const isBuyLow = currentValueDiscount > 0.2 && injuryRisk < 0.3;

    return {
      playerId: player.id,
      playerName: player.fullName,
      position: player.position,
      team: player.team || undefined,
      currentValue,
      projectedValue: rosProjection.projectedPoints,
      performanceRatio,
      zScore,
      trend,
      injuryRisk,
      isSellHigh,
      isBuyLow,
    };
  }

  /**
   * Get all player values for a roster
   */
  async getRosterValues(
    leagueId: string,
    season: number,
    currentWeek: number
  ): Promise<PlayerValue[]> {
    // Get roster for this league
    const roster = await db.roster.findMany({
      where: { leagueId },
      include: {
        player: true,
      },
    });

    const playerValues: PlayerValue[] = [];

    for (const rosterEntry of roster) {
      const value = await this.calculatePlayerValue(
        rosterEntry.playerId,
        leagueId,
        season,
        currentWeek
      );

      if (value) {
        playerValues.push(value);
      }
    }

    return playerValues;
  }

  /**
   * Get all player values for all rosters in a league
   */
  async getAllLeaguePlayerValues(
    leagueId: string,
    season: number,
    currentWeek: number
  ): Promise<Map<string, PlayerValue[]>> {
    // Get league info to find all teams
    const league = await db.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) {
      throw new Error('League not found');
    }

    // Get all rosters from Sleeper
    const rosters = await sleeperService.getRosters(league.platformLeagueId);

    const teamValues = new Map<string, PlayerValue[]>();

    for (const roster of rosters) {
      const rosterOwnerId = roster.owner_id || roster.roster_id?.toString();
      if (!rosterOwnerId) continue;

      const playerValues: PlayerValue[] = [];

      // Get value for each player on this team
      for (const playerId of roster.players || []) {
        const value = await this.calculatePlayerValue(playerId, leagueId, season, currentWeek);
        if (value) {
          playerValues.push(value);
        }
      }

      teamValues.set(rosterOwnerId, playerValues);
    }

    return teamValues;
  }

  /**
   * Calculate fairness score for a trade
   * Returns value between 0 and 1 (>0.6 is considered fair)
   */
  calculateFairnessScore(
    myPlayers: PlayerValue[],
    targetPlayers: PlayerValue[]
  ): number {
    const myTotalValue = myPlayers.reduce((sum, p) => sum + p.projectedValue, 0);
    const targetTotalValue = targetPlayers.reduce((sum, p) => sum + p.projectedValue, 0);

    if (myTotalValue === 0 || targetTotalValue === 0) {
      return 0;
    }

    // Calculate value ratio (closer to 1.0 = more fair)
    const valueRatio =
      myTotalValue > targetTotalValue
        ? targetTotalValue / myTotalValue
        : myTotalValue / targetTotalValue;

    // Convert to 0-1 scale where 1.0 ratio = 1.0 score
    // Allow up to 20% value difference for fairness
    return Math.min(1.0, valueRatio / 0.8);
  }

  /**
   * Calculate acceptance probability based on opponent profile
   */
  async calculateAcceptanceProbability(
    targetTeamId: string,
    leagueId: string,
    myPlayers: PlayerValue[],
    targetPlayers: PlayerValue[],
    fairnessScore: number
  ): Promise<number> {
    // Get opponent profile
    let opponentProfile = await db.opponentProfile.findUnique({
      where: {
        leagueId_opponentTeamId: {
          leagueId,
          opponentTeamId: targetTeamId,
        },
      },
    });

    // If no profile exists, use defaults
    if (!opponentProfile) {
      opponentProfile = {
        id: '',
        leagueId,
        opponentTeamId: targetTeamId,
        opponentTeamName: null,
        qbPreference: 0.5,
        rbPreference: 0.5,
        wrPreference: 0.5,
        tePreference: 0.5,
        riskTolerance: 0.5,
        tradingActivity: 0.5,
        acceptanceRate: 0.3,
        totalTradesProposed: 0,
        totalTradesAccepted: 0,
        totalTradesRejected: 0,
        totalTradesInitiated: 0,
        prefersStars: false,
        prefersDepth: false,
        valuesSafety: true,
        lastUpdated: new Date(),
        lastTradeDate: null,
        dataPoints: 0,
      };
    }

    // Base probability from historical acceptance rate
    let probability = opponentProfile.acceptanceRate;

    // Adjust for fairness (heavily weighted)
    probability *= fairnessScore * 1.5;

    // Adjust for position preferences
    for (const player of targetPlayers) {
      let positionBonus = 0;
      switch (player.position) {
        case 'QB':
          positionBonus = (opponentProfile.qbPreference - 0.5) * 0.2;
          break;
        case 'RB':
          positionBonus = (opponentProfile.rbPreference - 0.5) * 0.2;
          break;
        case 'WR':
          positionBonus = (opponentProfile.wrPreference - 0.5) * 0.2;
          break;
        case 'TE':
          positionBonus = (opponentProfile.tePreference - 0.5) * 0.2;
          break;
      }
      probability += positionBonus;
    }

    // Adjust for risk tolerance
    const avgInjuryRisk =
      targetPlayers.reduce((sum, p) => sum + p.injuryRisk, 0) / targetPlayers.length;
    if (avgInjuryRisk > 0.3 && !opponentProfile.valuesSafety) {
      probability -= 0.1; // Penalize risky trades for safety-conscious opponents
    }

    // Adjust for star vs depth preference
    if (opponentProfile.prefersStars && targetPlayers.length > myPlayers.length) {
      probability += 0.1; // They're getting fewer, higher-value players
    }
    if (opponentProfile.prefersDepth && myPlayers.length > targetPlayers.length) {
      probability += 0.1; // They're getting more players
    }

    // Cap between 0 and 1
    return Math.max(0, Math.min(1, probability));
  }

  /**
   * Generate trade packages (1-for-1, 2-for-1, 2-for-2)
   */
  async generateTradePackages(
    leagueId: string,
    season: number,
    currentWeek: number,
    maxPackages: number = 10
  ): Promise<TradePackage[]> {
    // Get all player values in the league
    const allTeamValues = await this.getAllLeaguePlayerValues(
      leagueId,
      season,
      currentWeek
    );

    // Get my team's roster
    const myRoster = await this.getRosterValues(leagueId, season, currentWeek);

    // Get league info to find my team ID
    const league = await db.league.findUnique({
      where: { id: leagueId },
    });

    if (!league || !league.platformTeamId) {
      throw new Error('League or team not found');
    }

    const myTeamId = league.platformTeamId;

    // Build owner_id → team name mapping from Sleeper
    const teamNameMap = new Map<string, string>();
    try {
      const users = await sleeperService.getLeagueUsers(league.platformLeagueId);
      if (users) {
        for (const user of users) {
          const name = user.metadata?.team_name || user.display_name;
          teamNameMap.set(user.user_id, name);
        }
      }
    } catch {
      // Non-critical: fall back to generic names
    }

    // Identify sell-high candidates from my roster
    const sellHighCandidates = myRoster.filter((p) => p.isSellHigh);

    // Identify buy-low targets from other teams
    const buyLowTargets: Array<{ player: PlayerValue; teamId: string }> = [];
    for (const [teamId, players] of allTeamValues.entries()) {
      if (teamId === myTeamId) continue; // Skip my own team

      for (const player of players) {
        if (player.isBuyLow) {
          buyLowTargets.push({ player, teamId });
        }
      }
    }

    const packages: TradePackage[] = [];

    // Generate 1-for-1 trades
    for (const myPlayer of sellHighCandidates) {
      for (const { player: targetPlayer, teamId } of buyLowTargets) {
        const pkg = await this.createTradePackage(
          leagueId,
          [myPlayer],
          [targetPlayer],
          teamId,
          '1-for-1',
          teamNameMap
        );

        if (pkg && pkg.fairnessScore > 0.6 && pkg.acceptanceProbability > 0.25) {
          packages.push(pkg);
        }
      }
    }

    // Generate 2-for-1 trades (I give 2, receive 1 high-value player)
    for (let i = 0; i < myRoster.length; i++) {
      for (let j = i + 1; j < myRoster.length; j++) {
        const myPlayers = [myRoster[i], myRoster[j]];

        for (const [teamId, opponentRoster] of allTeamValues.entries()) {
          if (teamId === myTeamId) continue;

          for (const targetPlayer of opponentRoster) {
            const pkg = await this.createTradePackage(
              leagueId,
              myPlayers,
              [targetPlayer],
              teamId,
              '2-for-1',
              teamNameMap
            );

            if (pkg && pkg.fairnessScore > 0.6 && pkg.acceptanceProbability > 0.25) {
              packages.push(pkg);
            }
          }
        }
      }
    }

    // Generate 2-for-2 trades
    for (let i = 0; i < myRoster.length; i++) {
      for (let j = i + 1; j < myRoster.length; j++) {
        const myPlayers = [myRoster[i], myRoster[j]];

        for (const [teamId, opponentRoster] of allTeamValues.entries()) {
          if (teamId === myTeamId) continue;

          for (let k = 0; k < opponentRoster.length; k++) {
            for (let l = k + 1; l < opponentRoster.length; l++) {
              const targetPlayers = [opponentRoster[k], opponentRoster[l]];

              const pkg = await this.createTradePackage(
                leagueId,
                myPlayers,
                targetPlayers,
                teamId,
                '2-for-2',
                teamNameMap
              );

              if (pkg && pkg.fairnessScore > 0.6 && pkg.acceptanceProbability > 0.25) {
                packages.push(pkg);
              }
            }
          }
        }
      }
    }

    // Sort by acceptance probability * fairness score and return top N
    packages.sort((a, b) => {
      const scoreA = a.acceptanceProbability * a.fairnessScore * a.myValueGain;
      const scoreB = b.acceptanceProbability * b.fairnessScore * b.myValueGain;
      return scoreB - scoreA;
    });

    return packages.slice(0, maxPackages);
  }

  /**
   * Create a single trade package with all metrics
   */
  private async createTradePackage(
    leagueId: string,
    myPlayers: PlayerValue[],
    targetPlayers: PlayerValue[],
    targetTeamId: string,
    tradeType: '1-for-1' | '2-for-1' | '1-for-2' | '2-for-2',
    teamNameMap?: Map<string, string>
  ): Promise<TradePackage | null> {
    // Calculate values
    const myTotalValue = myPlayers.reduce((sum, p) => sum + p.projectedValue, 0);
    const targetTotalValue = targetPlayers.reduce((sum, p) => sum + p.projectedValue, 0);

    const fairnessScore = this.calculateFairnessScore(myPlayers, targetPlayers);
    const acceptanceProbability = await this.calculateAcceptanceProbability(
      targetTeamId,
      leagueId,
      myPlayers,
      targetPlayers,
      fairnessScore
    );

    const myValueGain = targetTotalValue - myTotalValue;
    const targetValueGain = myTotalValue - targetTotalValue;

    // Generate reasoning
    const reasoning = this.generateTradeReasoning(
      myPlayers,
      targetPlayers,
      myValueGain,
      fairnessScore
    );

    return {
      myPlayers,
      targetPlayers,
      targetTeamId,
      targetTeamName: teamNameMap?.get(targetTeamId) || 'Opponent',
      fairnessScore,
      acceptanceProbability,
      myValueGain,
      targetValueGain,
      tradeType,
      reasoning,
      confidence: fairnessScore * acceptanceProbability,
    };
  }

  /**
   * Generate human-readable reasoning for trade
   */
  private generateTradeReasoning(
    myPlayers: PlayerValue[],
    targetPlayers: PlayerValue[],
    myValueGain: number,
    fairnessScore: number
  ): string {
    const sellHighPlayers = myPlayers.filter((p) => p.isSellHigh);
    const buyLowPlayers = targetPlayers.filter((p) => p.isBuyLow);

    let reasoning = '';

    if (sellHighPlayers.length > 0) {
      const names = sellHighPlayers.map((p) => p.playerName).join(', ');
      reasoning += `Sell high on ${names} who are performing above expectations. `;
    }

    if (buyLowPlayers.length > 0) {
      const names = buyLowPlayers.map((p) => p.playerName).join(', ');
      reasoning += `Buy low on ${names} who are undervalued. `;
    }

    if (myValueGain > 0) {
      reasoning += `This trade gains you ${myValueGain.toFixed(1)} projected points. `;
    }

    if (fairnessScore > 0.8) {
      reasoning += 'Very fair value exchange.';
    } else if (fairnessScore > 0.6) {
      reasoning += 'Reasonably fair trade.';
    }

    return reasoning.trim();
  }

  /**
   * Save trade recommendations to database
   */
  async saveRecommendations(
    leagueId: string,
    week: number,
    season: number,
    packages: TradePackage[]
  ): Promise<void> {
    // Delete old recommendations for this week
    await db.tradeRecommendation.deleteMany({
      where: {
        leagueId,
        week,
        season,
      },
    });

    // Save new recommendations
    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];

      await db.tradeRecommendation.create({
        data: {
          leagueId,
          week,
          season,
          myPlayers: pkg.myPlayers as any,
          targetPlayers: pkg.targetPlayers as any,
          targetTeamId: pkg.targetTeamId,
          targetTeamName: pkg.targetTeamName,
          fairnessScore: pkg.fairnessScore,
          acceptanceProbability: pkg.acceptanceProbability,
          myValueGain: pkg.myValueGain,
          targetValueGain: pkg.targetValueGain,
          tradeType: pkg.tradeType,
          reasoning: pkg.reasoning,
          sellHighPlayers: pkg.myPlayers.filter((p) => p.isSellHigh) as any,
          buyLowPlayers: pkg.targetPlayers.filter((p) => p.isBuyLow) as any,
          confidence: pkg.confidence,
          priority: packages.length - i, // Higher priority for earlier packages
          status: 'pending',
        },
      });
    }
  }

  /**
   * Get trade recommendations for a league
   */
  async getRecommendations(
    leagueId: string,
    week: number,
    season: number
  ): Promise<any[]> {
    return await db.tradeRecommendation.findMany({
      where: {
        leagueId,
        week,
        season,
        status: 'pending',
      },
      orderBy: {
        priority: 'desc',
      },
    });
  }
}

// Export singleton instance
export const tradeAnalyzerService = new TradeAnalyzerService();
