export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status");
    const takeRaw = Number.parseInt(
      request.nextUrl.searchParams.get("take") ?? "50",
      10
    );
    const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 200) : 50;

    const reviews = await prisma.limitlessSetReview.findMany({
      where:
        status && status !== "all"
          ? {
              status: status as any,
            }
          : undefined,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take,
      select: {
        id: true,
        slug: true,
        sourceUrl: true,
        sourceTitle: true,
        sourceCategory: true,
        region: true,
        dbSetId: true,
        status: true,
        declaredCount: true,
        dbSetCardCount: true,
        matchedCount: true,
        wrongSetCount: true,
        missingCount: true,
        extraCount: true,
        updatedAt: true,
        dbSet: {
          select: {
            id: true,
            title: true,
            code: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, reviews }, { status: 200 });
  } catch (error: any) {
    console.error("[limitless/reviews] failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to load Limitless reviews" },
      { status: 500 }
    );
  }
}
