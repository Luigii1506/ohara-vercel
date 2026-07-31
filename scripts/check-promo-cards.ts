import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkPromoCards() {
  console.log("Checking P-000 (Promo) cards in database...\n");

  // Todas las cartas con setCode P-000
  const allPromoCards = await prisma.card.findMany({
    where: {
      setCode: "P-000",
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
      code: "asc",
    },
  });

  console.log(`Total P-000 cards found: ${allPromoCards.length}\n`);

  // Agrupar por criterios
  const firstEditionOnly = allPromoCards.filter((c) => c.isFirstEdition);
  const baseCardsOnly = allPromoCards.filter((c) => c.baseCardId === null);
  const firstEditionAndBaseOnly = allPromoCards.filter(
    (c) => c.isFirstEdition && c.baseCardId === null
  );

  console.log(`First Edition only: ${firstEditionOnly.length}`);
  console.log(`Base cards only (baseCardId = null): ${baseCardsOnly.length}`);
  console.log(
    `First Edition AND Base cards: ${firstEditionAndBaseOnly.length}\n`
  );

  console.log("Sample of all P-000 cards:");
  allPromoCards.slice(0, 10).forEach((card) => {
    console.log(
      `  [${card.id}] ${card.code} - ${card.name} (Rarity: ${card.rarity}, FirstEd: ${card.isFirstEdition}, BaseCardId: ${card.baseCardId})`
    );
  });

  if (allPromoCards.length > 10) {
    console.log(`  ... and ${allPromoCards.length - 10} more`);
  }

  console.log("\n--- Analysis ---");
  console.log(
    `Cards that would show with firstEditionOnly=true & baseCardsOnly=true: ${firstEditionAndBaseOnly.length}`
  );
  console.log(
    `Cards that would show with firstEditionOnly=true (no baseCardsOnly): ${firstEditionOnly.length}`
  );
}

checkPromoCards()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
