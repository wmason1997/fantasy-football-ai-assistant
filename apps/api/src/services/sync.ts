import { prisma } from '@fantasy-football/database';
import { sleeperService } from './sleeper';

class SyncService {
  /**
   * Sync all NFL players from Sleeper API to database
   */
  async syncPlayers(): Promise<void> {
    console.log('Starting player sync...');

    const playersData = await sleeperService.getPlayers();

    if (!playersData) {
      throw new Error('Failed to fetch players from Sleeper');
    }

    const players = Object.entries(playersData).map(([playerId, player]) => ({
      id: playerId,
      fullName: player.full_name,
      position: player.position,
      team: player.team || null,
      status: player.status || 'Active',
      injuryDesignation: player.injury_status || null,
      byeWeek: null, // Sleeper doesn't provide this in players endpoint
      lastUpdated: new Date(),
      metadata: {},
    }));

    // Upsert all players
    for (const player of players) {
      await prisma.player.upsert({
        where: { id: player.id },
        update: player,
        create: player,
      });
    }

    console.log(`Synced ${players.length} players`);
  }

  /**
   * Sync league rosters from Sleeper API
   */
  async syncLeagueData(platformLeagueId: string, leagueId: string): Promise<void> {
    console.log(`Syncing league ${platformLeagueId}...`);

    // Fetch rosters from Sleeper
    const rosters = await sleeperService.getRosters(platformLeagueId);

    if (!rosters) {
      throw new Error('Failed to fetch rosters from Sleeper');
    }

    // Get the league record to find user's team
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) {
      throw new Error('League not found');
    }

    // Find the user's roster
    const userRoster = rosters.find(
      (r) => r.owner_id === league.platformTeamId
    );

    if (!userRoster) {
      throw new Error('User roster not found in league');
    }

    // Delete existing rosters for this league
    await prisma.roster.deleteMany({
      where: { leagueId },
    });

    // Create new roster entries
    const playerIds = userRoster.players || [];
    let didSyncPlayers = false;

    for (const playerId of playerIds) {
      // Ensure player exists in database
      let player = await prisma.player.findUnique({
        where: { id: playerId },
      });

      if (!player && !didSyncPlayers) {
        // Sync all players once if any are missing
        await this.syncPlayers();
        didSyncPlayers = true;
        player = await prisma.player.findUnique({
          where: { id: playerId },
        });
      }

      if (player) {
        await prisma.roster.create({
          data: {
            leagueId,
            playerId,
            rosterSlot: 'BN', // Default to bench, can be updated later
            isStarting: false,
          },
        });
      }
    }

    // Update league sync timestamp
    await prisma.league.update({
      where: { id: leagueId },
      data: { lastSynced: new Date() },
    });

    console.log(`Synced ${playerIds.length} players for league ${platformLeagueId}`);
  }

  /**
   * Initial league sync when user first connects a league
   */
  async initialLeagueSync(
    platformLeagueId: string,
    userId: string,
    platformUserId?: string
  ): Promise<any> {
    console.log(`Initial sync for league ${platformLeagueId}...`);

    // Fetch league data
    const leagueData = await sleeperService.getLeague(platformLeagueId);

    if (!leagueData) {
      throw new Error('Failed to fetch league data');
    }

    // Fetch rosters to find user's team
    const rosters = await sleeperService.getRosters(platformLeagueId);

    if (!rosters) {
      throw new Error('Failed to fetch rosters');
    }

    // If platformUserId provided, find their roster
    let userRosterId = platformUserId;

    if (!userRosterId && rosters.length > 0) {
      // Default to first roster if no user ID provided
      userRosterId = rosters[0].owner_id;
    }

    const userRoster = rosters.find((r) => r.owner_id === userRosterId);

    // Create league record
    const league = await prisma.league.create({
      data: {
        userId,
        platform: 'sleeper',
        platformLeagueId,
        leagueName: leagueData.name,
        platformTeamId: userRosterId || null,
        scoringSettings: leagueData.scoring_settings || {},
        rosterSettings: {
          positions: leagueData.roster_positions,
        },
        faabBudget: leagueData.settings?.waiver_budget ?? null,
        currentFaab: userRoster && leagueData.settings?.waiver_budget
          ? leagueData.settings.waiver_budget - (userRoster.settings?.waiver_budget_used ?? 0)
          : null,
        waiverPriority: userRoster?.settings?.waiver_position ?? null,
        isActive: true,
        lastSynced: new Date(),
      },
    });

    // Sync rosters
    await this.syncLeagueData(platformLeagueId, league.id);

    return league;
  }
}

export const syncService = new SyncService();
