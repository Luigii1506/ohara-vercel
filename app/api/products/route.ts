export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_LIMIT = 24;

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get("search")?.trim() ?? "";
    const type = req.nextUrl.searchParams.get("type") ?? "all";
    const sort = req.nextUrl.searchParams.get("sort") ?? "recent";
    const archived = req.nextUrl.searchParams.get("archived") ?? "false";
    const limitParam = req.nextUrl.searchParams.get("limit");
    const pageParam = req.nextUrl.searchParams.get("page");

    const limit = Math.min(
      Math.max(Number(limitParam) || DEFAULT_LIMIT, 6),
      60
    );
    const page = Math.max(Number(pageParam) || 1, 1);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search.length > 0) {
      where.name = { contains: search, mode: "insensitive" };
    }
    if (type !== "all") {
      where.productType = type;
    }
    if (archived !== "all") {
      where.isArchived = archived === "true";
    }

    const orderBy =
      sort === "name"
        ? { name: "asc" }
        : sort === "type"
        ? { productType: "asc" }
        : { createdAt: "desc" };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          imageUrl: true,
          thumbnailUrl: true,
          productType: true,
          isArchived: true,
          releaseDate: true,
          officialPrice: true,
          officialPriceCurrency: true,
          createdAt: true,
        },
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json(
      {
        items,
        total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[api/products] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
