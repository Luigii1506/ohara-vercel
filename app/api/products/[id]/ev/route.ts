export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  computeProductEv,
  bucketOf,
  selectEvPool,
} from "@/lib/services/ev/boosterEV";

/**
 * GET /api/products/[id]/ev — desglose de valor esperado de un producto sellado:
 * EV de la unidad (sobre/caja/case), veredicto vs precio, aporte por rareza y
 * las cartas que más valor aportan (los "chase").
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        productType: true,
        marketPrice: true,
        set: { select: { id: true, title: true } },
      },
    });
    if (!product?.set?.id) {
      return NextResponse.json({ applicable: false, ev: null });
    }

    const cards = await prisma.card.findMany({
      where: {
        sets: { some: { setId: product.set.id } },
        OR: [{ region: "US" }, { region: null }],
      },
      select: {
        id: true,
        name: true,
        code: true,
        rarity: true,
        alternateArt: true,
        marketPrice: true,
        src: true,
      },
    });

    const ev = computeProductEv(
      {
        productType: product.productType,
        name: product.name,
        marketPrice: product.marketPrice as any,
      },
      cards,
      product.set.title
    );

    // Top cartas "chase": del pool real (mismo filtro que el EV), mayor precio.
    const pool = selectEvPool(cards, product.set.title);
    const topCards = pool
      .filter((c) => bucketOf(c) && c.marketPrice != null)
      .map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        rarity: c.rarity,
        alternateArt: c.alternateArt,
        marketPrice: Number(c.marketPrice),
        src: c.src,
      }))
      .sort((a, b) => b.marketPrice - a.marketPrice)
      .slice(0, 8);

    return NextResponse.json({
      product: { id: product.id, name: product.name, set: product.set },
      ...ev,
      topCards,
    });
  } catch (error: any) {
    console.error("[products/ev] failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
