#!/usr/bin/env tsx

/**
 * Projection Accuracy Validation Script
 *
 * Validates the accuracy of historical-based projections against actual stats.
 * Calculates metrics like MAE, RMSE, R², and analyzes by position, week, etc.
 *
 * Usage:
 *   pnpm tsx apps/api/src/scripts/validate-projection-accuracy.ts
 *   pnpm tsx apps/api/src/scripts/validate-projection-accuracy.ts --weeks 1-5
 *   pnpm tsx apps/api/src/scripts/validate-projection-accuracy.ts --position QB
 *   pnpm tsx apps/api/src/scripts/validate-projection-accuracy.ts --export results.json
 */

import { db } from '@fantasy-football/database';
import * as fs from 'fs';

const SEASON = 2024;

interface ValidationOptions {
  weeks?: number[];
  position?: string;
  minGames?: number;
  export?: string;
}

interface PlayerAccuracy {
  playerId: string;
  playerName: string;
  position: string;
  gamesAnalyzed: number;
  mae: number; // Mean Absolute Error
  rmse: number; // Root Mean Square Error
  mape: number; // Mean Absolute Percentage Error
  bias: number; // Average (Projected - Actual)
  correlationCoeff: number; // Pearson correlation
  withinRange: {
    within5: number; // % within 5 points
    within10: number; // % within 10 points
  };
  projections: Array<{
    week: number;
    projected: number;
    actual: number;
    error: number;
    percentError: number;
  }>;
}

interface PositionAccuracy {
  position: string;
  playersAnalyzed: number;
  totalProjections: number;
  mae: number;
  rmse: number;
  mape: number;
  bias: number;
  withinRange: {
    within5: number;
    within10: number;
  };
  topPlayers: Array<{
    name: string;
    mae: number;
    games: number;
  }>;
  worstPlayers: Array<{
    name: string;
    mae: number;
    games: number;
  }>;
}

interface WeekAccuracy {
  week: number;
  projectionsAnalyzed: number;
  mae: number;
  rmse: number;
  mape: number;
  bias: number;
}

interface ValidationReport {
  season: number;
  generatedAt: Date;
  summary: {
    totalProjections: number;
    totalPlayers: number;
    overallMAE: number;
    overallRMSE: number;
    overallMAPE: number;
    overallBias: number;
    withinRange: {
      within5: number;
      within10: number;
    };
  };
  byPosition: PositionAccuracy[];
  byWeek: WeekAccuracy[];
  playerDetails?: PlayerAccuracy[];
}

async function parseArgs(): Promise<ValidationOptions> {
  const args = process.argv.slice(2);
  const options: ValidationOptions = {
    minGames: 3, // Minimum games for player-level analysis
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--weeks' && args[i + 1]) {
      const weeksArg = args[i + 1];
      if (weeksArg.includes('-')) {
        const [start, end] = weeksArg.split('-').map(Number);
        options.weeks = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      } else {
        options.weeks = weeksArg.split(',').map(Number);
      }
      i++;
    } else if (arg === '--position' && args[i + 1]) {
      options.position = args[i + 1].toUpperCase();
      i++;
    } else if (arg === '--min-games' && args[i + 1]) {
      options.minGames = Number(args[i + 1]);
      i++;
    } else if (arg === '--export' && args[i + 1]) {
      options.export = args[i + 1];
      i++;
    }
  }

  return options;
}

function calculateMAE(errors: number[]): number {
  if (errors.length === 0) return 0;
  return errors.reduce((sum, err) => sum + Math.abs(err), 0) / errors.length;
}

function calculateRMSE(errors: number[]): number {
  if (errors.length === 0) return 0;
  const mse = errors.reduce((sum, err) => sum + err * err, 0) / errors.length;
  return Math.sqrt(mse);
}

