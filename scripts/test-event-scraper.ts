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
  RenderMode,
} from "../lib/services/scraper/eventScraper";
import type { TranslationConfig } from "../lib/services/scraper/translation";

function readNumericFlag(
  args: string[],
  flag: string
): number | undefined {
  const withEquals = args.find((arg) => arg.startsWith(`${flag}=`));
  if (withEquals) {
    const [, value] = withEquals.split("=");
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  const index = args.indexOf(flag);
  if (index >= 0 && args[index + 1]) {
    const maybeValue = Number(args[index + 1]);
    return Number.isFinite(maybeValue) ? maybeValue : undefined;
  }

  return undefined;
}

async function main() {
  console.log('🧪 Testing Event Scraper...\n');
  console.log('=' .repeat(60));

  const args = process.argv.slice(2);
  const includeCurrent = !args.includes('--no-current');
  const includePast = args.includes('--past');
  const dryRun = args.includes('--dry-run');
  const customUrls = args.filter(arg => arg.startsWith('http'));

  const renderArg = args.find(arg => arg.startsWith('--render'));
  let renderMode: RenderMode = 'static';
  if (renderArg) {
    const [, provided = 'auto'] = renderArg.split('=');
    const normalized = provided.toLowerCase();
    if (['force', 'always'].includes(normalized)) {
      renderMode = 'force';
    } else if (['off', 'static', 'none'].includes(normalized)) {
      renderMode = 'static';
    } else {
      renderMode = 'auto';
    }
  }

  const translateEnabled =
    args.includes('--translate') || args.includes('--translations');
  const translateCacheArg = args.find(arg =>
    arg.startsWith('--translate-cache=')
  );
  const translateModelArg = args.find(arg =>
    arg.startsWith('--translate-model=')
  );
  const translateReset =
    args.includes('--translate-reset') ||
    args.includes('--translate-cache-reset');

  let translationConfig: TranslationConfig | undefined;
  if (translateEnabled) {
    const cachePath = translateCacheArg?.split('=')[1]?.trim();
    const model = translateModelArg?.split('=')[1]?.trim();
    translationConfig = {
      enabled: true,
      cachePath: cachePath || undefined,
      resetCache: translateReset,
      model: model || undefined,
    };
  }

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

  scrapeOptions.renderMode = renderMode;

  if (translationConfig) {
    scrapeOptions.translation = translationConfig;
  }

  if (renderMode !== 'static') {
    const renderLabel =
      renderMode === 'force'
        ? 'forced for all requests'
        : 'auto (only flagged hosts)';
    console.log(`\n🖥️  Headless rendering enabled: ${renderLabel}`);
  }

  if (translationConfig) {
    console.log('\n🌐 Translation pipeline enabled.');
    if (translationConfig.cachePath) {
      console.log(`   Cache: ${translationConfig.cachePath}`);
    }
    if (translationConfig.resetCache) {
      console.log('   Cache reset requested.');
    }
    if (!process.env.GOOGLE_GENAI_API_KEY) {
      console.warn(
        '   ⚠️  GOOGLE_GENAI_API_KEY is not set. Translation will be disabled.'
      );
    }
  }

  const maxEventsValue = readNumericFlag(args, "--max-events");
  if (typeof maxEventsValue === "number") {
    if (maxEventsValue > 0) {
      scrapeOptions.maxEvents = Math.floor(maxEventsValue);
      console.log(
        `\n🎯 Limiting total events to ${scrapeOptions.maxEvents}`
      );
    } else {
      console.warn(
        `⚠️  Ignoring --max-events value "${maxEventsValue}" (must be > 0)`
      );
    }
  }

  const perSourceValue = readNumericFlag(args, "--per-source-limit");
  if (typeof perSourceValue === "number") {
    if (perSourceValue > 0) {
      scrapeOptions.perSourceLimit = Math.floor(perSourceValue);
      console.log(
        `   Per-source limit set to ${scrapeOptions.perSourceLimit}`
      );
    } else {
      console.warn(
        `⚠️  Ignoring --per-source-limit value "${perSourceValue}" (must be > 0)`
      );
    }
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

    if (result.translation) {
      const stats = result.translation;
      console.log('\n🗣️  Translation stats:');
      console.log(
        `   Enabled: ${stats.enabled ? 'yes' : 'no'}${
          stats.disabledReason ? ` (${stats.disabledReason})` : ''
        }`
      );
      if (stats.cachePath) {
        console.log(`   Cache: ${stats.cachePath}`);
      }
      console.log(
        `   Cache entries: ${stats.cacheEntries} | hits: ${stats.cacheHits} | misses: ${stats.cacheMisses}`
      );
      console.log(
        `   API calls: ${stats.apiCalls} | skipped: ${stats.skipped} | errors: ${stats.errors}`
      );
    }

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
