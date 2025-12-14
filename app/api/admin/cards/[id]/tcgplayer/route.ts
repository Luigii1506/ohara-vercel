export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  getTcgplayerProductPricing,
  getTcgplayerProductsByIds,
} from "@/lib/services/tcgplayerClient";

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
    const numericProductId = Number(productId);
    if (!numericProductId || !Number.isFinite(numericProductId)) {
      return NextResponse.json(
        { error: "productId is required" },
        { status: 400 }
      );
    }

    const card = await prisma.card.findUnique({ where: { id: cardId } });
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const [productDetail] = await getTcgplayerProductsByIds(
      [numericProductId],
      true
    );
    const [pricingEntry] = await getTcgplayerProductPricing([numericProductId]);

    const resolvedPricing = pricing ?? pricingEntry ?? null;
    const resolvedUrl = tcgUrl ?? productDetail?.url ?? card.tcgUrl ?? null;
    const resolvedCurrency = currency ?? card.priceCurrency ?? "USD";
    const now = new Date();
    const data: Prisma.CardUpdateInput = {
      tcgplayerProductId: String(numericProductId),
      tcgplayerLinkStatus: true,
      tcgUrl: resolvedUrl,
    };

    if (resolvedPricing) {
      data.marketPrice = decimalOrNull(resolvedPricing.marketPrice);
      data.lowPrice = decimalOrNull(resolvedPricing.lowPrice);
      data.highPrice = decimalOrNull(resolvedPricing.highPrice);
      data.priceCurrency = resolvedCurrency;
      data.priceUpdatedAt = now;
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
        tcgplayerLinkStatus: null,
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
