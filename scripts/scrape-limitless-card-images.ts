#!/usr/bin/env -S ts-node --project tsconfig.scripts.json

import "dotenv/config";
import crypto from "node:crypto";
import path from "node:path";
import axios from "axios";
import * as cheerio from "cheerio";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

type ScriptOptions = {
  url: string;
  setCode: string;
  dryRun: boolean;
  limit: number | null;
  sleepMs: number;
};

type ScrapedImage = {
  code: string;
  url: string;
  variantIndex: number;
  filename: string;
};

const REQUIRED_ENV = [
  "DATABASE_URL",
  "CLOUDFLARE_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
] as const;

const IMAGE_SIZES = {
  tiny: { width: 20, height: 28, quality: 40, suffix: "-tiny" },
  xs: { width: 100, height: 140, quality: 60, suffix: "-xs" },
  thumb: { width: 200, height: 280, quality: 70, suffix: "-thumb" },
  small: { width: 300, height: 420, quality: 75, suffix: "-small" },
  medium: { width: 600, height: 840, quality: 80, suffix: "-medium" },
  large: { width: 800, height: 1120, quality: 85, suffix: "-large" },
  original: { width: null, height: null, quality: 90, suffix: "" },
} as const;

const prisma = new PrismaClient();

const ensureEnvVars = () => {
  const missing = REQUIRED_ENV.filter(
    (key) => !process.env[key] || process.env[key]!.trim().length === 0
  );
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};

const createS3Client = () =>
  new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

const sanitizeImageKey = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const resolveUniqueImageKey = async (
  s3Client: S3Client,
  bucketName: string,
  baseKey: string
) => {
  const exists = async (key: string) => {
    try {
      await s3Client.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: `cards/${key}.webp`,
        })
      );
      return true;
    } catch (error: any) {
      const status = error?.$metadata?.httpStatusCode;
      if (status === 404) return false;
      return false;
    }
  };

  if (!(await exists(baseKey))) return baseKey;

  for (let i = 1; i <= 10; i += 1) {
    const candidate = `${baseKey}-v${i}`;
    if (!(await exists(candidate))) return candidate;
  }

  return `${baseKey}-v${Date.now().toString(36)}`;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const downloadImage = async (url: string) => {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
    timeout: 30000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });
  return Buffer.from(response.data);
};

const downloadImageWithRetry = async (url: string, retries = 3) => {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await downloadImage(url);
    } catch (error: any) {
      lastError = error;
      const status = error?.response?.status;
      if (attempt === retries || (status && status < 500 && status !== 429)) {
        throw error;
      }
      await sleep(500 * attempt);
    }
  }
  throw lastError;
};

const uploadImageVariants = async (
  s3Client: S3Client,
  filename: string,
  buffer: Buffer,
  bucketName: string,
  publicUrl: string
) => {
  for (const config of Object.values(IMAGE_SIZES)) {
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

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: r2Key,
        Body: transformed,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
  }

  return `${publicUrl}/cards/${filename}.webp`;
};

const parseArgs = (): ScriptOptions => {
  const args = process.argv.slice(2);
  const getArg = (key: string) =>
    args.find((arg) => arg.startsWith(`${key}=`))?.split("=")[1];

  const url = getArg("--url");
  if (!url) {
    throw new Error("Missing required argument: --url");
  }

  const setCode = (getArg("--set") ?? "OP14").toUpperCase();
  const dryRun = args.includes("--dry-run");
  const limitRaw = getArg("--limit");
  const sleepMs = Number(getArg("--sleepMs") ?? 200);
  const limit =
    typeof limitRaw === "string" && limitRaw.trim().length > 0
      ? Number(limitRaw)
      : null;

  return {
    url,
    setCode,
    dryRun,
    limit: Number.isFinite(limit) ? limit : null,
    sleepMs: Number.isFinite(sleepMs) ? sleepMs : 200,
  };
};

const extractCodeFromFilename = (filename: string) => {
  const base = filename.replace(/\.[^.]+$/, "");
  const parts = base.split("_");
  const code = parts[0]?.toUpperCase() ?? "";
  let variantIndex = 0;
  if (parts.length > 1 && /^p\d+$/i.test(parts[1])) {
    variantIndex = Number(parts[1].slice(1)) || 0;
  }
  return { code, variantIndex };
};

const scrapeLimitlessImages = async (
  url: string,
  setCode: string
): Promise<ScrapedImage[]> => {
  console.log(`[limitless-images] Fetching HTML (${setCode})`);
  const response = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    timeout: 30000,
  });
  const $ = cheerio.load(response.data);
  const images: ScrapedImage[] = [];
  $("img.card").each((_, element) => {
    const src = $(element).attr("data-src") || $(element).attr("src");
    if (!src) return;
    const filename = path.basename(src.split("?")[0]);
    const { code, variantIndex } = extractCodeFromFilename(filename);
    if (!code || !code.startsWith(setCode)) return;
    images.push({ code, url: src, variantIndex, filename });
  });
  console.log(`[limitless-images] Found ${images.length} images`);
  return images;
};

