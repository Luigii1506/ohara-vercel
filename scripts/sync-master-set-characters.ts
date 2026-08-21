import { prisma } from "@/lib/prisma";
import {
  MASTER_SET_SEED_CHARACTERS,
  extractCharacterMatchesFromCardSource,
} from "@/lib/master-sets/catalog";

async function main() {
  const characterEntityClient = (prisma as any).characterEntity;
  const cardCharacterLinkClient = (prisma as any).cardCharacterLink;

  console.log(
    `[master-sets] syncing ${MASTER_SET_SEED_CHARACTERS.length} seed characters`
  );

  for (const character of MASTER_SET_SEED_CHARACTERS) {
    await characterEntityClient.upsert({
      where: { slug: character.slug },
      update: {
        name: character.name,
        aliases: character.aliases,
        description: character.description ?? null,
        isActive: true,
      },
      create: {
        slug: character.slug,
        name: character.name,
        aliases: character.aliases,
        description: character.description ?? null,
      },
    });
  }

  const characters = await characterEntityClient.findMany({
    select: { id: true, slug: true },
  });
  const characterIdBySlug = new Map(
    characters.map((character) => [character.slug, character.id])
  );

  const cards = await prisma.card.findMany({
    select: {
      id: true,
      name: true,
      triggerCard: true,
      texts: {
        select: { text: true },
      },
    },
  });

  let createdLinks = 0;

  for (const card of cards) {
    const matches = extractCharacterMatchesFromCardSource({
      name: card.name,
      texts: card.texts.map((entry) => entry.text),
      triggerCard: card.triggerCard,
    });

    for (const match of matches) {
      const characterId = characterIdBySlug.get(match.slug);
      if (!characterId) continue;

      await cardCharacterLinkClient.upsert({
        where: {
          unique_card_character_relation: {
            cardId: card.id,
            characterId,
            relationType: match.relationType,
          },
        },
        update: {
          source: "AUTO",
          notes: `Auto-linked from alias match: ${match.matchedAlias}`,
        },
        create: {
          cardId: card.id,
          characterId,
          relationType: match.relationType,
          source: "AUTO",
          notes: `Auto-linked from alias match: ${match.matchedAlias}`,
        },
      });

      createdLinks += 1;
    }
  }

  console.log(
    `[master-sets] done. processed=${cards.length} cards linksUpserted=${createdLinks}`
  );
}

main()
  .catch((error) => {
    console.error("[master-sets] failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
