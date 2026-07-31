#!/usr/bin/env ts-node

import { PrismaClient } from "@prisma/client";

type Options = {
  dryRun: boolean;
  limit: number | null;
  batchSize: number;
  includeVariants: boolean;
};

const parseArgs = (): Options => {
  const args = process.argv.slice(2);
  const options: Options = {
    dryRun: args.includes("--dry-run"),
    limit: null,
    batchSize: 500,
    includeVariants: args.includes("--include-variants"),
  };

  for (const arg of args) {
    if (arg.startsWith("--limit=")) {
      const value = Number(arg.split("=")[1]);
      if (!Number.isNaN(value) && value > 0) {
        options.limit = value;
      }
    } else if (arg.startsWith("--batch=")) {
      const value = Number(arg.split("=")[1]);
      if (!Number.isNaN(value) && value > 0) {
        options.batchSize = value;
      }
    }
  }

  return options;
};

const prisma = new PrismaClient();

const normalizeValue = (value: string | null | undefined) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const main = async () => {
  const options = parseArgs();

  let processed = 0;
  let baseGroups = 0;
  let baseLinks = 0;
  let variantGroups = 0;
  let variantLinks = 0;

  console.log(
    `[start] dryRun=${options.dryRun} limit=${options.limit ?? "none"} batch=${options.batchSize} includeVariants=${options.includeVariants}`
  );

  let lastId = 0;
  while (true) {
    const cards = await prisma.card.findMany({
      where: {
        id: { gt: lastId },
        ...(options.includeVariants ? {} : { isFirstEdition: true }),
      },
      select: {
        id: true,
        code: true,
        name: true,
        isFirstEdition: true,
        alias: true,
        alternateArt: true,
        illustrator: true,
        region: true,
        language: true,
      },
      orderBy: { id: "asc" },
      take: options.batchSize,
    });

    if (cards.length === 0) break;

    for (const card of cards) {
      if (options.limit && processed >= options.limit) break;
      processed += 1;
      if (processed % 100 === 0) {
        console.log(`[progress] processed=${processed}`);
      }

      const canonicalCode = normalizeValue(card.code);
      if (!canonicalCode) {
        lastId = card.id;
        continue;
      }

      let group = await prisma.cardGroup.findUnique({
        where: { canonicalCode },
        select: { id: true },
      });

      if (!group) {
        if (!options.dryRun) {
          group = await prisma.cardGroup.create({
            data: {
              canonicalCode,
              canonicalName: normalizeValue(card.name),
            },
            select: { id: true },
          });
        }
        baseGroups += 1;
      }

      if (card.isFirstEdition && group) {
        const existingLink = await prisma.cardGroupLink.findUnique({
          where: {
            groupId_cardId: {
              groupId: group.id,
              cardId: card.id,
            },
          },
          select: { id: true },
        });

        if (!existingLink) {
          if (!options.dryRun) {
            await prisma.cardGroupLink.create({
              data: {
                groupId: group.id,
                cardId: card.id,
                region: card.region,
                language: card.language,
              },
            });
          }
          baseLinks += 1;
        }
      }

      if (!options.includeVariants || card.isFirstEdition) {
        lastId = card.id;
        continue;
      }

      if (!group) {
        lastId = card.id;
        continue;
      }

      const alternateArt = normalizeValue(card.alternateArt);
      const illustrator = normalizeValue(card.illustrator);
      const variantKey = normalizeValue(card.alias);

      let variantGroupId: number | null = null;

      if (alternateArt && illustrator) {
        const found = await prisma.cardVariantGroup.findFirst({
          where: {
            baseGroupId: group.id,
            alternateArt,
            illustrator,
          },
          select: { id: true },
        });
        variantGroupId = found?.id ?? null;
      } else if (alternateArt) {
        const found = await prisma.cardVariantGroup.findFirst({
          where: {
            baseGroupId: group.id,
            alternateArt,
          },
          select: { id: true },
        });
        variantGroupId = found?.id ?? null;
      } else if (variantKey) {
        const found = await prisma.cardVariantGroup.findFirst({
          where: {
            baseGroupId: group.id,
            variantKey,
          },
          select: { id: true },
        });
        variantGroupId = found?.id ?? null;
      }

      if (!variantGroupId) {
        if (!options.dryRun) {
          const created = await prisma.cardVariantGroup.create({
            data: {
              baseGroupId: group.id,
              variantKey,
              alternateArt,
              illustrator,
            },
            select: { id: true },
          });
          variantGroupId = created.id;
        }
        variantGroups += 1;
      }

      if (variantGroupId) {
        const existingVariant = await prisma.cardVariantLink.findUnique({
          where: {
            variantGroupId_cardId: {
              variantGroupId,
              cardId: card.id,
            },
          },
          select: { id: true },
        });
        if (!existingVariant) {
          if (!options.dryRun) {
            await prisma.cardVariantLink.create({
              data: {
                variantGroupId,
                cardId: card.id,
                region: card.region,
                language: card.language,
              },
            });
          }
          variantLinks += 1;
        }
      }

      lastId = card.id;
    }

    if (options.limit && processed >= options.limit) {
      break;
    }
  }

  console.log(
    `[summary] processed=${processed} baseGroups=${baseGroups} baseLinks=${baseLinks} variantGroups=${variantGroups} variantLinks=${variantLinks}`
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
