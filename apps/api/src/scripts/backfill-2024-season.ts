#!/usr/bin/env tsx

/**
 * Backfill 2024 NFL Season Data
 *
 * This script:
 * 1. Fetches all player stats for weeks 1-18 of 2024 season from Sleeper API
 * 2. Generates historical-based projections for each week
 * 3. Stores both in the database for accuracy validation
 *
 * Usage:
 *   pnpm tsx apps/api/src/scripts/backfill-2024-season.ts
 *   pnpm tsx apps/api/src/scripts/backfill-2024-season.ts --weeks 1-5
 *   pnpm tsx apps/api/src/scripts/backfill-2024-season.ts --stats-only
 */

import { db } from '@fantasy-football/database';
import { playerStatsService } from '../services/playerStats';
import { projectionService } from '../services/projections';

const SEASON = 2024;
const TOTAL_WEEKS = 18;

interface BackfillOptions {
  weeks?: number[];
  statsOnly?: boolean;
  projectionsOnly?: boolean;
}

interface BackfillResult {
  week: number;
  statsResult?: {
    success: boolean;
    playersProcessed: number;
    playersWithStats: number;
    errors: string[];
  };
  projectionsResult?: {
    created: number;
    updated: number;
  };
  errors: string[];
}

async function parseArgs(): Promise<BackfillOptions> {
  const args = process.argv.slice(2);
  const options: BackfillOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--weeks' && args[i + 1]) {
      const weeksArg = args[i + 1];
      if (weeksArg.includes('-')) {
        // Range: 1-5
        const [start, end] = weeksArg.split('-').map(Number);
        options.weeks = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      } else {
        // Single week or comma-separated: 1,3,5
        options.weeks = weeksArg.split(',').map(Number);
      }
      i++; // Skip next arg
    } else if (arg === '--stats-only') {
      options.statsOnly = true;
    } else if (arg === '--projections-only') {
      options.projectionsOnly = true;
    }
  }

  // Default to all weeks if not specified
  if (!options.weeks) {
    options.weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);
  }

  return options;
}

