import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { injuryMonitorService } from '../services/injuryMonitor';

// Validation schemas
const acknowledgeAlertSchema = z.object({
  alertId: z.string().uuid(),
  substituted: z.boolean().optional().default(false),
});

export default async function injuryRoutes(server: FastifyInstance) {
  /**
   * GET /injuries/alerts
   * Get injury alerts for a league
   */
  server.get(
    '/alerts',
    {
      preHandler: [server.authenticate],
    },
    async (
      request: FastifyRequest<{
        Querystring: {
          leagueId?: string;
          week?: string;
          season?: string;
          unacknowledged?: string;
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

      const week = request.query.week ? parseInt(request.query.week) : undefined;
      const season = request.query.season ? parseInt(request.query.season) : undefined;
      const unacknowledged = request.query.unacknowledged === 'true';

      const alerts = await server.prisma.injuryAlert.findMany({
        where: {
          leagueId,
          ...(week && { week }),
          ...(season && { season }),
          ...(unacknowledged && { userAcknowledged: false }),
        },
        orderBy: {
          detectedAt: 'desc',
        },
      });

      return {
        alerts,
        count: alerts.length,
        unacknowledgedCount: alerts.filter((a) => !a.userAcknowledged).length,
      };
    }
  );

  /**
   * GET /injuries/alerts/:id
   * Get specific injury alert
   */
  server.get(
    '/alerts/:id',
    {
      preHandler: [server.authenticate],
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
      }>
    ) => {
      const { id } = request.params;

      const alert = await server.prisma.injuryAlert.findFirst({
        where: {
          id,
          league: { userId: request.user!.userId },
        },
      });

      if (!alert) {
        return request.server.httpErrors.notFound('Alert not found');
      }

      return { alert };
    }
  );

  /**
   * POST /injuries/alerts/:id/acknowledge
   * Acknowledge an injury alert
   */
  server.post(
    '/alerts/:id/acknowledge',
    {
      preHandler: [server.authenticate],
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: z.infer<typeof acknowledgeAlertSchema>;
      }>
    ) => {
      const { id } = request.params;
      const { substituted } = acknowledgeAlertSchema.parse(request.body);

      const alert = await server.prisma.injuryAlert.findFirst({
        where: {
          id,
          league: { userId: request.user!.userId },
        },
      });

      if (!alert) {
        return request.server.httpErrors.notFound('Alert not found');
      }

      // Update alert
      const updated = await server.prisma.injuryAlert.update({
        where: { id },
        data: {
          userAcknowledged: true,
          acknowledgedAt: new Date(),
          userSubstituted: substituted,
        },
      });

      return {
        message: 'Alert acknowledged',
        alert: updated,
      };
    }
  );

  /**
   * GET /injuries/monitoring-status
   * Get current monitoring service status
   */
  server.get(
    '/monitoring-status',
    {
      preHandler: [server.authenticate],
    },
    async () => {
      const status = injuryMonitorService.getStatus();

      return {
        status,
        message: status.isMonitoring
          ? 'Injury monitoring is active'
          : 'Injury monitoring is not active',
      };
    }
  );

  /**
   * POST /injuries/start-monitoring
   * Start injury monitoring service (admin/dev endpoint)
   */
  server.post(
    '/start-monitoring',
    {
      preHandler: [server.authenticate],
    },
    async () => {
      injuryMonitorService.start();

      return {
        message: 'Injury monitoring started',
        status: injuryMonitorService.getStatus(),
      };
    }
  );

  /**
   * POST /injuries/stop-monitoring
   * Stop injury monitoring service (admin/dev endpoint)
   */
  server.post(
    '/stop-monitoring',
    {
      preHandler: [server.authenticate],
    },
    async () => {
      injuryMonitorService.stop();

      return {
        message: 'Injury monitoring stopped',
        status: injuryMonitorService.getStatus(),
      };
    }
  );

  /**
   * GET /injuries/upcoming-games
   * Get upcoming games for monitoring (debug endpoint)
   */
  server.get(
    '/upcoming-games',
    {
      preHandler: [server.authenticate],
    },
    async (
      request: FastifyRequest<{
        Querystring: {
          week?: string;
          season?: string;
        };
      }>
    ) => {
      // This would fetch from actual game schedule API in production
      // For now, return mock data

      const now = new Date();
      const week = request.query.week ? parseInt(request.query.week) : 1;
      const season = request.query.season ? parseInt(request.query.season) : now.getFullYear();

      return {
        message: 'In production, this would return actual NFL game schedule',
        week,
        season,
        note: 'Integrate with NFL API or Sleeper game data',
      };
    }
  );
}
