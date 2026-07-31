#!/usr/bin/env ts-node

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const normalizeSetCode = (value: string) =>
  value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");

const main = async () => {
  const dryRun = process.argv.includes("--dry-run");

  const romanceSets = await prisma.set.findMany({
    where: {
      OR: [
        { code: { equals: "OP01", mode: "insensitive" } },
        { title: { contains: "Romance Dawn", mode: "insensitive" } },
      ],
    },
    select: { id: true, title: true, code: true },
  });

  if (!romanceSets.length) {
    console.log("[info] No Romance Dawn sets found.");
    return;
  }

  const romanceSetIds = romanceSets.map((set) => set.id);
  console.log(
    `[info] Romance Dawn sets: ${romanceSets
      .map((set) => `${set.title}(${set.code ?? "no-code"})#${set.id}`)
      .join(", ")}`
  );

  const cards = await prisma.card.findMany({
    where: {
      region: "CN",
      setCode: { not: "OP01" },
      sets: { some: { setId: { in: romanceSetIds } } },
    },
    select: { id: true, code: true, setCode: true },
  });

  if (!cards.length) {
    console.log("[info] No CN cards linked to Romance Dawn with mismatched setCode.");
    return;
  }

  console.log(`[info] Cards to delete: ${cards.length}`);

  if (dryRun) {
    console.log("[dry-run] No deletions performed.");
    return;
  }

  const cardIds = cards.map((card) => card.id);

  const removedCardSets = await prisma.cardSet.deleteMany({
    where: { cardId: { in: cardIds }, setId: { in: romanceSetIds } },
  });

  const removedCards = await prisma.card.deleteMany({
    where: { id: { in: cardIds } },
  });

  console.log(
    `[delete] cards=${removedCards.count} cardSetLinks=${removedCardSets.count}`
  );
};

main()
  .catch((error) => {
    console.error("[error] Script failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
