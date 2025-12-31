import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { projectionService } from '../services/projections';
import { db } from '@fantasy-football/database';

// Validation schemas
const getPlayerProjectionSchema = z.object({
  playerId: z.string(),
  week: z.string().transform(Number),
  season: z.string().transform(Number),
});

const getWeekProjectionsSchema = z.object({
  week: z.string().transform(Number),
  season: z.string().transform(Number),
  position: z.string().optional(),
  limit: z.string().transform(Number).optional(),
});

const syncProjectionsSchema = z.object({
  week: z.number().min(0).max(18),
  season: z.number().min(2020).max(2030),
  useBasicAlgorithm: z.boolean().optional().default(true),
});

const searchPlayersSchema = z.object({
  query: z.string().min(2),
  position: z.string().optional(),
  team: z.string().optional(),
  limit: z.string().transform(Number).optional(),
});

export default async function playerRoutes(server: FastifyInstance) {
  /**
   * GET /players/search
   * Search for players by name, position, or team
   */
  server.get(
    '/search',
    {
      preHandler: [server.authenticate],
    },
    async (
      request: FastifyRequest<{
        Querystring: z.infer<typeof searchPlayersSchema>;
      }>
    ) => {
      const { query, position, team, limit = 20 } = searchPlayersSchema.parse(
        request.query
      );

      const players = await db.player.findMany({
        where: {
          AND: [
            {
              fullName: {
                contains: query,
                mode: 'insensitive',
              },
            },
            position ? { position } : {},
            team ? { team } : {},
          ],
        },
        take: limit,
        orderBy: {
          fullName: 'asc',
        },
      });

      return { players };
    }
  );

  /**
   * GET /players/:playerId
   * Get player details with latest projection
   */
  server.get(
    '/:playerId',
    {
      preHandler: [server.authenticate],
    },
    async (
      request: FastifyRequest<{
        Params: { playerId: string };
        Querystring: { week?: string; season?: string };
      }>
    ) => {
      const { playerId } = request.params;
      const week = request.query.week ? parseInt(request.query.week) : undefined;
      const season = request.query.season
        ? parseInt(request.query.season)
        : new Date().getFullYear();

      const player = await db.player.findUnique({
        where: { id: playerId },
      });

      if (!player) {
        return request.server.httpErrors.notFound('Player not found');
      }

      let projection = null;
      if (week !== undefined) {
        projection = await projectionService.getPlayerProjection(
          playerId,
          week,
          season
        );
      }

      return {
        player,
        projection,
      };
    }
  );

  /**
   * GET /players/:playerId/projections
   * Get all projections for a player
   */
  server.get(
    '/:playerId/projections',
    {
      preHandler: [server.authenticate],
    },
    async (
      request: FastifyRequest<{
        Params: { playerId: string };
        Querystring: { season?: string };
      }>
    ) => {
      const { playerId } = request.params;
      const season = request.query.season
        ? parseInt(request.query.season)
        : new Date().getFullYear();

      const projections = await db.playerProjection.findMany({
        where: {
          playerId,
          season,
        },
        orderBy: {
          week: 'asc',
        },
      });

      return { projections };
    }
  );

  /**
   * GET /players/projections/week
   * Get all projections for a specific week
   */
  server.get(
    '/projections/week',
    {
      preHandler: [server.authenticate],
    },
    async (
      request: FastifyRequest<{
        Querystring: z.infer<typeof getWeekProjectionsSchema>;
      }>
    ) => {
      const { week, season, position, limit } = getWeekProjectionsSchema.parse(
        request.query
      );

      let projections;
      if (position) {
        projections = await projectionService.getTopProjectedPlayers(
          week,
          season,
          position,
          limit || 50
        );
      } else {
        projections = await projectionService.getWeekProjections(week, season);
        if (limit) {
          projections = projections.slice(0, limit);
        }
      }

      return { projections, week, season };
    }
  );

  /**
   * GET /players/projections/top
   * Get top projected players for a week (by position)
   */
  server.get(
    '/projections/top',
    {
      preHandler: [server.authenticate],
    },
    async (
      request: FastifyRequest<{
        Querystring: {
          week: string;
          season: string;
          position?: string;
          limit?: string;
        };
      }>
    ) => {
      const week = parseInt(request.query.week);
      const season = parseInt(request.query.season);
      const position = request.query.position;
      const limit = request.query.limit ? parseInt(request.query.limit) : 50;

      const projections = await projectionService.getTopProjectedPlayers(
        week,
        season,
        position,
        limit
      );

      return {
        projections,
        week,
        season,
        position: position || 'all',
        limit,
      };
    }
  );

  /**
   * POST /players/projections/sync
   * Manually trigger projection sync for a specific week
   * (Admin/development endpoint - in production, this would be a cron job)
   */
  server.post(
    '/projections/sync',
    {
      preHandler: [server.authenticate],
    },
    async (
      request: FastifyRequest<{
        Body: z.infer<typeof syncProjectionsSchema>;
      }>
    ) => {
      const { week, season, useBasicAlgorithm } = syncProjectionsSchema.parse(
        request.body
      );

      const result = await projectionService.syncWeekProjections(
        week,
        season,
        useBasicAlgorithm
      );

      return {
        message: 'Projection sync completed',
        week,
        season,
        ...result,
      };
    }
  );

  /**
   * GET /players/trending
   * Get trending players (most added/dropped, high projection changes, etc.)
   * Placeholder for future implementation
   */
  server.get(
    '/trending',
    {
      preHandler: [server.authenticate],
    },
    async () => {
      // TODO: Implement trending logic based on:
      // - Projection changes week-over-week
      // - Most added/dropped in leagues
      // - Injury status changes
      // - Opportunity score increases

      return {
        trending: [],
        message: 'Trending players feature coming soon',
      };
    }
  );
}
