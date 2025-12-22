#!/usr/bin/env ts-node

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const targetSetCode = "EB03";
  console.log(`Marking cards from ${targetSetCode} as missing (tcgplayerLinkStatus=false)`);

  const targetSet = await prisma.set.findFirst({
    where: { code: { equals: targetSetCode, mode: "insensitive" } },
    select: { id: true },
  });

  const cardIdsFromSetCode = await prisma.card.findMany({
    where: {
      setCode: {
        contains: targetSetCode,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  const setLinkedCardIds: number[] = [];
  if (targetSet) {
    const links = await prisma.cardSet.findMany({
      where: { setId: targetSet.id },
      select: { cardId: true },
    });
    links.forEach((link) => setLinkedCardIds.push(link.cardId));
  } else {
    console.warn(`Set with code ${targetSetCode} was not found; relying only on setCode matches.`);
  }

  const cardIds = Array.from(
    new Set([...cardIdsFromSetCode.map((c) => c.id), ...setLinkedCardIds])
  );

  if (!cardIds.length) {
    console.log("No cards matched criteria.");
    return;
  }

  const result = await prisma.card.updateMany({
    where: { id: { in: cardIds } },
    data: { tcgplayerLinkStatus: false },
  });

  console.log(`Updated ${result.count} cards.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
