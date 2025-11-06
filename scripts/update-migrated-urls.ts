/**
 * Script para actualizar URLs de imágenes después de la migración a R2
 * Convierte URLs de dominios externos a URLs de R2
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

const NEW_R2_DOMAIN = process.env.R2_PUBLIC_URL || 'https://ohara-image-worker.luis-encinas1506.workers.dev';

// Dominios que debemos reemplazar
const EXTERNAL_DOMAINS = [
  'limitlesstcg.nyc3.digitaloceanspaces.com',
  'limitlesstcg.nyc3.cdn.digitaloceanspaces.com',
  'en.onepiece-cardgame.com',
  'tcgplayer-cdn.tcgplayer.com',
  'bez3ta.com',
  'www.cardtrader.com',
  'oharatcg-21eab.kxcdn.com',
];

interface Stats {
  total: number;
  updated: number;
  skipped: number;
  failed: number;
}

const stats: Stats = {
  total: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
};

async function updateMigratedUrls() {
  console.log('🚀 Actualizando URLs de imágenes migradas\n');
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN' : '✅ LIVE UPDATE'}\n`);

  // Buscar todas las cards con URLs de dominios externos
  const cards = await prisma.card.findMany({
    select: {
      id: true,
      code: true,
      src: true,
    },
  });

  console.log(`📊 Analizando ${cards.length} cartas...\n`);

  for (const card of cards) {
    if (!card.src) continue;

    // Verificar si la URL es de un dominio externo
    const needsUpdate = EXTERNAL_DOMAINS.some(domain => card.src!.includes(domain));

    if (!needsUpdate) {
      stats.skipped++;
      continue;
    }

    try {
      const newUrl = convertToR2Url(card.src);
      stats.total++;

      console.log(`[${stats.total}] ${card.code}`);
      console.log(`   Old: ${card.src}`);
      console.log(`   New: ${newUrl}`);

      if (!isDryRun) {
        await prisma.card.update({
          where: { id: card.id },
          data: { src: newUrl },
        });
        console.log(`   ✅ Updated\n`);
      } else {
        console.log(`   🔍 [DRY RUN] Would update\n`);
      }

      stats.updated++;

    } catch (error) {
      console.error(`   ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
      stats.failed++;
    }
  }

  printSummary();
  await prisma.$disconnect();
}

function convertToR2Url(oldUrl: string): string {
  try {
    const urlObj = new URL(oldUrl);
    const pathname = urlObj.pathname;

    // Extraer el nombre del archivo
    const filename = pathname.split('/').pop() || '';

    // Limpiar el nombre del archivo (quitar query params)
    const cleanFilename = filename.split('?')[0];

    // Construir nueva URL de R2
    // Estructura: https://ohara-image-worker.luis-encinas1506.workers.dev/cards/{filename}
    return `${NEW_R2_DOMAIN}/cards/${cleanFilename}`;

  } catch (error) {
    console.warn(`Failed to parse URL: ${oldUrl}`);
    return oldUrl;
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 ACTUALIZACIÓN COMPLETA');
  console.log('='.repeat(60));
  console.log(`Total procesadas: ${stats.total}`);
  console.log(`✅ Actualizadas: ${stats.updated}`);
  console.log(`⏭️  Saltadas (ya en R2): ${stats.skipped}`);
  console.log(`❌ Fallidas: ${stats.failed}`);
  console.log('='.repeat(60) + '\n');

  if (isDryRun) {
    console.log('🔍 Este fue un DRY RUN. No se hicieron cambios reales.');
    console.log('   Ejecuta sin --dry-run para actualizar la base de datos.\n');
  } else {
    console.log('✅ URLs actualizadas exitosamente!');
    console.log('   Las imágenes ahora se sirven desde Cloudflare R2.\n');
  }
}

updateMigratedUrls().catch((error) => {
  console.error('💥 Error:', error);
  process.exit(1);
});
