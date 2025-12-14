export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  searchTcgplayerByName,
  ProductSearchParams,
} from "@/lib/services/tcgplayerClient";

const ONE_PIECE_CATEGORY_ID = 68;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const searchText = typeof body?.searchText === "string" ? body.searchText.trim() : "";

    if (!searchText) {
      return NextResponse.json(
        { error: "Search text is required" },
        { status: 400 }
      );
    }

    const parsedCategoryId = Number(body?.categoryId);
    const categoryId =
      Number.isFinite(parsedCategoryId) && parsedCategoryId > 0
        ? parsedCategoryId
        : ONE_PIECE_CATEGORY_ID;

    const limit =
      typeof body.limit === "number" && body.limit > 0 && body.limit <= 50
        ? body.limit
        : 50;
    const offset =
      typeof body.offset === "number" && body.offset >= 0 ? body.offset : 0;

    const searchParams: ProductSearchParams = {
      name: searchText,
      categoryId,
      limit,
      offset,
      getExtendedFields: Boolean(body.includeExtendedFields ?? true),
    };

    const result = await searchTcgplayerByName(searchParams);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[admin/tcgplayer/search-by-name] Error:", error);
    return NextResponse.json(
      { error: "Failed to search TCGplayer by name" },
      { status: 500 }
    );
  }
}
