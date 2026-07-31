import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkPromoRarity() {
  console.log('Checking cards with rarity "Promo" in database...\n');

  // Todas las cartas con rarity Promo
  const promoCards = await prisma.card.findMany({
    where: {
      rarity: "Promo",
    },
    select: {
      id: true,
      code: true,
      name: true,
      rarity: true,
      isFirstEdition: true,
      baseCardId: true,
      setCode: true,
    },
    orderBy: {
      setCode: "asc",
    },
    take: 50,
  });

  console.log(`Total cards with rarity "Promo": ${promoCards.length}\n`);

  // Agrupar por setCode
  const bySetCode = promoCards.reduce(
    (acc, card) => {
      if (!acc[card.setCode]) {
        acc[card.setCode] = [];
      }
      acc[card.setCode].push(card);
      return acc;
    },
    {} as Record<string, typeof promoCards>
  );

  console.log("Promo cards grouped by setCode:");
  Object.entries(bySetCode).forEach(([setCode, cards]) => {
    console.log(`\n  ${setCode}: ${cards.length} cards`);
    cards.slice(0, 3).forEach((card) => {
      console.log(
        `    [${card.id}] ${card.code} - ${card.name} (FirstEd: ${card.isFirstEdition}, BaseCardId: ${card.baseCardId})`
      );
    });
    if (cards.length > 3) {
      console.log(`    ... and ${cards.length - 3} more`);
    }
  });

  // También verificar si hay cartas con setCode que empiece con P-
  console.log('\n\nChecking cards with setCode starting with "P-"...');
  const pCards = await prisma.card.findMany({
    where: {
      setCode: {
        startsWith: "P-",
      },
    },
    select: {
      id: true,
      code: true,
      name: true,
      rarity: true,
      setCode: true,
      isFirstEdition: true,
      baseCardId: true,
    },
    orderBy: {
      setCode: "asc",
    },
    take: 20,
  });

  console.log(`\nTotal cards with setCode starting with "P-": ${pCards.length}`);
  if (pCards.length > 0) {
    console.log("\nSample:");
    pCards.slice(0, 10).forEach((card) => {
      console.log(
        `  [${card.setCode}] ${card.code} - ${card.name} (Rarity: ${card.rarity}, FirstEd: ${card.isFirstEdition}, BaseCardId: ${card.baseCardId})`
      );
    });
  }
}

checkPromoRarity()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