async function backfillWeek(
  week: number,
  options: BackfillOptions
): Promise<BackfillResult> {
  const result: BackfillResult = {
    week,
    errors: [],
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Backfilling Week ${week} of ${SEASON} Season`);
  console.log('='.repeat(60));

  try {
    // Step 1: Sync actual stats from Sleeper API
    if (!options.projectionsOnly) {
      console.log(`\n[1/2] Fetching actual stats from Sleeper API...`);
      result.statsResult = await playerStatsService.syncWeekStats(SEASON, week);

      if (!result.statsResult.success) {
        result.errors.push(`Stats sync failed for week ${week}`);
        console.error(`❌ Stats sync failed for week ${week}`);
        result.statsResult.errors.forEach(err => console.error(`   - ${err}`));
      } else {
        console.log(
          `✅ Stats synced: ${result.statsResult.playersWithStats}/${result.statsResult.playersProcessed} players`
        );
      }
    }

    // Step 2: Generate historical-based projections
    if (!options.statsOnly && week > 1) {
      console.log(`\n[2/2] Generating historical-based projections...`);

      // Get all active players
      const players = await db.player.findMany({
        where: {
          position: {
            in: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'],
          },
        },
        select: {
          id: true,
          fullName: true,
          position: true,
          status: true,
        },
      });

      console.log(`   Found ${players.length} fantasy-relevant players`);

      let projectionsCreated = 0;
      let projectionsSkipped = 0;
      const projectionErrors: string[] = [];

      // Process in batches to avoid overwhelming the database
      const BATCH_SIZE = 50;
      for (let i = 0; i < players.length; i += BATCH_SIZE) {
        const batch = players.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async player => {
            try {
              // Generate projection based on historical data
              const projection = await projectionService.generateProjectionFromHistory(
                player.id,
                SEASON,
                week,
                Math.min(week - 1, 6) // Look back up to 6 weeks
              );

              if (projection) {
                // Store projection in database
                await db.playerProjection.upsert({
                  where: {
                    playerId_week_season_source: {
                      playerId: projection.playerId,
                      week: projection.week,
                      season: projection.season,
                      source: projection.source || 'historical_analysis',
                    },
                  },
                  create: {
                    playerId: projection.playerId,
                    week: projection.week,
                    season: projection.season,
                    projectedPoints: projection.projectedPoints,
                    stats: projection.stats || {},
                    confidence: projection.confidence || 0.5,
                    source: projection.source || 'historical_analysis',
                  },
                  update: {
                    projectedPoints: projection.projectedPoints,
                    stats: projection.stats || {},
                    confidence: projection.confidence || 0.5,
                    updatedAt: new Date(),
                  },
                });

                projectionsCreated++;
              } else {
                projectionsSkipped++;
              }
            } catch (error) {
              projectionErrors.push(
                `${player.fullName}: ${error instanceof Error ? error.message : 'Unknown error'}`
              );
            }
          })
        );

        // Progress indicator
        const progress = Math.min(i + BATCH_SIZE, players.length);
        process.stdout.write(`   Progress: ${progress}/${players.length} players\r`);
      }

      console.log(`\n✅ Projections created: ${projectionsCreated}`);
      if (projectionsSkipped > 0) {
        console.log(`   ⚠️  Skipped: ${projectionsSkipped} (insufficient data)`);
      }
      if (projectionErrors.length > 0) {
        console.log(`   ❌ Errors: ${projectionErrors.length}`);
        projectionErrors.slice(0, 5).forEach(err => console.error(`      - ${err}`));
        if (projectionErrors.length > 5) {
          console.error(`      ... and ${projectionErrors.length - 5} more`);
        }
      }

      result.projectionsResult = {
        created: projectionsCreated,
        updated: 0,
      };
    } else if (week === 1 && !options.statsOnly) {
      console.log(`\n[2/2] Skipping projections for Week 1 (no historical data)`);
    }

    console.log(`\n✅ Week ${week} backfill complete!`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(errorMsg);
    console.error(`\n❌ Week ${week} backfill failed: ${errorMsg}`);
  }

  return result;
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🏈 2024 NFL Season Data Backfill Script');
  console.log('='.repeat(60));

  const options = await parseArgs();

  console.log(`\nConfiguration:`);
  console.log(`  Season: ${SEASON}`);
  console.log(`  Weeks: ${options.weeks?.join(', ')}`);
  console.log(`  Mode: ${options.statsOnly ? 'Stats Only' : options.projectionsOnly ? 'Projections Only' : 'Stats + Projections'}`);

  const results: BackfillResult[] = [];

  // Process weeks sequentially to respect API rate limits
  for (const week of options.weeks || []) {
    const result = await backfillWeek(week, options);
    results.push(result);

    // Brief delay between weeks to avoid rate limiting
    if (week < (options.weeks?.[options.weeks.length - 1] || TOTAL_WEEKS)) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📈 Backfill Summary');
  console.log('='.repeat(60));

  const totalStatsProcessed = results.reduce(
    (sum, r) => sum + (r.statsResult?.playersWithStats || 0),
    0
  );
  const totalProjectionsCreated = results.reduce(
    (sum, r) => sum + (r.projectionsResult?.created || 0),
    0
  );
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  console.log(`\nWeeks processed: ${results.length}`);
  console.log(`Total stats records: ${totalStatsProcessed}`);
  console.log(`Total projections: ${totalProjectionsCreated}`);
  console.log(`Total errors: ${totalErrors}`);

  if (totalErrors > 0) {
    console.log(`\n⚠️  Some errors occurred during backfill:`);
    results.forEach(r => {
      if (r.errors.length > 0) {
        console.log(`\n  Week ${r.week}:`);
        r.errors.forEach(err => console.log(`    - ${err}`));
      }
    });
  }

  console.log(`\n✅ Backfill complete!`);
  console.log('\nNext steps:');
  console.log('  1. Run validation script to check projection accuracy');
  console.log('  2. Review results and adjust projection algorithms');
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
