/**
 * Script para actualizar URLs de imágenes en la base de datos
 * De: KeyCDN (oharatcg-21eab.kxcdn.com)
 * A: Cloudflare R2 (images.oharatcg.com o pub-xxxxx.r2.dev)
 *
 * Uso:
 *   npx ts-node scripts/update-db-urls.ts
 *   npx ts-node scripts/update-db-urls.ts --dry-run
 *   npx ts-node scripts/update-db-urls.ts --limit=100
 */

import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs/promises';

const prisma = new PrismaClient();

// Parse CLI arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;

// Configuration
const OLD_CDN_DOMAIN = 'oharatcg-21eab.kxcdn.com';
const NEW_R2_DOMAIN = process.env.R2_PUBLIC_URL || 'https://images.oharatcg.com';

interface UpdateStats {
  total: number;
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
  startTime: Date;
}

const stats: UpdateStats = {
  total: 0,
  processed: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
  startTime: new Date(),
};

const failedUpdates: Array<{ id: number; oldUrl: string; error: string }> = [];

/**
 * Main update function
 */
async function updateDatabaseUrls() {
  console.log('🚀 Starting database URL migration\n');
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN' : '✅ LIVE UPDATE'}`);
  console.log(`Old CDN: ${OLD_CDN_DOMAIN}`);
  console.log(`New R2: ${NEW_R2_DOMAIN}`);
  console.log(`Limit: ${limit || 'No limit'}\n`);

  // Get all cards with KeyCDN URLs
  const cardsToUpdate = await getCardsToUpdate();
  stats.total = limit ? Math.min(cardsToUpdate.length, limit) : cardsToUpdate.length;

  console.log(`📊 Found ${cardsToUpdate.length} cards with old URLs`);
  console.log(`📦 Will process ${stats.total} cards\n`);

  const cardsSlice = limit ? cardsToUpdate.slice(0, limit) : cardsToUpdate;

  // Update base cards
  for (const card of cardsSlice) {
    await updateCard(card.id, card.src);

    if (stats.processed % 10 === 0) {
      printProgress();
    }
  }

  // Get alternates with old URLs
  const alternatesToUpdate = await getAlternatesToUpdate();
  const alternatesTotal = limit ? Math.min(alternatesToUpdate.length, limit) : alternatesToUpdate.length;

  console.log(`\n📊 Found ${alternatesToUpdate.length} alternate cards with old URLs`);
  console.log(`📦 Will process ${alternatesTotal} alternates\n`);

  const alternatesSlice = limit ? alternatesToUpdate.slice(0, limit) : alternatesToUpdate;

  for (const alternate of alternatesSlice) {
    await updateAlternate(alternate.id, alternate.src);

    if (stats.processed % 10 === 0) {
      printProgress();
    }
  }

  // Final report
  printFinalReport();

  // Save failed updates
  if (failedUpdates.length > 0) {
    await saveFailedUpdates();
  }

  await prisma.$disconnect();
}

/**
 * Get base cards with old CDN URLs
 */
async function getCardsToUpdate() {
  return await prisma.card.findMany({
    where: {
      src: {
        contains: OLD_CDN_DOMAIN,
      },
    },
    select: {
      id: true,
      src: true,
      code: true,
    },
  });
}

/**
 * Get alternate cards with old CDN URLs
 */
async function getAlternatesToUpdate() {
  return await prisma.card.findMany({
    where: {
      src: {
        contains: OLD_CDN_DOMAIN,
      },
      baseCardId: {
        not: null,
      },
    },
    select: {
      id: true,
      src: true,
      code: true,
    },
  });
}

/**
 * Update a single card's URL
 */
