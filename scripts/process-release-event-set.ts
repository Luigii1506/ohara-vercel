#!/usr/bin/env -S npx tsx

/**
 * Script genérico para procesar "Release Event Cards" desde TCGplayer.
 * - Obtiene las cartas del set desde la API OFICIAL de TCGplayer (el scraping web
 *   dejó de funcionar por el anti-bot). Resuelve el "grupo" (set) por título o id.
 * - Busca la carta base (isFirstEdition: true) por código y crea una alterna con alternateArt="Release event".
 * - Sube las variantes de imagen a R2 y relaciona la carta con el set objetivo.
 *
 * Uso:
 *   npx tsx scripts/process-release-event-set.ts \
 *     --setTitle="Adventure on Kami's Island Release Event Cards" --dry-run
 *   npx tsx scripts/process-release-event-set.ts --groupId=24638 \
 *     --setTitle="Adventure on Kami's Island Release Event Cards"
 */

import "dotenv/config";
import { tcgplayerFetch } from "../lib/services/tcgplayerClient";
import {
  PrismaClient,
  type Card,
  type CardColor,
  type CardCondition,
  type CardEffect,
  type CardText,
  type CardType,
} from "@prisma/client";
import { chromium } from "playwright";
import type { BrowserContext } from "playwright";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

type ScrapedCard = {
  code: string;
  title: string;
  image: string;
  detailPath?: string;
  imageSet?: string;
};

type CliArgs = {
  slug: string;
  setName: string;
  setTitle: string;
  maxPages: number;
  groupId?: number;
  dryRun: boolean;
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const ORIGIN = "https://www.tcgplayer.com";
const CODE_PATTERN = /#?\b([A-Z]{1,5}(?:-\d{1,4}|\d{1,4})[A-Z0-9-]*)\b/;

const ALTERNATE_ART_LABEL = "Release event";
const DEFAULT_MAX_PAGES = 4;

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
    (key) => !process.env[key] || process.env[key]!.trim().length === 0
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

const IMAGE_SIZES = {
  tiny: { width: 20, height: 28, quality: 40, suffix: "-tiny" },
  xs: { width: 100, height: 140, quality: 60, suffix: "-xs" },
  thumb: { width: 200, height: 280, quality: 70, suffix: "-thumb" },
  small: { width: 300, height: 420, quality: 75, suffix: "-small" },
  medium: { width: 600, height: 840, quality: 80, suffix: "-medium" },
  large: { width: 800, height: 1120, quality: 85, suffix: "-large" },
  original: { width: null, height: null, quality: 90, suffix: "" },
} as const;

function parseCliArgs(): CliArgs {
  const raw = process.argv.slice(2);
  const parsed: Partial<CliArgs> = {};

  let dryRun = false;
  raw.forEach((entry) => {
    if (!entry.startsWith("--")) return;
    if (entry === "--dry-run") {
      dryRun = true;
      return;
    }
    const [key, ...rest] = entry.split("=");
    const normalized = key.replace(/^--/, "");
    const value = rest.join("=");
    if (normalized === "maxPages") {
      const num = Number(value);
      if (Number.isFinite(num) && num > 0) {
        parsed.maxPages = num;
      }
    } else if (normalized === "groupId") {
      const num = Number(value);
      if (Number.isFinite(num) && num > 0) parsed.groupId = num;
    } else if (normalized === "slug") {
      parsed.slug = value.trim();
    } else if (normalized === "setTitle") {
      parsed.setTitle = value.trim();
    } else if (normalized === "setName") {
      parsed.setName = value.trim();
    }
  });

  if (!parsed.setTitle) {
    throw new Error(
      "--setTitle es obligatorio (ej. \"Adventure on Kami's Island Release Event Cards\")"
    );
  }

  return {
    slug: parsed.slug ?? "",
    setTitle: parsed.setTitle,
    setName: parsed.setName?.length ? parsed.setName : parsed.slug ?? "",
    maxPages:
      parsed.maxPages && parsed.maxPages > 0
        ? parsed.maxPages
        : DEFAULT_MAX_PAGES,
    groupId: parsed.groupId,
    dryRun,
  };
}

const cli = parseCliArgs();
const TARGET_SLUG = cli.slug;
const TARGET_SET_NAME = cli.setName;
const TARGET_SET_TITLE = cli.setTitle;

function extractCode(text?: string | null) {
  if (!text) return "";
  const match = text.match(CODE_PATTERN);
  return match ? match[1].toUpperCase() : "";
}

function isDataUrl(value?: string | null) {
  return Boolean(value && value.trim().toLowerCase().startsWith("data:"));
}

function normalizeImageUrl(value?: string | null) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed || isDataUrl(trimmed)) {
    return "";
  }
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  if (trimmed.startsWith("/")) {
    return `${ORIGIN}${trimmed}`;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return "";
}

