import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { projectionService } from '../services/projections';
import { playerSyncService } from '../services/playerSync';
import { sleeperService } from '../services/sleeper';
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
   * POST /players/sync
   * Manually trigger player sync from Sleeper API
   * (Admin/development endpoint - in production, this runs on a daily schedule)
   */
  server.post(
    '/sync',
    {
      preHandler: [server.authenticate],
    },
    async () => {
      const status = playerSyncService.getStatus();

      if (status.isSyncing) {
        return {
          message: 'Player sync already in progress',
          status,
        };
      }

      // Start sync (don't await - can take several minutes)
      playerSyncService.syncAllPlayers().then((result) => {
        console.log('[Player Sync API] Sync completed:', result);
      }).catch((error) => {
        console.error('[Player Sync API] Sync failed:', error);
      });

      return {
        message: 'Player sync started',
        status: playerSyncService.getStatus(),
        note: 'This may take several minutes. Check status with GET /players/sync/status',
      };
    }
  );

  /**
   * GET /players/sync/status
   * Get player sync status
   */
  server.get(
    '/sync/status',
    {
      preHandler: [server.authenticate],
    },
    async () => {
      const status = playerSyncService.getStatus();
      return {
        ...status,
        message: status.isSyncing ? 'Sync in progress' : 'No sync running',
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
    async (
      request: FastifyRequest<{
        Querystring: {
          type?: string;
          hours?: string;
          limit?: string;
        };
      }>
    ) => {
      const type = (request.query.type === 'drop' ? 'drop' : 'add') as 'add' | 'drop';
      const hours = request.query.hours ? parseInt(request.query.hours) : 24;
      const limit = request.query.limit ? Math.min(parseInt(request.query.limit), 50) : 25;

      const trending = await sleeperService.getTrendingPlayers(type, hours, limit);

      if (!trending || trending.length === 0) {
        return { trending: [], type, count: 0 };
      }

      // Enrich with player names from DB
      const playerIds = trending.map((t: any) => t.player_id);
      const players = await db.player.findMany({
        where: { id: { in: playerIds } },
        select: { id: true, fullName: true, position: true, team: true },
      });
      const playerMap = new Map(players.map(p => [p.id, p]));

      const enriched = trending.map((t: any) => {
        const player = playerMap.get(t.player_id);
        return {
          playerId: t.player_id,
          playerName: player?.fullName || 'Unknown',
          position: player?.position || 'Unknown',
          team: player?.team || null,
          count: t.count,
        };
      });

      return { trending: enriched, type, count: enriched.length };
    }
  );
}
