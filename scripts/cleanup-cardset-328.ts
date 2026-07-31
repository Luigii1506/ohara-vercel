#!/usr/bin/env ts-node

import { PrismaClient } from "@prisma/client";

type Options = {
  setId: number;
  dryRun: boolean;
};

const parseArgs = (): Options => {
  const args = process.argv.slice(2);
  let setId = 328;
  const dryRun = args.includes("--dry-run");

  for (const arg of args) {
    if (arg.startsWith("--set-id=")) {
      const value = Number(arg.split("=")[1]);
      if (!Number.isNaN(value)) setId = value;
    }
  }

  return { setId, dryRun };
};

const prisma = new PrismaClient();

const main = async () => {
  const { setId, dryRun } = parseArgs();

  const cardSetRows = await prisma.cardSet.findMany({
    where: { setId },
    select: { cardId: true },
  });
  const cardIds: number[] = [];
  const seen = new Set<number>();
  for (const row of cardSetRows) {
    if (!seen.has(row.cardId)) {
      seen.add(row.cardId);
      cardIds.push(row.cardId);
    }
  }

  if (cardIds.length === 0) {
    console.log(`[summary] setId=${setId} cards=0`);
    return;
  }

  const counts = await prisma.cardSet.groupBy({
    by: ["cardId"],
    where: { cardId: { in: cardIds } },
    _count: { _all: true },
  });

  const cardsWithMultipleSets = counts
    .filter((entry) => entry._count._all > 1)
    .map((entry) => entry.cardId);
  const cardsWithOnlyThis = counts
    .filter((entry) => entry._count._all === 1)
    .map((entry) => entry.cardId);

  console.log(`[summary] setId=${setId}`);
  console.log(`[summary] cards_with_set=${counts.length}`);
  console.log(
    `[summary] cards_with_multiple_sets=${cardsWithMultipleSets.length}`
  );
  console.log(
    `[summary] cards_with_only_this_set=${cardsWithOnlyThis.length}`
  );

  if (cardsWithMultipleSets.length === 0) {
    console.log("[summary] No multi-set cards to clean.");
    return;
  }

  if (dryRun) {
    console.log(
      `[dry-run] would delete ${cardsWithMultipleSets.length} cardSet rows for setId=${setId}`
    );
    console.log(
      `[dry-run] would keep ${cardsWithOnlyThis.length} cards that only have this set`
    );
    return;
  }

  const deleted = await prisma.cardSet.deleteMany({
    where: {
      setId,
      cardId: { in: cardsWithMultipleSets },
    },
  });

  console.log(
    `[done] deleted=${deleted.count} cardSet rows for setId=${setId}`
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