function calculateMAPE(projections: Array<{ projected: number; actual: number }>): number {
  if (projections.length === 0) return 0;
  const percentErrors = projections
    .filter(p => p.actual !== 0) // Avoid division by zero
    .map(p => Math.abs((p.projected - p.actual) / p.actual) * 100);
  if (percentErrors.length === 0) return 0;
  return percentErrors.reduce((sum, pe) => sum + pe, 0) / percentErrors.length;
}

function calculateBias(errors: number[]): number {
  if (errors.length === 0) return 0;
  return errors.reduce((sum, err) => sum + err, 0) / errors.length;
}

function calculateCorrelation(
  projections: Array<{ projected: number; actual: number }>
): number {
  if (projections.length < 2) return 0;

  const n = projections.length;
  const projected = projections.map(p => p.projected);
  const actual = projections.map(p => p.actual);

  const meanProjected = projected.reduce((sum, p) => sum + p, 0) / n;
  const meanActual = actual.reduce((sum, a) => sum + a, 0) / n;

  let numerator = 0;
  let denomProjected = 0;
  let denomActual = 0;

  for (let i = 0; i < n; i++) {
    const diffProjected = projected[i] - meanProjected;
    const diffActual = actual[i] - meanActual;
    numerator += diffProjected * diffActual;
    denomProjected += diffProjected * diffProjected;
    denomActual += diffActual * diffActual;
  }

  const denominator = Math.sqrt(denomProjected * denomActual);
  return denominator === 0 ? 0 : numerator / denominator;
}

function calculateWithinRange(errors: number[]): { within5: number; within10: number } {
  if (errors.length === 0) return { within5: 0, within10: 0 };

  const within5 = errors.filter(err => Math.abs(err) <= 5).length;
  const within10 = errors.filter(err => Math.abs(err) <= 10).length;

  return {
    within5: (within5 / errors.length) * 100,
    within10: (within10 / errors.length) * 100,
  };
}

async function analyzePlayerAccuracy(
  playerId: string,
  playerName: string,
  position: string,
  weeks: number[]
): Promise<PlayerAccuracy | null> {
  // Fetch projections and actual stats for this player
  const data = await db.playerProjection.findMany({
    where: {
      playerId,
      week: { in: weeks },
      season: SEASON,
      source: 'historical_analysis',
    },
    include: {
      player: {
        include: {
          weekStats: {
            where: {
              week: { in: weeks },
              season: SEASON,
            },
          },
        },
      },
    },
  });

  const projections: Array<{
    week: number;
    projected: number;
    actual: number;
    error: number;
    percentError: number;
  }> = [];

  for (const projection of data) {
    // Find matching actual stats
    const actualStats = projection.player.weekStats.find(
      ws => ws.week === projection.week && ws.season === projection.season
    );

    if (actualStats && actualStats.pprPoints !== null) {
      const error = projection.projectedPoints - actualStats.pprPoints;
      const percentError =
        actualStats.pprPoints !== 0
          ? Math.abs(error / actualStats.pprPoints) * 100
          : 0;

      projections.push({
        week: projection.week,
        projected: projection.projectedPoints,
        actual: actualStats.pprPoints,
        error,
        percentError,
      });
    }
  }

  // Need at least some data points
  if (projections.length === 0) {
    return null;
  }

  const errors = projections.map(p => p.error);

  return {
    playerId,
    playerName,
    position,
    gamesAnalyzed: projections.length,
    mae: calculateMAE(errors),
    rmse: calculateRMSE(errors),
    mape: calculateMAPE(projections),
    bias: calculateBias(errors),
    correlationCoeff: calculateCorrelation(projections),
    withinRange: calculateWithinRange(errors),
    projections,
  };
}

