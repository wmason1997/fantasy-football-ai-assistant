import { db } from '@fantasy-football/database';
import { projectionService } from './projections';
import { sleeperService } from './sleeper';

/**
 * Player opportunity data
 */
export interface PlayerOpportunity {
  playerId: string;
  playerName: string;
  position: string;
  team?: string;

  // Opportunity metrics
  opportunityScore: number; // 0.0 to 1.0
  projectedPoints: number;
  recentPerformance: number;
  targetShare?: number;
  snapShare?: number;
  injuryImpact: boolean;

  // Availability
  isAvailable: boolean;
  ownedPercentage?: number;
  addTrendPercentage?: number;
}

/**
 * Positional need assessment
 */
export interface PositionalNeed {
  position: string;
  needScore: number; // 0.0 to 1.0 (1.0 = critical need)
  currentStarters: number;
  requiredStarters: number;
  benchDepth: number;
  avgStarterValue: number;
}

/**
 * Waiver recommendation
 */
export interface WaiverRecommendation {
  player: PlayerOpportunity;
  positionalNeed: number;
  wouldStartImmediately: boolean;
  benchDepthScore: number;

  // FAAB bidding
  recommendedBid?: number;
  minBid?: number;
  maxBid?: number;
  medianHistoricalBid?: number;

  // Waiver priority
  priorityRank?: number;
  shouldClaim?: boolean;

  // Drop suggestion
  suggestedDropPlayer?: {
    playerId: string;
    playerName: string;
    value: number;
  };

  reasoning: string;
  confidence: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Waiver Optimizer Service
 * Identifies high-value waiver targets and calculates optimal FAAB bids
 */
export class WaiverOptimizerService {
  /**
   * Calculate opportunity score for a player
   * Based on projected value, recent performance, and opportunity indicators
   *
   * Formula: opportunityScore = (projectionChange + recentPerformance + opportunityFactors) / 3
   */
  async calculateOpportunityScore(
    playerId: string,
    season: number,
    currentWeek: number
  ): Promise<number> {
    // Get player projection
    const projection = await projectionService.getPlayerProjection(playerId, 0, season);

    if (!projection) {
      return 0;
    }

    const player = await db.player.findUnique({ where: { id: playerId } });

    if (!player) {
      return 0;
    }

    // Components of opportunity score
    let projectionScore = 0;
    let performanceScore = 0;
    let opportunityFactors = 0;

    // 1. Projection score (normalized 0-1)
    // Higher projected points = higher score
    const avgProjectionByPosition: Record<string, number> = {
      QB: 18.5,
      RB: 12.0,
      WR: 11.0,
      TE: 8.5,
      K: 8.0,
      DEF: 7.0,
    };

    const avgProj = avgProjectionByPosition[player.position] || 10.0;
    projectionScore = Math.min(1.0, projection.projectedPoints / (avgProj * 1.5));

    // 2. Recent performance score (mock - would fetch actual stats)
    // In production, calculate last 3 weeks average
    performanceScore = 0.5 + Math.random() * 0.3; // Mock: 0.5 to 0.8

    // 3. Opportunity factors
    let factorCount = 0;
    let factorSum = 0;

    // Injury status (healthy = opportunity)
    if (player.status === 'Active') {
      factorSum += 0.7;
      factorCount++;
    } else if (player.status === 'Questionable') {
      factorSum += 0.4;
      factorCount++;
    }

    // Position scarcity bonus
    if (['RB', 'TE'].includes(player.position)) {
      factorSum += 0.6; // Scarcer positions get bonus
      factorCount++;
    } else if (player.position === 'WR') {
      factorSum += 0.5;
      factorCount++;
    }

    // Opportunity from teammate injury (simplified check)
    // In production, check if team has injured starter at this position
    const hasInjuryOpportunity = Math.random() > 0.7; // Mock
    if (hasInjuryOpportunity) {
      factorSum += 0.8;
      factorCount++;
    }

    opportunityFactors = factorCount > 0 ? factorSum / factorCount : 0.5;

    // Final opportunity score (weighted average)
    const opportunityScore =
      projectionScore * 0.4 +
      performanceScore * 0.3 +
      opportunityFactors * 0.3;

    return Math.min(1.0, Math.max(0.0, opportunityScore));
  }

