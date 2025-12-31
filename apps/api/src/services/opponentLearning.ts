import { db } from '@fantasy-football/database';
import { sleeperService } from './sleeper';

/**
 * Transaction data for learning
 */
interface TransactionData {
  type: 'trade' | 'waiver' | 'free_agent';
  playersAdded: Array<{ id: string; position: string }>;
  playersDropped: Array<{ id: string; position: string }>;
  wasAccepted?: boolean;
  wasInitiated?: boolean;
  faabSpent?: number;
}

/**
 * Opponent Learning Service
 * Implements Bayesian updates to opponent profiles based on transaction history
 */
export class OpponentLearningService {
  /**
   * Initialize opponent profiles for all teams in a league
   */
  async initializeOpponentProfiles(leagueId: string): Promise<void> {
    const league = await db.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) {
      throw new Error('League not found');
    }

    // Get all rosters from Sleeper
    const rosters = await sleeperService.getRosters(league.platformLeagueId);
    const leagueUsers = await sleeperService.getLeagueUsers(league.platformLeagueId);

    for (const roster of rosters) {
      const ownerId = roster.owner_id;
      if (!ownerId) continue;

      // Skip if this is the user's own team
      if (ownerId === league.platformTeamId) continue;

      // Find user name
      const user = leagueUsers.find((u: any) => u.user_id === ownerId);
      const teamName = user?.display_name || user?.metadata?.team_name || 'Unknown';

      // Check if profile already exists
      const existing = await db.opponentProfile.findUnique({
        where: {
          leagueId_opponentTeamId: {
            leagueId,
            opponentTeamId: ownerId,
          },
        },
      });

      if (!existing) {
        // Create new profile with default values
        await db.opponentProfile.create({
          data: {
            leagueId,
            opponentTeamId: ownerId,
            opponentTeamName: teamName,
          },
        });
      }
    }
  }

  /**
   * Update opponent profile based on a trade transaction
   * Uses exponential moving average for Bayesian-like updates
   */
  async updateProfileFromTrade(
    leagueId: string,
    opponentTeamId: string,
    transaction: TransactionData
  ): Promise<void> {
    let profile = await db.opponentProfile.findUnique({
      where: {
        leagueId_opponentTeamId: {
          leagueId,
          opponentTeamId,
        },
      },
    });

    if (!profile) {
      // Initialize profile if it doesn't exist
      await this.initializeOpponentProfiles(leagueId);
      profile = await db.opponentProfile.findUnique({
        where: {
          leagueId_opponentTeamId: {
            leagueId,
            opponentTeamId,
          },
        },
      });

      if (!profile) {
        throw new Error('Failed to create opponent profile');
      }
    }

    // Learning rate for exponential moving average (0.2 = give 20% weight to new data)
    const alpha = 0.2;

    // Update position preferences based on players added
    let qbPreference = profile.qbPreference;
    let rbPreference = profile.rbPreference;
    let wrPreference = profile.wrPreference;
    let tePreference = profile.tePreference;

    for (const player of transaction.playersAdded) {
      switch (player.position) {
        case 'QB':
          qbPreference = qbPreference * (1 - alpha) + 1.0 * alpha;
          break;
        case 'RB':
          rbPreference = rbPreference * (1 - alpha) + 1.0 * alpha;
          break;
        case 'WR':
          wrPreference = wrPreference * (1 - alpha) + 1.0 * alpha;
          break;
        case 'TE':
          tePreference = tePreference * (1 - alpha) + 1.0 * alpha;
          break;
      }
    }

    // Slightly decrease preference for positions dropped
    for (const player of transaction.playersDropped) {
      switch (player.position) {
        case 'QB':
          qbPreference = qbPreference * (1 - alpha * 0.5) + 0.0 * (alpha * 0.5);
          break;
        case 'RB':
          rbPreference = rbPreference * (1 - alpha * 0.5) + 0.0 * (alpha * 0.5);
          break;
        case 'WR':
          wrPreference = wrPreference * (1 - alpha * 0.5) + 0.0 * (alpha * 0.5);
          break;
        case 'TE':
          tePreference = tePreference * (1 - alpha * 0.5) + 0.0 * (alpha * 0.5);
          break;
      }
    }

    // Update trade statistics
    const updates: any = {
      qbPreference,
      rbPreference,
      wrPreference,
      tePreference,
      dataPoints: profile.dataPoints + 1,
      lastUpdated: new Date(),
    };

    if (transaction.type === 'trade') {
      updates.totalTradesProposed = profile.totalTradesProposed + 1;

      if (transaction.wasAccepted) {
        updates.totalTradesAccepted = profile.totalTradesAccepted + 1;
        updates.lastTradeDate = new Date();
      } else {
        updates.totalTradesRejected = profile.totalTradesRejected + 1;
      }

      if (transaction.wasInitiated) {
        updates.totalTradesInitiated = profile.totalTradesInitiated + 1;
      }

      // Update acceptance rate
      const totalTrades = updates.totalTradesProposed;
      updates.acceptanceRate = totalTrades > 0 ? updates.totalTradesAccepted / totalTrades : 0.3;

      // Update trading activity (higher if they initiate trades)
      if (transaction.wasInitiated) {
        updates.tradingActivity = Math.min(
          1.0,
          profile.tradingActivity * (1 - alpha) + 1.0 * alpha
        );
      }
    }

    // Infer preferences based on transaction pattern
    if (transaction.playersAdded.length < transaction.playersDropped.length) {
      // Getting fewer players = might prefer stars
      updates.prefersStars = true;
      updates.prefersDepth = false;
    } else if (transaction.playersAdded.length > transaction.playersDropped.length) {
      // Getting more players = might prefer depth
      updates.prefersStars = false;
      updates.prefersDepth = true;
    }

    // Update the profile
    await db.opponentProfile.update({
      where: {
        leagueId_opponentTeamId: {
          leagueId,
          opponentTeamId,
        },
      },
      data: updates,
    });
  }

  /**
   * Sync all transactions for a league and update opponent profiles
   */
  async syncLeagueTransactions(
    leagueId: string,
    season: number,
    week: number
  ): Promise<void> {
    const league = await db.league.findUnique({
      where: { id: leagueId },
    });

    if (!league) {
      throw new Error('League not found');
    }

    // Ensure opponent profiles are initialized
    await this.initializeOpponentProfiles(leagueId);

    // Fetch transactions from Sleeper
    const transactions = await sleeperService.getTransactions(
      league.platformLeagueId,
      week
    );

    for (const txn of transactions) {
      // Parse transaction data
      const type = txn.type; // 'trade', 'waiver', 'free_agent'

      if (type !== 'trade') {
        continue; // For now, only process trades for opponent learning
      }

      // Get the teams involved
      const rosterIds = txn.roster_ids || [];

      for (const rosterId of rosterIds) {
        // Map roster_id to owner_id
        const rosters = await sleeperService.getRosters(league.platformLeagueId);
        const roster = rosters.find((r: any) => r.roster_id === rosterId);

        if (!roster || !roster.owner_id) continue;

        const opponentTeamId = roster.owner_id;

        // Skip if this is the user's own team
        if (opponentTeamId === league.platformTeamId) continue;

        // Get players added and dropped
        const playersAdded: Array<{ id: string; position: string }> = [];
        const playersDropped: Array<{ id: string; position: string }> = [];

        // Get players from adds/drops
        const adds = txn.adds || {};
        const drops = txn.drops || {};

        for (const [playerId, addedToRoster] of Object.entries(adds)) {
          if (addedToRoster === rosterId) {
            const player = await db.player.findUnique({ where: { id: playerId } });
            if (player) {
              playersAdded.push({ id: playerId, position: player.position });
            }
          }
        }

        for (const [playerId, droppedFromRoster] of Object.entries(drops)) {
          if (droppedFromRoster === rosterId) {
            const player = await db.player.findUnique({ where: { id: playerId } });
            if (player) {
              playersDropped.push({ id: playerId, position: player.position });
            }
          }
        }

        // Update opponent profile
        await this.updateProfileFromTrade(leagueId, opponentTeamId, {
          type: 'trade',
          playersAdded,
          playersDropped,
          wasAccepted: txn.status === 'complete',
          wasInitiated: txn.creator === opponentTeamId,
        });
      }

      // Store transaction in database for future reference
      const existingTxn = await db.transaction.findFirst({
        where: {
          leagueId,
          platformTransactionId: txn.transaction_id,
        },
      });

      if (!existingTxn) {
        await db.transaction.create({
          data: {
            leagueId,
            transactionType: type,
            week,
            season,
            involvedTeams: txn.roster_ids || [],
            playersMoved: {
              adds: txn.adds || {},
              drops: txn.drops || {},
            },
            proposerTeamId: txn.creator || null,
            status: txn.status || 'completed',
            completedAt: txn.status_updated ? new Date(txn.status_updated) : new Date(),
            platformTransactionId: txn.transaction_id,
            metadata: txn,
          },
        });
      }
    }
  }

  /**
   * Get opponent profile for a team
   */
  async getOpponentProfile(
    leagueId: string,
    opponentTeamId: string
  ): Promise<any | null> {
    return await db.opponentProfile.findUnique({
      where: {
        leagueId_opponentTeamId: {
          leagueId,
          opponentTeamId,
        },
      },
    });
  }

  /**
   * Get all opponent profiles for a league
   */
  async getAllOpponentProfiles(leagueId: string): Promise<any[]> {
    return await db.opponentProfile.findMany({
      where: { leagueId },
      orderBy: {
        opponentTeamName: 'asc',
      },
    });
  }
}

// Export singleton instance
export const opponentLearningService = new OpponentLearningService();
