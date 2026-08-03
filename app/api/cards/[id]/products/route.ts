export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/cards/[id]/products — "¿de qué booster/producto sale esta carta?"
 *
 * No hay link directo carta↔producto (ProductCard está vacío); el vínculo real
 * es por Set: los productos sellados cuyo `setId` coincide con algún set de la
 * carta son los que la contienen. Se priorizan los tipos "abribles" (booster,
 * display, starter deck…) sobre accesorios (sleeves, playmats).
 */
const OPENABLE_TYPES = new Set([
  "BOOSTER",
  "DISPLAY_BOX",
  "STARTER_DECK",
  "DECK",
  "PREMIUM_BOOSTER_BOX",
  "PREMIUM_CARD_COLLECTION",
  "ANNIVERSARY_SET",
  "PROMO_PACK",
  "DOUBLE_PACK",
  "COLLECTORS_SET",
  "TIN_PACK",
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }

    const card = await prisma.card.findUnique({
      where: { id },
      select: { id: true, sets: { select: { setId: true } } },
    });
    if (!card) {
      return NextResponse.json({ error: "Carta no encontrada" }, { status: 404 });
    }

    const setIds = card.sets.map((s) => s.setId);
    if (setIds.length === 0) {
      return NextResponse.json({ products: [] });
    }

    const products = await prisma.product.findMany({
      where: { setId: { in: setIds }, isArchived: false },
      select: {
        id: true,
        name: true,
        productType: true,
        imageUrl: true,
        thumbnailUrl: true,
        marketPrice: true,
        priceCurrency: true,
        tcgUrl: true,
      },
      orderBy: [{ marketPrice: { sort: "desc", nulls: "last" } }],
    });

    // Los "abribles" primero (de ahí sale la carta), luego el resto.
    const ranked = products.sort((a, b) => {
      const ao = OPENABLE_TYPES.has(a.productType) ? 0 : 1;
      const bo = OPENABLE_TYPES.has(b.productType) ? 0 : 1;
      return ao - bo;
    });

    return NextResponse.json({ products: ranked });
  } catch (error: any) {
    console.error("[cards/products] failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
