/**
 * Script para convertir URLs de .png a .webp en la base de datos
 * Solo actualiza URLs que apuntan a R2 (workers.dev)
 *
 * Uso:
 *   npx ts-node scripts/convert-png-to-webp-urls.ts --dry-run
 *   npx ts-node scripts/convert-png-to-webp-urls.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Parse CLI arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

async function convertUrls() {
  console.log('🚀 Converting R2 URLs from .png to .webp\n');
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN' : '✅ LIVE UPDATE'}\n`);

  // Find all cards with R2 URLs that end in .png
  const cardsToUpdate = await prisma.card.findMany({
    where: {
      AND: [
        { src: { contains: 'workers.dev' }},
        { src: { endsWith: '.png' }}
      ]
    },
    select: {
      id: true,
      code: true,
      src: true
    }
  });

  console.log(`📊 Found ${cardsToUpdate.length} cards with .png URLs to convert\n`);

  let updated = 0;
  let failed = 0;

  for (const card of cardsToUpdate) {
    try {
      const newUrl = card.src!.replace(/\.png$/, '.webp');

      console.log(`[${updated + 1}/${cardsToUpdate.length}] ${card.code}`);
      console.log(`   Old: ${card.src}`);
      console.log(`   New: ${newUrl}`);

      if (!isDryRun) {
        await prisma.card.update({
          where: { id: card.id },
          data: { src: newUrl }
        });
        console.log(`   ✅ Updated\n`);
      } else {
        console.log(`   🔍 [DRY RUN] Would update\n`);
      }

      updated++;

    } catch (error) {
      console.error(`   ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 CONVERSION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total found: ${cardsToUpdate.length}`);
  console.log(`✅ ${isDryRun ? 'Would update' : 'Updated'}: ${updated}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(60) + '\n');

  if (isDryRun) {
    console.log('🔍 This was a DRY RUN. No actual database changes were made.');
    console.log('   Run without --dry-run to perform the actual update.\n');
  } else {
    console.log('✅ URLs have been converted successfully!');
    console.log('   All R2 URLs now use .webp extension.\n');
  }

  await prisma.$disconnect();
}

convertUrls().catch((error) => {
  console.error('💥 Conversion failed:', error);
  process.exit(1);
});