async function analyzeByPosition(
  position: string,
  weeks: number[],
  minGames: number
): Promise<PositionAccuracy> {
  console.log(`\n  Analyzing ${position}...`);

  // Get all players at this position with projections
  const players = await db.player.findMany({
    where: {
      position,
      projections: {
        some: {
          week: { in: weeks },
          season: SEASON,
          source: 'historical_analysis',
        },
      },
    },
    select: {
      id: true,
      fullName: true,
      position: true,
    },
  });

  console.log(`    Found ${players.length} ${position}s with projections`);

  const playerAccuracies: PlayerAccuracy[] = [];

  for (const player of players) {
    const accuracy = await analyzePlayerAccuracy(
      player.id,
      player.fullName,
      player.position,
      weeks
    );

    if (accuracy && accuracy.gamesAnalyzed >= minGames) {
      playerAccuracies.push(accuracy);
    }
  }

  console.log(`    Analyzed ${playerAccuracies.length} ${position}s with ${minGames}+ games`);

  // Aggregate metrics
  const allErrors = playerAccuracies.flatMap(pa => pa.projections.map(p => p.error));
  const allProjections = playerAccuracies.flatMap(pa => pa.projections);

  // Top and worst performers
  const sortedByMAE = [...playerAccuracies].sort((a, b) => a.mae - b.mae);

  return {
    position,
    playersAnalyzed: playerAccuracies.length,
    totalProjections: allProjections.length,
    mae: calculateMAE(allErrors),
    rmse: calculateRMSE(allErrors),
    mape: calculateMAPE(allProjections),
    bias: calculateBias(allErrors),
    withinRange: calculateWithinRange(allErrors),
    topPlayers: sortedByMAE.slice(0, 5).map(pa => ({
      name: pa.playerName,
      mae: pa.mae,
      games: pa.gamesAnalyzed,
    })),
    worstPlayers: sortedByMAE
      .slice(-5)
      .reverse()
      .map(pa => ({
        name: pa.playerName,
        mae: pa.mae,
        games: pa.gamesAnalyzed,
      })),
  };
}

async function analyzeByWeek(week: number): Promise<WeekAccuracy> {
  // Get all projections vs actuals for this week
  const projections = await db.playerProjection.findMany({
    where: {
      week,
      season: SEASON,
      source: 'historical_analysis',
    },
    include: {
      player: {
        include: {
          weekStats: {
            where: {
              week,
              season: SEASON,
            },
          },
        },
      },
    },
  });

  const data: Array<{ projected: number; actual: number; error: number }> = [];

  for (const projection of projections) {
    const actualStats = projection.player.weekStats.find(
      ws => ws.week === week && ws.season === SEASON
    );

    if (actualStats && actualStats.pprPoints !== null) {
      data.push({
        projected: projection.projectedPoints,
        actual: actualStats.pprPoints,
        error: projection.projectedPoints - actualStats.pprPoints,
      });
    }
  }

  const errors = data.map(d => d.error);

  return {
    week,
    projectionsAnalyzed: data.length,
    mae: calculateMAE(errors),
    rmse: calculateRMSE(errors),
    mape: calculateMAPE(data),
    bias: calculateBias(errors),
  };
}

