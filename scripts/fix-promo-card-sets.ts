#!/usr/bin/env -S npx tsx
/**
 * Política de sets para cartas promo (grupo TCGplayer "One Piece Promotion
 * Cards", gid 17675):
 *   - Set PRINCIPAL = el pack/playmat real del paréntesis del nombre.
 *   - Set SECUNDARIO = "One Piece Promotion Cards" (umbrella, para browsing).
 *
 * Este script deja la base así, de forma idempotente:
 *   (a) cartas que quedaron SOLO en el umbrella genérico → les crea/asigna su
 *       pack real como principal (sin borrar el umbrella).
 *   (b) TODAS las cartas promo → se aseguran de estar también en el umbrella.
 * No re-deriva packs de cartas que ya tienen un set específico (evita duplicar).
 *
 *   npx tsx scripts/fix-promo-card-sets.ts           # dry-run
 *   npx tsx scripts/fix-promo-card-sets.ts --apply    # aplica
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { extractPromoPack } from "../lib/services/tcgplayerCardData";

const APPLY = process.argv.includes("--apply");
const UMBRELLA = "One Piece Promotion Cards";
const PROMO_GID = 17675;

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
  const umbrellaId = APPLY ? await findOrCreateSet(UMBRELLA) : -273;

  // Productos promo linkeados (gid 17675).
  const prods = await prisma.tcgCatalogProduct.findMany({
    where: { linkedCardId: { not: null } },
    select: { name: true, linkedCardId: true, metadata: true },
  });
  const promo = prods.filter((p) => (p.metadata as any)?.groupId === PROMO_GID);
  const packByCard = new Map<number, string>();
  const cardIds = new Set<number>();
  for (const p of promo) {
    const cid = p.linkedCardId!;
    cardIds.add(cid);
    const pack = extractPromoPack(p.name);
    if (pack && !packByCard.has(cid)) packByCard.set(cid, pack);
  }
  console.log(`Cartas promo (gid ${PROMO_GID}): ${cardIds.size}`);

  // Links actuales de esas cartas (título del set) en un solo query por lotes.
  const ids = Array.from(cardIds);
  const linksByCard = new Map<number, { setId: number; title: string }[]>();
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const rows = await prisma.cardSet.findMany({
      where: { cardId: { in: chunk } },
      select: { cardId: true, setId: true, set: { select: { title: true } } },
    });
    for (const r of rows) {
      const arr = linksByCard.get(r.cardId) ?? [];
      arr.push({ setId: r.setId, title: r.set.title });
      linksByCard.set(r.cardId, arr);
    }
  }

  const genericIds = new Set<number>();
  const g = await prisma.set.findMany({
    where: { title: { equals: UMBRELLA, mode: "insensitive" } },
    select: { id: true },
  });
  g.forEach((s) => genericIds.add(s.id));

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  const packSetCache = new Map<string, number>();
  let assignedPack = 0;
  let addedUmbrella = 0;
  const umbrellaToCreate: { cardId: number; setId: number }[] = [];

  for (const cid of ids) {
    const links = linksByCard.get(cid) ?? [];
    const titles = links.map((l) => l.title);
    const specific = links.filter((l) => !genericIds.has(l.setId));

    // (a) Solo en el umbrella genérico (sin set específico) → asignar el pack.
    const pack = packByCard.get(cid);
    if (specific.length === 0 && pack) {
      const key = norm(pack);
      let psid = packSetCache.get(key);
      if (psid == null) {
        psid = APPLY ? await findOrCreateSet(pack) : -1;
        packSetCache.set(key, psid);
      }
      assignedPack++;
      if (APPLY) {
        const exists = await prisma.cardSet.findFirst({
          where: { cardId: cid, setId: psid },
          select: { id: true },
        });
        if (!exists) await prisma.cardSet.create({ data: { cardId: cid, setId: psid } });
      }
    }

    // (b) Asegurar el umbrella secundario.
    const hasUmbrella = links.some((l) => genericIds.has(l.setId));
    if (!hasUmbrella) {
      addedUmbrella++;
      if (APPLY) umbrellaToCreate.push({ cardId: cid, setId: umbrellaId });
    }
    void titles;
  }

  if (APPLY && umbrellaToCreate.length) {
    for (let i = 0; i < umbrellaToCreate.length; i += 500) {
      await prisma.cardSet.createMany({ data: umbrellaToCreate.slice(i, i + 500) });
    }
  }

  console.log(`\n${APPLY ? "✅ APLICADO" : "[DRY-RUN]"}`);
  console.log(`  Pack asignado (estaban solo en genérico): ${assignedPack}`);
  console.log(`  Umbrella secundario agregado: ${addedUmbrella}`);
  if (!APPLY) console.log(`\nCorre con --apply para aplicar.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
