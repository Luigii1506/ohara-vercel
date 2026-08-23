#!/usr/bin/env -S npx tsx
//
// Rellena Set.code para los Sets region="CN" que nunca lo tuvieron —
// se parsea del corchete 【...】 en el título (ej. "补充包 传说的强者【OPC-08】"
// -> "OPC08"). Sin esto, scrape-onepiece-cardlist-cn.ts --link-by-card-setcode
// no puede resolver ningún Set por código.
//
// Idempotente: solo toca filas con code todavía null.
//
// Uso:
//   npx tsx scripts/backfill-cn-set-code.ts --dry-run
//   npx tsx scripts/backfill-cn-set-code.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const sets = await prisma.set.findMany({
    where: { region: "CN", code: null },
    select: { id: true, title: true },
    orderBy: { id: "asc" },
  });

  console.log(
    `${dryRun ? "[DRY-RUN] " : ""}${sets.length} sets CN candidatos (code aún null)\n`
  );

  let updated = 0;
  let noBracket = 0;

  for (const set of sets) {
    const match = set.title.match(/[\[【]([^\]】]+)[\]】]/);
    if (!match) {
      console.log(`  [sin corchete] #${set.id} "${set.title}"`);
      noBracket += 1;
      continue;
    }
    const code = match[1].trim().toUpperCase().replace(/-/g, "");
    console.log(`  #${set.id} "${set.title}" -> code=${code}`);
    if (!dryRun) {
      await prisma.set.update({ where: { id: set.id }, data: { code } });
    }
    updated += 1;
  }

  console.log(
    `\n${dryRun ? "[DRY-RUN] " : ""}${updated} sets ${dryRun ? "se actualizarían" : "actualizados"}, ${noBracket} sin corchete (sin tocar)`
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
