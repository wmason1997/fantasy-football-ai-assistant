import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@fantasy-football/database';
import { sleeperService } from '../services/sleeper';
import { syncService } from '../services/sync';

const connectLeagueSchema = z.object({
  platformLeagueId: z.string(),
  platformUserId: z.string().optional(),
});

export default async function leagueRoutes(fastify: FastifyInstance) {
  // Connect a Sleeper league
  fastify.post('/connect', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      const body = connectLeagueSchema.parse(request.body);
      const userId = request.user!.userId;

      try {
        // Fetch league data from Sleeper
        const leagueData = await sleeperService.getLeague(body.platformLeagueId);

        if (!leagueData) {
          return reply.status(404).send({ error: 'League not found' });
        }

        // Check if league already connected
        const existingLeague = await prisma.league.findFirst({
          where: {
            userId,
            platformLeagueId: body.platformLeagueId,
            platform: 'sleeper',
          },
        });

        if (existingLeague) {
          return reply.status(400).send({ error: 'League already connected' });
        }

        // Perform initial sync
        const league = await syncService.initialLeagueSync(
          body.platformLeagueId,
          userId,
          body.platformUserId
        );

        return { league };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to connect league' });
      }
    },
  });

  // Get all connected leagues
  fastify.get('/', {
    onRequest: [fastify.authenticate],
    handler: async (request) => {
      const userId = request.user!.userId;

      const leagues = await prisma.league.findMany({
        where: { userId },
        include: {
          rosters: {
            include: {
              player: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return { leagues };
    },
  });

  // Get specific league details
  fastify.get('/:id', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.user!.userId;

      const league = await prisma.league.findFirst({
        where: {
          id,
          userId,
        },
        include: {
          rosters: {
            include: {
              player: true,
            },
          },
        },
      });

      if (!league) {
        return reply.status(404).send({ error: 'League not found' });
      }

      return { league };
    },
  });

  // Sync league data
  fastify.post('/:id/sync', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.user!.userId;

      const league = await prisma.league.findFirst({
        where: { id, userId },
      });

      if (!league) {
        return reply.status(404).send({ error: 'League not found' });
      }

      try {
        await syncService.syncLeagueData(league.platformLeagueId, id);
        return { success: true, message: 'League synced successfully' };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to sync league' });
      }
    },
  });
}
