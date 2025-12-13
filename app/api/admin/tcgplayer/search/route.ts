export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  ProductSearchParams,
  searchTcgplayerProducts,
} from "@/lib/services/tcgplayerClient";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<ProductSearchParams> & {
      offset?: number;
      limit?: number;
    };

    if (!body || (!body.name && !body.groupId && !body.categoryId)) {
      return NextResponse.json(
        {
          error:
            "Provide at least a name, groupId, or categoryId to search TCGplayer products.",
        },
        { status: 400 }
      );
    }

    const limit =
      typeof body.limit === "number" && body.limit > 0 && body.limit <= 100
        ? body.limit
        : 20;
    const offset =
      typeof body.offset === "number" && body.offset >= 0 ? body.offset : 0;

    const params: ProductSearchParams = {
      name: body.name,
      productLineName: body.productLineName,
      categoryId:
        typeof body.categoryId === "number" ? body.categoryId : undefined,
      groupId: typeof body.groupId === "number" ? body.groupId : undefined,
      limit,
      offset,
      getExtendedFields: Boolean(body.getExtendedFields),
    };

    const result = await searchTcgplayerProducts(params);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[admin/tcgplayer/search] Error:", error);
    return NextResponse.json(
      { error: "Failed to search TCGplayer catalog" },
      { status: 500 }
    );
  }
}
