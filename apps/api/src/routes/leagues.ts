import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@fantasy-football/database';
import { sleeperService } from '../services/sleeper';
import { syncService } from '../services/sync';
import { getCurrentWeekAndSeason } from '../services/scheduler';

const connectLeagueSchema = z.object({
  platformLeagueId: z.string(),
  platformUserId: z.string().optional(),
});

const lookupLeagueSchema = z.object({
  platformLeagueId: z.string(),
});

const searchLeaguesSchema = z.object({
  username: z.string(),
  season: z.string().optional(),
});

export default async function leagueRoutes(fastify: FastifyInstance) {
  // Search for user's leagues by Sleeper username
  fastify.post('/search', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      const body = searchLeaguesSchema.parse(request.body);
      const season = body.season || new Date().getFullYear().toString();

      try {
        // Get user info from Sleeper
        const user = await sleeperService.getUserByUsername(body.username);

        if (!user) {
          return reply.status(404).send({ error: 'Sleeper user not found' });
        }

        // Get user's leagues for the season
        const leagues = await sleeperService.getUserLeagues(user.user_id, season);

        if (!leagues || leagues.length === 0) {
          return reply.send({
            sleeperUserId: user.user_id,
            sleeperUsername: user.display_name,
            leagues: []
          });
        }

        // Format leagues for response
        const formattedLeagues = leagues.map(league => ({
          id: league.league_id,
          name: league.name,
          season: league.season,
          totalRosters: league.roster_positions?.length || 0,
        }));

        return {
          sleeperUserId: user.user_id,
          sleeperUsername: user.display_name,
          leagues: formattedLeagues,
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to search for leagues' });
      }
    },
  });

  // Lookup league details before connecting (helps user find their team)
  fastify.post('/lookup', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      const body = lookupLeagueSchema.parse(request.body);

      try {
        // Fetch league data from Sleeper
        const leagueData = await sleeperService.getLeague(body.platformLeagueId);

        if (!leagueData) {
          return reply.status(404).send({ error: 'League not found' });
        }

        // Fetch league users to help identify the right team
        const users = await sleeperService.getLeagueUsers(body.platformLeagueId);

        // Fetch rosters to show team info
        const rosters = await sleeperService.getRosters(body.platformLeagueId);

        // Combine roster and user data
        const teams = rosters?.map((roster) => {
          const user = users?.find((u) => u.user_id === roster.owner_id);
          return {
            rosterId: roster.roster_id,
            ownerId: roster.owner_id,
            ownerName: user?.display_name || 'Unknown',
            playerCount: roster.players?.length || 0,
          };
        }) || [];

        return {
          league: {
            id: leagueData.league_id,
            name: leagueData.name,
            season: leagueData.season,
            totalTeams: teams.length,
          },
          teams,
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to lookup league' });
      }
    },
  });

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

  // Get matchups for a specific week
  fastify.get('/:id/matchups/:week', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      const { id, week } = request.params as { id: string; week: string };
      const userId = request.user!.userId;

      const league = await prisma.league.findFirst({
        where: { id, userId },
      });

      if (!league) {
        return reply.status(404).send({ error: 'League not found' });
      }

      try {
        const matchups = await sleeperService.getMatchups(
          league.platformLeagueId,
          parseInt(week)
        );
        return { matchups };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch matchups' });
      }
    },
  });

  // Sync transactions for a specific week
  fastify.post('/:id/transactions/sync', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { week } = request.body as { week?: number };
      const userId = request.user!.userId;

      const league = await prisma.league.findFirst({
        where: { id, userId },
      });

      if (!league) {
        return reply.status(404).send({ error: 'League not found' });
      }

      try {
        const currentWeek = week || getCurrentWeekAndSeason().week;
        const transactions = await sleeperService.getTransactions(
          league.platformLeagueId,
          currentWeek
        );

        if (!transactions) {
          return { success: true, message: 'No transactions found', count: 0 };
        }

        // Store transactions in database
        let count = 0;
        for (const txn of transactions) {
          // Check if transaction already exists
          const existing = await prisma.transaction.findFirst({
            where: {
              leagueId: id,
              platformTransactionId: txn.transaction_id,
            },
          });

          if (!existing) {
            await prisma.transaction.create({
              data: {
                league: {
                  connect: { id },
                },
                platformTransactionId: txn.transaction_id,
                transactionType: txn.type,
                week: currentWeek,
                season: new Date().getFullYear(),
                involvedTeams: [],
                playersMoved: [],
                status: 'completed',
                metadata: txn as any,
              },
            });
            count++;
          }
        }

        return {
          success: true,
          message: `Synced ${count} new transactions`,
          count,
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to sync transactions' });
      }
    },
  });
}
