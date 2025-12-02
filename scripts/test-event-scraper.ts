/**
 * Script de testing para el Event Scraper
 *
 * Uso:
 * npx ts-node scripts/test-event-scraper.ts
 */

import { scrapeEvents } from '@/lib/services/scraper/eventScraper';

async function main() {
  console.log('🧪 Testing Event Scraper...\n');
  console.log('=' .repeat(60));

  try {
    const result = await scrapeEvents();

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTS:\n');
    console.log(JSON.stringify(result, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed successfully!');

    if (result.errors.length > 0) {
      console.log('\n⚠️  Warnings:');
      result.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
