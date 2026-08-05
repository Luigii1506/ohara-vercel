export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LimitlessDecisionStatus } from "@prisma/client";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number.parseInt(params.id, 10);
    const body = await request.json();
    const status =
      body?.status === "PENDING" ||
      body?.status === "APPLIED" ||
      body?.status === "IGNORED"
        ? (body.status as LimitlessDecisionStatus)
        : null;

    if (!Number.isFinite(id) || !status) {
      return NextResponse.json(
        { error: "Invalid item id or status" },
        { status: 400 }
      );
    }

    const item = await prisma.limitlessSetReviewItem.update({
      where: { id },
      data: {
        decisionStatus: status,
      },
      select: {
        id: true,
        reviewId: true,
        decisionStatus: true,
      },
    });

    const pendingCount = await prisma.limitlessSetReviewItem.count({
      where: {
        reviewId: item.reviewId,
        decisionStatus: LimitlessDecisionStatus.PENDING,
      },
    });

    await prisma.limitlessSetReview.update({
      where: { id: item.reviewId },
      data: {
        status: pendingCount > 0 ? "PENDING" : "REVIEWED",
      },
    });

    return NextResponse.json({ ok: true, item }, { status: 200 });
  } catch (error: any) {
    console.error("[limitless/reviews/items/:id/decision] failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to update review item decision" },
      { status: 500 }
    );
  }
}
