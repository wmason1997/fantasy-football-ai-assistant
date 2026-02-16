import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { waiverOptimizerService } from '../services/waiverOptimizer';
import { sleeperService } from '../services/sleeper';
import { getCurrentWeekAndSeason } from '../services/scheduler';

// Validation schemas
const generateRecommendationsSchema = z.object({
  leagueId: z.string().uuid(),
  week: z.number().min(1).max(18).optional(),
  season: z.number().min(2020).max(2030).optional(),
  maxRecommendations: z.number().min(1).max(20).optional().default(10),
});

const calculateBidSchema = z.object({
  leagueId: z.string().uuid(),
  playerId: z.string(),
  week: z.number().min(1).max(18).optional(),
  season: z.number().min(2020).max(2030).optional(),
});

const trackClaimSchema = z.object({
  recommendationId: z.string().uuid(),
  action: z.enum(['viewed', 'claimed', 'missed', 'dismissed']),
});

const analyzePositionalNeedsSchema = z.object({
  leagueId: z.string().uuid(),
  week: z.number().min(1).max(18).optional(),
  season: z.number().min(2020).max(2030).optional(),
});

export default async function waiverRoutes(server: FastifyInstance) {
  /**
   * POST /waivers/recommendations/generate
   * Generate waiver wire recommendations for a league
   */
  server.post(
    '/recommendations/generate',
    {
      preHandler: [server.authenticate],
    },
    async (
      request: FastifyRequest<{
        Body: z.infer<typeof generateRecommendationsSchema>;
      }>
    ) => {
      const { leagueId, week, season, maxRecommendations } =
        generateRecommendationsSchema.parse(request.body);

      // Verify user owns this league
      const league = await server.prisma.league.findFirst({
        where: {
          id: leagueId,
          userId: request.user!.userId,
        },
      });

      if (!league) {
        return request.server.httpErrors.notFound('League not found');
      }

      // Use current week/season if not provided
      const { week: currentWeek, season: currentSeason } = getCurrentWeekAndSeason();
      const targetWeek = week || currentWeek;
      const targetSeason = season || currentSeason;

      // Determine if league uses FAAB
      const useFAAB = league.faabBudget !== null && league.faabBudget > 0;

      console.log(
        `Generating waiver recommendations for league ${leagueId}, week ${targetWeek}...`
      );

      // Generate recommendations
      const recommendations = await waiverOptimizerService.generateRecommendations(
        leagueId,
        targetSeason,
        targetWeek,
        useFAAB,
        maxRecommendations
      );

      // Save to database
      await waiverOptimizerService.saveRecommendations(
        leagueId,
        targetWeek,
        targetSeason,
        recommendations
      );

      return {
        message: 'Waiver recommendations generated',
        count: recommendations.length,
        week: targetWeek,
        season: targetSeason,
        useFAAB,
        recommendations: recommendations.slice(0, 5), // Return top 5
      };
    }
  );

  /**
   * GET /waivers/recommendations
   * Get waiver recommendations for a league
   */
  server.get(
    '/recommendations',
    {
      preHandler: [server.authenticate],
    },
    async (
      request: FastifyRequest<{
        Querystring: {
          leagueId?: string;
          week?: string;
          season?: string;
          status?: string;
        };
      }>
    ) => {
      const leagueId = request.query.leagueId;

      if (!leagueId) {
        return request.server.httpErrors.badRequest('leagueId query parameter is required');
      }

      // Verify user owns this league
      const league = await server.prisma.league.findFirst({
        where: {
          id: leagueId,
          userId: request.user!.userId,
        },
      });

      if (!league) {
        return request.server.httpErrors.notFound('League not found');
      }

      // Use current week/season if not provided
      const { week: currentWeek, season: currentSeason } = getCurrentWeekAndSeason();
      const targetWeek = request.query.week ? parseInt(request.query.week) : currentWeek;
      const targetSeason = request.query.season
        ? parseInt(request.query.season)
        : currentSeason;
      const status = request.query.status || 'pending';

      const recommendations = await server.prisma.waiverRecommendation.findMany({
        where: {
          leagueId,
          week: targetWeek,
          season: targetSeason,
          status,
        },
        orderBy: {
          priorityRank: 'asc',
        },
      });

      return {
        recommendations,
        week: targetWeek,
        season: targetSeason,
        count: recommendations.length,
      };
    }
  );

  /**
   * GET /waivers/recommendations/:id
   * Get a specific waiver recommendation
   */
  server.get(
    '/recommendations/:id',
    {
      preHandler: [server.authenticate],
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
      }>
    ) => {
      const { id } = request.params;

      const recommendation = await server.prisma.waiverRecommendation.findFirst({
        where: {
          id,
          league: { userId: request.user!.userId },
        },
      });

      if (!recommendation) {
        return request.server.httpErrors.notFound('Recommendation not found');
      }

      return { recommendation };
    }
  );

  /**
   * POST /waivers/calculate-bid
   * Calculate optimal FAAB bid for a specific player
   */
  server.post(
    '/calculate-bid',
    {
      preHandler: [server.authenticate],
    },
    async (
      request: FastifyRequest<{
        Body: z.infer<typeof calculateBidSchema>;
      }>
    ) => {
      const { leagueId, playerId, week, season } = calculateBidSchema.parse(request.body);

      // Verify user owns this league
      const league = await server.prisma.league.findFirst({
        where: {
          id: leagueId,
          userId: request.user!.userId,
        },
      });

      if (!league) {
        return request.server.httpErrors.notFound('League not found');
      }

      // Check if league uses FAAB
      if (!league.faabBudget || league.faabBudget === 0) {
        return request.server.httpErrors.badRequest(
          'This league does not use FAAB bidding'
        );
      }

      const { week: currentWeek, season: currentSeason } = getCurrentWeekAndSeason();
      const targetWeek = week || currentWeek;
      const targetSeason = season || currentSeason;

      // Calculate opportunity score
      const opportunityScore = await waiverOptimizerService.calculateOpportunityScore(
        playerId,
        targetSeason,
        targetWeek
      );

      // Analyze positional needs
      const positionalNeeds = await waiverOptimizerService.analyzePositionalNeeds(
        leagueId,
        targetSeason,
        targetWeek
      );

      // Get player info
      const player = await server.prisma.player.findUnique({
        where: { id: playerId },
      });

      if (!player) {
        return request.server.httpErrors.notFound('Player not found');
      }

      const positionalNeed = positionalNeeds.get(player.position)?.needScore || 0.5;

      // Fetch real add trend from Sleeper trending API
      let addTrendPercentage = 0;
      try {
        const trending = await sleeperService.getTrendingPlayers('add', 24, 200);
        if (trending) {
          const playerTrend = trending.find((t: any) => t.player_id === playerId);
          if (playerTrend) {
            // Normalize: top trending player's count ≈ 40%, scale others relative
            const maxCount = trending[0]?.count || 1;
            addTrendPercentage = (playerTrend.count / maxCount) * 40;
          }
        }
      } catch {
        // Non-critical: default to 0 if API fails
      }

      // Calculate FAAB bid
      const bidCalc = await waiverOptimizerService.calculateFAABBid(
        leagueId,
        playerId,
        opportunityScore,
        positionalNeed,
        addTrendPercentage,
        targetSeason,
        targetWeek
      );

      return {
        player: {
          id: player.id,
          name: player.fullName,
          position: player.position,
          team: player.team,
        },
        opportunityScore,
        positionalNeed,
        addTrendPercentage,
        currentFAAB: league.currentFaab,
        ...bidCalc,
        recommendation:
          bidCalc.recommendedBid <= (league.currentFaab || 0)
            ? 'Place bid'
            : 'Insufficient FAAB',
      };
    }
  );

  /**
   * GET /waivers/targets
   * Get available players with high opportunity scores
   */
  server.get(
    '/targets',
    {
      preHandler: [server.authenticate],
    },
    async (
      request: FastifyRequest<{
        Querystring: {
          leagueId: string;
          week?: string;
          season?: string;
          position?: string;
          minOpportunity?: string;
        };
      }>
    ) => {
      const leagueId = request.query.leagueId;

      // Verify user owns this league
      const league = await server.prisma.league.findFirst({
        where: {
          id: leagueId,
          userId: request.user!.userId,
        },
      });

      if (!league) {
        return request.server.httpErrors.notFound('League not found');
      }

      const { week: currentWeek, season: currentSeason } = getCurrentWeekAndSeason();
      const targetWeek = request.query.week ? parseInt(request.query.week) : currentWeek;
      const targetSeason = request.query.season
        ? parseInt(request.query.season)
        : currentSeason;

      // Identify waiver targets
      let targets = await waiverOptimizerService.identifyWaiverTargets(
        leagueId,
        targetSeason,
        targetWeek
      );

      // Filter by position if specified
      if (request.query.position) {
        targets = targets.filter((t) => t.position === request.query.position);
      }

      // Filter by minimum opportunity score if specified
      if (request.query.minOpportunity) {
        const minOpp = parseFloat(request.query.minOpportunity);
        targets = targets.filter((t) => t.opportunityScore >= minOpp);
      }

      return {
        targets: targets.slice(0, 20), // Limit to top 20
        count: targets.length,
        week: targetWeek,
        season: targetSeason,
      };
    }
  );

  /**
   * GET /waivers/positional-needs
   * Analyze roster positional needs
   */
  server.get(
    '/positional-needs',
    {
      preHandler: [server.authenticate],
    },
    async (
      request: FastifyRequest<{
        Querystring: {
          leagueId: string;
          week?: string;
          season?: string;
        };
      }>
    ) => {
      const leagueId = request.query.leagueId;

      // Verify user owns this league
      const league = await server.prisma.league.findFirst({
        where: {
          id: leagueId,
          userId: request.user!.userId,
        },
      });

      if (!league) {
        return request.server.httpErrors.notFound('League not found');
      }

      const { week: currentWeek, season: currentSeason } = getCurrentWeekAndSeason();
      const targetWeek = request.query.week ? parseInt(request.query.week) : currentWeek;
      const targetSeason = request.query.season
        ? parseInt(request.query.season)
        : currentSeason;

      const needs = await waiverOptimizerService.analyzePositionalNeeds(
        leagueId,
        targetSeason,
        targetWeek
      );

      // Convert Map to array
      const needsArray = Array.from(needs.values());

      // Sort by need score (highest first)
      needsArray.sort((a, b) => b.needScore - a.needScore);

      return {
        positionalNeeds: needsArray,
        week: targetWeek,
        season: targetSeason,
      };
    }
  );

  /**
   * POST /waivers/track-claim
   * Track user action on a waiver recommendation
   */
  server.post(
    '/track-claim',
    {
      preHandler: [server.authenticate],
    },
    async (
      request: FastifyRequest<{
        Body: z.infer<typeof trackClaimSchema>;
      }>
    ) => {
      const { recommendationId, action } = trackClaimSchema.parse(request.body);

      const recommendation = await server.prisma.waiverRecommendation.findUnique({
        where: { id: recommendationId },
        include: {
          league: true,
        },
      });

      if (!recommendation) {
        return request.server.httpErrors.notFound('Recommendation not found');
      }

      // Verify user owns this league
      if (recommendation.league.userId !== request.user!.userId) {
        return request.server.httpErrors.forbidden('Access denied');
      }

      // Update recommendation based on action
      const updates: any = {
        status: action,
      };

      switch (action) {
        case 'viewed':
          updates.viewedAt = new Date();
          updates.status = 'pending'; // Keep as pending
          break;
        case 'claimed':
          updates.claimedAt = new Date();
          updates.status = 'claimed';
          break;
        case 'missed':
          updates.status = 'missed';
          break;
        case 'dismissed':
          updates.status = 'dismissed';
          break;
      }

      await server.prisma.waiverRecommendation.update({
        where: { id: recommendationId },
        data: updates,
      });

      return {
        message: 'Claim action tracked',
        action,
        recommendationId,
      };
    }
  );

  /**
   * GET /waivers/history
   * Get waiver claim history for a league
   */
  server.get(
    '/history',
    {
      preHandler: [server.authenticate],
    },
    async (
      request: FastifyRequest<{
        Querystring: {
          leagueId: string;
          season?: string;
        };
      }>
    ) => {
      const leagueId = request.query.leagueId;

      // Verify user owns this league
      const league = await server.prisma.league.findFirst({
        where: {
          id: leagueId,
          userId: request.user!.userId,
        },
      });

      if (!league) {
        return request.server.httpErrors.notFound('League not found');
      }

      const { season: currentSeason } = getCurrentWeekAndSeason();
      const targetSeason = request.query.season
        ? parseInt(request.query.season)
        : currentSeason;

      const history = await server.prisma.waiverRecommendation.findMany({
        where: {
          leagueId,
          season: targetSeason,
          status: {
            in: ['claimed', 'missed'],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Calculate success rate
      const claimed = history.filter((h) => h.status === 'claimed').length;
      const total = history.length;
      const successRate = total > 0 ? (claimed / total) * 100 : 0;

      return {
        history,
        stats: {
          totalRecommendations: total,
          claimed,
          missed: total - claimed,
          successRate: successRate.toFixed(1),
        },
        season: targetSeason,
      };
    }
  );
}
