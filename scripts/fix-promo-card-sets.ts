#!/usr/bin/env -S npx tsx
/**
 * Reclasifica las cartas promo que quedaron en el set genérico "One Piece
 * Promotion Cards" hacia su PACK real (del paréntesis del nombre del producto
 * TCGplayer), para poder ligarlas a su sobre (precios/EV por sobre).
 *
 * Mueve el link del set genérico al pack (crea el pack si no existe). Las cartas
 * sin producto/pack se dejan como están.
 *
 *   npx tsx scripts/fix-promo-card-sets.ts           # dry-run
 *   npx tsx scripts/fix-promo-card-sets.ts --apply    # aplica
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { extractPromoPack } from "../lib/services/tcgplayerCardData";

const APPLY = process.argv.includes("--apply");

async function findOrCreateSet(title: string): Promise<number> {
  const t = title.trim();
  const found = await prisma.set.findMany({
    where: { title: { contains: t, mode: "insensitive" } },
    select: { id: true, title: true },
  });
  const m = found.find((s) => s.title.trim().toLowerCase() === t.toLowerCase());
  if (m) return m.id;
  const created = await prisma.set.create({
    data: { title: t, image: "", code: null, releaseDate: new Date(), isOpen: false },
    select: { id: true },
  });
  return created.id;
}

async function main() {
  // Sets genéricos de promoción a vaciar.
  const generic = await prisma.set.findMany({
    where: {
      OR: [
        { title: { equals: "One Piece Promotion Cards", mode: "insensitive" } },
        { title: { equals: "One Piece Promotional Cards", mode: "insensitive" } },
      ],
    },
    select: { id: true, title: true },
  });
  const genericIds = generic.map((s) => s.id);
  console.log(
    "Sets genéricos:",
    generic.map((s) => `[${s.id}] ${s.title}`).join(", ") || "ninguno"
  );
  if (!genericIds.length) return;

  const cards = await prisma.card.findMany({
    where: { sets: { some: { setId: { in: genericIds } } } },
    select: { id: true, code: true, tcgplayerProductId: true },
  });
  console.log(`Cartas en set(s) genérico(s): ${cards.length}`);

  let moved = 0;
  let noProduct = 0;
  let noPack = 0;
  const setCache = new Map<string, number>();

  for (const c of cards) {
    if (!c.tcgplayerProductId) {
      noProduct++;
      continue;
    }
    const prod = await prisma.tcgCatalogProduct.findUnique({
      where: { productId: Number(c.tcgplayerProductId) },
      select: { name: true },
    });
    const pack = extractPromoPack(prod?.name ?? null);
    if (!pack) {
      noPack++;
      continue;
    }

    let packSetId = setCache.get(pack.toLowerCase());
    if (packSetId == null) {
      packSetId = APPLY
        ? await findOrCreateSet(pack)
        : -1; // dry-run: no crea
      setCache.set(pack.toLowerCase(), packSetId);
    }

    console.log(`  ${c.code.padEnd(10)} genérico → "${pack}"`);
    moved++;

    if (APPLY) {
      // Crea el link al pack (si no existe) y borra el link genérico.
      // CardSet no tiene unique compuesto: verificamos a mano.
      const exists = await prisma.cardSet.findFirst({
        where: { cardId: c.id, setId: packSetId },
        select: { id: true },
      });
      if (!exists) {
        await prisma.cardSet.create({
          data: { cardId: c.id, setId: packSetId },
        });
      }
      await prisma.cardSet.deleteMany({
        where: { cardId: c.id, setId: { in: genericIds } },
      });
    }
  }

  console.log(`\n${APPLY ? "✅ APLICADO" : "[DRY-RUN]"}`);
  console.log(`  Reclasificadas al pack: ${moved}`);
  console.log(`  Sin producto TCGplayer (se dejan): ${noProduct}`);
  console.log(`  Sin pack en el nombre (se dejan): ${noPack}`);
  if (!APPLY) console.log(`\nCorre con --apply para aplicar.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
