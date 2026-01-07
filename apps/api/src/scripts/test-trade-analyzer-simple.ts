#!/usr/bin/env tsx

/**
 * Simple Trade Analyzer Test
 * Tests sell-high/buy-low detection with real 2024 data
 */

import { db } from '@fantasy-football/database';

const SEASON = 2024;
const WEEKS_TO_ANALYZE = [4, 5, 6]; // Weeks with best projection data

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🏈 SELL-HIGH / BUY-LOW ANALYSIS WITH IMPROVED PROJECTIONS');
  console.log('='.repeat(80));
  console.log(`\nSeason: ${SEASON}`);
  console.log(`Weeks Analyzed: ${WEEKS_TO_ANALYZE.join(', ')}\n`);

  // Get top players with both projections and actual stats
  const players = await db.player.findMany({
    where: {
      position: { in: ['QB', 'RB', 'WR', 'TE'] },
      weekStats: {
        some: {
          season: SEASON,
          week: { in: WEEKS_TO_ANALYZE },
        },
      },
      projections: {
        some: {
          season: SEASON,
          week: { in: WEEKS_TO_ANALYZE },
        },
      },
    },
    include: {
      weekStats: {
        where: {
          season: SEASON,
          week: { in: WEEKS_TO_ANALYZE },
        },
        orderBy: { week: 'asc' },
      },
      projections: {
        where: {
          season: SEASON,
          week: { in: WEEKS_TO_ANALYZE },
        },
        orderBy: { week: 'asc' },
      },
    },
    take: 100, // Get more players
  });

  console.log(`Found ${players.length} players with complete data\n`);

  // Calculate performance ratios
  const playerAnalysis = players
    .map(player => {
      // Match projections with actuals by week
      const weekData = WEEKS_TO_ANALYZE.map(week => {
        const actual = player.weekStats.find(s => s.week === week);
        // Prefer historical_analysis, fallback to position_average
        let projected = player.projections.find(p => p.week === week && p.source === 'historical_analysis');
        if (!projected) {
          projected = player.projections.find(p => p.week === week && p.source === 'position_average');
        }

        if (!actual || !projected || actual.pprPoints === null || projected.projectedPoints === 0) {
          return null;
        }

        return {
          week,
          actual: actual.pprPoints,
          projected: projected.projectedPoints,
          error: Math.abs(actual.pprPoints - projected.projectedPoints),
          source: projected.source,
        };
      }).filter(d => d !== null);

      if (weekData.length < 3) return null; // Need at least 3 weeks

      const avgActual = weekData.reduce((sum, d) => sum + d!.actual, 0) / weekData.length;
      const avgProjected = weekData.reduce((sum, d) => sum + d!.projected, 0) / weekData.length;
      const avgError = weekData.reduce((sum, d) => sum + d!.error, 0) / weekData.length;

      const performanceRatio = avgProjected > 0 ? avgActual / avgProjected : 0;

      return {
        playerId: player.id,
        playerName: player.fullName,
        position: player.position,
        team: player.team,
        weeksAnalyzed: weekData.length,
        avgActual,
        avgProjected,
        avgError,
        performanceRatio,
        percentDiff: ((avgActual - avgProjected) / avgProjected) * 100,
        isSellHigh: performanceRatio > 1.15, // Performing 15% above projection
        isBuyLow: performanceRatio < 0.8 && avgActual > 5, // 20% below + meaningful points
      };
    })
    .filter(p => p !== null);

  // Sort by performance ratio
  playerAnalysis.sort((a, b) => b!.performanceRatio - a!.performanceRatio);

  // Display results
  console.log('='.repeat(80));
  console.log('SELL-HIGH CANDIDATES (Outperforming Projections by 15%+)');
  console.log('='.repeat(80));

  const sellHigh = playerAnalysis.filter(p => p!.isSellHigh);
  console.log(`\nFound ${sellHigh.length} sell-high candidates:\n`);

  sellHigh.forEach(p => {
    console.log(`🔥 ${p!.playerName.padEnd(25)} (${p!.position} - ${p!.team || 'FA'})`);
    console.log(`     Avg Actual:    ${p!.avgActual.toFixed(1)} pts/game`);
    console.log(`     Avg Projected: ${p!.avgProjected.toFixed(1)} pts/game`);
    console.log(`     Performing ${p!.percentDiff.toFixed(1)}% ABOVE projection`);
    console.log(`     Performance Ratio: ${p!.performanceRatio.toFixed(2)}x`);
    console.log(`     Weeks: ${p!.weeksAnalyzed} | Avg Error: ${p!.avgError.toFixed(1)} pts`);
    console.log('');
  });

  console.log('\n' + '='.repeat(80));
  console.log('BUY-LOW CANDIDATES (Underperforming Projections by 20%+)');
  console.log('='.repeat(80));

  const buyLow = playerAnalysis.filter(p => p!.isBuyLow);
  console.log(`\nFound ${buyLow.length} buy-low candidates:\n`);

  buyLow.forEach(p => {
    console.log(`💎 ${p!.playerName.padEnd(25)} (${p!.position} - ${p!.team || 'FA'})`);
    console.log(`     Avg Actual:    ${p!.avgActual.toFixed(1)} pts/game`);
    console.log(`     Avg Projected: ${p!.avgProjected.toFixed(1)} pts/game`);
    console.log(`     Performing ${Math.abs(p!.percentDiff).toFixed(1)}% BELOW projection`);
    console.log(`     Performance Ratio: ${p!.performanceRatio.toFixed(2)}x`);
    console.log(`     Weeks: ${p!.weeksAnalyzed} | Avg Error: ${p!.avgError.toFixed(1)} pts`);
    console.log('');
  });

  // Overall statistics
  console.log('\n' + '='.repeat(80));
  console.log('OVERALL PROJECTION PERFORMANCE');
  console.log('='.repeat(80));

  const avgRatio = playerAnalysis.reduce((sum, p) => sum + p!.performanceRatio, 0) / playerAnalysis.length;
  const avgPercentDiff = playerAnalysis.reduce((sum, p) => sum + p!.percentDiff, 0) / playerAnalysis.length;

  console.log(`\nTotal Players Analyzed: ${playerAnalysis.length}`);
  console.log(`Average Performance Ratio: ${avgRatio.toFixed(2)}x`);
  console.log(`Average % Difference: ${avgPercentDiff.toFixed(1)}%`);
  console.log(`\nSell-High Candidates: ${sellHigh.length} (${(sellHigh.length / playerAnalysis.length * 100).toFixed(1)}%)`);
  console.log(`Buy-Low Candidates: ${buyLow.length} (${(buyLow.length / playerAnalysis.length * 100).toFixed(1)}%)`);

  // Sample some players to show projection quality
  console.log('\n' + '='.repeat(80));
  console.log('SAMPLE PLAYER PROJECTIONS (Random Selection)');
  console.log('='.repeat(80));

  const samples = playerAnalysis.slice(0, 10);
  console.log('\nPlayer                     | Pos | Actual | Proj  | Error | Ratio | Status');
  console.log('-'.repeat(80));

  samples.forEach(p => {
    const status = p!.isSellHigh ? ' 🔥 SELL' : p!.isBuyLow ? ' 💎 BUY' : '';
    console.log(
      `${p!.playerName.substring(0, 24).padEnd(24)} | ` +
      `${p!.position.padEnd(3)} | ` +
      `${p!.avgActual.toFixed(1).padStart(6)} | ` +
      `${p!.avgProjected.toFixed(1).padStart(5)} | ` +
      `${p!.avgError.toFixed(1).padStart(5)} | ` +
      `${p!.performanceRatio.toFixed(2).padStart(5)} |${status}`
    );
  });

  console.log('\n');
}

main()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
