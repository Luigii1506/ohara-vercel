#!/usr/bin/env ts-node

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const main = async () => {
  const targetRegion = "CN";
  const dryRun = process.argv.slice(2).includes("--dry-run");

  const cards = await prisma.card.findMany({
    where: {
      region: targetRegion,
      setCode: {
        startsWith: "ST",
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (!cards.length) {
    console.log("[skip] No matching cards found.");
    return;
  }

  const cardIds = cards.map((card) => card.id);

  console.log(
    `[plan] Delete cards=${cardIds.length} region=${targetRegion} setCode=ST*`
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