  /**
   * Analyze positional needs for a roster
   */
  async analyzePositionalNeeds(
    leagueId: string,
    season: number,
    currentWeek: number
  ): Promise<Map<string, PositionalNeed>> {
    // Get league roster
    const roster = await db.roster.findMany({
      where: { leagueId },
      include: {
        player: true,
      },
    });

    // Get league settings to determine starter requirements
    const league = await db.league.findUnique({
      where: { id: leagueId },
    });

    // Default starter requirements (standard league)
    const starterRequirements: Record<string, number> = {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      FLEX: 1, // RB/WR/TE
      K: 1,
      DEF: 1,
    };

    // Calculate needs for each position
    const needs = new Map<string, PositionalNeed>();
    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

    for (const position of positions) {
      const positionPlayers = roster.filter(r => r.player.position === position);
      const required = starterRequirements[position] || 0;

      // Get player values for this position
      const playerValues = await Promise.all(
        positionPlayers.map(async (r) => {
          const proj = await projectionService.getPlayerProjection(
            r.playerId,
            0,
            season
          );
          return proj?.projectedPoints || 0;
        })
      );

      // Sort by value
      playerValues.sort((a, b) => b - a);

      // Calculate average starter value
      const starters = playerValues.slice(0, required);
      const avgStarterValue = starters.length > 0
        ? starters.reduce((sum, val) => sum + val, 0) / starters.length
        : 0;

      // Calculate need score
      let needScore = 0;

      if (positionPlayers.length < required) {
        // Critical need - not enough players to fill starters
        needScore = 1.0;
      } else if (positionPlayers.length === required) {
        // High need - no bench depth
        needScore = 0.8;
      } else if (positionPlayers.length === required + 1) {
        // Medium need - minimal depth
        needScore = 0.5;
      } else if (avgStarterValue < 8.0) {
        // Low starter quality
        needScore = 0.6;
      } else {
        // Adequate depth
        needScore = 0.2;
      }

      needs.set(position, {
        position,
        needScore,
        currentStarters: Math.min(positionPlayers.length, required),
        requiredStarters: required,
        benchDepth: Math.max(0, positionPlayers.length - required),
        avgStarterValue,
      });
    }

    return needs;
  }

  /**
   * Calculate FAAB bid recommendation
   * Based on CLAUDE.md algorithm
   */
  async calculateFAABBid(
    leagueId: string,
    playerId: string,
    opportunityScore: number,
    positionalNeed: number,
    addTrendPercentage: number,
    season: number,
    currentWeek: number
  ): Promise<{
    recommendedBid: number;
    minBid: number;
    maxBid: number;
    medianHistoricalBid: number;
  }> {
    // Get league FAAB budget
    const league = await db.league.findUnique({
      where: { id: leagueId },
    });

    const currentFAAB = league?.currentFaab || 100;

    // Calculate median historical bid for similar adds
    // In production, analyze past waiver transactions
    const medianHistoricalBid = await this.getMedianHistoricalBid(
      leagueId,
      playerId,
      season
    );

    // FAAB calculation from CLAUDE.md:
    // baseBid = medianHistoricalBid
    // baseBid *= (1 + opportunityScore * 0.5)  // value adjustment
    // baseBid *= (1 + positionalNeed * 0.3)     // need adjustment
    // if (addTrend > 20) baseBid *= 1.2         // urgency adjustment
    // maxBid = min(baseBid, currentFAAB * 0.4)

    let baseBid = medianHistoricalBid;

    // Value adjustment
    baseBid *= (1 + opportunityScore * 0.5);

    // Need adjustment
    baseBid *= (1 + positionalNeed * 0.3);

    // Urgency adjustment (if >20% of leagues are adding)
    if (addTrendPercentage > 20) {
      baseBid *= 1.2;
    }

    // Never recommend more than 40% of remaining budget
    const maxBid = Math.min(baseBid, currentFAAB * 0.4);
    const recommendedBid = Math.round(maxBid);

    // Calculate minimum competitive bid (50% of recommended)
    const minBid = Math.round(recommendedBid * 0.5);

    return {
      recommendedBid: Math.max(1, recommendedBid),
      minBid: Math.max(0, minBid),
      maxBid: Math.round(maxBid),
      medianHistoricalBid,
    };
  }

