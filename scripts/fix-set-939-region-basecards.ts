#!/usr/bin/env ts-node

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SET_ID = 939;
const TARGET_REGION = "US";
const BATCH_SIZE = 500;

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

const main = async () => {
  const dryRun = process.argv.slice(2).includes("--dry-run");

  const cards = await prisma.card.findMany({
    where: {
      sets: {
        some: {
          setId: SET_ID,
        },
      },
    },
    select: {
      id: true,
      code: true,
      isFirstEdition: true,
      region: true,
      baseCardId: true,
    },
  });

  if (!cards.length) {
    console.log("[skip] No cards found for set", SET_ID);
    return;
  }

  const codes = Array.from(new Set(cards.map((card) => card.code)));
  const baseCards = await prisma.card.findMany({
    where: {
      code: { in: codes },
      region: TARGET_REGION,
      isFirstEdition: true,
    },
    select: {
      id: true,
      code: true,
    },
  });

  const baseCardIdByCode = new Map<string, number>();
  for (const base of baseCards) {
    if (!baseCardIdByCode.has(base.code)) {
      baseCardIdByCode.set(base.code, base.id);
    }
  }

  const missingBaseCodes = new Set<string>();
  const updates: Array<{ id: number; data: { region?: string; baseCardId?: number | null } }> = [];

  for (const card of cards) {
    const data: { region?: string; baseCardId?: number | null } = {};

    if (card.region !== TARGET_REGION) {
      data.region = TARGET_REGION;
    }

    if (card.isFirstEdition) {
      if (card.baseCardId !== null) {
        data.baseCardId = null;
      }
    } else {
      const baseCardId = baseCardIdByCode.get(card.code);
      if (!baseCardId) {
        missingBaseCodes.add(card.code);
      } else if (card.baseCardId !== baseCardId) {
        data.baseCardId = baseCardId;
      }
    }

    if (Object.keys(data).length > 0) {
      updates.push({ id: card.id, data });
    }
  }

  console.log(`[plan] cards=${cards.length} updates=${updates.length}`);
  if (missingBaseCodes.size > 0) {
    console.log(
      `[warn] Missing base cards for codes (${missingBaseCodes.size}): ${Array.from(
        missingBaseCodes
      ).join(", ")}`
    );
  }

  if (dryRun || updates.length === 0) {
    return;
  }

  for (const chunk of chunkArray(updates, BATCH_SIZE)) {
    await prisma.$transaction(
      chunk.map((entry) =>
        prisma.card.update({
          where: { id: entry.id },
          data: entry.data,
        })
      )
    );
  }

  console.log("[done] Set 939 cards updated.");
};

main()
  .catch((error) => {
    console.error("[error] Script failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
