#!/usr/bin/env -S ts-node --project tsconfig.scripts.json

import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { prisma } from "../lib/prisma";

type CardLinkInfo = {
  cardId: number;
  productId: number;
  status: boolean | null;
  updatedAt: Date | null;
};

const CHUNK_SIZE = 50;

function loadEnvFiles() {
  const envFiles = [".env", ".env.local"];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      loadEnv({ path: fullPath, override: true });
    }
  }
}

async function collectLinkedCards() {
  const cards = await prisma.card.findMany({
    where: { tcgplayerProductId: { not: null } },
    select: {
      id: true,
      tcgplayerProductId: true,
      tcgplayerLinkStatus: true,
      updatedAt: true,
    },
  });

  const map = new Map<number, CardLinkInfo>();
  for (const card of cards) {
    const productId = Number(card.tcgplayerProductId);
    if (!Number.isFinite(productId)) continue;

    if (!map.has(productId)) {
      map.set(productId, {
        cardId: card.id,
        productId,
        status: card.tcgplayerLinkStatus ?? null,
        updatedAt: card.updatedAt,
      });
      continue;
    }

    const existing = map.get(productId)!;
    if (existing.status === true) {
      // prefer keeping the card already marked as linked
      continue;
    }

    if (card.tcgplayerLinkStatus === true) {
      map.set(productId, {
        cardId: card.id,
        productId,
        status: true,
        updatedAt: card.updatedAt,
      });
    }
  }

  return map;
}

async function clearUnlinkedProducts(linkedProductIds: number[]) {
  if (!linkedProductIds.length) return 0;
  const result = await prisma.tcgCatalogProduct.updateMany({
    where: {
      productId: { notIn: linkedProductIds },
      linkedCardId: { not: null },
    },
    data: {
      linkedCardId: null,
      linkedAt: null,
      linkedById: null,
    },
  });
  return result.count;
}

async function updateLinkedProducts(entries: CardLinkInfo[]) {
  let updated = 0;
  const missing: number[] = [];

  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const chunk = entries.slice(i, i + CHUNK_SIZE);
    const tx = chunk.map((entry) =>
      prisma.tcgCatalogProduct.updateMany({
        where: { productId: entry.productId },
        data: {
          linkedCardId: entry.cardId,
          linkedAt: entry.updatedAt ?? new Date(),
          linkedById: null,
          productStatus: "active",
        },
      })
    );
    const results = await prisma.$transaction(tx);
    results.forEach((result, index) => {
      if (result.count > 0) {
        updated += result.count;
      } else {
        missing.push(chunk[index].productId);
      }
    });
  }

  return { updated, missing };
}

async function main() {
  loadEnvFiles();

  console.log("[backfill-catalog-links] Collecting linked cards…");
  const map = await collectLinkedCards();
  const entries = Array.from(map.values());
  const productIds = entries.map((entry) => entry.productId);

  console.log(
    `[backfill-catalog-links] Found ${entries.length} unique linked products`
  );

  console.log("[backfill-catalog-links] Clearing orphaned catalog links…");
  const cleared = await clearUnlinkedProducts(productIds);
  console.log(
    `[backfill-catalog-links] Cleared ${cleared} catalog entries with stale links`
  );

  console.log("[backfill-catalog-links] Updating catalog links…");
  const { updated, missing } = await updateLinkedProducts(entries);
  console.log(
    `[backfill-catalog-links] Updated ${updated} catalog entries with linked cards`
  );

  if (missing.length) {
    console.warn(
      "[backfill-catalog-links] Catalog entries missing for product IDs:",
      missing.slice(0, 25),
      missing.length > 25 ? `(+${missing.length - 25} more)` : ""
    );
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("[backfill-catalog-links] Failed", error);
  prisma.$disconnect().catch(() => {});
  process.exitCode = 1;
});
