#!/usr/bin/env -S npx tsx
//
// Segunda pasada de scripts/fix-official-sync-set-region-mismatch.ts: los 214
// enlaces que quedaron sin tocar porque el Set al que apuntaban ("Family
// Deck Set", "Limited Edition", "Limited Edition Card") nunca tuvo un
// `code` propio (se crearon por coincidencia de título, no de código). Cada
// CARTA sí tiene su propio código (ej. "ST01-002", "OP01-001") — se usa ese
// para resolver/crear el Set correcto por región, igual que la primera
// pasada, solo que derivado de la carta en vez del Set viejo.
//
// Uso:
//   npx tsx scripts/fix-official-sync-set-region-mismatch-nocode.ts --dry-run
//   npx tsx scripts/fix-official-sync-set-region-mismatch-nocode.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function regionsMatch(cardRegion: string | null, setRegion: string | null): boolean {
  const cardIsUs = !cardRegion || cardRegion === "" || cardRegion === "US";
  const setIsUs = !setRegion || setRegion === "";
  if (cardIsUs) return setIsUs;
  return cardRegion === setRegion;
}

function setRegionWhereFor(cardRegion: string | null) {
  const isUs = !cardRegion || cardRegion === "" || cardRegion === "US";
  return isUs
    ? { OR: [{ region: null }, { region: "" }, { region: "US" }] }
    : { region: cardRegion };
}

async function ensureCorrectSet(
  code: string,
  cardRegion: string | null,
  dryRun: boolean,
  cache: Map<string, number>
): Promise<number | null> {
  const cacheKey = `${code}::${cardRegion ?? "US"}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const existing = await prisma.set.findFirst({
    where: { code, ...setRegionWhereFor(cardRegion) },
    select: { id: true },
  });
  if (existing) {
    cache.set(cacheKey, existing.id);
    return existing.id;
  }
  if (dryRun) {
    console.log(`  [dry-run][set][create] code=${code} region=${cardRegion ?? "US"}`);
    return null;
  }
  const created = await prisma.set.create({
    data: {
      image: "",
      title: code,
      code,
      region: cardRegion === "US" || !cardRegion ? null : cardRegion,
      releaseDate: new Date(0),
      isOpen: false,
    } as never,
    select: { id: true },
  });
  console.log(
    `  [set][create] code=${code} region=${cardRegion ?? "US"} -> nuevo Set #${created.id}`
  );
  cache.set(cacheKey, created.id);
  return created.id;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const cards = await prisma.card.findMany({
    where: { sources: { some: { source: { in: ["EN", "ASIA-EN", "JP", "FR"] } } } },
    select: {
      id: true,
      code: true,
      region: true,
      sets: { select: { set: { select: { id: true, code: true, region: true, title: true } } } },
    },
  });

  const cache = new Map<string, number>();
  let fixed = 0;

  for (const card of cards) {
    for (const link of card.sets) {
      const set = link.set;
      if (set.code) continue; // ya resuelto en la primera pasada
      if (regionsMatch(card.region, set.region)) continue;

      const derivedCode = card.code.split("-")[0]?.toUpperCase();
      if (!derivedCode) continue;

      const correctSetId = await ensureCorrectSet(derivedCode, card.region, dryRun, cache);

      if (dryRun) {
        console.log(
          `  [dry-run] card #${card.id} (${card.code}, region=${card.region ?? "US"}) : set #${set.id} "${set.title}" -> code=${derivedCode} region correcta`
        );
        fixed += 1;
        continue;
      }
      if (!correctSetId) continue;

      await prisma.cardSet.deleteMany({ where: { cardId: card.id, setId: set.id } });
      await prisma.cardSet
        .create({ data: { cardId: card.id, setId: correctSetId } })
        .catch(() => {});
      console.log(
        `  card #${card.id} (${card.code}) : set #${set.id} "${set.title}" -> set #${correctSetId} (code=${derivedCode}, region=${card.region ?? "US"})`
      );
      fixed += 1;
    }
  }

  console.log(`\n${dryRun ? "[DRY-RUN] " : ""}${fixed} enlaces corregidos, ~${cache.size} sets resueltos/creados`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
