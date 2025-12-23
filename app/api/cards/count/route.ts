import { NextRequest, NextResponse } from "next/server";
import {
  buildFiltersFromSearchParams,
  countCardsByFilters,
} from "@/lib/cards/query";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const filters = buildFiltersFromSearchParams(params);

    const total = await countCardsByFilters(filters);

    return NextResponse.json({ total }, { status: 200 });
  } catch (error) {
    console.error("Error counting cards:", error);
    return NextResponse.json(
      { error: "Failed to count cards" },
      { status: 500 }
    );
  }
}