async function updateCard(cardId: number, oldUrl: string | null): Promise<void> {
  stats.processed++;

  if (!oldUrl) {
    stats.skipped++;
    return;
  }

  try {
    const newUrl = convertUrl(oldUrl);

    if (newUrl === oldUrl) {
      console.log(`⏭️  [${stats.processed}] Card ${cardId}: Already migrated`);
      stats.skipped++;
      return;
    }

    console.log(`[${stats.processed}/${stats.total}] Card ${cardId}:`);
    console.log(`   Old: ${oldUrl}`);
    console.log(`   New: ${newUrl}`);

    if (!isDryRun) {
      await prisma.card.update({
        where: { id: cardId },
        data: { src: newUrl },
      });
      console.log(`   ✅ Updated`);
    } else {
      console.log(`   🔍 [DRY RUN] Would update`);
    }

    stats.updated++;

  } catch (error) {
    console.error(`   ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    stats.failed++;
    failedUpdates.push({
      id: cardId,
      oldUrl,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update a single alternate card's URL
 */
async function updateAlternate(alternateId: number, oldUrl: string | null): Promise<void> {
  stats.processed++;

  if (!oldUrl) {
    stats.skipped++;
    return;
  }

  try {
    const newUrl = convertUrl(oldUrl);

    if (newUrl === oldUrl) {
      stats.skipped++;
      return;
    }

    console.log(`[${stats.processed}] Alternate ${alternateId}:`);
    console.log(`   Old: ${oldUrl}`);
    console.log(`   New: ${newUrl}`);

    if (!isDryRun) {
      await prisma.card.update({
        where: { id: alternateId },
        data: { src: newUrl },
      });
      console.log(`   ✅ Updated`);
    } else {
      console.log(`   🔍 [DRY RUN] Would update`);
    }

    stats.updated++;

  } catch (error) {
    console.error(`   ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    stats.failed++;
    failedUpdates.push({
      id: alternateId,
      oldUrl,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Convert old KeyCDN URL to new R2 URL
 */
function convertUrl(oldUrl: string): string {
  try {
    // Parse old URL
    const urlObj = new URL(oldUrl);

    // If already an R2 URL, return as-is
    if (urlObj.hostname.includes('.r2.dev') || urlObj.hostname.includes('oharatcg.com')) {
      return oldUrl;
    }

    // Extract filename from path
    const pathname = urlObj.pathname;
    const filename = path.basename(pathname);

    // Remove query params
    const cleanFilename = filename.split('?')[0];

    // Build new R2 URL
    // Structure: https://images.oharatcg.com/cards/{filename}
    const newUrl = `${NEW_R2_DOMAIN}/cards/${cleanFilename}`;

    return newUrl;

  } catch (error) {
    console.warn(`Failed to parse URL: ${oldUrl}`);
    return oldUrl; // Return original if can't parse
  }
}

/**
 * Print progress update
 */
function printProgress() {
  const elapsed = (Date.now() - stats.startTime.getTime()) / 1000;
  const rate = stats.processed / elapsed;
  const remaining = stats.total - stats.processed;
  const eta = remaining / rate;

  console.log(`\n📊 Progress: ${stats.processed}/${stats.total} (${Math.round((stats.processed / stats.total) * 100)}%)`);
  console.log(`   ✅ Updated: ${stats.updated}`);
  console.log(`   ⏭️  Skipped: ${stats.skipped}`);
  console.log(`   ❌ Failed: ${stats.failed}`);
  console.log(`   ⏱️  ETA: ${Math.round(eta / 60)} minutes\n`);
}

/**
 * Print final report
 */
function printFinalReport() {
  const elapsed = (Date.now() - stats.startTime.getTime()) / 1000;

  console.log('\n' + '='.repeat(60));
  console.log('📊 DATABASE UPDATE COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total processed: ${stats.processed}`);
  console.log(`✅ Updated: ${stats.updated}`);
  console.log(`⏭️  Skipped: ${stats.skipped}`);
  console.log(`❌ Failed: ${stats.failed}`);
  console.log(`⏱️  Total time: ${Math.round(elapsed / 60)} minutes`);
  console.log('='.repeat(60) + '\n');

  if (stats.failed > 0) {
    console.log(`⚠️  ${stats.failed} updates failed. Check update-db-failed.json for details.\n`);
  }

  if (isDryRun) {
    console.log('🔍 This was a DRY RUN. No actual database changes were made.');
    console.log('   Run without --dry-run to perform the actual update.\n');
  } else {
    console.log('✅ Database URLs have been updated successfully!');
    console.log('   Next steps:');
    console.log('   1. Test a few URLs to verify they work');
    console.log('   2. Clear any CDN/browser caches');
    console.log('   3. Monitor for 24-48 hours');
    console.log('   4. Deactivate old KeyCDN account\n');
  }
}

/**
 * Save failed updates to JSON file
 */
async function saveFailedUpdates() {
  const filename = 'update-db-failed.json';
  await fs.writeFile(
    filename,
    JSON.stringify(failedUpdates, null, 2),
    'utf-8'
  );
  console.log(`💾 Failed updates saved to: ${filename}\n`);
}

// Run update
updateDatabaseUrls().catch((error) => {
  console.error('💥 Database update failed:', error);
  process.exit(1);
});
