export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number.parseInt(params.id, 10);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid review id" }, { status: 400 });
    }

    const review = await prisma.limitlessSetReview.findUnique({
      where: { id },
      include: {
        dbSet: {
          select: {
            id: true,
            title: true,
            code: true,
          },
        },
        items: {
          orderBy: [{ kind: "asc" }, { code: "asc" }, { id: "asc" }],
        },
      },
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, review }, { status: 200 });
  } catch (error: any) {
    console.error("[limitless/reviews/:id] failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to load review" },
      { status: 500 }
    );
  }
}
