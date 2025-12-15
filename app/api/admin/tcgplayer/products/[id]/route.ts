export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  getTcgplayerProductPricing,
  getTcgplayerProductsByIds,
} from "@/lib/services/tcgplayerClient";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const productId = Number(params.id);
  if (!Number.isFinite(productId) || productId <= 0) {
    return NextResponse.json(
      { error: "Invalid product id" },
      { status: 400 }
    );
  }

  try {
    const includePricing =
      req.nextUrl.searchParams.get("includePricing") === "true";

    const [product] = await getTcgplayerProductsByIds([productId], true);
    if (!product) {
      return NextResponse.json(
        { error: "Product not found on TCGplayer" },
        { status: 404 }
      );
    }

    const pricing = includePricing
      ? await getTcgplayerProductPricing([productId])
      : null;

    return NextResponse.json(
      {
        product,
        pricing: pricing?.[0] ?? null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[admin/tcgplayer/products] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch product details" },
      { status: 500 }
    );
  }
}