  /**
   * Get median historical FAAB bid from league transactions
   */
  private async getMedianHistoricalBid(
    leagueId: string,
    playerId: string,
    season: number
  ): Promise<number> {
    // Get historical waiver transactions for this league
    const transactions = await db.transaction.findMany({
      where: {
        leagueId,
        season,
        transactionType: 'waiver',
      },
    });

    // Extract FAAB amounts from transactions
    const bids: number[] = [];

    for (const txn of transactions) {
      const playersMoved = txn.playersMoved as any;

      // Look for FAAB amounts in the transaction metadata
      if (playersMoved && typeof playersMoved === 'object') {
        // Sleeper structure varies, might need adjustment
        const metadata = txn.metadata as any;
        if (metadata?.settings?.waiver_bid) {
          bids.push(metadata.settings.waiver_bid);
        }
      }
    }

    // Calculate median
    if (bids.length === 0) {
      // Default to 5% of budget if no history
      return 5;
    }

    bids.sort((a, b) => a - b);
    const mid = Math.floor(bids.length / 2);
    const median = bids.length % 2 === 0
      ? (bids[mid - 1] + bids[mid]) / 2
      : bids[mid];

    return Math.round(median);
  }

  /**
   * Identify waiver targets (available players with opportunityScore > 0.3)
   */
  async identifyWaiverTargets(
    leagueId: string,
    season: number,
    currentWeek: number
  ): Promise<PlayerOpportunity[]> {
    const league = await db.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) {
      throw new Error('League not found');
    }

    // Get all rostered players in the league
    const rosters = await sleeperService.getRosters(league.platformLeagueId);
    const rosteredPlayerIds = new Set<string>();

    for (const roster of rosters) {
      for (const playerId of roster.players || []) {
        rosteredPlayerIds.add(playerId);
      }
    }

    // Get all players
    const allPlayers = await db.player.findMany({
      where: {
        status: {
          in: ['Active', 'Questionable'],
        },
      },
    });

    // Filter to available players only
    const availablePlayers = allPlayers.filter(p => !rosteredPlayerIds.has(p.id));

    // Calculate opportunity scores
    const targets: PlayerOpportunity[] = [];

    for (const player of availablePlayers) {
      const opportunityScore = await this.calculateOpportunityScore(
        player.id,
        season,
        currentWeek
      );

      // Only include if opportunityScore > 0.3
      if (opportunityScore > 0.3) {
        const projection = await projectionService.getPlayerProjection(
          player.id,
          0,
          season
        );

        targets.push({
          playerId: player.id,
          playerName: player.fullName,
          position: player.position,
          team: player.team || undefined,
          opportunityScore,
          projectedPoints: projection?.projectedPoints || 0,
          recentPerformance: 0, // Mock - would calculate from stats
          injuryImpact: false, // Mock - would check teammate injuries
          isAvailable: true,
          addTrendPercentage: Math.random() * 40, // Mock - would fetch from API
        });
      }
    }

    // Sort by opportunity score
    targets.sort((a, b) => b.opportunityScore - a.opportunityScore);

    return targets;
  }

