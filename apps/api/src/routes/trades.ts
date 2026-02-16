import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { tradeAnalyzerService } from '../services/tradeAnalyzer';
import { opponentLearningService } from '../services/opponentLearning';
import { getCurrentWeekAndSeason } from '../services/scheduler';

// Validation schemas
const generateRecommendationsSchema = z.object({
  leagueId: z.string().uuid(),
  week: z.number().min(1).max(18).optional(),
  season: z.number().min(2020).max(2030).optional(),
  maxRecommendations: z.number().min(1).max(20).optional().default(10),
});

const evaluateTradeSchema = z.object({
  leagueId: z.string().uuid(),
  myPlayerIds: z.array(z.string()).min(1).max(3),
  targetPlayerIds: z.array(z.string()).min(1).max(3),
  targetTeamId: z.string(),
});

const trackResponseSchema = z.object({
  recommendationId: z.string().uuid(),
  action: z.enum(['viewed', 'sent', 'accepted', 'rejected', 'dismissed']),
});

const syncTransactionsSchema = z.object({
  leagueId: z.string().uuid(),
  week: z.number().min(1).max(18).optional(),
  season: z.number().min(2020).max(2030).optional(),
});

export default async function tradeRoutes(server: FastifyInstance) {
  /**
   * POST /trades/recommendations/generate
   * Generate trade recommendations for a league
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

      // Initialize opponent profiles if needed
      await opponentLearningService.initializeOpponentProfiles(leagueId);

      // Generate trade packages
      console.log(
        `Generating trade recommendations for league ${leagueId}, week ${targetWeek}...`
      );

      const packages = await tradeAnalyzerService.generateTradePackages(
        leagueId,
        targetSeason,
        targetWeek,
        maxRecommendations
      );

      // Save recommendations to database
      await tradeAnalyzerService.saveRecommendations(
        leagueId,
        targetWeek,
        targetSeason,
        packages
      );

      return {
        message: 'Trade recommendations generated',
        count: packages.length,
        week: targetWeek,
        season: targetSeason,
        recommendations: packages.slice(0, 5), // Return top 5
      };
    }
  );

  /**
   * GET /trades/recommendations
   * Get trade recommendations for a league
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

      const recommendations = await server.prisma.tradeRecommendation.findMany({
        where: {
          leagueId,
          week: targetWeek,
          season: targetSeason,
          status,
        },
        orderBy: {
          priority: 'desc',
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
   * GET /trades/recommendations/:id
   * Get a specific trade recommendation
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

      const recommendation = await server.prisma.tradeRecommendation.findUnique({
        where: { id },
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

      return { recommendation };
    }
  );

  /**
   * POST /trades/evaluate
   * Evaluate a custom trade proposal
   */
  server.post(
    '/evaluate',
    {
      preHandler: [server.authenticate],
    },
    async (
      request: FastifyRequest<{
        Body: z.infer<typeof evaluateTradeSchema>;
      }>
    ) => {
      const { leagueId, myPlayerIds, targetPlayerIds, targetTeamId } =
        evaluateTradeSchema.parse(request.body);

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

      const { week, season } = getCurrentWeekAndSeason();

      // Calculate player values
      const myPlayers = await Promise.all(
        myPlayerIds.map((id) =>
          tradeAnalyzerService.calculatePlayerValue(id, leagueId, season, week)
        )
      );

      const targetPlayers = await Promise.all(
        targetPlayerIds.map((id) =>
          tradeAnalyzerService.calculatePlayerValue(id, leagueId, season, week)
        )
      );

      // Filter out nulls
      const validMyPlayers = myPlayers.filter((p) => p !== null);
      const validTargetPlayers = targetPlayers.filter((p) => p !== null);

      if (validMyPlayers.length === 0 || validTargetPlayers.length === 0) {
        return request.server.httpErrors.badRequest('Invalid player IDs');
      }

      // Calculate trade metrics
      const fairnessScore = tradeAnalyzerService.calculateFairnessScore(
        validMyPlayers,
        validTargetPlayers
      );

      const acceptanceProbability =
        await tradeAnalyzerService.calculateAcceptanceProbability(
          targetTeamId,
          leagueId,
          validMyPlayers,
          validTargetPlayers,
          fairnessScore
        );

      const myTotalValue = validMyPlayers.reduce((sum, p) => sum + p.projectedValue, 0);
      const targetTotalValue = validTargetPlayers.reduce(
        (sum, p) => sum + p.projectedValue,
        0
      );

      return {
        evaluation: {
          fairnessScore,
          acceptanceProbability,
          myValueGain: targetTotalValue - myTotalValue,
          targetValueGain: myTotalValue - targetTotalValue,
          recommendation:
            fairnessScore > 0.6 && acceptanceProbability > 0.25
              ? 'recommended'
              : 'not_recommended',
          myPlayers: validMyPlayers,
          targetPlayers: validTargetPlayers,
        },
      };
    }
  );

  /**
   * POST /trades/track-response
   * Track user response to a trade recommendation
   */
  server.post(
    '/track-response',
    {
      preHandler: [server.authenticate],
    },
    async (
      request: FastifyRequest<{
        Body: z.infer<typeof trackResponseSchema>;
      }>
    ) => {
      const { recommendationId, action } = trackResponseSchema.parse(request.body);

      const recommendation = await server.prisma.tradeRecommendation.findUnique({
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
      const updates: any = {};

      switch (action) {
        case 'viewed':
          updates.viewedAt = new Date();
          break;
        case 'sent':
          updates.sentAt = new Date();
          updates.status = 'sent';
          break;
        case 'accepted':
          updates.respondedAt = new Date();
          updates.status = 'accepted';
          break;
        case 'rejected':
          updates.respondedAt = new Date();
          updates.status = 'rejected';
          break;
        case 'dismissed':
          updates.status = 'dismissed';
          break;
      }

      await server.prisma.tradeRecommendation.update({
        where: { id: recommendationId },
        data: updates,
      });

      // If trade was accepted/rejected, update opponent profile
      if (action === 'accepted' || action === 'rejected') {
        const myPlayers = recommendation.myPlayers as any[];
        const targetPlayers = recommendation.targetPlayers as any[];

        await opponentLearningService.updateProfileFromTrade(
          recommendation.leagueId,
          recommendation.targetTeamId,
          {
            type: 'trade',
            playersAdded: myPlayers.map((p) => ({ id: p.playerId, position: p.position })),
            playersDropped: targetPlayers.map((p) => ({
              id: p.playerId,
              position: p.position,
            })),
            wasAccepted: action === 'accepted',
            wasInitiated: true, // User initiated this trade
          }
        );
      }

      return {
        message: 'Response tracked',
        action,
        recommendationId,
      };
    }
  );

  /**
   * POST /trades/sync-transactions
   * Sync league transactions and update opponent profiles
   */
  server.post(
    '/sync-transactions',
    {
      preHandler: [server.authenticate],
    },
    async (
      request: FastifyRequest<{
        Body: z.infer<typeof syncTransactionsSchema>;
      }>
    ) => {
      const { leagueId, week, season } = syncTransactionsSchema.parse(request.body);

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
      const targetWeek = week || currentWeek;
      const targetSeason = season || currentSeason;

      await opponentLearningService.syncLeagueTransactions(
        leagueId,
        targetSeason,
        targetWeek
      );

      return {
        message: 'Transactions synced and opponent profiles updated',
        week: targetWeek,
        season: targetSeason,
      };
    }
  );

  /**
   * GET /trades/opponent-profiles
   * Get all opponent profiles for a league
   */
  server.get(
    '/opponent-profiles',
    {
      preHandler: [server.authenticate],
    },
    async (
      request: FastifyRequest<{
        Querystring: { leagueId: string };
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

      const profiles = await opponentLearningService.getAllOpponentProfiles(leagueId);

      return {
        profiles,
        count: profiles.length,
      };
    }
  );

  /**
   * GET /trades/opponent-profiles/:teamId
   * Get specific opponent profile
   */
  server.get(
    '/opponent-profiles/:teamId',
    {
      preHandler: [server.authenticate],
    },
    async (
      request: FastifyRequest<{
        Params: { teamId: string };
        Querystring: { leagueId: string };
      }>
    ) => {
      const { teamId } = request.params;
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

      const profile = await opponentLearningService.getOpponentProfile(leagueId, teamId);

      if (!profile) {
        return request.server.httpErrors.notFound('Opponent profile not found');
      }

      return { profile };
    }
  );
}
