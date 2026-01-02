export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get("search")?.trim() ?? "";
    const region = req.nextUrl.searchParams.get("region")?.trim() ?? "all";
    const pageParam = req.nextUrl.searchParams.get("page");
    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = Math.min(Math.max(Number(limitParam) || 40, 10), 100);
    const page = Math.max(Number(pageParam) || 1, 1);
    const skip = (page - 1) * limit;

    const where: any = {
      isFirstEdition: true,
      baseGroupLinks: { none: {} },
    };
    if (search.length > 0) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }
    if (region !== "all") {
      where.region = region;
    }

    const [items, total] = await Promise.all([
      prisma.card.findMany({
        where,
        orderBy: { code: "asc" },
        skip,
        take: limit,
        select: {
          id: true,
          code: true,
          name: true,
          region: true,
          language: true,
          src: true,
          imageKey: true,
        },
      }),
      prisma.card.count({ where }),
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
    console.error("Error fetching ungrouped cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch ungrouped cards" },
      { status: 500 }
    );
  }
}