  /**
   * Find best drop candidate from roster
   */
  async findDropCandidate(
    leagueId: string,
    targetPosition: string,
    season: number,
    currentWeek: number
  ): Promise<{ playerId: string; playerName: string; value: number } | null> {
    const roster = await db.roster.findMany({
      where: { leagueId },
      include: {
        player: true,
      },
    });

    // Get player values
    const playerValues: Array<{ id: string; name: string; value: number; position: string }> = [];

    for (const rosterEntry of roster) {
      const projection = await projectionService.getPlayerProjection(
        rosterEntry.playerId,
        0,
        season
      );

      playerValues.push({
        id: rosterEntry.playerId,
        name: rosterEntry.player.fullName,
        value: projection?.projectedPoints || 0,
        position: rosterEntry.player.position,
      });
    }

    // Sort by value (ascending - lowest first)
    playerValues.sort((a, b) => a.value - b.value);

    // Prefer dropping same position or bench players
    // For simplicity, return lowest value player
    if (playerValues.length > 0) {
      const drop = playerValues[0];
      return {
        playerId: drop.id,
        playerName: drop.name,
        value: drop.value,
      };
    }

    return null;
  }

  /**
   * Generate waiver recommendations for a league
   */
  async generateRecommendations(
    leagueId: string,
    season: number,
    currentWeek: number,
    useFAAB: boolean = true,
    maxRecommendations: number = 10
  ): Promise<WaiverRecommendation[]> {
    console.log(`Generating waiver recommendations for league ${leagueId}...`);

    // Identify high-value targets
    const targets = await this.identifyWaiverTargets(leagueId, season, currentWeek);

    // Analyze positional needs
    const positionalNeeds = await this.analyzePositionalNeeds(leagueId, season, currentWeek);

    const recommendations: WaiverRecommendation[] = [];

    for (const target of targets.slice(0, maxRecommendations * 2)) {
      const need = positionalNeeds.get(target.position);
      const positionalNeed = need?.needScore || 0.5;

      // Calculate if would start immediately
      const wouldStartImmediately = positionalNeed > 0.7;

      // Calculate bench depth improvement
      const benchDepthScore = target.opportunityScore * (1 - positionalNeed * 0.3);

      let recommendedBid, minBid, maxBid, medianHistoricalBid;
      let priorityRank, shouldClaim;

      if (useFAAB) {
        // Calculate FAAB bid
        const bidCalc = await this.calculateFAABBid(
          leagueId,
          target.playerId,
          target.opportunityScore,
          positionalNeed,
          target.addTrendPercentage || 0,
          season,
          currentWeek
        );

        recommendedBid = bidCalc.recommendedBid;
        minBid = bidCalc.minBid;
        maxBid = bidCalc.maxBid;
        medianHistoricalBid = bidCalc.medianHistoricalBid;
      } else {
        // Calculate waiver priority ranking
        const compositeScore =
          target.opportunityScore * 0.5 +
          positionalNeed * 0.3 +
          target.projectedPoints / 20 * 0.2;

        priorityRank = Math.round(compositeScore * 100);
        shouldClaim = compositeScore > 0.4;
      }

      // Find drop candidate
      const dropCandidate = await this.findDropCandidate(
        leagueId,
        target.position,
        season,
        currentWeek
      );

      // Generate reasoning
      const reasoning = this.generateReasoning(
        target,
        positionalNeed,
        wouldStartImmediately,
        useFAAB ? recommendedBid : undefined
      );

      // Determine urgency
      let urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium';
      if (target.opportunityScore > 0.8 || (target.addTrendPercentage || 0) > 30) {
        urgency = 'critical';
      } else if (target.opportunityScore > 0.6) {
        urgency = 'high';
      } else if (target.opportunityScore < 0.4) {
        urgency = 'low';
      }

      // Calculate confidence
      const confidence = target.opportunityScore * 0.7 + positionalNeed * 0.3;

      recommendations.push({
        player: target,
        positionalNeed,
        wouldStartImmediately,
        benchDepthScore,
        recommendedBid,
        minBid,
        maxBid,
        medianHistoricalBid,
        priorityRank,
        shouldClaim,
        suggestedDropPlayer: dropCandidate || undefined,
        reasoning,
        confidence,
        urgency,
      });
    }

    // Sort by composite score
    recommendations.sort((a, b) => {
      const scoreA = a.player.opportunityScore * a.confidence;
      const scoreB = b.player.opportunityScore * b.confidence;
      return scoreB - scoreA;
    });

    return recommendations.slice(0, maxRecommendations);
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    player: PlayerOpportunity,
    positionalNeed: number,
    wouldStart: boolean,
    bid?: number
  ): string {
    let reasoning = `${player.playerName} (${player.position})`;

    if (player.opportunityScore > 0.7) {
      reasoning += ' has excellent opportunity with high projected value.';
    } else if (player.opportunityScore > 0.5) {
      reasoning += ' shows strong upside potential.';
    } else {
      reasoning += ' presents a solid waiver option.';
    }

    if (wouldStart) {
      reasoning += ' Would start immediately based on roster needs.';
    } else if (positionalNeed > 0.5) {
      reasoning += ` Fills a need at ${player.position}.`;
    }

    if (player.injuryImpact) {
      reasoning += ' Benefiting from teammate injury.';
    }

    if (bid !== undefined) {
      reasoning += ` Recommended FAAB bid: $${bid}.`;
    }

    return reasoning;
  }

