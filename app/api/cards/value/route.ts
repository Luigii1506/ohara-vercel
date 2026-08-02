import { NextRequest, NextResponse } from "next/server";
import {
  buildFiltersFromSearchParams,
  sumCardsValueByFilters,
} from "@/lib/cards/query";

export const dynamic = "force-dynamic";

/** GET /api/cards/value — valor total (suma de marketPrice) de las cartas que
 *  matchean el filtro actual del card-list. */
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const filters = buildFiltersFromSearchParams(params);
    const { value, withPrice } = await sumCardsValueByFilters(filters);
    return NextResponse.json({ value, withPrice }, { status: 200 });
  } catch (error) {
    console.error("Error summing cards value:", error);
    return NextResponse.json({ error: "Failed to sum cards value" }, { status: 500 });
  }
}