function buildUrl(pageNumber: number) {
  const params = new URLSearchParams({
    productLineName: "one-piece-card-game",
    page: String(pageNumber),
    view: "grid",
    setName: TARGET_SET_NAME,
    ProductTypeName: "Cards",
  });
  return `${ORIGIN}/search/one-piece-card-game/${TARGET_SLUG}?${params.toString()}`;
}

function pickBestImage(srcset?: string | null, fallback?: string | null) {
  if (!srcset) {
    return normalizeImageUrl(fallback);
  }
  const entries = srcset
    .split(",")
    .map((entry) => {
      const parts = entry.trim().split(/\s+/);
      const url = parts[0];
      const size = parseInt(parts[1], 10) || 0;
      return { url, size };
    })
    .filter((entry) => Boolean(entry.url));
  if (!entries.length) {
    return normalizeImageUrl(fallback);
  }
  entries.sort((a, b) => b.size - a.size);
  const bestEntry = entries.find((entry) => !isDataUrl(entry.url));
  if (bestEntry?.url) {
    return normalizeImageUrl(bestEntry.url);
  }
  return normalizeImageUrl(fallback);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapePage(context: BrowserContext, pageNumber: number) {
  const url = buildUrl(pageNumber);
  console.log(`[navigate][page ${pageNumber}] ${url}`);
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000 + Math.random() * 1000);

  const pageCards = (await page.$$eval(
    ".product-card__title",
    (titles: Element[]) => {
      const CODE_PATTERN = /#?\b([A-Z]{1,5}(?:-\d{1,4}|\d{1,4})[A-Z0-9-]*)\b/;
      const extractCode = (text?: string | null) => {
        if (!text) return "";
        const match = text.match(CODE_PATTERN);
        return match ? match[1].toUpperCase() : "";
      };

      const pickAttr = (el: Element | null, attrs: string[]) => {
        if (!el) return "";
        for (const attr of attrs) {
          const value = el.getAttribute(attr) || "";
          const normalized = value.trim();
          if (normalized && !normalized.toLowerCase().startsWith("data:")) {
            return normalized;
          }
        }
        return "";
      };

      const extractImageInfo = (root: Element) => {
        const wrapper = root.querySelector(
          ".lazy-image__wrapper"
        ) as Element | null;
        if (!wrapper) {
          return { src: "", srcset: "" };
        }
        const img = wrapper.querySelector("img");
        const pictureSources = Array.from(
          wrapper.querySelectorAll("source")
        );
        let src = pickAttr(img, [
          "data-src",
          "data-lazy-src",
          "data-original",
          "data-placeholder",
          "src",
        ]);
        if (!src && img && "currentSrc" in img) {
          const current = (img as HTMLImageElement).currentSrc || "";
          if (current && !current.toLowerCase().startsWith("data:")) {
            src = current.trim();
          }
        }
        let srcset = pickAttr(img, ["data-srcset", "data-lazy-srcset", "srcset"]);
        if (!srcset && pictureSources.length) {
          for (const source of pictureSources) {
            srcset = pickAttr(source, [
              "data-srcset",
              "data-lazy-srcset",
              "srcset",
            ]);
            if (srcset) break;
          }
        }
        return { src, srcset };
      };

      return titles
        .map((titleEl) => {
          const element = titleEl as HTMLElement;
          const cardRoot = element.closest(".search-result__content") as
            | HTMLElement
            | null;
          if (!cardRoot) return null;

          const title = element.textContent?.trim() ?? "";
          if (!title) return null;

          let code = extractCode(title);
          if (!code) {
            const subtitleText = Array.from(
              cardRoot.querySelectorAll<HTMLSpanElement>(
                ".product-card__subtitle span"
              )
            )
              .map((span) => span.textContent?.trim() || "")
              .join(" ");
            code = extractCode(subtitleText);
          }
          if (!code) {
            const rarityText = Array.from(
              cardRoot.querySelectorAll<HTMLSpanElement>(
                ".product-card__rarity__variant span"
              )
            )
              .map((span) => span.textContent?.trim() || "")
              .join(" ");
            code = extractCode(rarityText);
          }
          if (!code) {
            const cardText = cardRoot.textContent || "";
            code = extractCode(cardText);
          }
          if (!code) {
            return null;
          }

          const anchors = Array.from(
            cardRoot.querySelectorAll<HTMLAnchorElement>("a")
          );
          const detailAnchor = anchors.find((anchor) =>
            (anchor.getAttribute("href") || "").includes("/product/")
          );
          const detailPath = detailAnchor?.getAttribute("href") || "";
          const imageInfo = extractImageInfo(cardRoot);
          return {
            title,
            code,
            image: imageInfo.src,
            imageSet: imageInfo.srcset,
            detailPath,
          };
        })
        .filter(Boolean) as ScrapedCard[];
    }
  )) as ScrapedCard[];

  await page.close();
  return pageCards;
}

