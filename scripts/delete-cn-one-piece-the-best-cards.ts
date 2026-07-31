#!/usr/bin/env ts-node

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const main = async () => {
  const targetRegion = "CN";
  const targetTitle = "One Piece The Best";
  const targetCode = "PRB01";
  const dryRun = process.argv.slice(2).includes("--dry-run");

  const sets = await prisma.set.findMany({
    where: {
      OR: [
        { title: { equals: targetTitle, mode: "insensitive" } },
        { code: { equals: targetCode, mode: "insensitive" } },
      ],
    },
    select: { id: true, title: true, code: true },
  });

  if (!sets.length) {
    console.log("[skip] No matching sets found.");
    return;
  }

  const setIds = sets.map((set) => set.id);
  const cards = await prisma.card.findMany({
    where: {
      region: targetRegion,
      sets: { some: { setId: { in: setIds } } },
    },
    select: { id: true },
  });

  if (!cards.length) {
    console.log("[skip] No matching cards found.");
    return;
  }

  const cardIds = cards.map((card) => card.id);

  console.log(
    `[plan] Delete cards=${cardIds.length} region=${targetRegion} sets=${sets
      .map((set) => `${set.title ?? "n/a"}(${set.code ?? "n/a"})`)
      .join(", ")}`
  );

  if (dryRun) {
    return;
  }

  const tournamentCount = await prisma.tournamentDeck.deleteMany({
    where: { leaderCardId: { in: cardIds } },
  });
  const gameLogCount = await prisma.gameLog.deleteMany({
    where: { opponentLeaderId: { in: cardIds } },
  });
  const deleteResult = await prisma.card.deleteMany({
    where: { id: { in: cardIds } },
  });

  console.log(
    `[done] Deleted cards=${deleteResult.count} tournamentDecks=${tournamentCount.count} gameLogs=${gameLogCount.count}`
  );
};

main()
  .catch((error) => {
    console.error("[error] Delete failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
