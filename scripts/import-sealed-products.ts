#!/usr/bin/env -S npx tsx
/**
 * Importa los productos SELLADOS del mirror de TCGplayer (TcgCatalogProduct
 * isSealed) a nuestro modelo Product: clasifica el tipo desde el nombre, linkea
 * el set (por el nombre del grupo de TCGplayer) y trae el precio.
 *
 * Idempotente: upsert por tcgplayerProductId, y deja el TcgCatalogProduct
 * linkeado (linkedProductId).
 *
 *   npx tsx scripts/import-sealed-products.ts           # dry-run
 *   npx tsx scripts/import-sealed-products.ts --apply    # aplica
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import {
  tcgplayerFetch,
  getTcgplayerProductPricing,
} from "../lib/services/tcgplayerClient";
import type { ProductType } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const norm = (s: string) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

/** Clasifica el ProductType desde el nombre del sellado. */
function classifyType(name: string): ProductType {
  const s = name.toLowerCase();
  if (/playmat/.test(s)) return "PLAYMAT";
  if (/sleeve/.test(s)) return "SLEEVE";
  if (/deck box/.test(s)) return "DECK_BOX";
  if (/storage/.test(s)) return "STORAGE_BOX";
  if (/tin/.test(s)) return "TIN_PACK";
  if (/uncut sheet/.test(s)) return "UNCUT_SHEET";
  if (/devil fruit/.test(s)) return "DEVIL_FRUIT";
  if (/premium card collection/.test(s)) return "PREMIUM_CARD_COLLECTION";
  if (/premium booster/.test(s)) return "PREMIUM_BOOSTER_BOX";
  if (/anniversary/.test(s)) return "ANNIVERSARY_SET";
  if (/double pack/.test(s)) return "DOUBLE_PACK";
  if (/gift collection|collection|collector/.test(s)) return "COLLECTORS_SET";
  if (/starter deck/.test(s)) return "STARTER_DECK";
  if (
    /release event|promotion pack|tournament pack|promo pack|dash pack|winner pack|finalist pack|championship pack|entry pack|welcome pack|event pack|gift collection|regional/.test(
      s
    )
  )
    return "PROMO_PACK";
  if (/booster box|display|box case|booster case|\bcase\b/.test(s)) return "DISPLAY_BOX";
  if (/booster pack|booster/.test(s)) return "BOOSTER";
  if (/starter|deck/.test(s)) return "DECK";
  return "OTHER";
}

async function main() {
  const sealed = await prisma.tcgCatalogProduct.findMany({
    where: { isSealed: true, productStatus: "active" },
    select: { productId: true, name: true, url: true, metadata: true, linkedProductId: true },
  });
  console.log(`Sellados en el mirror: ${sealed.length}`);

  // Mapa groupId → nombre (del catálogo de grupos de TCGplayer).
  const groupName = new Map<number, string>();
  let offset = 0;
  while (true) {
    const res: any = await tcgplayerFetch(
      `/catalog/categories/68/groups?limit=100&offset=${offset}`
    );
    const results = res?.results ?? res?.Results ?? [];
    for (const g of results) groupName.set(g.groupId, g.name);
    if (results.length < 100) break;
    offset += 100;
  }
  console.log(`Grupos TCGplayer: ${groupName.size}`);

  // Mapa nombre-de-set normalizado → setId (nuestros sets).
  const sets = await prisma.set.findMany({ select: { id: true, title: true } });
  const setByName = new Map<string, number>();
  for (const s of sets) setByName.set(norm(s.title), s.id);

  // Precios en lote.
  const pids = sealed.map((s) => s.productId);
  const priceMap = new Map<number, any>();
  for (let i = 0; i < pids.length; i += 100) {
    const chunk = pids.slice(i, i + 100);
    try {
      const pricing = await getTcgplayerProductPricing(chunk);
      for (const e of pricing as any[]) {
        const prev = priceMap.get(e.productId);
        if (!prev || (e.marketPrice != null && prev.marketPrice == null))
          priceMap.set(e.productId, e);
      }
    } catch (e) {
      console.warn("pricing chunk falló:", (e as Error).message);
    }
  }
  console.log(`Con precio: ${priceMap.size}`);

  let created = 0;
  let updated = 0;
  let linkedSet = 0;
  const byType = new Map<string, number>();

  for (const s of sealed) {
    const gid = (s.metadata as any)?.groupId as number | undefined;
    const gname = gid ? groupName.get(gid) : undefined;
    const setId = gname ? setByName.get(norm(gname)) ?? null : null;
    const type = classifyType(s.name);
    byType.set(type, (byType.get(type) ?? 0) + 1);
    if (setId) linkedSet++;

    const price = priceMap.get(s.productId);
    const data = {
      name: s.name,
      productType: type,
      imageUrl: `https://tcgplayer-cdn.tcgplayer.com/product/${s.productId}_in_1000x1000.jpg`,
      setId,
      tcgUrl: s.url ?? `https://www.tcgplayer.com/product/${s.productId}`,
      tcgplayerProductId: String(s.productId),
      tcgplayerLinkStatus: true,
      marketPrice: price?.marketPrice ?? price?.midPrice ?? null,
      lowPrice: price?.lowPrice ?? null,
      highPrice: price?.highPrice ?? price?.directLowPrice ?? null,
      priceCurrency: "USD",
      priceUpdatedAt: price ? new Date() : null,
    };

    if (!APPLY) {
      const exists = await prisma.product.findUnique({
        where: { tcgplayerProductId: String(s.productId) },
        select: { id: true },
      });
      exists ? updated++ : created++;
      continue;
    }

    const prod = await prisma.product.upsert({
      where: { tcgplayerProductId: String(s.productId) },
      update: data,
      create: data,
      select: { id: true },
    });
    await prisma.tcgCatalogProduct.update({
      where: { productId: s.productId },
      data: { linkedProductId: prod.id },
    });
    created++; // (upsert: contamos como procesado)
  }

  console.log(`\n${APPLY ? "✅ APLICADO" : "[DRY-RUN]"}`);
  console.log(`  Productos procesados: ${sealed.length} | con set linkeado: ${linkedSet}`);
  console.log(`  Por tipo:`, Array.from(byType.entries()).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join("  "));
  if (!APPLY) console.log(`\nCorre con --apply para importar.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
