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

  const op01Set = await prisma.set.findFirst({
    where: { code: "OP01" },
    select: { id: true, code: true, title: true },
  });

  if (!op01Set) {
    console.log("[skip] Set OP01 not found.");
    return;
  }

  const cards = await prisma.card.findMany({
    where: {
      alternateArt: "Pre-Errata",
      sets: { some: { setId: op01Set.id } },
    },
    select: { id: true, code: true, setCode: true },
  });

  console.log(
    `[scan] set=${op01Set.code} matches=${cards.length} dryRun=${dryRun}`
  );

  if (!cards.length) return;

  if (dryRun) {
    console.log(
      `[dry-run] Example: ${cards
        .slice(0, 10)
        .map((card) => `${card.code}(${card.id})`)
        .join(", ")}${cards.length > 10 ? "..." : ""}`
    );
    return;
  }

  let updated = 0;
  let removedRelations = 0;

  for (const batch of chunk(cards, 200)) {
    const ids = batch.map((card) => card.id);

    const remove = await prisma.cardSet.deleteMany({
      where: {
        setId: op01Set.id,
        cardId: { in: ids },
      },
    });
    removedRelations += remove.count;

    const update = await prisma.card.updateMany({
      where: { id: { in: ids } },
      data: { setCode: "OP01-pre-errata" },
    });
    updated += update.count;
  }

  console.log(
    `[done] updated=${updated} removedRelations=${removedRelations}`
  );
};

main()
  .catch((error) => {
    console.error("[error] fix failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
