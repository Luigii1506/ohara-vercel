#!/usr/bin/env -S npx tsx
/**
 * Elimina sets sin cartas.
 *
 * Por defecto, solo borra sets "seguros":
 * - 0 cartas
 * - 0 productos ligados
 * - 0 eventos ligados
 *
 * Flags:
 *   npx tsx scripts/delete-empty-sets.ts                 # dry-run
 *   npx tsx scripts/delete-empty-sets.ts --apply         # aplica borrado seguro
 *   npx tsx scripts/delete-empty-sets.ts --include-linked
 *   npx tsx scripts/delete-empty-sets.ts --include-linked --apply
 *
 * `--include-linked` también elimina sets sin cartas aunque sigan ligados a
 * productos/eventos. Prisma hará:
 * - `Product.setId` -> null
 * - `EventSet` rows -> cascade delete
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";

const APPLY = process.argv.includes("--apply");
const INCLUDE_LINKED = process.argv.includes("--include-linked");

type EmptySetSummary = {
  id: number;
  title: string;
  code: string | null;
  region: string | null;
  cards: number;
  products: number;
  events: number;
};

async function main() {
  const sets = await prisma.set.findMany({
    select: {
      id: true,
      title: true,
      code: true,
      region: true,
      _count: {
        select: {
          cards: true,
          products: true,
          events: true,
        },
      },
    },
    orderBy: [{ title: "asc" }, { id: "asc" }],
  });

  const emptySets: EmptySetSummary[] = sets
    .filter((set) => set._count.cards === 0)
    .map((set) => ({
      id: set.id,
      title: set.title,
      code: set.code,
      region: set.region,
      cards: set._count.cards,
      products: set._count.products,
      events: set._count.events,
    }));

  const safeCandidates = emptySets.filter(
    (set) => set.products === 0 && set.events === 0
  );
  const linkedCandidates = emptySets.filter(
    (set) => set.products > 0 || set.events > 0
  );
  const targets = INCLUDE_LINKED ? emptySets : safeCandidates;

  console.log(`Sets totales: ${sets.length}`);
  console.log(`Sets sin cartas: ${emptySets.length}`);
  console.log(`  Seguros para borrar: ${safeCandidates.length}`);
  console.log(`  Vacíos pero ligados: ${linkedCandidates.length}`);

  if (linkedCandidates.length > 0) {
    console.log("\nSets vacíos pero ligados a productos/eventos:");
    linkedCandidates.slice(0, 50).forEach((set) => {
      console.log(
        `  - #${set.id} "${set.title}" code=${set.code ?? "null"} region=${set.region ?? "null"} products=${set.products} events=${set.events}`
      );
    });
    if (linkedCandidates.length > 50) {
      console.log(`  ... y ${linkedCandidates.length - 50} más`);
    }
  }

  if (targets.length === 0) {
    console.log("\nNo hay sets candidatos para borrar.");
    await prisma.$disconnect();
    return;
  }

  console.log(
    `\n${INCLUDE_LINKED ? "Candidatos (incluyendo ligados)" : "Candidatos seguros"}: ${targets.length}`
  );
  targets.slice(0, 100).forEach((set) => {
    console.log(
      `  - #${set.id} "${set.title}" code=${set.code ?? "null"} region=${set.region ?? "null"} products=${set.products} events=${set.events}`
    );
  });
  if (targets.length > 100) {
    console.log(`  ... y ${targets.length - 100} más`);
  }

  if (!APPLY) {
    console.log(
      `\n[DRY-RUN] Corre con --apply para borrar ${targets.length} set(s).`
    );
    if (linkedCandidates.length > 0 && !INCLUDE_LINKED) {
      console.log(
        'Usa --include-linked si también quieres borrar sets vacíos que sigan ligados a productos/eventos.'
      );
    }
    await prisma.$disconnect();
    return;
  }

  const ids = targets.map((set) => set.id);
  const deleted = await prisma.set.deleteMany({
    where: {
      id: { in: ids },
    },
  });

  console.log(
    `\n✅ APLICADO: ${deleted.count} set(s) eliminado(s)${
      INCLUDE_LINKED ? " (incluyendo ligados)" : ""
    }.`
  );

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
