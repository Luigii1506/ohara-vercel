#!/usr/bin/env ts-node

import { PrismaClient, type Card, type CardColor } from "@prisma/client";

type CardWithBaseColors = Card & {
  baseCard: (Card & { colors: CardColor[] }) | null;
};

const prisma = new PrismaClient();

async function main() {
  let processed = 0;
  let updated = 0;
  const batchSize = 200;
  let cursor: number | null = null;

  console.log("🚀 Starting orphan color fixer...\n");

  while (true) {
    const cards: CardWithBaseColors[] = await prisma.card.findMany({
      where: {
        category: { not: "DON" },
        colors: { none: {} },
        baseCardId: { not: null },
      },
      include: {
        baseCard: {
          include: { colors: true },
        },
      },
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      take: batchSize,
      orderBy: { id: "asc" },
    });

    if (!cards.length) {
      break;
    }

    for (const card of cards) {
      processed += 1;
      cursor = card.id;

      const baseColors = card.baseCard?.colors ?? [];
      if (!baseColors.length) {
        continue;
      }

      await prisma.cardColor.createMany({
        data: baseColors.map((color: CardColor) => ({
          cardId: card.id,
          color: color.color,
        })),
        skipDuplicates: true,
      });

      updated += 1;

      if (processed % 100 === 0) {
        console.log(
          `Processed ${processed} cards – copied colors to ${updated} alternates`
        );
      }
    }
  }

  console.log(
    `\n✅ Done. Processed ${processed} cards; copied colors for ${updated}.`
  );
}

main()
  .catch((error) => {
    console.error("❌ Color fix failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