async function generateReport(options: ValidationOptions): Promise<ValidationReport> {
  console.log('\n📊 Generating validation report...\n');

  // Determine weeks to analyze
  const weeks =
    options.weeks ||
    Array.from({ length: 18 }, (_, i) => i + 1).filter(w => w > 1); // Skip week 1 (no projections)

  console.log(`Analyzing weeks: ${weeks.join(', ')}`);

  // Analyze by position
  console.log('\n📈 Analyzing by position...');
  const positions = options.position ? [options.position] : ['QB', 'RB', 'WR', 'TE'];
  const byPosition: PositionAccuracy[] = [];

  for (const position of positions) {
    const posAccuracy = await analyzeByPosition(position, weeks, options.minGames || 3);
    byPosition.push(posAccuracy);
  }

  // Analyze by week
  console.log('\n📅 Analyzing by week...');
  const byWeek: WeekAccuracy[] = [];

  for (const week of weeks) {
    process.stdout.write(`  Week ${week}...\r`);
    const weekAccuracy = await analyzeByWeek(week);
    byWeek.push(weekAccuracy);
  }
  console.log(''); // New line after progress

  // Calculate overall summary
  console.log('\n📊 Calculating overall metrics...');
  const allErrors = byPosition.flatMap(pos =>
    Array(pos.totalProjections)
      .fill(0)
      .map(() => 0)
  ); // Placeholder
  const totalProjections = byPosition.reduce((sum, pos) => sum + pos.totalProjections, 0);
  const totalPlayers = byPosition.reduce((sum, pos) => sum + pos.playersAnalyzed, 0);

  // Weighted average MAE/RMSE by position (weighted by number of projections)
  const overallMAE =
    byPosition.reduce((sum, pos) => sum + pos.mae * pos.totalProjections, 0) /
    totalProjections;
  const overallRMSE =
    byPosition.reduce((sum, pos) => sum + pos.rmse * pos.totalProjections, 0) /
    totalProjections;
  const overallMAPE =
    byPosition.reduce((sum, pos) => sum + pos.mape * pos.totalProjections, 0) /
    totalProjections;
  const overallBias =
    byPosition.reduce((sum, pos) => sum + pos.bias * pos.totalProjections, 0) /
    totalProjections;
  const overallWithin5 =
    byPosition.reduce(
      (sum, pos) => sum + pos.withinRange.within5 * pos.totalProjections,
      0
    ) / totalProjections;
  const overallWithin10 =
    byPosition.reduce(
      (sum, pos) => sum + pos.withinRange.within10 * pos.totalProjections,
      0
    ) / totalProjections;

  return {
    season: SEASON,
    generatedAt: new Date(),
    summary: {
      totalProjections,
      totalPlayers,
      overallMAE,
      overallRMSE,
      overallMAPE,
      overallBias,
      withinRange: {
        within5: overallWithin5,
        within10: overallWithin10,
      },
    },
    byPosition,
    byWeek,
  };
}

