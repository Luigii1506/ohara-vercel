import { NextRequest, NextResponse } from "next/server";
import { getPricingForProducts } from "@/lib/tcgplayer/pricing";

const parseIds = (value: string | null) =>
  value
    ? value
        .split(",")
        .map((entry) => Number(entry.trim()))
        .filter((num) => Number.isInteger(num) && num > 0)
    : [];

export async function GET(req: NextRequest) {
  const productIds = parseIds(req.nextUrl.searchParams.get("productIds"));
  if (!productIds.length) {
    return NextResponse.json(
      { error: "productIds query param required" },
      { status: 400 }
    );
  }
  const prices = await getPricingForProducts(productIds);
  return NextResponse.json({ results: prices }, { status: 200 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ids = Array.isArray(body?.productIds)
      ? body.productIds.map((id: any) => Number(id)).filter((n) => n > 0)
      : [];
    if (!ids.length) {
      return NextResponse.json(
        { error: "productIds array required" },
        { status: 400 }
      );
    }
    const prices = await getPricingForProducts(ids);
    return NextResponse.json({ results: prices }, { status: 200 });
  } catch (error) {
    console.error("Pricing endpoint error", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing" },
      { status: 500 }
    );
  }
}
