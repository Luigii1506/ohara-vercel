import { NextResponse, NextRequest } from "next/server";
import {
  buildFiltersFromSearchParams,
  fetchCardsPageFromDb,
} from "@/lib/cards/query";
import { mergeFiltersWithSetCode } from "@/lib/cards/types";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const setCode = params.get("setCode");
    const limitParam = params.get("limit");
    const cursorParam = params.get("cursor");

    const filters = mergeFiltersWithSetCode(
      buildFiltersFromSearchParams(params),
      setCode
    );


    const includeRelations = params.get("includeRelations") !== "false";
    const includeAlternates = params.get("includeAlternates") !== "false";
    const includeCounts = params.get("includeCounts") === "true";

    const limit =
      limitParam && !Number.isNaN(Number(limitParam))
        ? Math.min(Math.max(Number(limitParam), 1), 500)
        : 150;

    const cursor = cursorParam ? Number(cursorParam) : null;


    const result = await fetchCardsPageFromDb({
      filters,
      limit,
      cursor,
      includeRelations,
      includeAlternates,
      includeCounts,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error fetching cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch cards" },
      { status: 500 }
    );
  }
}
