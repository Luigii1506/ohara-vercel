#!/usr/bin/env -S npx tsx
//
// Normaliza Card.rarity para las filas que quedaron con el código crudo de
// TCGplayer ("R", "SR", "PR"...) en vez del nombre completo ("Rare",
// "Super Rare", "Promo"...). Bug: app/api/admin/catalog-gaps/us-alternates/
// create/route.ts copiaba prod.rarity (TcgCatalogProduct, espejo crudo de
// TCGplayer) directo a Card.rarity sin pasar por el RARITY_MAP que sí usa
// el otro camino de creación (parseTcgCard). Ya arreglado hacia adelante;
// este script solo corrige las filas existentes.
//
// Uso:
//   npx tsx scripts/backfill-rarity-labels.ts --dry-run
//   npx tsx scripts/backfill-rarity-labels.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { RARITY_MAP } from "@/lib/services/tcgplayerCardData";

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const codes = Object.keys(RARITY_MAP);
  const rows = await prisma.card.findMany({
    where: { rarity: { in: codes } },
    select: { id: true, code: true, rarity: true },
  });

  console.log(`${dryRun ? "[DRY-RUN] " : ""}${rows.length} cartas con rarity abreviado\n`);

  const byRarity = new Map<string, number>();
  for (const r of rows) {
    const key = r.rarity as string;
    byRarity.set(key, (byRarity.get(key) ?? 0) + 1);
  }
  byRarity.forEach((count, code) => console.log(`  ${code} -> ${RARITY_MAP[code]}: ${count}`));

  if (!dryRun) {
    for (const [code, label] of Object.entries(RARITY_MAP)) {
      const res = await prisma.card.updateMany({
        where: { rarity: code },
        data: { rarity: label },
      });
      if (res.count) console.log(`Actualizadas ${res.count} de "${code}" -> "${label}"`);
    }
  }

  console.log(`\n${dryRun ? "[DRY-RUN] " : ""}${rows.length} filas ${dryRun ? "se actualizarían" : "actualizadas"}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
