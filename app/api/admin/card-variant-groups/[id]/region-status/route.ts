export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const variantGroupId = Number(params.id);
    if (Number.isNaN(variantGroupId)) {
      return NextResponse.json(
        { error: "Invalid variantGroupId" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const region = String(body.region ?? "").trim();
    const status = String(body.status ?? "").trim();
    if (!region) {
      return NextResponse.json({ error: "Region is required" }, { status: 400 });
    }
    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 });
    }

    if (status === "RESET") {
      await prisma.cardVariantGroupRegionReview.deleteMany({
        where: { variantGroupId, region },
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const record = await prisma.cardVariantGroupRegionReview.upsert({
      where: {
        variantGroupId_region: {
          variantGroupId,
          region,
        },
      },
      create: {
        variantGroupId,
        region,
        status: status as any,
      },
      update: {
        status: status as any,
      },
    });

    return NextResponse.json(record, { status: 200 });
  } catch (error) {
    console.error("Error updating variant region status:", error);
    return NextResponse.json(
      { error: "Failed to update variant region status" },
      { status: 500 }
    );
  }
}