const buildUploadKeyBase = (code: string, variantTag: string, url: string) => {
  const hash = crypto.createHash("sha1").update(url).digest("hex").slice(0, 8);
  const timestamp = Date.now().toString(36);
  return sanitizeImageKey(`${code}-${variantTag}-${hash}-${timestamp}`);
};

const updateCardImage = async (
  s3Client: S3Client,
  bucketName: string,
  publicUrl: string,
  cardId: number,
  imageUrl: string,
  imageKeyBase: string,
  dryRun: boolean
) => {
  const imageKey = await resolveUniqueImageKey(
    s3Client,
    bucketName,
    imageKeyBase
  );

  if (dryRun) {
    return { imageKey, src: `${publicUrl}/cards/${imageKey}.webp` };
  }

  const buffer = await downloadImageWithRetry(imageUrl, 3);
  const src = await uploadImageVariants(
    s3Client,
    imageKey,
    buffer,
    bucketName,
    publicUrl
  );
  await prisma.card.update({
    where: { id: cardId },
    data: { src, imageKey },
  });
  return { imageKey, src };
};

const main = async () => {
  const options = parseArgs();
  ensureEnvVars();

  const s3Client = createS3Client();
  const bucketName = process.env.R2_BUCKET_NAME!;
  const publicUrl = process.env.R2_PUBLIC_URL!;

  console.log(`[limitless-images] Fetching ${options.url}`);
  const scraped = await scrapeLimitlessImages(options.url, options.setCode);
  if (!scraped.length) {
    console.log("[limitless-images] No images found.");
    return;
  }

  const grouped = new Map<string, ScrapedImage[]>();
  for (const image of scraped) {
    const list = grouped.get(image.code) ?? [];
    list.push(image);
    grouped.set(image.code, list);
  }

  const entries = Array.from(grouped.entries())
    .map(([code, images]) => ({
      code,
      images: images.sort((a, b) => a.variantIndex - b.variantIndex),
    }))
    .slice(0, options.limit ?? grouped.size);

  console.log(`[limitless-images] ${entries.length} codes to process.`);

  const summary = {
    updated: 0,
    skipped: 0,
    missing: 0,
  };

  for (const entry of entries) {
    console.log(`\n[code] ${entry.code}`);
    entry.images.forEach((img, idx) => {
      console.log(
        `  [img ${idx}] ${img.filename} (variant=${img.variantIndex})`
      );
      console.log(`          src=${img.url}`);
    });

    const cards = await prisma.card.findMany({
      where: {
        code: entry.code,
        OR: [
          { setCode: options.setCode },
          { sets: { some: { set: { code: options.setCode } } } },
        ],
      },
      orderBy: [{ isFirstEdition: "desc" }, { id: "asc" }],
    });

    if (!cards.length) {
      summary.missing += 1;
      console.warn(
        `[limitless-images] No matching cards for code ${entry.code}`
      );
      continue;
    }

    const base = cards.find((card) => card.isFirstEdition) ?? cards[0];
    const alternates = cards.filter((card) => card.id !== base.id);
    const baseImage = entry.images.find((img) => img.variantIndex === 0) ?? null;
    const altImages = entry.images
      .filter((img) => img.variantIndex > 0)
      .sort((a, b) => a.variantIndex - b.variantIndex);

    console.log(
      `  [match] ${cards.length} card(s) found (base=${base.id}, alternates=${alternates.length})`
    );
    console.log(
      `  [images] base=${baseImage ? baseImage.filename : "none"} alts=${altImages.length}`
    );
    cards.forEach((card, idx) => {
      console.log(
        `  [card ${idx}] id=${card.id} code=${card.code} isFirstEdition=${card.isFirstEdition} currentSrc=${card.src}`
      );
    });

    if (baseImage) {
      console.log(
        `  [skip] Base image already trusted for ${entry.code}; skipping base update`
      );
      summary.skipped += 1;
    } else {
      summary.skipped += 1;
      console.warn(`  [skip] No base image for ${entry.code}`);
    }

    for (let i = 0; i < alternates.length; i += 1) {
      const image = altImages[i];
      if (!image) {
        summary.skipped += 1;
        console.warn(
          `  [skip] No alternate image for ${entry.code} (alt index ${i})`
        );
        continue;
      }
      const variantTag = `ALT${i + 1}`;
      const baseKey = buildUploadKeyBase(entry.code, variantTag, image.url);
      console.log(
        `  [plan] cardId=${alternates[i].id} isFirstEdition=${alternates[i].isFirstEdition} -> ${variantTag} -> ${baseKey}`
      );
      await updateCardImage(
        s3Client,
        bucketName,
        publicUrl,
        alternates[i].id,
        image.url,
        baseKey,
        options.dryRun
      );
      summary.updated += 1;
      if (options.sleepMs > 0) {
        await sleep(options.sleepMs);
      }
    }
  }

  console.log("[limitless-images] Done", summary);
};

main()
  .catch((error) => {
    console.error("[limitless-images] Failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