const IMAGE_RESOLUTION_WORKERS = Math.max(
  1,
  Math.min(6, Number(process.env.PRE_RELEASE_RESOLVE_WORKERS) || 3)
);
const IMAGE_PROGRESS_CHUNK = 5;

async function scrapeAllCards() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const aggregated: ScrapedCard[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= cli.maxPages; pageNumber += 1) {
      const pageCards = await scrapePage(context, pageNumber);
      if (!pageCards.length) {
        console.log(`[page ${pageNumber}] No cards found, stopping pagination.`);
        break;
      }
      aggregated.push(...pageCards);
      console.log(
        `[aggregate] After page ${pageNumber}, total cards collected: ${aggregated.length}`
      );
      await delay(1500 + Math.random() * 1000);
    }

    const uniqueCards = deduplicateScrapedCards(aggregated);

    if (uniqueCards.length) {
      await enrichCardImages(context, uniqueCards);
    }

    return uniqueCards;
  } finally {
    await context.close();
    await browser.close();
  }
}

function deduplicateScrapedCards(cards: ScrapedCard[]) {
  const byCode = new Map<string, ScrapedCard>();
  let duplicates = 0;

  const qualityScore = (card: ScrapedCard) => {
    let score = 0;
    if (card.detailPath) score += 2;
    if (card.imageSet) score += 1;
    if (card.image) score += 1;
    return score;
  };

  for (const card of cards) {
    const code = card.code.trim();
    if (!code) continue;
    const existing = byCode.get(code);
    if (!existing) {
      byCode.set(code, card);
      continue;
    }

    duplicates += 1;
    if (qualityScore(card) > qualityScore(existing)) {
      byCode.set(code, card);
    }
  }

  if (duplicates) {
    console.log(`[aggregate] Removed ${duplicates} duplicate entries by code.`);
  }

  return Array.from(byCode.values());
}

