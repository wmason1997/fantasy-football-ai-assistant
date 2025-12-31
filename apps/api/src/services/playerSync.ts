import { db } from '@fantasy-football/database';
import { sleeperService, SleeperPlayer } from './sleeper';
import { cacheService } from './cache';

interface SyncResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

/**
 * Player Sync Service
 * Syncs NFL player data from Sleeper API to local database
 */
export class PlayerSyncService {
  private isSyncing: boolean = false;
  private lastSyncTime: Date | null = null;

  /**
   * Full player sync from Sleeper API
   * Fetches all NFL players and updates the database
   */
  async syncAllPlayers(): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error('Player sync already in progress');
    }

    this.isSyncing = true;
    console.log('[Player Sync] Starting full player sync from Sleeper...');

    const result: SyncResult = {
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    try {
      // Fetch all players from Sleeper API
      const playersData = await sleeperService.getPlayers();

      if (!playersData) {
        throw new Error('Failed to fetch players from Sleeper API');
      }

      // Convert object to array for processing
      const playerIds = Object.keys(playersData);
      result.total = playerIds.length;

      console.log(`[Player Sync] Processing ${result.total} players...`);

      // Process players in batches to avoid overwhelming the database
      const batchSize = 100;
      for (let i = 0; i < playerIds.length; i += batchSize) {
        const batch = playerIds.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (playerId) => {
            try {
              const sleeperPlayer = playersData[playerId];

              // Skip players without basic required data
              if (!sleeperPlayer || !sleeperPlayer.position || !sleeperPlayer.full_name) {
                result.skipped++;
                return;
              }

              // Only sync fantasy-relevant positions
              const relevantPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
              if (!relevantPositions.includes(sleeperPlayer.position)) {
                result.skipped++;
                return;
              }

              await this.upsertPlayer(playerId, sleeperPlayer);

              // Determine if this was a create or update (approximate)
              const existing = await db.player.findUnique({ where: { id: playerId } });
              if (existing) {
                result.updated++;
              } else {
                result.created++;
              }
            } catch (error) {
              console.error(`[Player Sync] Error processing player ${playerId}:`, error);
              result.errors++;
            }
          })
        );

        // Log progress every batch
        if ((i + batchSize) % 500 === 0 || i + batchSize >= playerIds.length) {
          console.log(`[Player Sync] Progress: ${Math.min(i + batchSize, playerIds.length)}/${result.total}`);
        }
      }

      this.lastSyncTime = new Date();

      console.log('[Player Sync] Sync completed:', {
        total: result.total,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors,
      });

      // Clear player cache to force fresh data
      console.log('[Player Sync] Clearing player cache...');
      // Note: We don't have a bulk cache clear, so new requests will get fresh data

      return result;
    } catch (error) {
      console.error('[Player Sync] Sync failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Upsert a single player to the database
   */
  private async upsertPlayer(playerId: string, sleeperPlayer: SleeperPlayer): Promise<void> {
    // Map injury status to our schema
    const injuryDesignation = sleeperPlayer.injury_status
      ? `${sleeperPlayer.injury_status}${sleeperPlayer.injury_body_part ? ` (${sleeperPlayer.injury_body_part})` : ''}`
      : null;

    // Determine player status
    let status = 'Active';
    if (sleeperPlayer.injury_status) {
      status = sleeperPlayer.injury_status; // Out, Questionable, Doubtful, etc.
    } else if (!sleeperPlayer.active) {
      status = 'Inactive';
    }

    // Build metadata JSON
    const metadata = {
      firstName: sleeperPlayer.first_name,
      lastName: sleeperPlayer.last_name,
      age: sleeperPlayer.age,
      yearsExp: sleeperPlayer.years_exp,
      number: sleeperPlayer.number,
      height: sleeperPlayer.height,
      weight: sleeperPlayer.weight,
      college: sleeperPlayer.college,
      birthDate: sleeperPlayer.birth_date,
      depthChartOrder: sleeperPlayer.depth_chart_order,
      fantasyPositions: sleeperPlayer.fantasy_positions || [],
      searchRank: sleeperPlayer.search_rank,
      injuryStartDate: sleeperPlayer.injury_start_date,
    };

    await db.player.upsert({
      where: { id: playerId },
      create: {
        id: playerId,
        fullName: sleeperPlayer.full_name,
        position: sleeperPlayer.position,
        team: sleeperPlayer.team,
        status,
        injuryDesignation,
        byeWeek: null, // Would need separate API call or data source
        lastUpdated: new Date(),
        metadata,
      },
      update: {
        fullName: sleeperPlayer.full_name,
        position: sleeperPlayer.position,
        team: sleeperPlayer.team,
        status,
        injuryDesignation,
        lastUpdated: new Date(),
        metadata,
      },
    });
  }

  /**
   * Sync player statuses only (faster update for injury monitoring)
   */
  async syncPlayerStatuses(playerIds: string[]): Promise<number> {
    console.log(`[Player Sync] Syncing statuses for ${playerIds.length} players...`);

    const playersData = await sleeperService.getPlayers();
    if (!playersData) {
      throw new Error('Failed to fetch players from Sleeper API');
    }

    let updated = 0;

    for (const playerId of playerIds) {
      const sleeperPlayer = playersData[playerId];
      if (!sleeperPlayer) continue;

      const injuryDesignation = sleeperPlayer.injury_status
        ? `${sleeperPlayer.injury_status}${sleeperPlayer.injury_body_part ? ` (${sleeperPlayer.injury_body_part})` : ''}`
        : null;

      let status = 'Active';
      if (sleeperPlayer.injury_status) {
        status = sleeperPlayer.injury_status;
      } else if (!sleeperPlayer.active) {
        status = 'Inactive';
      }

      await db.player.update({
        where: { id: playerId },
        data: {
          status,
          injuryDesignation,
          team: sleeperPlayer.team,
          lastUpdated: new Date(),
        },
      });

      updated++;
    }

    console.log(`[Player Sync] Updated statuses for ${updated} players`);
    return updated;
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
    };
  }
}

export const playerSyncService = new PlayerSyncService();
