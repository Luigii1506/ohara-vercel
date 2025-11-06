/**
 * Script de migración de imágenes de KeyCDN a Cloudflare R2
 *
 * Funcionalidad:
 * 1. Lee todas las URLs de imágenes de la base de datos
 * 2. Descarga cada imagen desde KeyCDN
 * 3. Genera múltiples tamaños optimizados (tiny, xs, thumb, small, medium, large, original)
 * 4. Sube cada variante a R2 con la estructura correcta
 * 5. Mantiene log de progreso y errores
 *
 * Uso:
 *   npx ts-node scripts/migrate-to-r2.ts
 *   npx ts-node scripts/migrate-to-r2.ts --dry-run  # Solo simular
 *   npx ts-node scripts/migrate-to-r2.ts --limit 100 # Migrar solo 100 imágenes
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs/promises';

const prisma = new PrismaClient();

// Configuración
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'ohara-cards-images';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

// Parse CLI arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;

// Image size configurations (matching imageOptimization.ts)
const IMAGE_SIZES = {
  tiny: { width: 20, height: 28, quality: 40, suffix: '-tiny' },
  xs: { width: 100, height: 140, quality: 60, suffix: '-xs' },
  thumb: { width: 200, height: 280, quality: 70, suffix: '-thumb' },
  small: { width: 300, height: 420, quality: 75, suffix: '-small' },
  medium: { width: 600, height: 840, quality: 80, suffix: '-medium' },
  large: { width: 800, height: 1120, quality: 85, suffix: '-large' },
  original: { width: null, height: null, quality: 90, suffix: '' },
} as const;

// Initialize S3 client for R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

interface MigrationStats {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  startTime: Date;
}

const stats: MigrationStats = {
  total: 0,
  processed: 0,
  succeeded: 0,
  failed: 0,
  skipped: 0,
  startTime: new Date(),
};

const failedUrls: Array<{ url: string; error: string }> = [];

/**
 * Main migration function
 */
async function migrateImages() {
  console.log('🚀 Starting image migration to Cloudflare R2\n');
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (no actual upload)' : '✅ LIVE MIGRATION'}`);
  console.log(`Limit: ${limit || 'No limit (all images)'}\n`);

  if (!CLOUDFLARE_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error('❌ Missing R2 credentials. Please check your .env.local file.');
    process.exit(1);
  }

  // Get all unique image URLs from database
  const uniqueUrls = await getUniqueImageUrls();
  stats.total = limit ? Math.min(uniqueUrls.length, limit) : uniqueUrls.length;

  console.log(`📊 Found ${uniqueUrls.length} unique images in database`);
  console.log(`📦 Will process ${stats.total} images\n`);

  // Process each URL
  const urlsToProcess = limit ? uniqueUrls.slice(0, limit) : uniqueUrls;

  for (const url of urlsToProcess) {
    await processImage(url);

    // Progress update every 10 images
    if (stats.processed % 10 === 0) {
      printProgress();
    }
  }

  // Final report
  printFinalReport();

  // Save failed URLs to file
  if (failedUrls.length > 0) {
    await saveFailedUrls();
  }

  await prisma.$disconnect();
}

/**
 * Get all unique image URLs from database that need migration
 */
async function getUniqueImageUrls(): Promise<string[]> {
  const cards = await prisma.card.findMany({
    select: {
      src: true,
    },
  });

  const urls = new Set<string>();

  for (const card of cards) {
    if (
      card.src &&
      card.src.trim() !== '' &&
      !card.src.includes('example.com/missing') &&
      !card.src.includes('null')
    ) {
      // Skip URLs already in R2
      if (
        card.src.includes('.workers.dev') ||
        card.src.includes('.r2.dev') ||
        card.src.includes('images.oharatcg.com')
      ) {
        continue;
      }

      urls.add(card.src);
    }
  }

  return Array.from(urls);
}

/**
 * Process a single image URL
 */