async function enrichCardImages(
  context: BrowserContext,
  cards: ScrapedCard[]
) {
  const total = cards.length;
  const workers = Math.min(IMAGE_RESOLUTION_WORKERS, total);
  console.log(
    `[images] Resolving best image for ${total} cards with ${workers} worker${
      workers === 1 ? "" : "s"
    }...`
  );

  let nextIndex = 0;
  let completed = 0;

  const logProgress = () => {
    console.log(
      `[images] Completed ${completed}/${total} cards (${Math.round(
        (completed / total) * 100
      )}%)`
    );
  };

  async function worker() {
    while (true) {
      if (nextIndex >= total) break;
      const currentIndex = nextIndex;
      nextIndex += 1;
      const target = cards[currentIndex];
      try {
        target.image = await resolveBestImage(context, target);
      } catch (error) {
        console.warn(
          `[images][${target.code}] Failed to resolve best image: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      } finally {
        completed += 1;
        if (
          completed === total ||
          completed % IMAGE_PROGRESS_CHUNK === 0
        ) {
          logProgress();
        }
      }
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));
}

function buildCreateData(
  baseCard: Card & {
    types: CardType[];
    colors: CardColor[];
    effects: CardEffect[];
    conditions: CardCondition[];
    texts: CardText[];
  },
  imageUrl: string
) {
  return {
    name: baseCard.name,
    code: baseCard.code,
    setCode: baseCard.setCode,
    src: imageUrl,
    imageKey: null,
    cost: baseCard.cost,
    power: baseCard.power,
    attribute: baseCard.attribute,
    counter: baseCard.counter,
    category: baseCard.category,
    life: baseCard.life,
    rarity: baseCard.rarity,
    illustrator: baseCard.illustrator,
    alternateArt: ALTERNATE_ART_LABEL,
    status: baseCard.status,
    triggerCard: baseCard.triggerCard,
    tcgUrl: null,
    tcgplayerProductId: null,
    tcgplayerLinkStatus: null,
    marketPrice: null,
    lowPrice: null,
    highPrice: null,
    priceCurrency: null,
    priceUpdatedAt: null,
    alias: baseCard.alias,
    order: baseCard.order,
    isFirstEdition: false,
    isPro: baseCard.isPro,
    region: baseCard.region,
    baseCardId: baseCard.id,
    types: baseCard.types.length
      ? { create: baseCard.types.map((t) => ({ type: t.type })) }
      : undefined,
    colors: baseCard.colors.length
      ? { create: baseCard.colors.map((c) => ({ color: c.color })) }
      : undefined,
    effects: baseCard.effects.length
      ? { create: baseCard.effects.map((e) => ({ effect: e.effect })) }
      : undefined,
    conditions: baseCard.conditions.length
      ? { create: baseCard.conditions.map((c) => ({ condition: c.condition })) }
      : undefined,
    texts: baseCard.texts.length
      ? { create: baseCard.texts.map((t) => ({ text: t.text })) }
      : undefined,
  };
}

async function resolveBestImage(context: BrowserContext, card: ScrapedCard) {
  let bestImage = pickBestImage(card.imageSet, card.image);
  const detailUrl = card.detailPath
    ? card.detailPath.startsWith("http")
      ? card.detailPath
      : `${ORIGIN}${card.detailPath}`
    : "";

  if (!detailUrl) {
    return bestImage;
  }

  const detailPage = await context.newPage();
  try {
    await detailPage.goto(detailUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await detailPage.waitForSelector('img[data-testid^="product-image__container"]', {
      timeout: 15000,
    });
    const detailImageInfo = await detailPage.evaluate(() => {
      const imgs = Array.from(
        document.querySelectorAll(
          'img[data-testid^="product-image__container"]'
        )
      );
      if (!imgs.length) return null;
      const target = imgs[0];
      return {
        src: target.getAttribute("src") || "",
        srcset: target.getAttribute("srcset") || "",
      };
    });
    if (detailImageInfo) {
      bestImage = pickBestImage(detailImageInfo.srcset, detailImageInfo.src);
    }
  } catch (error: any) {
    console.warn(`Failed to load detail for ${card.code}:`, error.message);
  } finally {
    await detailPage.close();
    await delay(400 + Math.random() * 400);
  }

  return normalizeImageUrl(bestImage);
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

function sanitizeCodeForFilename(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildUniqueImageKey(code: string): string {
  const safeCode = sanitizeCodeForFilename(code) || "ANNIVERSARY";
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${safeCode}-${timestamp}-${random}`;
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

  console.log(`[upload] All variants uploaded for ${filename}.`);
  return `${R2_PUBLIC_URL}/cards/${filename}.webp`;
}

const ONE_PIECE_CATEGORY_ID = 68;

// Resuelve el groupId del set: por --groupId o buscando por título en la API.
async function resolveGroupId(): Promise<number> {
  if (cli.groupId) return cli.groupId;
  const target = TARGET_SET_TITLE.trim().toLowerCase();
  for (let offset = 0; offset < 5000; offset += 100) {
    const res: any = await tcgplayerFetch(
      `/catalog/categories/${ONE_PIECE_CATEGORY_ID}/groups?limit=100&offset=${offset}`
    );
    const groups = res?.results ?? [];
    if (!groups.length) break;
    const match = groups.find(
      (g: any) => String(g.name).trim().toLowerCase() === target
    );
    if (match) return match.groupId;
    if (groups.length < 100) break;
  }
  throw new Error(
    `No encontré el grupo "${TARGET_SET_TITLE}" en la API de TCGplayer. Pasa --groupId=N.`
  );
}

// Trae las cartas del set desde la API OFICIAL de TCGplayer (code + imagen).
async function fetchCardsFromApi(): Promise<ScrapedCard[]> {
  const groupId = await resolveGroupId();
  console.log(`[api] grupo id=${groupId}`);
  const out: ScrapedCard[] = [];
  for (let offset = 0; offset < 5000; offset += 100) {
    const res: any = await tcgplayerFetch(
      `/catalog/products?categoryId=${ONE_PIECE_CATEGORY_ID}&groupId=${groupId}&getExtendedFields=true&limit=100&offset=${offset}`
    );
    const products = res?.results ?? [];
    if (!products.length) break;
    for (const p of products) {
      const numberField = (p.extendedData ?? []).find((e: any) =>
        /^number$/i.test(e.name)
      )?.value;
      const code = (numberField || extractCode(p.name || p.cleanName)).toUpperCase();
      if (!code) continue;
      // _200w → _400w (mejor resolución disponible en el CDN).
      const image = String(p.imageUrl || "").replace(/_200w\.(jpg|png)/i, "_400w.$1");
      out.push({ code, title: p.name || p.cleanName || code, image });
    }
    if (products.length < 100) break;
  }
  return out;
}

async function main() {
  console.log(
    `Processing release event set "${TARGET_SET_TITLE}" (slug: ${TARGET_SLUG}) pages=${cli.maxPages}`
  );

  const cards = deduplicateScrapedCards(await fetchCardsFromApi());
  console.log(
    `${cli.dryRun ? "[DRY-RUN] " : ""}Obtenidas ${cards.length} cartas únicas desde la API de TCGplayer.`
  );

  let targetSet = await prisma.set.findFirst({
    where: {
      title: {
        equals: TARGET_SET_TITLE,
        mode: "insensitive",
      },
    },
  });

  if (!targetSet) {
    if (cli.dryRun) {
      console.log(`[DRY-RUN][set] Se crearía el set "${TARGET_SET_TITLE}".`);
    } else {
      console.log(
        `[set] Set "${TARGET_SET_TITLE}" not found. Creating it now...`
      );
      targetSet = await prisma.set.create({
        data: {
          title: TARGET_SET_TITLE,
          code: null,
          image: "",
          releaseDate: new Date(),
          isOpen: false,
          version: null,
        },
      });
      console.log(
        `[set] Created new set "${TARGET_SET_TITLE}" (ID ${targetSet.id}).`
      );
    }
  }

  const stats = {
    processed: 0,
    created: 0,
    skippedExisting: 0,
    skippedNoBase: 0,
    skippedNoImage: 0,
    failed: 0,
  };

  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index];
    stats.processed += 1;
    console.log(
      `\n===== [${index + 1}/${cards.length}] Processing ${card.code} =====`
    );

    try {
      const baseCard = await prisma.card.findFirst({
        where: {
          code: card.code,
          isFirstEdition: true,
        },
        include: {
          types: true,
          colors: true,
          effects: true,
          conditions: true,
          texts: true,
        },
      });

      if (!baseCard) {
        console.log("[skip][no-base] No base card found with isFirstEdition=true");
        stats.skippedNoBase += 1;
        continue;
      }

      const existingAlternate = await prisma.card.findFirst({
        where: {
          code: card.code,
          alternateArt: {
            equals: ALTERNATE_ART_LABEL,
            mode: "insensitive",
          },
        },
      });

      if (existingAlternate) {
        console.log(
          `[skip][existing] Card with code ${card.code} already has an ${ALTERNATE_ART_LABEL} alternate (ID ${existingAlternate.id}).`
        );
        stats.skippedExisting += 1;
        continue;
      }

      if (!card.image) {
        console.log("[skip][no-image] Missing usable image URL from scraper");
        stats.skippedNoImage += 1;
        continue;
      }

      if (cli.dryRun) {
        console.log(
          `[DRY-RUN][create] ${card.code} → crearía alterna "${ALTERNATE_ART_LABEL}" (base ${baseCard.id}) img=${card.image.slice(-30)}`
        );
        stats.created += 1;
        continue;
      }

      const imageBuffer = await downloadImage(card.image);
      const imageKey = buildUniqueImageKey(card.code);
      const publicUrl = await uploadImageVariants(imageKey, imageBuffer);

      const createData = buildCreateData(baseCard, publicUrl);
      const createdCard = await prisma.card.create({
        data: {
          ...createData,
          sets: {
            create: {
              setId: targetSet.id,
            },
          },
        },
      });

      console.log(
        `[create] Created ${ALTERNATE_ART_LABEL} card ${createdCard.id} (${createdCard.code})`
      );
      stats.created += 1;
    } catch (error) {
      console.error(`[error] Failed processing ${card.code}:`, error);
      stats.failed += 1;
    }
  }

  console.log("\n========== Summary ==========");
  console.log(`Processed: ${stats.processed}`);
  console.log(`Created: ${stats.created}`);
  console.log(`Skipped (existing alternate): ${stats.skippedExisting}`);
  console.log(`Skipped (no base card): ${stats.skippedNoBase}`);
  console.log(`Skipped (no image): ${stats.skippedNoImage}`);
  console.log(`Failed: ${stats.failed}`);
  console.log("================================\n");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
