import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeCards() {
  console.log('📊 Analizando estructura de cartas en la BD...\n');

  // Total cards
  const totalCards = await prisma.card.count();
  console.log('Total cards in DB:', totalCards);

  // Cards with baseCardId (alternates)
  const alternateCards = await prisma.card.count({
    where: { baseCardId: { not: null } }
  });
  console.log('Alternate cards (with baseCardId):', alternateCards);

  // Base cards (without baseCardId)
  const baseCards = await prisma.card.count({
    where: { baseCardId: null }
  });
  console.log('Base cards (without baseCardId):', baseCards);

  console.log('\n✅ Verification:', baseCards, '+', alternateCards, '=', totalCards);

  // Sample base card with alternates
  const cardWithAlternates = await prisma.card.findFirst({
    where: {
      baseCardId: null,
      alternateCards: { some: {} }
    },
    include: {
      alternateCards: {
        select: { id: true, code: true }
      }
    }
  });

  if (cardWithAlternates) {
    console.log('\n📋 Ejemplo de carta con alternates:');
    console.log(`Base: ${cardWithAlternates.code} (ID: ${cardWithAlternates.id})`);
    console.log(`Alternates (${cardWithAlternates.alternateCards.length}):`,
      cardWithAlternates.alternateCards.map(a => a.code).join(', '));
  }

  await prisma.$disconnect();
}

analyzeCards().catch(console.error);
