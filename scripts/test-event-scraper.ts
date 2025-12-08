/**
 * Script de testing para el Event Scraper
 *
 * Uso:
 * npx ts-node scripts/test-event-scraper.ts
 */

import {
  scrapeEvents,
  DEFAULT_EVENT_LIST_SOURCES,
  PAST_EVENT_LIST_SOURCE,
  ScrapeEventsOptions,
  EventListSource,
} from '../lib/services/scraper/eventScraper';

async function main() {
  console.log('🧪 Testing Event Scraper...\n');
  console.log('=' .repeat(60));

  const args = process.argv.slice(2);
  const includeCurrent = !args.includes('--no-current');
  const includePast = args.includes('--past');
  const dryRun = args.includes('--dry-run');
  const customUrls = args.filter(arg => arg.startsWith('http'));
  const hasCustomSources = includePast || customUrls.length > 0 || !includeCurrent;

  const sources: EventListSource[] = [];

  if (includeCurrent) {
    sources.push(...DEFAULT_EVENT_LIST_SOURCES);
  }

  if (includePast) {
    sources.push(PAST_EVENT_LIST_SOURCE);
  }

  customUrls.forEach((url, index) => {
    sources.push({ url, label: `custom-${index + 1}` });
  });

  const scrapeOptions: ScrapeEventsOptions = {};

  if (hasCustomSources) {
    if (sources.length === 0) {
      console.error('\n❌ No event sources selected.');
      console.error('   Use --no-current only when providing --past or explicit URLs.');
      process.exit(1);
    }

    scrapeOptions.sources = sources;

    console.log('\n🗂️  Using custom sources:');
    sources.forEach(source => {
      console.log(`   - ${source.label || source.url} (${source.type || 'custom'})`);
    });
  }

  if (dryRun) {
    console.log('\n🧪 Dry run enabled: no data will be written to the database.');
    scrapeOptions.dryRun = true;
  }

  try {
    const result = await scrapeEvents(scrapeOptions);

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
