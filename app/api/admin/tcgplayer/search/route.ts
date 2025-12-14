export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  searchTcgplayerCategoryProducts,
  CategorySearchFilter,
} from "@/lib/services/tcgplayerClient";

const ONE_PIECE_CATEGORY_ID = 68;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsedCategoryId = Number(body?.categoryId);
    const categoryId =
      Number.isFinite(parsedCategoryId) && parsedCategoryId > 0
        ? parsedCategoryId
        : ONE_PIECE_CATEGORY_ID;
    const rawFilters = body?.filters as CategorySearchFilter[] | undefined;

    const filters = (rawFilters ?? [])
      .map((filter) => ({
        name: typeof filter?.name === "string" ? filter.name.trim() : "",
        values: Array.isArray(filter?.values)
          ? filter.values.map((value) => String(value).trim()).filter(Boolean)
          : [],
      }))
      .filter((filter) => filter.name && filter.values.length);

    if (!filters.length) {
      return NextResponse.json(
        {
          error: "At least one filter is required",
        },
        { status: 400 }
      );
    }

    const limit =
      typeof body.limit === "number" && body.limit > 0 && body.limit <= 50
        ? body.limit
        : 50;
    const offset =
      typeof body.offset === "number" && body.offset >= 0 ? body.offset : 0;

    const result = await searchTcgplayerCategoryProducts({
      categoryId,
      filters,
      limit,
      offset,
      sort: body.sort,
      includeExtendedFields: Boolean(body.includeExtendedFields),
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[admin/tcgplayer/search] Error:", error);
    return NextResponse.json(
      { error: "Failed to search TCGplayer catalog" },
      { status: 500 }
    );
  }
}
