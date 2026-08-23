#!/usr/bin/env -S npx tsx
//
// Los Sets creados automáticamente por ensureSet() antes de este fix
// quedaron con título = code pelado (ej. "OP15" en vez de "ブースターパック
// 神の島の冒険【OP-15】"). El nombre real ya está guardado en
// OfficialSyncItem.seriesLabel para cada code/región — este script lo usa
// para corregir el título de esos Sets placeholder.
//
// Uso:
//   npx tsx scripts/backfill-official-set-titles.ts --dry-run
//   npx tsx scripts/backfill-official-set-titles.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const sets = await prisma.set.findMany({
    where: { code: { not: null } },
    select: { id: true, title: true, code: true, region: true },
  });

  const placeholders = sets.filter((s) => s.title === s.code);
  console.log(`${dryRun ? "[DRY-RUN] " : ""}${placeholders.length} sets con título = code (candidatos)\n`);

  let fixed = 0;
  let noLabel = 0;

  let fromContamination = 0;

  for (const set of placeholders) {
    // OfficialSyncItem.region es NOT NULL — guarda la región ESCANEADA
    // (cfg.region), no la región real de la carta. Un Set con region=null
    // (US) solo puede venir de EN (única fuente cuyo cardRegion mapea a
    // US) — no existe un OfficialSyncItem con region="US" literal.
    const itemRegion = set.region ?? "EN";
    //
    // Preferir isAlternate=false: un código puede aparecer como inserto
    // promocional suelto dentro de la página de OTRA serie (ej. una carta
    // "OP01" de bonus en el starter deck "ST-31") — esa fila guarda el
    // seriesLabel de LA PÁGINA DONDE SE SCRAPEÓ, no la dueña real del
    // código. La carta BASE (no alterna) casi siempre viene de la página
    // propia y dedicada del código, así que es la señal confiable.
    const baseItem = await prisma.officialSyncItem.findFirst({
      where: {
        setCode: set.code!,
        region: itemRegion,
        seriesLabel: { not: null },
        isAlternate: false,
      },
      select: { seriesLabel: true },
    });
    const item =
      baseItem ??
      (await prisma.officialSyncItem.findFirst({
        where: { setCode: set.code!, region: itemRegion, seriesLabel: { not: null } },
        select: { seriesLabel: true },
      }));
    if (!item?.seriesLabel) {
      noLabel += 1;
      console.log(`  [sin label] set #${set.id} code=${set.code} region=${set.region ?? "US"}`);
      continue;
    }
    if (!baseItem) {
      // Sin la carta BASE propia no hay señal confiable — el único label
      // disponible viene de una alterna que se coló en OTRA serie (bonus
      // de un booster/starter deck distinto). Mejor dejarlo con el código
      // como título (revisar a mano en /admin/sets) que adivinar mal.
      fromContamination += 1;
      console.log(
        `  [sin base propia, no se toca] set #${set.id} "${set.title}" — único label disponible: "${item.seriesLabel}" (de una alterna, no confiable)`
      );
      continue;
    }
    console.log(`  set #${set.id} "${set.title}" -> "${item.seriesLabel}"`);
    if (!dryRun) {
      await prisma.set.update({ where: { id: set.id }, data: { title: item.seriesLabel } });
    }
    fixed += 1;
  }

  console.log(
    `\n${dryRun ? "[DRY-RUN] " : ""}${fixed} títulos corregidos (${fromContamination} desde una alterna, revisar), ${noLabel} sin label disponible`
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
