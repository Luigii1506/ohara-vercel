import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import {
  type TcgplayerProduct,
  listTcgplayerProducts,
} from "./tcgplayerClient";

const ONE_PIECE_CATEGORY_ID = 68;

export interface CatalogSyncOptions {
  pageSize?: number;
  offset?: number;
  limit?: number;
  delayMs?: number;
  logger?: (message: string, meta?: Record<string, unknown>) => void;
  dryRun?: boolean;
}

export interface CatalogSyncResult {
  processed: number;
  removedCount: number;
  reportedTotal?: number | null;
  syncTimestamp: Date;
  dryRun: boolean;
}

type CatalogProductResult = TcgplayerProduct & {
  productLineName?: string | null;
  url?: string | null;
  sku?: string | null;
};

const DEFAULT_DELAY_MS = Number(process.env.TCGPLAYER_SYNC_DELAY_MS ?? 2000);

export async function syncTcgCatalog(
  options: CatalogSyncOptions = {}
): Promise<CatalogSyncResult> {
  const logger = options.logger ?? (() => {});
  const pageSize = clamp(options.pageSize ?? 100, 1, 100);
  const syncTimestamp = new Date();
  const dryRunEnv = (process.env.TCG_CATALOG_DRY_RUN ?? "1") !== "0";
  const dryRun = options.dryRun ?? dryRunEnv;
  let processed = 0;
  let offset = Math.max(options.offset ?? 0, 0);
  let reportedTotal: number | null = null;

  logger("catalogSync:start", {
    pageSize,
    offset,
    limit: options.limit,
    delayMs: options.delayMs ?? DEFAULT_DELAY_MS,
    dryRun,
  });

  while (true) {
    const remaining =
      typeof options.limit === "number" ? options.limit - processed : null;
    if (remaining !== null && remaining <= 0) {
      break;
    }

    const currentPageSize =
      remaining !== null ? Math.min(pageSize, remaining) : pageSize;

    logger("catalogSync:fetch", {
      offset,
      pageSize: currentPageSize,
    });

    const { products, totalResults } = await fetchCatalogChunk(
      offset,
      currentPageSize
    );

    if (typeof totalResults === "number") {
      reportedTotal = Math.max(reportedTotal ?? 0, totalResults);
    }

    if (!products.length) {
      logger("catalogSync:emptyPage", { offset });
      break;
    }

    if (dryRun) {
      logger("catalogSync:preview", {
        sampleSize: Math.min(products.length, 5),
        sample: products.slice(0, 5).map((product) => ({
          productId: product.productId,
          name: product.name,
          cleanName: product.cleanName,
          cardType: getExtendedValue(product, "CardType"),
          rarity: getExtendedValue(product, "Rarity"),
          isSealed: isSealedProduct(product),
          url: product.url,
        })),
      });
    } else {
      await saveProducts(products, syncTimestamp);
    }
    processed += products.length;

    logger("catalogSync:saved", {
      processed,
      batchSize: products.length,
    });

    if (remaining !== null && processed >= options.limit!) {
      logger("catalogSync:cliLimitReached", {});
      break;
    }

    offset += products.length;
    if (products.length < currentPageSize) {
      logger("catalogSync:lastPageReached", {
        batchSize: products.length,
      });
      break;
    }
    await delay(options.delayMs ?? DEFAULT_DELAY_MS);
  }

  const removedCount = dryRun ? 0 : await markRemovedProducts(syncTimestamp);

  logger("catalogSync:finished", {
    processed,
    removedCount,
    reportedTotal,
    dryRun,
  });

  return {
    processed,
    removedCount,
    reportedTotal,
    syncTimestamp,
    dryRun,
  };
}

async function fetchCatalogChunk(
  offset: number,
  pageSize: number
) {
  const { results, totalItems } = await listTcgplayerProducts({
    categoryId: ONE_PIECE_CATEGORY_ID,
    limit: pageSize,
    offset,
    includeExtendedFields: true,
  });

  const products = (results ?? []).filter((product): product is CatalogProductResult =>
    Boolean(product && typeof product.productId === "number")
  );

  return {
    products,
    totalResults: totalItems ?? products.length,
  };
}

async function saveProducts(
  products: CatalogProductResult[],
  syncTimestamp: Date
) {
  const operations: ReturnType<typeof prisma.tcgCatalogProduct.upsert>[] = [];
  const chunkSize = 25;

  for (const product of products) {
    const payload = buildCatalogPayload(product, syncTimestamp);
    operations.push(
      prisma.tcgCatalogProduct.upsert({
        where: { productId: payload.productId },
        update: payload.update,
        create: payload.create,
      })
    );

    if (operations.length >= chunkSize) {
      await prisma.$transaction(operations.splice(0));
    }
  }

  if (operations.length) {
    await prisma.$transaction(operations);
  }
}

function buildCatalogPayload(
  product: CatalogProductResult,
  syncTimestamp: Date
) {
  if (typeof product.productId !== "number") {
    throw new Error("Product is missing productId");
  }

  const normalizedLineName =
    product.productLineName?.trim() || product.categoryName?.trim() || "One Piece Card Game";
  const cleanName = product.cleanName?.trim() || product.name?.trim() || "";
  const fallbackUrl =
    product.url ||
    (product.productId
      ? `https://www.tcgplayer.com/product/${product.productId}`
      : null);

  const metadata = product as unknown as Prisma.InputJsonValue;
  const cardTypeValue = getExtendedValue(product, "CardType");
  const rarityValue = getExtendedValue(product, "Rarity");
  const isSealed = isSealedProduct(product);
  const baseData = {
    name: product.name?.trim() || cleanName || `Product ${product.productId}`,
    cleanName: cleanName || null,
    productLineName: normalizedLineName,
    cardType: cardTypeValue,
    rarity: rarityValue,
    isSealed,
    url: fallbackUrl,
    sku: product.sku ?? null,
    imageUrl: product.imageUrl ?? null,
    metadata,
    lastSyncedAt: syncTimestamp,
    productStatus: "active" as const,
  };

  return {
    productId: product.productId,
    create: {
      productId: product.productId,
      ...baseData,
    },
    update: baseData,
  };
}

async function markRemovedProducts(syncTimestamp: Date) {
  const result = await prisma.tcgCatalogProduct.updateMany({
    where: {
      lastSyncedAt: {
        lt: syncTimestamp,
      },
    },
    data: {
      productStatus: "removed",
    },
  });

  return result.count;
}

function getExtendedValue(product: CatalogProductResult, key: string) {
  const entry = product.extendedData?.find((item) => item.name === key);
  if (!entry) return null;
  const value = entry.value;
  if (value === null || value === undefined) return null;
  return String(value);
}

function isSealedProduct(product: CatalogProductResult) {
  const cardType = getExtendedValue(product, "CardType");
  if (cardType && cardType.trim().length > 0) {
    return false;
  }
  const name = (product.name ?? product.cleanName ?? "").toLowerCase();
  const keywords = [
    "booster",
    "deck",
    "box",
    "pack",
    "case",
    "starter",
    "campaign",
    "release",
    "promo pack",
    "treasure",
  ];
  if (keywords.some((keyword) => name.includes(keyword))) {
    return true;
  }
  return true;
}

function delay(ms: number) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