  /**
   * Save recommendations to database
   */
  async saveRecommendations(
    leagueId: string,
    week: number,
    season: number,
    recommendations: WaiverRecommendation[]
  ): Promise<void> {
    // Delete old recommendations for this week
    await db.waiverRecommendation.deleteMany({
      where: {
        leagueId,
        week,
        season,
      },
    });

    // Save new recommendations
    for (let i = 0; i < recommendations.length; i++) {
      const rec = recommendations[i];

      await db.waiverRecommendation.create({
        data: {
          leagueId,
          week,
          season,
          playerId: rec.player.playerId,
          playerName: rec.player.playerName,
          position: rec.player.position,
          team: rec.player.team,
          opportunityScore: rec.player.opportunityScore,
          projectedPoints: rec.player.projectedPoints,
          recentPerformance: rec.player.recentPerformance,
          targetShare: rec.player.targetShare,
          snapShare: rec.player.snapShare,
          injuryImpact: rec.player.injuryImpact,
          positionalNeed: rec.positionalNeed,
          wouldStartImmediately: rec.wouldStartImmediately,
          benchDepthScore: rec.benchDepthScore,
          recommendedBid: rec.recommendedBid,
          minBid: rec.minBid,
          maxBid: rec.maxBid,
          medianHistoricalBid: rec.medianHistoricalBid,
          addTrendPercentage: rec.player.addTrendPercentage,
          priorityRank: rec.priorityRank || i + 1,
          shouldClaim: rec.shouldClaim || false,
          suggestedDropPlayerId: rec.suggestedDropPlayer?.playerId,
          suggestedDropPlayerName: rec.suggestedDropPlayer?.playerName,
          dropPlayerValue: rec.suggestedDropPlayer?.value,
          reasoning: rec.reasoning,
          confidence: rec.confidence,
          urgency: rec.urgency,
          status: 'pending',
        },
      });
    }
  }

  /**
   * Get waiver recommendations from database
   */
  async getRecommendations(
    leagueId: string,
    week: number,
    season: number
  ): Promise<any[]> {
    return await db.waiverRecommendation.findMany({
      where: {
        leagueId,
        week,
        season,
        status: 'pending',
      },
      orderBy: {
        priorityRank: 'asc',
      },
    });
  }
}

// Export singleton instance
export const waiverOptimizerService = new WaiverOptimizerService();
