#!/usr/bin/env -S npx tsx
/**
 * Corrige en lote el alternateArt de las cartas alternas US linkeadas a
 * TCGplayer, adoptando la clasificación de TCGplayer SOLO en los casos seguros
 * (categoría "adopt": nuestro valor vacío/genérico, TCGplayer específico).
 *
 * Es la versión de línea de comandos del "Auditor de catálogo", para arreglar
 * las 600+ de una sola pasada contra producción.
 *
 *   npx tsx scripts/fix-alternate-art-from-tcgplayer.ts            # dry-run
 *   npx tsx scripts/fix-alternate-art-from-tcgplayer.ts --apply    # aplica
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import {
  classifyAlternateArt,
  splitDisclaimer,
} from "../lib/services/tcgplayerCardData";

const GENERIC = new Set(["", "alternate art", "full art", "parallel", "manga art"]);
const APPLY = process.argv.includes("--apply");

async function main() {
  const cards = await prisma.card.findMany({
    where: {
      tcgplayerProductId: { not: null },
      isFirstEdition: false,
      OR: [{ region: "US" }, { region: null }],
    },
    select: { id: true, code: true, alternateArt: true, tcgplayerProductId: true },
  });

  const pids = cards
    .map((c) => Number(c.tcgplayerProductId))
    .filter((n) => Number.isFinite(n));

  const prodRows: { productId: number; name: string; description: string | null }[] =
    await prisma.$queryRawUnsafe(
      `SELECT "productId", name,
         (SELECT e->>'value' FROM jsonb_array_elements(metadata->'extendedData') e
          WHERE e->>'name' = 'Description' LIMIT 1) AS description
       FROM "TcgCatalogProduct" WHERE "productId" IN (${pids.join(",")})`
    );
  const pm = new Map(prodRows.map((p) => [p.productId, p]));

  const fixes: { id: number; code: string; from: string; to: string }[] = [];
  let conflict = 0;
  let keep = 0;

  for (const c of cards) {
    const p = pm.get(Number(c.tcgplayerProductId));
    if (!p) continue;
    const { disclaimer } = splitDisclaimer(p.description);
    const tcgAlt = classifyAlternateArt(p.name, disclaimer);
    const our = (c.alternateArt ?? "").trim();
    if (our.toLowerCase() === tcgAlt.toLowerCase()) continue;

    const ourGen = GENERIC.has(our.toLowerCase());
    const tcgGen = GENERIC.has(tcgAlt.toLowerCase());

    let cat: "adopt" | "conflict" | "keep";
    if (ourGen && !tcgGen) cat = "adopt";
    else if (ourGen && tcgGen) cat = our === "" ? "adopt" : "conflict";
    else if (!ourGen && tcgGen) cat = "keep";
    else cat = "conflict";

    if (cat === "adopt") fixes.push({ id: c.id, code: c.code, from: our || "(vacío)", to: tcgAlt });
    else if (cat === "conflict") conflict++;
    else keep++;
  }

  const byTarget = new Map<string, number>();
  for (const f of fixes) byTarget.set(f.to, (byTarget.get(f.to) ?? 0) + 1);

  console.log(`Cartas alternas US linkeadas: ${cards.length}`);
  console.log(`\n🟢 SEGURAS a corregir (adopt): ${fixes.length}`);
  console.log(`🟡 conflictos (no se tocan): ${conflict}`);
  console.log(`⚪ correctas / tú más específico (no se tocan): ${keep}`);
  console.log(`\nPor destino:`);
  Array.from(byTarget.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([alt, n]) => console.log(`  ${String(n).padStart(4)}  → ${alt}`));

  if (!APPLY) {
    console.log(`\n[DRY-RUN] No se aplicó nada. Corre con --apply para aplicar.`);
    console.log(`Muestra:`);
    fixes.slice(0, 10).forEach((f) => console.log(`  ${f.code}: "${f.from}" → "${f.to}"`));
    await prisma.$disconnect();
    return;
  }

  console.log(`\n[APPLY] Aplicando ${fixes.length} correcciones…`);
  let done = 0;
  // En chunks para no saturar el pool de Neon.
  const CHUNK = 100;
  for (let i = 0; i < fixes.length; i += CHUNK) {
    const chunk = fixes.slice(i, i + CHUNK);
    await prisma.$transaction(
      chunk.map((f) =>
        prisma.card.update({ where: { id: f.id }, data: { alternateArt: f.to } })
      )
    );
    done += chunk.length;
    console.log(`  ${done}/${fixes.length}`);
  }
  console.log(`\n✅ Listo: ${done} cartas corregidas.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
