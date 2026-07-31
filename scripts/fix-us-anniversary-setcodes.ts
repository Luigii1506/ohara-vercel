#!/usr/bin/env ts-node

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SUFFIX_BY_ART: Record<string, string> = {
  "1st Anniversary": "1st-anniversary",
  "2nd Anniversary": "2nd-anniversary",
  "3rd Anniversary": "3rd-anniversary",
};

const normalize = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase();

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

const main = async () => {
  const dryRun = process.argv.slice(2).includes("--dry-run");

  const targetArts = Object.keys(SUFFIX_BY_ART);
  const cards = await prisma.card.findMany({
    where: {
      region: "US",
      alternateArt: { in: targetArts },
    },
    select: {
      id: true,
      code: true,
      setCode: true,
      alternateArt: true,
    },
  });

  if (!cards.length) {
    console.log("[skip] No US anniversary cards found.");
    return;
  }

  const updates: Array<{ id: number; setCode: string }> = [];
  const setCodes = new Set<string>();

  for (const card of cards) {
    const suffix = SUFFIX_BY_ART[card.alternateArt ?? ""];
    if (!suffix) continue;
    const prefix = card.code.split("-")[0]?.trim().toUpperCase();
    if (!prefix) continue;
    const nextSetCode = `${prefix}-${suffix}`;
    if (card.setCode !== nextSetCode) {
      updates.push({ id: card.id, setCode: nextSetCode });
      setCodes.add(nextSetCode);
    }
  }

  if (!updates.length) {
    console.log("[skip] No setCode updates required.");
    return;
  }

  console.log(`[plan] Update cards=${updates.length}`);

  if (dryRun) {
    return;
  }

  const setRecords = await prisma.set.findMany({
    where: { code: { in: Array.from(setCodes) } },
    select: { id: true, code: true },
  });
  const setIdByCode = new Map<string, number>();
  for (const set of setRecords) {
    if (!set.code) continue;
    setIdByCode.set(set.code.toUpperCase(), set.id);
  }

  for (const chunk of chunkArray(updates, 500)) {
    await prisma.$transaction(
      chunk.map((entry) =>
        prisma.card.update({
          where: { id: entry.id },
          data: { setCode: entry.setCode },
        })
      )
    );

    for (const entry of chunk) {
      const setId = setIdByCode.get(entry.setCode.toUpperCase());
      if (!setId) continue;
      await prisma.cardSet.deleteMany({ where: { cardId: entry.id } });
      await prisma.cardSet.create({
        data: { cardId: entry.id, setId },
      });
    }
  }

  console.log("[done] Anniversary setCode updates applied.");
};

main()
  .catch((error) => {
    console.error("[error] Script failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
