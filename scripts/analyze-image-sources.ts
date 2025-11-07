/**
 * Script para analizar los dominios de origen de las imágenes
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeImageSources() {
  console.log('🔍 Analizando orígenes de imágenes...\n');

  const cards = await prisma.card.findMany({
    select: { src: true }
  });

  const domainCounts: Record<string, number> = {};
  let totalImages = 0;
  let invalidUrls = 0;

  for (const card of cards) {
    if (!card.src || card.src.includes('example.com/missing')) {
      continue;
    }

    totalImages++;

    try {
      const url = new URL(card.src);
      const domain = url.hostname;
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    } catch (error) {
      invalidUrls++;
    }
  }

  // Sort by count descending
  const sorted = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);

  console.log('📊 Distribución por dominio:\n');
  console.log('Domain'.padEnd(50) + 'Count'.padStart(10));
  console.log('='.repeat(60));

  for (const [domain, count] of sorted) {
    const percentage = ((count / totalImages) * 100).toFixed(1);
    console.log(
      domain.padEnd(50) +
      count.toString().padStart(6) +
      ` (${percentage}%)`
    );
  }

  console.log('='.repeat(60));
  console.log(`Total images: ${totalImages}`);
  console.log(`Invalid URLs: ${invalidUrls}`);
  console.log(`Already in R2: ${domainCounts['ohara-image-worker.luis-encinas1506.workers.dev'] || 0}`);
  console.log(`Need migration: ${totalImages - (domainCounts['ohara-image-worker.luis-encinas1506.workers.dev'] || 0)}`);

  await prisma.$disconnect();
}

analyzeImageSources().catch(console.error);