async function processImage(url: string): Promise<void> {
  stats.processed++;

  try {
    // Extract filename from URL
    const filename = extractFilename(url);
    if (!filename) {
      console.log(`⚠️  Skipping invalid URL: ${url}`);
      stats.skipped++;
      return;
    }

    console.log(`[${stats.processed}/${stats.total}] Processing: ${filename}`);

    // Check if already exists in R2 (skip if exists)
    if (!isDryRun) {
      const exists = await checkIfExistsInR2(filename);
      if (exists) {
        console.log(`   ⏭️  Already exists in R2, skipping`);
        stats.skipped++;
        return;
      }
    }

    // Download original image
    const imageBuffer = await downloadImage(url);
    if (!imageBuffer) {
      throw new Error('Failed to download image');
    }

    console.log(`   ⬇️  Downloaded (${Math.round(imageBuffer.length / 1024)}KB)`);

    // Generate and upload all size variants
    for (const [sizeName, config] of Object.entries(IMAGE_SIZES)) {
      const r2Key = generateR2Key(filename, config.suffix);

      if (isDryRun) {
        console.log(`   🔍 [DRY RUN] Would upload: ${r2Key}`);
        continue;
      }

      // Transform image
      const transformedBuffer = await transformImage(imageBuffer, config);

      // Upload to R2
      await uploadToR2(r2Key, transformedBuffer);

      console.log(`   ✅ Uploaded ${sizeName}: ${r2Key} (${Math.round(transformedBuffer.length / 1024)}KB)`);
    }

    stats.succeeded++;

  } catch (error) {
    console.error(`   ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    stats.failed++;
    failedUrls.push({
      url,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Extract clean filename from URL
 */
function extractFilename(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = path.basename(pathname);

    // Remove query params and clean up
    return filename.split('?')[0];
  } catch {
    return null;
  }
}

/**
 * Generate R2 key for file
 * Structure: cards/{filename}-{size}.{ext}
 */
function generateR2Key(filename: string, suffix: string): string {
  const ext = path.extname(filename);
  const basename = path.basename(filename, ext);

  // Convert to WebP for better compression (except GIFs)
  const outputExt = ext.toLowerCase() === '.gif' ? ext : '.webp';

  return `cards/${basename}${suffix}${outputExt}`;
}

/**
 * Check if file already exists in R2
 */
async function checkIfExistsInR2(filename: string): Promise<boolean> {
  try {
    const key = generateR2Key(filename, ''); // Check original size
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    return true; // File exists
  } catch {
    return false; // File doesn't exist
  }
}

/**
 * Download image from URL
 */
async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`Failed to download ${url}:`, error);
    return null;
  }
}

/**
 * Transform image using Sharp
 */
async function transformImage(
  buffer: Buffer,
  config: { width: number | null; height: number | null; quality: number }
): Promise<Buffer> {
  let transformer = sharp(buffer);

  // Resize if dimensions specified
  if (config.width || config.height) {
    transformer = transformer.resize({
      width: config.width || undefined,
      height: config.height || undefined,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  // Convert to WebP with quality settings
  return await transformer
    .webp({
      quality: config.quality,
      effort: 6, // Higher effort = better compression
    })
    .toBuffer();
}

/**
 * Upload buffer to R2
 */
async function uploadToR2(key: string, buffer: Buffer): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  });

  await s3Client.send(command);
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
  console.log(`   ✅ Succeeded: ${stats.succeeded}`);
  console.log(`   ❌ Failed: ${stats.failed}`);
  console.log(`   ⏭️  Skipped: ${stats.skipped}`);
  console.log(`   ⏱️  ETA: ${Math.round(eta / 60)} minutes\n`);
}

/**
 * Print final migration report
 */
function printFinalReport() {
  const elapsed = (Date.now() - stats.startTime.getTime()) / 1000;

  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total processed: ${stats.processed}`);
  console.log(`✅ Succeeded: ${stats.succeeded}`);
  console.log(`❌ Failed: ${stats.failed}`);
  console.log(`⏭️  Skipped: ${stats.skipped}`);
  console.log(`⏱️  Total time: ${Math.round(elapsed / 60)} minutes`);
  console.log(`📈 Average rate: ${Math.round((stats.processed / elapsed) * 60)} images/minute`);
  console.log('='.repeat(60) + '\n');

  if (stats.failed > 0) {
    console.log(`⚠️  ${stats.failed} images failed. Check migration-failed.json for details.\n`);
  }

  if (isDryRun) {
    console.log('🔍 This was a DRY RUN. No actual uploads were performed.');
    console.log('   Run without --dry-run to perform the actual migration.\n');
  }
}

/**
 * Save failed URLs to JSON file
 */
async function saveFailedUrls() {
  const filename = 'migration-failed.json';
  await fs.writeFile(
    filename,
    JSON.stringify(failedUrls, null, 2),
    'utf-8'
  );
  console.log(`💾 Failed URLs saved to: ${filename}\n`);
}

// Run migration
migrateImages().catch((error) => {
  console.error('💥 Migration failed:', error);
  process.exit(1);
});
