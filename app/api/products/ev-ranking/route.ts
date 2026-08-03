export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeProductEv } from "@/lib/services/ev/boosterEV";

/**
 * GET /api/products/ev-ranking — ranking de sellados por valor esperado.
 * Calcula el EV de cada producto "abrible" (booster/display/premium box) y lo
 * ordena por margen (EV vs precio). Base de la vista "¿Vale la pena?".
 */
const EV_TYPES = ["BOOSTER", "DISPLAY_BOX", "PREMIUM_BOOSTER_BOX"];

export async function GET(_req: NextRequest) {
  try {
    const products = await prisma.product.findMany({
      where: {
        productType: { in: EV_TYPES as any },
        setId: { not: null },
        marketPrice: { not: null },
        isArchived: false,
      },
      select: {
        id: true,
        name: true,
        productType: true,
        imageUrl: true,
        thumbnailUrl: true,
        marketPrice: true,
        priceCurrency: true,
        tcgUrl: true,
        set: { select: { id: true, title: true } },
      },
    });

    const setIds = Array.from(
      new Set(products.map((p) => p.set?.id).filter((v): v is number => !!v))
    );

    // Un solo query de cartas para todos los sets involucrados.
    const cards = setIds.length
      ? await prisma.card.findMany({
          where: {
            sets: { some: { setId: { in: setIds } } },
            OR: [{ region: "US" }, { region: null }],
          },
          select: {
            code: true,
            rarity: true,
            alternateArt: true,
            marketPrice: true,
            sets: { select: { setId: true } },
          },
        })
      : [];

    const cardsBySet = new Map<number, any[]>();
    for (const c of cards) {
      for (const s of c.sets) {
        if (!setIds.includes(s.setId)) continue;
        const arr = cardsBySet.get(s.setId) ?? [];
        arr.push(c);
        cardsBySet.set(s.setId, arr);
      }
    }

    const items = products
      .map((p) => {
        const pool = p.set?.id ? cardsBySet.get(p.set.id) ?? [] : [];
        if (!pool.length) return null;
        const ev = computeProductEv(
          {
            productType: p.productType,
            name: p.name,
            marketPrice: p.marketPrice as any,
          },
          pool,
          p.set?.title
        );
        if (!ev.applicable || ev.ev == null || ev.price == null) return null;
        return {
          id: p.id,
          name: p.name,
          productType: p.productType,
          imageUrl: p.imageUrl,
          thumbnailUrl: p.thumbnailUrl,
          tcgUrl: p.tcgUrl,
          set: p.set,
          price: ev.price,
          ev: ev.ev,
          evPack: ev.evPack,
          unit: ev.unit,
          marginPct: ev.marginPct,
          verdict: ev.verdict,
          priceCurrency: p.priceCurrency ?? "USD",
        };
      })
      .filter(Boolean) as any[];

    // Guard anti-artefactos: ningún sellado real vale >10x su precio. Un margen
    // absurdo indica un set especial (illustration/premium con todo hits) donde
    // el modelo de tasas estándar no aplica. Se excluyen del ranking.
    const OUTLIER_MARGIN = 900; // +900% = 10x
    const clean = items.filter((i) => (i.marginPct ?? 0) <= OUTLIER_MARGIN);
    const hiddenOutliers = items.length - clean.length;

    clean.sort((a, b) => (b.marginPct ?? -999) - (a.marginPct ?? -999));

    const oro = clean.filter((i) => i.verdict === "oro").length;
    return NextResponse.json({
      items: clean,
      total: clean.length,
      oro,
      hiddenOutliers,
    });
  } catch (error: any) {
    console.error("[ev-ranking] failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
