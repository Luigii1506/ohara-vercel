import { NextRequest, NextResponse } from "next/server";
import { rankSetSearchSuggestions } from "@/lib/cards/setSearch";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get("query")?.trim() ?? "";
    const limitParam = Number.parseInt(
      req.nextUrl.searchParams.get("limit") ?? "8",
      10
    );
    const limit = Number.isNaN(limitParam)
      ? 8
      : Math.min(Math.max(limitParam, 1), 12);

    if (query.length < 2) {
      return NextResponse.json({ suggestions: [] }, { status: 200 });
    }

    const suggestions = await rankSetSearchSuggestions(query, limit);

    return NextResponse.json(
      {
        suggestions: suggestions.map((item) => ({
          id: item.id,
          value: item.title,
          label: item.title,
          code: item.code,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error building card search suggestions:", error);
    return NextResponse.json(
      { error: "Failed to build search suggestions" },
      { status: 500 }
    );
  }
}
