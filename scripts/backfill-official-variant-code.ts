#!/usr/bin/env -S npx tsx
//
// Rellena Card.officialVariantCode ("p1"/"p2"/...) para alternas existentes
// que ya tienen esa info, solo que en el lugar equivocado: en `alias` (cuando
// vino de un scraper oficial y nunca se migró) o metida en el nombre de
// archivo de `src` (ej. ".../op06-101_p2.webp") sin haberse guardado nunca en
// un campo estructurado. Esa es la causa real de que /admin/official-sync
// marque como "faltantes" alternas que ya existen.
//
// Idempotente: solo toca filas con officialVariantCode todavía null, así que
// correrlo dos veces la segunda vez no cambia nada (ni pisa valores cargados
// a mano después).
//
// Uso:
//   npx tsx scripts/backfill-official-variant-code.ts --dry-run
//   npx tsx scripts/backfill-official-variant-code.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { inferOfficialVariantCode } from "@/lib/cards/officialVariant";

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const candidates = await prisma.card.findMany({
    where: { baseCardId: { not: null }, officialVariantCode: null },
    select: { id: true, code: true, region: true, baseCardId: true, alias: true, src: true },
  });

  console.log(
    `${dryRun ? "[DRY-RUN] " : ""}${candidates.length} alternas candidatas (officialVariantCode aún null)\n`
  );

  // Detectar colisiones: dos hermanas del mismo baseCardId que resolverían al
  // mismo código -> no escribir ninguna, dejar para revisión manual.
  const inferredByCard = new Map<number, string>();
  const codesByBase = new Map<number, Map<string, number[]>>();

  for (const card of candidates) {
    const inferred = inferOfficialVariantCode(card);
    if (!inferred) continue;
    inferredByCard.set(card.id, inferred);

    const baseId = card.baseCardId as number;
    if (!codesByBase.has(baseId)) codesByBase.set(baseId, new Map());
    const byCode = codesByBase.get(baseId)!;
    if (!byCode.has(inferred)) byCode.set(inferred, []);
    byCode.get(inferred)!.push(card.id);
  }

  const collisionCardIds = new Set<number>();
  for (const byCode of codesByBase.values()) {
    for (const ids of byCode.values()) {
      if (ids.length > 1) ids.forEach((id) => collisionCardIds.add(id));
    }
  }

  let inferredFromAlias = 0;
  let inferredFromSrc = 0;
  let noSignal = 0;
  const sampleLines: string[] = [];
  const collisionLines: string[] = [];

  for (const card of candidates) {
    const inferred = inferredByCard.get(card.id) ?? null;

    if (!inferred) {
      noSignal += 1;
      continue;
    }

    if (collisionCardIds.has(card.id)) {
      collisionLines.push(
        `  COLISIÓN baseCardId=${card.baseCardId} code=${card.code} region=${card.region} id=${card.id} alias="${card.alias}" -> ${inferred} (src=${card.src})`
      );
      continue;
    }

    const fromAlias = /^[pr]\d{1,3}$/i.test((card.alias ?? "").trim());
    if (fromAlias) inferredFromAlias += 1;
    else inferredFromSrc += 1;

    if (sampleLines.length < 40) {
      sampleLines.push(
        `  [${fromAlias ? "alias" : "src"}] ${card.code}#${card.id} region=${card.region} -> officialVariantCode=${inferred}`
      );
    }

    if (!dryRun) {
      await prisma.card.update({
        where: { id: card.id },
        data: { officialVariantCode: inferred },
      });
    }
  }

  console.log(sampleLines.join("\n"));
  if (collisionLines.length) {
    console.log(`\n${collisionLines.length} colisiones (NO se tocan, revisar a mano):`);
    console.log(collisionLines.join("\n"));
  }

  const totalWritten = inferredFromAlias + inferredFromSrc;
  console.log(
    `\n${dryRun ? "[DRY-RUN] " : ""}inferredFromAlias=${inferredFromAlias} inferredFromSrc=${inferredFromSrc} noSignal=${noSignal} collisions=${collisionCardIds.size}`
  );
  console.log(
    `${dryRun ? "[DRY-RUN] " : ""}${totalWritten} filas ${dryRun ? "se actualizarían" : "actualizadas"}`
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
