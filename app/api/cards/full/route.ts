import { NextResponse, NextRequest } from "next/server";
import {
  buildFiltersFromSearchParams,
  fetchAllCardsFromDb,
} from "@/lib/cards/query";
import { mergeFiltersWithSetCode } from "@/lib/cards/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const setCode = params.get("setCode");
    const limitParam = params.get("limit");

    const filters = mergeFiltersWithSetCode(
      buildFiltersFromSearchParams(params),
      setCode
    );

    const includeRelations = params.get("includeRelations") !== "false";
    const includeAlternates = params.get("includeAlternates") !== "false";
    const includeCounts = params.get("includeCounts") === "true";

    const limit =
      limitParam && !Number.isNaN(Number(limitParam))
        ? Math.min(Math.max(Number(limitParam), 1), 5000)
        : null;

    const items = await fetchAllCardsFromDb({
      filters,
      includeRelations,
      includeAlternates,
      includeCounts,
      limit,
    });

    return NextResponse.json(
      {
        items,
        count: items.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching all cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch cards" },
      { status: 500 }
    );
  }
}
