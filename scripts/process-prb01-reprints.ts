#!/usr/bin/env ts-node

/**
 * Process PRB01 Reprint cards:
 * 1. Scrape all PRB01 reprint listings from TCGplayer.
 * 2. For each card, find DB entries with code match + setCode containing PRB01.
 * 3. Only process cards whose alternateArt is null/empty; update image + alternateArt="Reprint".
 */

import { PrismaClient } from "@prisma/client";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { scrapeReprintCards } = require("../bin/tcgplayer-reprint-prb01.js");

interface ScrapedCard {
  code: string;
  title: string;
  image: string;
}

interface ProcessStats {
  totalScraped: number;
  processed: number;
  updated: number;
  skippedNotFound: number;
  skippedHasAlternate: number;
  skippedNoImage: number;
  failed: number;
}

const IMAGE_SIZES = {
  tiny: { width: 20, height: 28, quality: 40, suffix: "-tiny" },
  xs: { width: 100, height: 140, quality: 60, suffix: "-xs" },
  thumb: { width: 200, height: 280, quality: 70, suffix: "-thumb" },
  small: { width: 300, height: 420, quality: 75, suffix: "-small" },
  medium: { width: 600, height: 840, quality: 80, suffix: "-medium" },
  large: { width: 800, height: 1120, quality: 85, suffix: "-large" },
  original: { width: null, height: null, quality: 90, suffix: "" },
} as const;

const REQUIRED_ENV = [
  "DATABASE_URL",
  "CLOUDFLARE_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
] as const;

function ensureEnvVars() {
  const missing = REQUIRED_ENV.filter(
    (key) => !process.env[key] || process.env[key]?.trim() === ""
  );
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

ensureEnvVars();

const prisma = new PrismaClient();

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;

function sanitizeCodeForFilename(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildImageKey(code: string): string {
  const safeCode = sanitizeCodeForFilename(code) || "PRB01-CARD";
  const timestamp = Date.now().toString(36);
  return `${safeCode}-${timestamp}`;
}

async function downloadImage(url: string): Promise<Buffer> {
  console.log(`[download] Fetching image: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image (${response.statusText})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  console.log(
    `[download] Completed (${Math.round(buffer.length / 1024)}KB downloaded)`
  );
  return buffer;
}

async function uploadImageVariants(filename: string, buffer: Buffer) {
  console.log(`[upload] Uploading image variants for ${filename}`);

  for (const [sizeName, config] of Object.entries(IMAGE_SIZES)) {
    const r2Key = `cards/${filename}${config.suffix}.webp`;
    let transformer = sharp(buffer);

    if (config.width || config.height) {
      transformer = transformer.resize({
        width: config.width || undefined,
        height: config.height || undefined,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
    }

    const transformed = await transformer
      .webp({ quality: config.quality, effort: 6 })
      .toBuffer();

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: r2Key,
      Body: transformed,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    });

    await s3Client.send(command);
    console.log(
      `  [upload:${sizeName}] ${r2Key} (${Math.round(
        transformed.length / 1024
      )}KB)`
    );
  }

  console.log(
    `[upload] All variants uploaded for ${filename}. Public URL ready.`
  );
  return `${R2_PUBLIC_URL}/cards/${filename}.webp`;
}

function hasAlternateArtValue(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  return value.trim().length > 0;
}

async function processCard(
  scrapedCard: ScrapedCard,
  index: number,
  total: number,
  stats: ProcessStats
) {
  console.log(
    `\n===== [${index}/${total}] Processing ${scrapedCard.code} =====`
  );
  stats.processed += 1;

  const existingCard = await prisma.card.findFirst({
    where: {
      code: scrapedCard.code,
      setCode: {
        contains: "PRB01",
        mode: "insensitive",
      },
      OR: [
        { alternateArt: null },
        { alternateArt: "" },
      ],
    },
  });

  if (!existingCard) {
    console.log(
      `[skip][not-found] No card in DB with code ${scrapedCard.code} + setCode PRB01 + alternateArt null`
    );
    stats.skippedNotFound += 1;
    return;
  }

  if (hasAlternateArtValue(existingCard.alternateArt)) {
    console.log(
      `[skip][has-alternate] ${existingCard.code} already has alternateArt="${existingCard.alternateArt}"`
    );
    stats.skippedHasAlternate += 1;
    return;
  }

  if (!scrapedCard.image) {
    console.log(
      `[skip][no-image] ${scrapedCard.code} has no image URL from scraper`
    );
    stats.skippedNoImage += 1;
    return;
  }

  const imageBuffer = await downloadImage(scrapedCard.image);
  const filename = buildImageKey(existingCard.code);
  const publicUrl = await uploadImageVariants(filename, imageBuffer);

  console.log(
    `[update] Updating card ${existingCard.id} (${existingCard.code})`
  );
  await prisma.card.update({
    where: { id: existingCard.id },
    data: {
      src: publicUrl,
      imageKey: filename,
      alternateArt: "Reprint",
    },
  });

  stats.updated += 1;
  console.log(
    `[update] Card ${existingCard.code} updated with new R2 image + alternateArt=Reprint`
  );
}

async function main() {
  console.log("🚀 Starting PRB01 reprint processor...\n");
  const scrapedCards: ScrapedCard[] = await scrapeReprintCards();

  const stats: ProcessStats = {
    totalScraped: scrapedCards.length,
    processed: 0,
    updated: 0,
    skippedNotFound: 0,
    skippedHasAlternate: 0,
    skippedNoImage: 0,
    failed: 0,
  };

  console.log(`📄 Total scraped cards: ${stats.totalScraped}`);

  let index = 1;
  for (const card of scrapedCards) {
    try {
      await processCard(card, index, stats.totalScraped, stats);
    } catch (error) {
      stats.failed += 1;
      console.error(
        `[error] Failed processing ${card.code}:`,
        error instanceof Error ? error.stack : error
      );
    } finally {
      index += 1;
    }
  }

  console.log("\n========== Summary ==========");
  console.log(`Total scraped: ${stats.totalScraped}`);
  console.log(`Processed: ${stats.processed}`);
  console.log(`Updated: ${stats.updated}`);
  console.log(`Skipped (not found): ${stats.skippedNotFound}`);
  console.log(`Skipped (has alternate): ${stats.skippedHasAlternate}`);
  console.log(`Skipped (no image): ${stats.skippedNoImage}`);
  console.log(`Failed: ${stats.failed}`);
  console.log("================================\n");
}

main()
  .catch((error) => {
    console.error("Fatal error processing PRB01 reprints:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
