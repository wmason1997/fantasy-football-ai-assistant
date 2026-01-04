import cron, { ScheduledTask } from 'node-cron';
import { projectionService } from './projections';
import { playerSyncService } from './playerSync';

/**
 * Get current NFL week and season
 * Simple algorithm - in production, this should use NFL's official week calculation
 */
function getCurrentWeekAndSeason(): { week: number; season: number } {
  const now = new Date();
  const season = now.getFullYear();

  // NFL season typically starts first Thursday after Labor Day (early September)
  // Regular season is weeks 1-18 (17 games + 1 bye)
  // For now, use a simple estimation based on date

  const seasonStart = new Date(season, 8, 1); // September 1st
  const weeksSinceStart = Math.floor(
    (now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );

  // Calculate current week (capped at 18)
  let week = Math.max(1, Math.min(18, weeksSinceStart + 1));

  // If we're before September, we're in preseason or offseason
  if (now.getMonth() < 8) {
    week = 0; // Use 0 for season-long projections
  }

  // If we're past January, we're in playoffs/offseason
  if (now.getMonth() > 0 && now.getMonth() < 8) {
    week = 0;
  }

  return { week, season };
}

/**
 * Get next week number
 */
function getNextWeek(): { week: number; season: number } {
  const { week, season } = getCurrentWeekAndSeason();

  if (week === 0) {
    // Offseason - project for week 1
    return { week: 1, season };
  }

  if (week >= 18) {
    // End of season
    return { week: 18, season };
  }

  return { week: week + 1, season };
}

/**
 * Scheduler service for automated tasks
 */
export class SchedulerService {
  private jobs: ScheduledTask[] = [];

  /**
   * Initialize all scheduled jobs
   */
  start() {
    console.log('Starting scheduler service...');

    // Daily player sync at 2:00 AM ET (runs before projections)
    // This keeps player database fresh with injury statuses, team changes, etc.
    const playerSyncJob = cron.schedule(
      '0 7 * * *', // Every day at 7:00 AM UTC (2:00 AM ET)
      async () => {
        console.log('Running scheduled player sync...');
        await this.syncPlayers();
      },
      {
        timezone: 'UTC',
      }
    );

    this.jobs.push(playerSyncJob);

    // Daily projection sync at 3:00 AM ET
    // Cron format: minute hour day month dayOfWeek
    // ET is UTC-5 (or UTC-4 during DST), so 3 AM ET = 8 AM UTC (standard) or 7 AM UTC (DST)
    // For simplicity, using 8 AM UTC
    const projectionSyncJob = cron.schedule(
      '0 8 * * *', // Every day at 8:00 AM UTC (3:00 AM ET)
      async () => {
        console.log('Running scheduled projection sync...');
        await this.syncProjections();
      },
      {
        timezone: 'UTC',
      }
    );

    this.jobs.push(projectionSyncJob);

    // Weekly transaction sync (runs after waivers clear - typically Wednesday 3 AM ET)
    // This would sync league transactions to update opponent profiles
    const transactionSyncJob = cron.schedule(
      '0 8 * * 3', // Every Wednesday at 8:00 AM UTC (3:00 AM ET)
      async () => {
        console.log('Running scheduled transaction sync...');
        // TODO: Implement transaction sync for all connected leagues
        // This will be implemented when we build the opponent learning system
      },
      {
        timezone: 'UTC',
      }
    );

    this.jobs.push(transactionSyncJob);

    console.log('✓ Scheduler service started');
    console.log('  - Daily player sync: 2:00 AM ET (7:00 AM UTC)');
    console.log('  - Daily projection sync: 3:00 AM ET (8:00 AM UTC)');
    console.log('  - Weekly transaction sync: Wednesdays 3:00 AM ET');
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    console.log('Stopping scheduler service...');
    this.jobs.forEach((job) => job.stop());
    this.jobs = [];
    console.log('✓ Scheduler service stopped');
  }

  /**
   * Sync projections for current and next week
   */
  private async syncProjections() {
    try {
      const { week: currentWeek, season } = getCurrentWeekAndSeason();
      const { week: nextWeek } = getNextWeek();

      // Sync current week projections
      if (currentWeek > 0) {
        console.log(`Syncing projections for week ${currentWeek}, season ${season}`);
        await projectionService.syncWeekProjections(currentWeek, season, true);
      }

      // Sync next week projections
      if (nextWeek !== currentWeek && nextWeek > 0) {
        console.log(`Syncing projections for week ${nextWeek}, season ${season}`);
        await projectionService.syncWeekProjections(nextWeek, season, true);
      }

      // Also sync season-long projections (week 0)
      console.log(`Syncing season-long projections for season ${season}`);
      await projectionService.syncWeekProjections(0, season, true);

      console.log('✓ Scheduled projection sync completed');
    } catch (error) {
      console.error('Error in scheduled projection sync:', error);
    }
  }

  /**
   * Sync players from Sleeper API
   */
  private async syncPlayers() {
    try {
      console.log('Starting player sync from Sleeper API...');
      const result = await playerSyncService.syncAllPlayers();
      console.log('✓ Scheduled player sync completed', result);
    } catch (error) {
      console.error('Error in scheduled player sync:', error);
    }
  }

  /**
   * Manually trigger player sync (for testing/admin)
   */
  async triggerPlayerSync() {
    await this.syncPlayers();
  }

  /**
   * Manually trigger projection sync (for testing/admin)
   */
  async triggerProjectionSync() {
    await this.syncProjections();
  }

  /**
   * Get current week info (for debugging)
   */
  getCurrentWeekInfo() {
    const current = getCurrentWeekAndSeason();
    const next = getNextWeek();
    return {
      current,
      next,
    };
  }
}

// Export singleton instance
export const schedulerService = new SchedulerService();

// Export utility functions
export { getCurrentWeekAndSeason, getNextWeek };
