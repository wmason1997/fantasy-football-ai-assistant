#!/usr/bin/env tsx

/**
 * Trade Analyzer Test Script
 *
 * Tests the trade analyzer with real 2024 season data and improved projections
 * to validate sell-high/buy-low detection and trade recommendations
 *
 * Usage:
 *   pnpm tsx apps/api/src/scripts/test-trade-analyzer.ts
 */

import { db } from '@fantasy-football/database';
import { tradeAnalyzerService, PlayerValue } from '../services/tradeAnalyzer';
import { projectionService } from '../services/projections';

const SEASON = 2024;
const TEST_WEEK = 8; // Mid-season week with good data

interface TestResults {
  totalPlayers: number;
  sellHighCandidates: PlayerValue[];
  buyLowCandidates: PlayerValue[];
  topTradeRecommendations: any[];
  avgPerformanceRatio: number;
  avgFairnessScore: number;
  avgAcceptanceProbability: number;
}

/**
 * Find real players with good data for testing
 */
async function findTestPlayers(limit: number = 20): Promise<string[]> {
  console.log(`\n🔍 Finding ${limit} players with good 2024 data...`);

  // Get players who have stats in multiple weeks
  const playersWithStats = await db.playerWeekStats.groupBy({
    by: ['playerId'],
    where: {
      season: SEASON,
      week: { gte: 2, lte: TEST_WEEK },
      pprPoints: { not: null },
    },
    _count: {
      playerId: true,
    },
    having: {
      playerId: {
        _count: {
          gte: 5, // At least 5 weeks of data
        },
      },
    },
  });

  console.log(`   Found ${playersWithStats.length} players with 5+ weeks of stats`);

  // Get top players by total points
  const topPlayers = await db.playerWeekStats.groupBy({
    by: ['playerId'],
    where: {
      season: SEASON,
      week: { gte: 2, lte: TEST_WEEK },
      playerId: {
        in: playersWithStats.map(p => p.playerId),
      },
    },
    _sum: {
      pprPoints: true,
    },
    orderBy: {
      _sum: {
        pprPoints: 'desc',
      },
    },
    take: limit,
  });

  const playerIds = topPlayers
    .filter(p => p._sum.pprPoints && p._sum.pprPoints > 50) // At least 50 total points
    .map(p => p.playerId);

  console.log(`   Selected ${playerIds.length} top performers\n`);

  return playerIds;
}

/**
 * Create a test league with sample roster
 */
async function createTestLeague(): Promise<string> {
  console.log('🏈 Creating test league...');

  // Create test user
  const user = await db.user.upsert({
    where: { email: 'test@example.com' },
    create: {
      email: 'test@example.com',
      password: 'test123',
      name: 'Test User',
    },
    update: {},
  });

  // Create test league
  const league = await db.league.upsert({
    where: {
      platform_platformLeagueId_platformTeamId: {
        platform: 'sleeper',
        platformLeagueId: 'test_league_123',
        platformTeamId: 'team_1',
      },
    },
    create: {
      userId: user.id,
      platform: 'sleeper',
      platformLeagueId: 'test_league_123',
      leagueName: 'Test League - Trade Analysis',
      teamName: 'Test Team',
      platformTeamId: 'team_1',
      scoringSettings: {
        rec: 1.0, // PPR
        pass_yd: 0.04,
        pass_td: 4,
        pass_int: -2,
        rush_yd: 0.1,
        rush_td: 6,
        rec_yd: 0.1,
        rec_td: 6,
        fum_lost: -2,
      },
      rosterSettings: {
        QB: 1,
        RB: 2,
        WR: 2,
        TE: 1,
        FLEX: 1,
        BN: 6,
      },
      currentFaab: 100,
      faabBudget: 100,
      isActive: true,
    },
    update: {},
  });

  console.log(`   ✅ Test league created: ${league.id}\n`);

  return league.id;
}

/**
 * Add players to test roster
 */
async function addPlayersToRoster(
  leagueId: string,
  playerIds: string[]
): Promise<void> {
  console.log(`📋 Adding ${playerIds.length} players to test roster...`);

  // Clear existing roster
  await db.roster.deleteMany({
    where: { leagueId },
  });

  // Add players to roster
  for (const playerId of playerIds) {
    await db.roster.create({
      data: {
        leagueId,
        playerId,
        rosterSlot: 'BN', // All on bench for simplicity
        isStarting: false,
      },
    });
  }

  console.log(`   ✅ Roster populated\n`);
}

/**
 * Analyze roster for sell-high and buy-low candidates
 */
