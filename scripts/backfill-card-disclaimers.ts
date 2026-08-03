#!/usr/bin/env -S npx tsx
/**
 * Backfill de Card.disclaimer desde el Description del producto de TCGplayer
 * (mirror TcgCatalogProduct). El disclaimer (pre-errata / no legal / reprint)
 * viene DENTRO del Description; splitDisclaimer lo separa.
 *
 *   npx tsx scripts/backfill-card-disclaimers.ts           # dry-run
 *   npx tsx scripts/backfill-card-disclaimers.ts --apply    # aplica
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { splitDisclaimer } from "../lib/services/tcgplayerCardData";

const APPLY = process.argv.includes("--apply");

async function main() {
  const prods = await prisma.tcgCatalogProduct.findMany({
    where: { linkedCardId: { not: null } },
    select: { name: true, metadata: true, linkedCardId: true },
  });

  let found = 0;
  let updated = 0;
  const samples: string[] = [];

  for (const p of prods) {
    const desc =
      (p.metadata as any)?.extendedData?.find(
        (e: any) => e.name === "Description"
      )?.value ?? null;
    const { disclaimer } = splitDisclaimer(desc);
    if (!disclaimer || !p.linkedCardId) continue;
    found++;

    const card = await prisma.card.findUnique({
      where: { id: p.linkedCardId },
      select: { id: true, code: true, disclaimer: true },
    });
    if (!card) continue;
    if (card.disclaimer === disclaimer) continue; // ya está

    if (samples.length < 6)
      samples.push(`${card.code}: ${disclaimer.slice(0, 60)}…`);
    updated++;
    if (APPLY) {
      await prisma.card.update({
        where: { id: card.id },
        data: { disclaimer },
      });
    }
  }

  console.log(`Productos linkeados: ${prods.length}`);
  console.log(`Con disclaimer detectable: ${found}`);
  console.log(`${APPLY ? "✅ Cartas actualizadas" : "[DRY-RUN] a actualizar"}: ${updated}`);
  samples.forEach((s) => console.log("  ", s));
  if (!APPLY) console.log("\nCorre con --apply para aplicar.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
