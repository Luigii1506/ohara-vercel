export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/products/[id]/cards — las cartas que contiene el producto: como los
 * sellados se linkean a un Set (no a cartas individuales), devolvemos las
 * cartas base US de ese set, con precio.
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
      select: { setId: true, set: { select: { id: true, title: true } } },
    });
    if (!product?.setId) {
      return NextResponse.json({ set: null, cards: [] });
    }
    const cards = await prisma.card.findMany({
      where: {
        sets: { some: { setId: product.setId } },
        isFirstEdition: true,
        OR: [{ region: "US" }, { region: null }],
      },
      select: {
        id: true,
        name: true,
        code: true,
        src: true,
        rarity: true,
        marketPrice: true,
      },
      orderBy: { code: "asc" },
      take: 400,
    });
    return NextResponse.json({ set: product.set, cards });
  } catch (error: any) {
    console.error("[products/cards] failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