async function analyzeRoster(leagueId: string): Promise<{
  sellHigh: PlayerValue[];
  buyLow: PlayerValue[];
  allPlayers: PlayerValue[];
}> {
  console.log('📊 Analyzing roster for trade opportunities...\n');

  const playerValues = await tradeAnalyzerService.getRosterValues(
    leagueId,
    SEASON,
    TEST_WEEK
  );

  const sellHigh = playerValues.filter(p => p.isSellHigh);
  const buyLow = playerValues.filter(p => p.isBuyLow);

  console.log('='.repeat(80));
  console.log('SELL-HIGH CANDIDATES');
  console.log('='.repeat(80));

  if (sellHigh.length === 0) {
    console.log('   No sell-high candidates found');
  } else {
    console.log(`Found ${sellHigh.length} sell-high candidates:\n`);
    sellHigh.forEach(p => {
      console.log(`   ${p.playerName} (${p.position} - ${p.team})`);
      console.log(`     Performance Ratio: ${p.performanceRatio.toFixed(2)}x (${(p.performanceRatio * 100 - 100).toFixed(1)}% above projection)`);
      console.log(`     Z-Score: ${p.zScore.toFixed(2)} (${p.zScore > 0 ? 'above' : 'below'} average)`);
      console.log(`     Current Value: ${p.currentValue.toFixed(1)} pts`);
      console.log(`     Projected Value: ${p.projectedValue.toFixed(1)} pts`);
      console.log(`     Trend: ${p.trend}`);
      console.log('');
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('BUY-LOW CANDIDATES');
  console.log('='.repeat(80));

  if (buyLow.length === 0) {
    console.log('   No buy-low candidates found');
  } else {
    console.log(`Found ${buyLow.length} buy-low candidates:\n`);
    buyLow.forEach(p => {
      console.log(`   ${p.playerName} (${p.position} - ${p.team})`);
      console.log(`     Performance Ratio: ${p.performanceRatio.toFixed(2)}x (${(100 - p.performanceRatio * 100).toFixed(1)}% below projection)`);
      console.log(`     Z-Score: ${p.zScore.toFixed(2)}`);
      console.log(`     Current Value: ${p.currentValue.toFixed(1)} pts`);
      console.log(`     Projected Value: ${p.projectedValue.toFixed(1)} pts`);
      console.log(`     Injury Risk: ${(p.injuryRisk * 100).toFixed(0)}%`);
      console.log(`     Trend: ${p.trend}`);
      console.log('');
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('ALL ROSTER PLAYERS - PERFORMANCE ANALYSIS');
  console.log('='.repeat(80));
  console.log('\nPlayer                          | Pos | Ratio | Z-Scr | Value | Trend | Status');
  console.log('-'.repeat(80));

  playerValues
    .sort((a, b) => b.performanceRatio - a.performanceRatio)
    .forEach(p => {
      const status = p.isSellHigh ? '🔥 SELL' : p.isBuyLow ? '💎 BUY' : '   -';
      console.log(
        `${p.playerName.padEnd(30)} | ${p.position.padEnd(3)} | ` +
        `${p.performanceRatio.toFixed(2).padStart(5)} | ` +
        `${p.zScore.toFixed(2).padStart(5)} | ` +
        `${p.currentValue.toFixed(1).padStart(5)} | ` +
        `${p.trend.padEnd(5)} | ${status}`
      );
    });

  return {
    sellHigh,
    buyLow,
    allPlayers: playerValues,
  };
}

/**
 * Test projection accuracy for sample players
 */
async function testProjectionAccuracy(playerIds: string[]): Promise<void> {
  console.log('\n\n' + '='.repeat(80));
  console.log('PROJECTION ACCURACY TEST');
  console.log('='.repeat(80));
  console.log('\nTesting improved projections vs actual performance...\n');

  let totalError = 0;
  let totalPlayers = 0;

  for (const playerId of playerIds.slice(0, 10)) {
    const player = await db.player.findUnique({
      where: { id: playerId },
    });

    if (!player) continue;

    // Get actual stats for week 7
    const actualStats = await db.playerWeekStats.findUnique({
      where: {
        playerId_week_season_source: {
          playerId,
          week: 7,
          season: SEASON,
          source: 'sleeper',
        },
      },
    });

    // Get projection for week 7
    const projection = await projectionService.getPlayerProjection(playerId, 7, SEASON);

    if (actualStats && projection && actualStats.pprPoints !== null) {
      const error = Math.abs(projection.projectedPoints - actualStats.pprPoints);
      totalError += error;
      totalPlayers++;

      console.log(`${player.fullName.padEnd(25)} | ` +
        `Projected: ${projection.projectedPoints.toFixed(1).padStart(5)} | ` +
        `Actual: ${actualStats.pprPoints.toFixed(1).padStart(5)} | ` +
        `Error: ${error.toFixed(1).padStart(5)} pts`);
    }
  }

  if (totalPlayers > 0) {
    const avgError = totalError / totalPlayers;
    console.log(`\nAverage Projection Error: ${avgError.toFixed(2)} points`);
  }
}

/**
 * Calculate statistics for analysis
 */
function calculateStatistics(players: PlayerValue[]): void {
  if (players.length === 0) return;

  const avgRatio = players.reduce((sum, p) => sum + p.performanceRatio, 0) / players.length;
  const avgZScore = players.reduce((sum, p) => sum + p.zScore, 0) / players.length;
  const avgCurrentValue = players.reduce((sum, p) => sum + p.currentValue, 0) / players.length;
  const avgProjectedValue = players.reduce((sum, p) => sum + p.projectedValue, 0) / players.length;

  const upTrend = players.filter(p => p.trend === 'up').length;
  const downTrend = players.filter(p => p.trend === 'down').length;
  const stable = players.filter(p => p.trend === 'stable').length;

  console.log('\n' + '='.repeat(80));
  console.log('ROSTER STATISTICS');
  console.log('='.repeat(80));
  console.log(`\nTotal Players Analyzed: ${players.length}`);
  console.log(`Average Performance Ratio: ${avgRatio.toFixed(2)}x`);
  console.log(`Average Z-Score: ${avgZScore.toFixed(2)}`);
  console.log(`Average Current Value: ${avgCurrentValue.toFixed(1)} pts`);
  console.log(`Average Projected Value: ${avgProjectedValue.toFixed(1)} pts`);
  console.log(`\nTrend Distribution:`);
  console.log(`  Trending Up: ${upTrend} (${(upTrend / players.length * 100).toFixed(1)}%)`);
  console.log(`  Stable: ${stable} (${(stable / players.length * 100).toFixed(1)}%)`);
  console.log(`  Trending Down: ${downTrend} (${(downTrend / players.length * 100).toFixed(1)}%)`);
}

/**
 * Main test function
 */
async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🏈 TRADE ANALYZER TEST WITH IMPROVED PROJECTIONS');
  console.log('='.repeat(80));
  console.log(`\nSeason: ${SEASON}`);
  console.log(`Test Week: ${TEST_WEEK}`);
  console.log(`Analysis Date: ${new Date().toLocaleDateString()}\n`);

  try {
    // 1. Find test players
    const playerIds = await findTestPlayers(20);

    if (playerIds.length === 0) {
      console.error('❌ No players found with sufficient data');
      return;
    }

    // 2. Create test league and roster
    const leagueId = await createTestLeague();
    await addPlayersToRoster(leagueId, playerIds);

    // 3. Test projection accuracy
    await testProjectionAccuracy(playerIds);

    // 4. Analyze roster for trade opportunities
    const { sellHigh, buyLow, allPlayers } = await analyzeRoster(leagueId);

    // 5. Calculate statistics
    calculateStatistics(allPlayers);

    // 6. Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n✅ Trade Analyzer Test Complete!`);
    console.log(`\nKey Findings:`);
    console.log(`  • Total Players Analyzed: ${allPlayers.length}`);
    console.log(`  • Sell-High Candidates: ${sellHigh.length}`);
    console.log(`  • Buy-Low Candidates: ${buyLow.length}`);

    if (allPlayers.length > 0) {
      const avgRatio = allPlayers.reduce((sum, p) => sum + p.performanceRatio, 0) / allPlayers.length;
      console.log(`  • Average Performance Ratio: ${avgRatio.toFixed(2)}x`);

      if (avgRatio > 1.0) {
        console.log(`  • ✅ Players performing ${((avgRatio - 1.0) * 100).toFixed(1)}% ABOVE projections`);
      } else {
        console.log(`  • ⚠️  Players performing ${((1.0 - avgRatio) * 100).toFixed(1)}% BELOW projections`);
      }
    }

    console.log(`\n💡 Insights:`);
    if (sellHigh.length > 0) {
      console.log(`  • Found ${sellHigh.length} sell-high opportunities - these players are outperforming`);
      console.log(`    their projections and may regress to the mean`);
    } else {
      console.log(`  • No sell-high candidates - no players significantly outperforming`);
    }

    if (buyLow.length > 0) {
      console.log(`  • Found ${buyLow.length} buy-low targets - undervalued players with upside`);
    } else {
      console.log(`  • No buy-low candidates - no significantly undervalued players`);
    }

    console.log('\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

main()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
