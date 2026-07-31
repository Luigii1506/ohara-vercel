#!/usr/bin/env ts-node

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_REGION = "JP";
const chunk = <T>(list: T[], size: number) => {
  const result: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    result.push(list.slice(i, i + size));
  }
  return result;
};

const normalizeSetCode = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");

const SPECIAL_SET_TITLES: Record<string, string> = {
  PROMOTIONALCARD: "Promotional Card",
  LIMITEDEDITION: "Limited Edition",
  FAMILYDECKSET: "Family Deck Set",
};

const main = async () => {
  const dryRun = process.argv.includes("--dry-run");
  const regionArg = process.argv.find((arg) => arg.startsWith("--region="));
  const region = regionArg ? regionArg.split("=")[1] : DEFAULT_REGION;
  const setArg = process.argv.find((arg) => arg.startsWith("--set="));
  const setCodes = setArg
    ? setArg
        .split("=")[1]
        ?.split(",")
        .map((value) => normalizeSetCode(value))
        .filter(Boolean) || []
    : [];

  const where: any = {
    region,
    sets: { none: {} },
  };
  if (setCodes.length) {
    where.setCode = { in: setCodes };
  }

  const cards = await prisma.card.findMany({
    where,
    select: { id: true, setCode: true },
  });

  if (!cards.length) {
    console.log("[info] No cards found to backfill.");
    return;
  }

  const uniqueSetCodes = Array.from(
    new Set(cards.map((card) => normalizeSetCode(card.setCode)))
  ).filter(Boolean);

  const sets = await prisma.set.findMany({
    where: {
      OR: [
        { code: { in: uniqueSetCodes } },
        { title: { in: uniqueSetCodes, mode: "insensitive" } },
      ],
    },
    select: { id: true, code: true, title: true },
  });

  const setIdByCode = new Map<string, number>();
  const setIdByTitle = new Map<string, number>();
  for (const set of sets) {
    if (set.code) {
      setIdByCode.set(normalizeSetCode(set.code), set.id);
    }
    if (set.title) {
      setIdByTitle.set(normalizeSetCode(set.title), set.id);
    }
  }

  const relations = cards
    .map((card) => {
      const normalized = normalizeSetCode(card.setCode);
      const setId =
        setIdByCode.get(normalized) || setIdByTitle.get(normalized);
      if (!setId) return null;
      return { cardId: card.id, setId };
    })
    .filter(Boolean) as Array<{ cardId: number; setId: number }>;

  if (!relations.length) {
    const missingCodes = uniqueSetCodes.filter(
      (code) => !setIdByCode.has(code) && !setIdByTitle.has(code)
    );
    console.log(
      `[info] No matching sets. Missing codes: ${missingCodes.slice(0, 15).join(", ")}`
    );
    if (!dryRun) {
      const creatable = missingCodes
        .map((code) => SPECIAL_SET_TITLES[code])
        .filter(Boolean);
      if (creatable.length) {
        for (const title of creatable) {
          const created = await prisma.set.create({
            data: {
              title,
              image: "",
              code: null,
              releaseDate: new Date(),
              isOpen: false,
              version: null,
            },
            select: { id: true, title: true },
          });
          const normalizedTitle = normalizeSetCode(created.title);
          setIdByTitle.set(normalizedTitle, created.id);
          console.log(`[create] Set ${created.title} -> ${created.id}`);
        }
      }
    }
  }

  const refreshedRelations = relations.length
    ? relations
    : cards
        .map((card) => {
          const normalized = normalizeSetCode(card.setCode);
          const setId =
            setIdByCode.get(normalized) || setIdByTitle.get(normalized);
          if (!setId) return null;
          return { cardId: card.id, setId };
        })
        .filter(Boolean) as Array<{ cardId: number; setId: number }>;

  console.log(
    `[info] Cards=${cards.length} Relations=${refreshedRelations.length} Region=${region}`
  );

  if (dryRun) {
    console.log("[dry-run] No relations created.");
    return;
  }

  const relationChunks = chunk(refreshedRelations, 1000);
  let created = 0;
  for (const chunkRelations of relationChunks) {
    const result = await prisma.cardSet.createMany({
      data: chunkRelations,
      skipDuplicates: true,
    });
    created += result.count;
  }

  console.log(`[create] CardSet relations created=${created}`);
};

main()
  .catch((error) => {
    console.error("[error] Script failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
