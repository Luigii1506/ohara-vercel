#!/usr/bin/env ts-node

import "dotenv/config";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { prisma } = require("../lib/prisma");

type SlotRow = { id: number; sortOrder: number };

const parseArg = (key: string) =>
  process.argv.find((arg) => arg.startsWith(`${key}=`))?.split("=")[1];

const dryRun = process.argv.includes("--dry-run");
const limitArg = parseArg("--limit");
const limit = limitArg ? Number.parseInt(limitArg, 10) : undefined;

const main = async () => {
  const collectionCards = await prisma.collectionCard.findMany({
    include: {
      slots: {
        select: { id: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    ...(limit ? { take: limit } : {}),
  });

  const maxSort = await prisma.collectionCardSlot.aggregate({
    _max: { sortOrder: true },
  });
  let nextSortOrder = (maxSort._max.sortOrder ?? 0) + 10;

  let created = 0;
  let deleted = 0;
  let updated = 0;

  for (const card of collectionCards) {
    const currentSlots = card.slots ?? [];
    const slotCount = currentSlots.length;
    const targetCount = card.quantity;

    if (slotCount === targetCount && slotCount > 0) {
      const minSlot = currentSlots[0]?.sortOrder ?? card.sortOrder ?? 0;
      if (card.sortOrder !== minSlot) {
        updated += 1;
        if (!dryRun) {
          await prisma.collectionCard.update({
            where: { id: card.id },
            data: { sortOrder: minSlot },
          });
        }
      }
      continue;
    }

    if (slotCount > targetCount) {
      const toRemove: SlotRow[] = currentSlots
        .slice()
        .sort((a: SlotRow, b: SlotRow) => b.sortOrder - a.sortOrder)
        .slice(0, slotCount - targetCount);
      deleted += toRemove.length;
      if (!dryRun && toRemove.length) {
          await prisma.collectionCardSlot.deleteMany({
            where: { id: { in: toRemove.map((slot: SlotRow) => slot.id) } },
          });
        }
      }

    if (slotCount < targetCount) {
      const baseSort =
        card.sortOrder && card.sortOrder >= nextSortOrder
          ? card.sortOrder
          : nextSortOrder;
      const toCreate = Array.from(
        { length: targetCount - slotCount },
        (_, idx) => ({
          collectionId: card.collectionId,
          collectionCardId: card.id,
          sortOrder: baseSort + idx * 10,
        })
      );
      created += toCreate.length;
      if (!dryRun && toCreate.length) {
        await prisma.collectionCardSlot.createMany({
          data: toCreate,
        });
      }
      nextSortOrder = baseSort + (targetCount - slotCount) * 10;

      if (card.sortOrder !== baseSort) {
        updated += 1;
        if (!dryRun) {
          await prisma.collectionCard.update({
            where: { id: card.id },
            data: { sortOrder: baseSort },
          });
        }
      }
    }
  }

  console.log(
    `[summary] created=${created} deleted=${deleted} updated=${updated} dryRun=${dryRun}`
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
