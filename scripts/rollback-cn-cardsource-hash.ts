#!/usr/bin/env ts-node

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const chunk = <T>(list: T[], size: number) => {
  const result: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    result.push(list.slice(i, i + size));
  }
  return result;
};

const main = async () => {
  const dryRun = process.argv.includes("--dry-run");

  const sources = await prisma.cardSource.findMany({
    where: {
      source: "CN",
      sourceId: { contains: ":" },
    },
    select: {
      cardId: true,
      sourceId: true,
      card: { select: { region: true, code: true } },
    },
  });

  const filtered = sources.filter((item) => item.card?.region === "CN");
  const cardIds = Array.from(new Set(filtered.map((item) => item.cardId)));
  const codes = Array.from(
    new Set(
      filtered
        .map((item) => item.card?.code)
        .filter((code): code is string => Boolean(code))
    )
  ).sort();

  console.log(
    `[scan] cardSources=${sources.length} cnMatches=${filtered.length} cards=${cardIds.length}`
  );
  console.log(
    `[sample] ${codes.slice(0, 25).join(", ")}${codes.length > 25 ? "..." : ""}`
  );

  if (dryRun) {
    console.log("[dry-run] No deletions performed.");
    return;
  }

  let deletedCardSets = 0;
  let deletedCardSources = 0;
  let deletedGroupLinks = 0;
  let deletedVariantLinks = 0;
  let deletedCards = 0;

  for (const batch of chunk(cardIds, 500)) {
    const removedCardSets = await prisma.cardSet.deleteMany({
      where: { cardId: { in: batch } },
    });
    deletedCardSets += removedCardSets.count;

    const removedGroupLinks = await prisma.cardGroupLink.deleteMany({
      where: { cardId: { in: batch } },
    });
    deletedGroupLinks += removedGroupLinks.count;

    const removedVariantLinks = await prisma.cardVariantLink.deleteMany({
      where: { cardId: { in: batch } },
    });
    deletedVariantLinks += removedVariantLinks.count;

    const removedCardSources = await prisma.cardSource.deleteMany({
      where: { cardId: { in: batch } },
    });
    deletedCardSources += removedCardSources.count;

    const removedCards = await prisma.card.deleteMany({
      where: { id: { in: batch } },
    });
    deletedCards += removedCards.count;
  }

  console.log(
    `[delete] cards=${deletedCards} cardSources=${deletedCardSources} cardSets=${deletedCardSets} groupLinks=${deletedGroupLinks} variantLinks=${deletedVariantLinks}`
  );
};

main()
  .catch((error) => {
    console.error("[error] rollback failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
