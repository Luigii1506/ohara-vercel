/**
 * Script de testing para el Event Scraper
 *
 * Uso:
 * npx ts-node scripts/test-event-scraper.ts
 */

import {
  scrapeEvents,
  ScrapeEventsOptions,
  EventListSource,
  LANGUAGE_EVENT_SOURCES,
} from '../lib/services/scraper/eventScraper';

async function main() {
  console.log('🧪 Testing Event Scraper...\n');
  console.log('=' .repeat(60));

  const args = process.argv.slice(2);
  const includeCurrent = !args.includes('--no-current');
  const includePast = args.includes('--past');
  const dryRun = args.includes('--dry-run');
  const customUrls = args.filter(arg => arg.startsWith('http'));

  const langFlag =
    args.find(arg => arg.startsWith('--lang=')) ||
    args.find(arg => arg.startsWith('--locale='));

  let languages = ['en'];
  if (langFlag) {
    const [, value = ''] = langFlag.split('=');
    const parsed = value
      .split(',')
      .map(lang => lang.trim().toLowerCase())
      .filter(Boolean);
    if (parsed.length > 0) {
      languages = parsed;
    }
  }

  const invalidLanguages = languages.filter(
    lang => !LANGUAGE_EVENT_SOURCES[lang]
  );
  if (invalidLanguages.length > 0) {
    console.error(
      '\n❌ Invalid language codes:',
      invalidLanguages.join(', ')
    );
    console.error(
      `   Supported languages: ${Object.keys(LANGUAGE_EVENT_SOURCES).join(', ')}`
    );
    process.exit(1);
  }

  const usingCustomLanguages =
    languages.length !== 1 || languages[0] !== 'en';

  const hasCustomSources =
    includePast ||
    customUrls.length > 0 ||
    !includeCurrent ||
    usingCustomLanguages;

  const scrapeOptions: ScrapeEventsOptions = {};

  if (hasCustomSources) {
    const sources: EventListSource[] = [];

    if (includeCurrent) {
    languages.forEach(lang => {
      const config = LANGUAGE_EVENT_SOURCES[lang];
      if (!config) return;

      if (config.requiresDynamicRendering) {
        console.warn(
          `\n⚠️  Language "${lang}" requires dynamic rendering. Results may be incomplete without a headless browser.`
        );
      }

      if (config.current) {
        sources.push(config.current);
      } else {
        console.warn(
          `\n⚠️  Language "${lang}" does not define a current events source.`
        );
      }

      if (config.notes) {
        console.warn(`   → ${config.notes}`);
      }
    });
  }

  if (includePast) {
    languages.forEach(lang => {
      const config = LANGUAGE_EVENT_SOURCES[lang];
      if (!config) return;

      if (config.past) {
        sources.push(config.past);
      } else {
        console.warn(
          `\n⚠️  Language "${lang}" does not have a dedicated past-events feed.`
        );
      }
    });
  }

    customUrls.forEach((url, index) => {
      sources.push({ url, label: `custom-${index + 1}` });
    });

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
