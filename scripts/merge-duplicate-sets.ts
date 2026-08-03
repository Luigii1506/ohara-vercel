#!/usr/bin/env -S npx tsx
/**
 * Fusiona sets duplicados (mismo título normalizado). Por cada grupo elige el
 * canónico (con code > más cartas > id menor) y mueve al canónico las cartas
 * (CardSet), productos (Product.setId) y eventos (EventSet) de los duplicados,
 * dedupeando, luego borra el duplicado. También hace trim de los títulos.
 *
 *   npx tsx scripts/merge-duplicate-sets.ts           # dry-run
 *   npx tsx scripts/merge-duplicate-sets.ts --apply    # aplica
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";

const APPLY = process.argv.includes("--apply");
const norm = (s: string) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

async function main() {
  const sets = await prisma.set.findMany({
    select: { id: true, title: true, code: true, _count: { select: { cards: true } } },
  });

  const groups = new Map<string, typeof sets>();
  for (const s of sets) {
    const k = norm(s.title);
    const a = groups.get(k) ?? [];
    a.push(s);
    groups.set(k, a);
  }

  const dupGroups = Array.from(groups.values()).filter((v) => v.length > 1);
  console.log(`Grupos duplicados: ${dupGroups.length}`);

  let merged = 0;
  let movedCards = 0;
  let movedProducts = 0;

  for (const group of dupGroups) {
    // Canónico: con code, luego más cartas, luego id menor.
    const keep = [...group].sort(
      (a, b) =>
        (b.code ? 1 : 0) - (a.code ? 1 : 0) ||
        b._count.cards - a._count.cards ||
        a.id - b.id
    )[0];
    const dups = group.filter((s) => s.id !== keep.id);
    console.log(
      `\n"${keep.title.trim()}" → keep #${keep.id} (code=${keep.code ?? "null"}, ${keep._count.cards} cartas)`
    );

    for (const dup of dups) {
      console.log(`  merge #${dup.id} (${dup._count.cards} cartas) → #${keep.id}`);
      if (!APPLY) {
        merged++;
        continue;
      }

      // CardSet: mover, dedupeando (CardSet no tiene unique, evitamos redundancia).
      const dupCardSets = await prisma.cardSet.findMany({ where: { setId: dup.id } });
      const keepCardIds = new Set(
        (await prisma.cardSet.findMany({ where: { setId: keep.id }, select: { cardId: true } })).map(
          (r) => r.cardId
        )
      );
      for (const cs of dupCardSets) {
        if (keepCardIds.has(cs.cardId)) {
          await prisma.cardSet.delete({ where: { id: cs.id } });
        } else {
          await prisma.cardSet.update({ where: { id: cs.id }, data: { setId: keep.id } });
          keepCardIds.add(cs.cardId);
          movedCards++;
        }
      }

      // Product.setId
      const upd = await prisma.product.updateMany({ where: { setId: dup.id }, data: { setId: keep.id } });
      movedProducts += upd.count;

      // EventSet: dedupe por PK compuesta.
      const dupEventSets = await prisma.eventSet.findMany({ where: { setId: dup.id } });
      const keepEventIds = new Set(
        (await prisma.eventSet.findMany({ where: { setId: keep.id }, select: { eventId: true } })).map(
          (r) => r.eventId
        )
      );
      for (const es of dupEventSets) {
        if (keepEventIds.has(es.eventId)) {
          await prisma.eventSet.delete({ where: { eventId_setId: { eventId: es.eventId, setId: dup.id } } });
        } else {
          await prisma.eventSet.update({
            where: { eventId_setId: { eventId: es.eventId, setId: dup.id } },
            data: { setId: keep.id },
          });
          keepEventIds.add(es.eventId);
        }
      }

      await prisma.set.delete({ where: { id: dup.id } });
      merged++;
    }

    // Trim del título canónico.
    if (APPLY && keep.title !== keep.title.trim()) {
      await prisma.set.update({ where: { id: keep.id }, data: { title: keep.title.trim() } });
    }
  }

  console.log(
    `\n${APPLY ? "✅ APLICADO" : "[DRY-RUN]"}: ${merged} sets fusionados` +
      (APPLY ? `, ${movedCards} cartas y ${movedProducts} productos movidos` : "")
  );
  if (!APPLY) console.log("Corre con --apply para aplicar.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
