export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const decimalOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Prisma.Decimal) return value;
  if (typeof value === "string" || typeof value === "number") {
    if (Number.isNaN(Number(value))) return null;
    return new Prisma.Decimal(value);
  }
  return null;
};

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cardId = Number(params.id);
  if (!Number.isFinite(cardId) || cardId <= 0) {
    return NextResponse.json(
      { error: "Invalid card id" },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const { productId, tcgUrl, pricing, currency } = body ?? {};
    if (!productId || !Number.isFinite(Number(productId))) {
      return NextResponse.json(
        { error: "productId is required" },
        { status: 400 }
      );
    }

    const card = await prisma.card.findUnique({ where: { id: cardId } });
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const now = new Date();
    const data: Prisma.CardUpdateInput = {
      tcgplayerProductId: String(productId),
      tcgUrl: tcgUrl ?? card.tcgUrl ?? null,
    };

    if (pricing) {
      data.marketPrice = decimalOrNull(pricing.marketPrice);
      data.lowPrice = decimalOrNull(pricing.lowPrice);
      data.highPrice = decimalOrNull(pricing.highPrice);
      data.priceCurrency = currency || "USD";
      data.priceUpdatedAt = pricing.priceUpdatedAt
        ? new Date(pricing.priceUpdatedAt)
        : now;
    }

    const updated = await prisma.card.update({
      where: { id: cardId },
      data,
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("[admin/cards/[id]/tcgplayer] POST error:", error);
    return NextResponse.json(
      { error: "Failed to link TCGplayer product" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cardId = Number(params.id);
  if (!Number.isFinite(cardId) || cardId <= 0) {
    return NextResponse.json(
      { error: "Invalid card id" },
      { status: 400 }
    );
  }

  try {
    const card = await prisma.card.findUnique({ where: { id: cardId } });
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const updated = await prisma.card.update({
      where: { id: cardId },
      data: {
        tcgplayerProductId: null,
        tcgUrl: null,
        marketPrice: null,
        lowPrice: null,
        highPrice: null,
        priceUpdatedAt: null,
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("[admin/cards/[id]/tcgplayer] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to unlink TCGplayer product" },
      { status: 500 }
    );
  }
}
