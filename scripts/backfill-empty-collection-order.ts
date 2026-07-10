#!/usr/bin/env -S npx tsx
//
// Rellena collectionOrder para las cartas que lo tienen vacío ("").
//
// Postgres ordena "" primero, así que esas cartas (EB04, ST29, ST30…) aparecían
// arriba en el render del servidor y luego el cliente las reordenaba con
// getCollectionOrderKey → parpadeo. Guardamos EXACTAMENTE la misma clave que
// calcula el cliente para que el orden del servidor y del cliente coincidan.
//
// Uso:
//   npx tsx scripts/backfill-empty-collection-order.ts --dry-run
//   npx tsx scripts/backfill-empty-collection-order.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { getCollectionOrderKey } from "@/lib/cards/sort";
import type { CardWithCollectionData } from "@/types";

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const empties = await prisma.card.findMany({
    where: { collectionOrder: "" },
    select: {
      id: true,
      code: true,
      collectionOrder: true,
      category: true,
      baseCardId: true,
      order: true,
      setCode: true,
    },
  });

  console.log(
    `${dryRun ? "[DRY-RUN] " : ""}${empties.length} cartas con collectionOrder vacío\n`
  );

  let updated = 0;
  for (const card of empties) {
    // getCollectionOrderKey cachea por id; como collectionOrder está vacío,
    // devuelve la clave fallback (prefijo_codigo_sufijo) — la misma que usa el grid.
    const key = getCollectionOrderKey(card as unknown as CardWithCollectionData);
    if (!key || !key.length) continue;

    if (empties.length <= 80) {
      console.log(`  ${card.code} → ${key}`);
    }

    if (!dryRun) {
      await prisma.card.update({
        where: { id: card.id },
        data: { collectionOrder: key },
      });
    }
    updated += 1;
  }

  console.log(
    `\n${dryRun ? "[DRY-RUN] " : ""}${updated} cartas ${dryRun ? "se actualizarían" : "actualizadas"}`
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
