#!/usr/bin/env ts-node

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_SET_CODES = ["OP01", "OP02"];

const chunk = <T>(list: T[], size: number) => {
  const result: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    result.push(list.slice(i, i + size));
  }
  return result;
};

const main = async () => {
  const dryRun = process.argv.includes("--dry-run");
  const setArg = process.argv.find((arg) => arg.startsWith("--set="));
  const setCodes = setArg
    ? setArg
        .split("=")[1]
        ?.split(",")
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean) || []
    : DEFAULT_SET_CODES;

  if (!setCodes.length) {
    console.log("[info] No set codes provided.");
    return;
  }

  const codeChunks = chunk(setCodes, 50);
  let deletedCards = 0;
  let deletedCardSets = 0;

  for (const codes of codeChunks) {
    const cards = await prisma.card.findMany({
      where: {
        region: "CN",
        setCode: { in: codes },
      },
      select: { id: true },
    });

    const cardIds = cards.map((card) => card.id);
    if (!cardIds.length) continue;

    if (dryRun) {
      console.log(`[dry-run] Would delete ${cardIds.length} cards for ${codes.join(", ")}`);
      continue;
    }

    const removedCardSets = await prisma.cardSet.deleteMany({
      where: { cardId: { in: cardIds } },
    });
    deletedCardSets += removedCardSets.count;

    const removedCards = await prisma.card.deleteMany({
      where: { id: { in: cardIds } },
    });
    deletedCards += removedCards.count;
  }

  if (!dryRun) {
    console.log(
      `[delete] cards=${deletedCards} cardSetLinks=${deletedCardSets}`
    );
  }
};

main()
  .catch((error) => {
    console.error("[error] Script failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
