#!/usr/bin/env -S npx tsx
/**
 * Audita (y opcionalmente limpia) cartas mal linkeadas a un set.
 *
 * Un booster normal tiene un prefijo de código DOMINANTE (OP15, ST26…). Las
 * cartas de otro prefijo ("foráneas") suelen ser links espurios que ensucian el
 * set y distorsionan el EV. Los sets curados (reimpresiones "The Best", promos,
 * anniversary…) SÍ mezclan a propósito, así que se excluyen.
 *
 * SEGURIDAD: solo desvincula una carta foránea si YA está correctamente linkeada
 * a su propio set (mismo prefijo), para no dejarla huérfana.
 *
 *   npx tsx scripts/audit-set-card-links.ts           # dry-run (reporte)
 *   npx tsx scripts/audit-set-card-links.ts --apply    # aplica
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { codePrefix, isCuratedSet } from "../lib/services/ev/boosterEV";

const APPLY = process.argv.includes("--apply");
const DOMINANT_MIN = 0.55; // el prefijo dominante debe ser mayoría clara

async function main() {
  const sets = await prisma.set.findMany({
    select: {
      id: true,
      title: true,
      cards: { select: { cardId: true, card: { select: { code: true } } } },
    },
  });

  // Índice: prefijo → setIds donde ese prefijo es dominante (para saber si una
  // carta foránea tiene "su propio set" a dónde pertenecer).
  const dominantSetsByPrefix = new Map<string, Set<number>>();
  for (const s of sets) {
    if (s.cards.length === 0) continue;
    const byP = new Map<string, number>();
    for (const cs of s.cards) {
      const p = codePrefix(cs.card.code);
      if (p) byP.set(p, (byP.get(p) ?? 0) + 1);
    }
    const dom = Array.from(byP.entries()).sort((a, b) => b[1] - a[1])[0];
    if (dom && dom[1] / s.cards.length >= DOMINANT_MIN) {
      const set = dominantSetsByPrefix.get(dom[0]) ?? new Set<number>();
      set.add(s.id);
      dominantSetsByPrefix.set(dom[0], set);
    }
  }

  let candidateLinks = 0;
  let skippedCurated = 0;
  let skippedNoHome = 0;
  const toRemove: { setId: number; cardId: number }[] = [];
  const report: string[] = [];

  for (const s of sets) {
    if (s.cards.length === 0) continue;
    if (isCuratedSet(s.title)) {
      skippedCurated++;
      continue;
    }
    const byP = new Map<string, number>();
    for (const cs of s.cards) {
      const p = codePrefix(cs.card.code);
      if (p) byP.set(p, (byP.get(p) ?? 0) + 1);
    }
    if (byP.size <= 1) continue;
    const dom = Array.from(byP.entries()).sort((a, b) => b[1] - a[1])[0];
    if (!dom || dom[1] / s.cards.length < DOMINANT_MIN) continue; // set poco dominante → no tocar

    const foreign = s.cards.filter(
      (cs) => codePrefix(cs.card.code) && codePrefix(cs.card.code) !== dom[0]
    );
    if (foreign.length === 0) continue;

    let removedHere = 0;
    for (const cs of foreign) {
      candidateLinks++;
      const p = codePrefix(cs.card.code);
      // ¿La carta tiene "su propio set" (dominante de su prefijo) para no orfanar?
      const homeSets = dominantSetsByPrefix.get(p);
      const cardSetIds = s.cards.length; // no aplica; verificamos por carta abajo
      void cardSetIds;
      if (!homeSets || homeSets.size === 0) {
        skippedNoHome++;
        continue;
      }
      // Confirma que la carta está linkeada a alguno de sus home sets.
      const alsoHome = await prisma.cardSet.count({
        where: { cardId: cs.cardId, setId: { in: Array.from(homeSets) } },
      });
      if (alsoHome === 0) {
        skippedNoHome++;
        continue;
      }
      toRemove.push({ setId: s.id, cardId: cs.cardId });
      removedHere++;
    }
    if (removedHere > 0) {
      report.push(
        `  [${dom[0]} dom=${dom[1]}] ${s.title.slice(0, 40)} → quita ${removedHere} foráneas (${Array.from(
          byP.entries()
        )
          .filter(([k]) => k !== dom[0])
          .map(([k, v]) => `${k}:${v}`)
          .join(",")})`
      );
    }
  }

  console.log(`Sets con cartas: ${sets.filter((s) => s.cards.length).length}`);
  console.log(`Curados omitidos: ${skippedCurated}`);
  console.log(`Links foráneos candidatos: ${candidateLinks}`);
  console.log(
    `  → sin "home set" (NO se tocan, evita huérfanas): ${skippedNoHome}`
  );
  console.log(`  → a desvincular (seguros): ${toRemove.length}`);
  console.log("\nSets afectados:");
  report.slice(0, 40).forEach((r) => console.log(r));
  if (report.length > 40) console.log(`  … y ${report.length - 40} sets más`);

  if (APPLY && toRemove.length) {
    let done = 0;
    for (let i = 0; i < toRemove.length; i += 200) {
      const chunk = toRemove.slice(i, i + 200);
      await prisma.$transaction(
        chunk.map((r) =>
          prisma.cardSet.deleteMany({
            where: { setId: r.setId, cardId: r.cardId },
          })
        )
      );
      done += chunk.length;
    }
    console.log(`\n✅ APLICADO: ${done} links foráneos desvinculados.`);
  } else if (!APPLY) {
    console.log(`\n[DRY-RUN] Corre con --apply para desvincular.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
