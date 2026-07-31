#!/usr/bin/env ts-node

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const main = async () => {
  const targetRegion = "FR";
  const targetSetCodes = ["PRB-01", "PRB01"];

  const cards = await prisma.card.findMany({
    where: {
      region: targetRegion,
      setCode: { in: targetSetCodes },
    },
    select: { id: true },
  });

  if (!cards.length) {
    console.log(
      `[skip] No cards found for region=${targetRegion} setCodes=${targetSetCodes.join(",")}`
    );
    return;
  }

  const cardIds = cards.map((card) => card.id);

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