function printReport(report: ValidationReport) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 PROJECTION ACCURACY VALIDATION REPORT');
  console.log('='.repeat(70));

  console.log(`\nSeason: ${report.season}`);
  console.log(`Generated: ${report.generatedAt.toLocaleString()}`);

  console.log('\n' + '-'.repeat(70));
  console.log('OVERALL SUMMARY');
  console.log('-'.repeat(70));
  console.log(`Total Projections Analyzed: ${report.summary.totalProjections}`);
  console.log(`Total Players Analyzed: ${report.summary.totalPlayers}`);
  console.log(`\nAccuracy Metrics:`);
  console.log(`  Mean Absolute Error (MAE):     ${report.summary.overallMAE.toFixed(2)} points`);
  console.log(`  Root Mean Square Error (RMSE): ${report.summary.overallRMSE.toFixed(2)} points`);
  console.log(`  Mean Absolute % Error (MAPE):  ${report.summary.overallMAPE.toFixed(1)}%`);
  console.log(`  Bias (Projected - Actual):     ${report.summary.overallBias >= 0 ? '+' : ''}${report.summary.overallBias.toFixed(2)} points`);
  console.log(`\nRange Accuracy:`);
  console.log(`  Within 5 points:  ${report.summary.withinRange.within5.toFixed(1)}%`);
  console.log(`  Within 10 points: ${report.summary.withinRange.within10.toFixed(1)}%`);

  console.log('\n' + '-'.repeat(70));
  console.log('ACCURACY BY POSITION');
  console.log('-'.repeat(70));

  for (const pos of report.byPosition) {
    console.log(`\n${pos.position}:`);
    console.log(`  Players: ${pos.playersAnalyzed} | Projections: ${pos.totalProjections}`);
    console.log(`  MAE: ${pos.mae.toFixed(2)} | RMSE: ${pos.rmse.toFixed(2)} | MAPE: ${pos.mape.toFixed(1)}%`);
    console.log(`  Bias: ${pos.bias >= 0 ? '+' : ''}${pos.bias.toFixed(2)} | Within 5pts: ${pos.withinRange.within5.toFixed(1)}%`);

    console.log(`\n  Top 5 Most Accurate:`);
    pos.topPlayers.forEach((p, i) => {
      console.log(`    ${i + 1}. ${p.name.padEnd(25)} MAE: ${p.mae.toFixed(2)} (${p.games} games)`);
    });

    console.log(`\n  Bottom 5 Least Accurate:`);
    pos.worstPlayers.forEach((p, i) => {
      console.log(`    ${i + 1}. ${p.name.padEnd(25)} MAE: ${p.mae.toFixed(2)} (${p.games} games)`);
    });
  }

  console.log('\n' + '-'.repeat(70));
  console.log('ACCURACY BY WEEK');
  console.log('-'.repeat(70));
  console.log('\nWeek | Projections |   MAE  |  RMSE  |  MAPE  |  Bias');
  console.log('-'.repeat(70));

  for (const week of report.byWeek) {
    console.log(
      ` ${week.week.toString().padStart(2)}  | ` +
        `${week.projectionsAnalyzed.toString().padStart(11)} | ` +
        `${week.mae.toFixed(2).padStart(6)} | ` +
        `${week.rmse.toFixed(2).padStart(6)} | ` +
        `${week.mape.toFixed(1).padStart(5)}% | ` +
        `${(week.bias >= 0 ? '+' : '') + week.bias.toFixed(2).padStart(5)}`
    );
  }

  console.log('\n' + '='.repeat(70));
  console.log('KEY INSIGHTS');
  console.log('='.repeat(70));

  // Best/worst position
  const sortedPositions = [...report.byPosition].sort((a, b) => a.mae - b.mae);
  console.log(`\n✅ Most Accurate Position: ${sortedPositions[0].position} (MAE: ${sortedPositions[0].mae.toFixed(2)})`);
  console.log(`❌ Least Accurate Position: ${sortedPositions[sortedPositions.length - 1].position} (MAE: ${sortedPositions[sortedPositions.length - 1].mae.toFixed(2)})`);

  // Bias analysis
  if (Math.abs(report.summary.overallBias) > 1) {
    console.log(
      `\n${report.summary.overallBias > 0 ? '⚠️  Over-projecting' : '⚠️  Under-projecting'} by ${Math.abs(report.summary.overallBias).toFixed(2)} points on average`
    );
  } else {
    console.log(`\n✅ Minimal bias in projections (${report.summary.overallBias.toFixed(2)} points)`);
  }

  // Week trends
  const weekMAEs = report.byWeek.map(w => w.mae);
  const avgEarlyWeeks = weekMAEs.slice(0, 6).reduce((a, b) => a + b, 0) / 6;
  const avgLateWeeks = weekMAEs.slice(6).reduce((a, b) => a + b, 0) / (weekMAEs.length - 6);
  if (avgLateWeeks < avgEarlyWeeks) {
    console.log(`\n✅ Projections improve as season progresses (Early: ${avgEarlyWeeks.toFixed(2)}, Late: ${avgLateWeeks.toFixed(2)})`);
  } else {
    console.log(`\n⚠️  Projection accuracy decreases later in season (Early: ${avgEarlyWeeks.toFixed(2)}, Late: ${avgLateWeeks.toFixed(2)})`);
  }

  console.log('\n');
}

async function main() {
  const options = await parseArgs();

  console.log('\n' + '='.repeat(70));
  console.log('🏈 Projection Accuracy Validation');
  console.log('='.repeat(70));

  const report = await generateReport(options);

  printReport(report);

  // Export if requested
  if (options.export) {
    console.log(`\n💾 Exporting report to ${options.export}...`);
    fs.writeFileSync(options.export, JSON.stringify(report, null, 2));
    console.log(`✅ Report exported successfully!\n`);
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
