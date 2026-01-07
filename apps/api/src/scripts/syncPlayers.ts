import { playerSyncService } from '../services/playerSync';

/**
 * Sync all NFL players from Sleeper API
 * Run this before backfilling stats to ensure player records exist
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Syncing NFL Players from Sleeper API');
  console.log('='.repeat(60));
  console.log('');

  try {
    const result = await playerSyncService.syncAllPlayers();

    console.log('');
    console.log('='.repeat(60));
    console.log('SYNC COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total players processed: ${result.total}`);
    console.log(`  ✓ Created: ${result.created}`);
    console.log(`  ✓ Updated: ${result.updated}`);
    console.log(`  ⊘ Skipped: ${result.skipped}`);
    console.log(`  ✗ Errors: ${result.errors}`);
    console.log('='.repeat(60));
    console.log('');

    process.exit(result.errors > 0 ? 1 : 0);
  } catch (error) {
    console.error('');
    console.error('❌ Fatal error during player sync:');
    console.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main };
