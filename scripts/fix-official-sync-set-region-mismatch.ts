#!/usr/bin/env -S npx tsx
//
// Repara el bug histórico de ensureSet() en lib/services/officialSync.ts:
// antes buscaba/creaba un Set por código SIN filtrar por región, así que una
// carta JP/FR con código "OP01" terminaba enlazada al Set US "Romance Dawn"
// en vez de a un Set JP/FR propio. Ya arreglado en el código (ensureSet ahora
// sí filtra por región); este script corrige las filas ya existentes.
//
// Para cada carta de official-sync (fuente EN/ASIA-EN/JP/FR) con un CardSet
// que apunta a un Set de la región equivocada:
//   1. Busca (o crea, igual que ensureSet ya corregido) el Set correcto:
//      mismo `code`, región de la CARTA.
//   2. Quita el CardSet viejo (a la región equivocada).
//   3. Crea el CardSet nuevo (a la región correcta), si no existe ya.
// No borra ninguna Card — solo corrige a qué Set está enlazada.
//
// Uso:
//   npx tsx scripts/fix-official-sync-set-region-mismatch.ts --dry-run
//   npx tsx scripts/fix-official-sync-set-region-mismatch.ts

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
  createdCache: Map<string, number>
): Promise<number | null> {
  const cacheKey = `${code}::${cardRegion ?? "US"}`;
  if (createdCache.has(cacheKey)) return createdCache.get(cacheKey)!;

  const existing = await prisma.set.findFirst({
    where: { code, ...setRegionWhereFor(cardRegion) },
    select: { id: true },
  });
  if (existing) {
    createdCache.set(cacheKey, existing.id);
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
    `  [set][create] code=${code} region=${cardRegion ?? "US"} -> nuevo Set #${created.id} (título temporal, revisar en /admin/sets)`
  );
  createdCache.set(cacheKey, created.id);
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
      sets: { select: { set: { select: { id: true, code: true, region: true } } } },
    },
  });

  console.log(`${dryRun ? "[DRY-RUN] " : ""}${cards.length} cartas de official-sync a revisar\n`);

  const createdCache = new Map<string, number>();
  let cardsFixed = 0;
  let linksMoved = 0;
  let linksSkippedNoCode = 0;
  let setsCreated = 0;
  const setsCreatedBefore = new Set<string>();

  for (const card of cards) {
    let cardTouched = false;
    for (const link of card.sets) {
      const set = link.set;
      if (regionsMatch(card.region, set.region)) continue;

      if (!set.code) {
        linksSkippedNoCode += 1;
        console.log(
          `  [skip][sin código] card #${card.id} (${card.code}) -> set #${set.id} region=${set.region} (no se puede inferir el correcto sin code)`
        );
        continue;
      }

      const cacheKeyBefore = `${set.code}::${card.region ?? "US"}`;
      const hadCache = createdCache.has(cacheKeyBefore);
      const correctSetId = await ensureCorrectSet(
        set.code,
        card.region,
        dryRun,
        createdCache
      );
      if (!hadCache && !setsCreatedBefore.has(cacheKeyBefore) && createdCache.has(cacheKeyBefore)) {
        // Se creó (o resolvió por primera vez) en esta corrida — no afecta el conteo si ya existía.
      }

      if (dryRun) {
        console.log(
          `  [dry-run] card #${card.id} (${card.code}, region=${card.region ?? "US"}) -> quitar set #${set.id} (region=${set.region ?? "US"}), enlazar a code=${set.code} region correcta`
        );
        cardTouched = true;
        linksMoved += 1;
        continue;
      }

      if (!correctSetId) continue;

      await prisma.cardSet.deleteMany({ where: { cardId: card.id, setId: set.id } });
      await prisma.cardSet
        .create({ data: { cardId: card.id, setId: correctSetId } })
        .catch(() => {
          // ya existía el link correcto (carrera con otra carta del mismo code) — no pasa nada
        });

      console.log(
        `  card #${card.id} (${card.code}) : set #${set.id} (${set.region ?? "US"}) -> set #${correctSetId} (${card.region ?? "US"})`
      );
      cardTouched = true;
      linksMoved += 1;
    }
    if (cardTouched) cardsFixed += 1;
  }

  setsCreated = createdCache.size;

  console.log(
    `\n${dryRun ? "[DRY-RUN] " : ""}Resumen: ${cardsFixed} cartas corregidas, ${linksMoved} enlaces movidos, ${linksSkippedNoCode} enlaces sin código (sin tocar), ~${setsCreated} sets resueltos/creados`
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
