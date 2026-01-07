import { playerStatsService } from '../services/playerStats';

/**
 * Backfill historical stats for the current season
 * Run this script once to populate player week stats
 *
 * Usage:
 *   npx ts-node src/scripts/backfillStats.ts [season] [endWeek]
 *
 * Examples:
 *   npx ts-node src/scripts/backfillStats.ts          # Current season, all weeks
 *   npx ts-node src/scripts/backfillStats.ts 2024     # 2024 season, all weeks
 *   npx ts-node src/scripts/backfillStats.ts 2024 10  # 2024 season, weeks 1-10
 */

/**
 * Get current NFL season based on date
 */
function getCurrentSeason(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // JavaScript months are 0-indexed

  // NFL season runs from September (month 9) to February (month 2)
  // If we're in Jan/Feb, the season is the previous year
  // If we're in Mar-Aug, there's no current season (offseason)
  // If we're in Sep-Dec, the season is the current year
  if (month >= 1 && month <= 2) {
    return year - 1; // Jan/Feb: previous year's season
  } else if (month >= 3 && month <= 8) {
    return year; // Mar-Aug: use current year for upcoming season
  } else {
    return year; // Sep-Dec: current year's season
  }
}

/**
 * Get current NFL week (approximate)
 */
function getCurrentNFLWeek(): number {
  const now = new Date();
  const year = now.getFullYear();

  // NFL season typically starts first Thursday after Labor Day (first Monday in September)
  // Approximate: first week of September = Week 1
  const seasonStart = new Date(year, 8, 7); // September 7th (approximate)

  if (now < seasonStart) {
    return 1; // Pre-season or early season
  }

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / msPerWeek);

  // NFL regular season is 18 weeks
  return Math.min(weeksSinceStart + 1, 18);
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Backfill stats for a range of weeks
 */
async function backfillStats(season: number, endWeek: number) {
  console.log('='.repeat(60));
  console.log('Fantasy Football Stats Backfill');
  console.log('='.repeat(60));
  console.log(`Season: ${season}`);
  console.log(`Weeks: 1-${endWeek}`);
  console.log('='.repeat(60));
  console.log('');

  const results = {
    totalWeeks: endWeek,
    successfulWeeks: 0,
    failedWeeks: 0,
    totalPlayers: 0,
    playersWithStats: 0,
    errors: [] as string[],
  };

  for (let week = 1; week <= endWeek; week++) {
    console.log(`\n[${ week}/${endWeek}] Syncing week ${week}...`);

    try {
      const result = await playerStatsService.syncWeekStats(season, week);

      if (result.success) {
        results.successfulWeeks++;
        results.totalPlayers += result.playersProcessed;
        results.playersWithStats += result.playersWithStats;

        console.log(`  ✓ Success: ${result.playersWithStats}/${result.playersProcessed} players`);

        if (result.errors.length > 0) {
          console.log(`  ⚠ ${result.errors.length} errors occurred:`);
          result.errors.slice(0, 3).forEach((err) => console.log(`    - ${err}`));
          if (result.errors.length > 3) {
            console.log(`    ... and ${result.errors.length - 3} more`);
          }
          results.errors.push(...result.errors);
        }
      } else {
        results.failedWeeks++;
        console.log(`  ✗ Failed: ${result.errors.join(', ')}`);
        results.errors.push(...result.errors);
      }

      // Rate limiting: wait 2 seconds between requests to respect API limits
      if (week < endWeek) {
        console.log('  ⏳ Waiting 2s before next request...');
        await sleep(2000);
      }
    } catch (error) {
      results.failedWeeks++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`  ✗ Error: ${errorMsg}`);
      results.errors.push(`Week ${week}: ${errorMsg}`);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('BACKFILL SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total weeks processed: ${results.totalWeeks}`);
  console.log(`  ✓ Successful: ${results.successfulWeeks}`);
  console.log(`  ✗ Failed: ${results.failedWeeks}`);
  console.log(`\nTotal players processed: ${results.totalPlayers}`);
  console.log(`Players with stats: ${results.playersWithStats}`);

  if (results.errors.length > 0) {
    console.log(`\n⚠ Total errors: ${results.errors.length}`);
    console.log('First few errors:');
    results.errors.slice(0, 5).forEach((err) => console.log(`  - ${err}`));
    if (results.errors.length > 5) {
      console.log(`  ... and ${results.errors.length - 5} more`);
    }
  }

  console.log('='.repeat(60));
  console.log('');

  // Exit code based on results
  if (results.failedWeeks > 0) {
    console.log('⚠ Some weeks failed. Check errors above.');
    process.exit(1);
  } else {
    console.log('✓ Backfill completed successfully!');
    process.exit(0);
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  let season = getCurrentSeason();
  let endWeek = getCurrentNFLWeek() - 1; // Don't include current week (may be in progress)

  // Parse arguments
  if (args.length >= 1) {
    const parsedSeason = parseInt(args[0], 10);
    if (isNaN(parsedSeason)) {
      console.error(`Error: Invalid season "${args[0]}". Must be a number (e.g., 2024).`);
      process.exit(1);
    }
    season = parsedSeason;
  }

  if (args.length >= 2) {
    const parsedWeek = parseInt(args[1], 10);
    if (isNaN(parsedWeek) || parsedWeek < 1 || parsedWeek > 18) {
      console.error(`Error: Invalid week "${args[1]}". Must be 1-18.`);
      process.exit(1);
    }
    endWeek = parsedWeek;
  }

  // Validate
  if (endWeek < 1) {
    console.log('ℹ Season has not started yet. Nothing to backfill.');
    process.exit(0);
  }

  // Run backfill
  try {
    await backfillStats(season, endWeek);
  } catch (error) {
    console.error('\n❌ Fatal error during backfill:');
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { backfillStats, getCurrentSeason, getCurrentNFLWeek };
