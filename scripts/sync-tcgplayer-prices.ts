import { syncTcgplayerPrices } from "../lib/services/tcgplayerPriceSync";

async function main() {
  console.log("🔄 Starting TCGplayer price sync...\n");

  const watchlistOnly = process.argv.includes("--watchlist");

  if (watchlistOnly) {
    console.log("📋 Syncing watchlisted cards only\n");
  } else {
    console.log("📋 Syncing all cards with TCGplayer product IDs\n");
  }

  try {
    const started = Date.now();
    const result = await syncTcgplayerPrices({
      onlyWatchlisted: watchlistOnly,
    });
    const duration = ((Date.now() - started) / 1000).toFixed(2);

    console.log("\n✅ Price sync completed successfully!");
    console.log("\n📊 Results:");
    console.log(`   - Cards processed: ${result.cardsProcessed}`);
    console.log(`   - Cards updated: ${result.cardsUpdated}`);
    console.log(`   - Price logs created: ${result.logsCreated}`);
    console.log(`   - Alerts triggered: ${result.alertsTriggered || 0}`);
    console.log(`   - Duration: ${duration}s\n`);

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Price sync failed:", error);
    process.exit(1);
  }
}

main();
