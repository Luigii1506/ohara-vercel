import { prisma } from "@/lib/prisma";
import {
  buildCharacterNameMatchers,
  findCharacterNameMatch,
} from "@/lib/master-sets/name-linking";

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();

  for (const entry of argv) {
    if (!entry.startsWith("--")) continue;
    const [key, value = ""] = entry.slice(2).split("=");
    args.set(key, value);
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.has("dry-run");
  const limit = args.get("limit")
    ? Number.parseInt(args.get("limit") as string, 10)
    : undefined;
  const onlySlugs = args.get("slugs")
    ? (args.get("slugs") as string)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : undefined;

  const characterEntityClient = (prisma as any).characterEntity;
  const cardCharacterLinkClient = (prisma as any).cardCharacterLink;

  const characters = await characterEntityClient.findMany({
    where: {
      isActive: true,
      ...(onlySlugs?.length ? { slug: { in: onlySlugs } } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      aliases: true,
    },
  });

  const cards = await prisma.card.findMany({
    orderBy: { id: "asc" },
    ...(limit ? { take: limit } : {}),
    select: {
      id: true,
      code: true,
      name: true,
    },
  });

  const matchers = buildCharacterNameMatchers(characters);

  console.log(
    `[master-set-name-links] start characters=${matchers.length} cards=${cards.length} dryRun=${dryRun}`
  );

  let processedCards = 0;
  let matchedCards = 0;
  let createdOrUpdated = 0;

  for (const card of cards) {
    processedCards += 1;
    let cardHadMatch = false;

    for (const matcher of matchers) {
      const match = findCharacterNameMatch(card.name, matcher);
      if (!match) continue;

      cardHadMatch = true;

      if (!dryRun) {
        await cardCharacterLinkClient.upsert({
          where: {
            unique_card_character_relation: {
              cardId: card.id,
              characterId: matcher.id,
              relationType: "MENTIONED_IN_NAME",
            },
          },
          update: {
            source: "AUTO",
            notes: `Auto-linked from card name alias match: ${match.matchedAlias}`,
          },
          create: {
            cardId: card.id,
            characterId: matcher.id,
            relationType: "MENTIONED_IN_NAME",
            source: "AUTO",
            notes: `Auto-linked from card name alias match: ${match.matchedAlias}`,
          },
        });
      }

      createdOrUpdated += 1;
      console.log(
        `[master-set-name-links] matched cardId=${card.id} code=${card.code} slug=${matcher.slug} alias="${match.matchedAlias}"`
      );
    }

    if (cardHadMatch) {
      matchedCards += 1;
    }

    if (processedCards % 500 === 0) {
      console.log(
        `[master-set-name-links] progress cards=${processedCards}/${cards.length} matchedCards=${matchedCards} links=${createdOrUpdated}`
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        processedCards,
        matchedCards,
        linksCreatedOrUpdated: createdOrUpdated,
        dryRun,
        scopedCharacters: matchers.length,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("[master-set-name-links] failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
