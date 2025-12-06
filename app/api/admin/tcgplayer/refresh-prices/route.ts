import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getPricingForProducts } from "@/lib/tcgplayer/pricing";

export async function POST(req: NextRequest) {
  const limitParam = req.nextUrl.searchParams.get("limit");
  const take = Math.min(Number(limitParam) || 100, 500);

  const cards = await prisma.card.findMany({
    where: {
      tcgplayerProductId: {
        not: null,
      },
    },
    select: {
      id: true,
      tcgplayerProductId: true,
    },
    take,
  });

  const productIds = cards
    .map((card) => card.tcgplayerProductId)
    .filter((id): id is number => typeof id === "number");

  if (!productIds.length) {
    return NextResponse.json({ refreshed: 0, prices: [] }, { status: 200 });
  }

  const prices = await getPricingForProducts(productIds);

  return NextResponse.json(
    {
      refreshed: prices.length,
      products: prices,
    },
    { status: 200 }
  );
}
