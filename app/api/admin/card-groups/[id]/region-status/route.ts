export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const groupId = Number(params.id);
    if (Number.isNaN(groupId)) {
      return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
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
      await prisma.cardGroupRegionReview.deleteMany({
        where: { groupId, region },
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const record = await prisma.cardGroupRegionReview.upsert({
      where: {
        groupId_region: {
          groupId,
          region,
        },
      },
      create: {
        groupId,
        region,
        status: status as any,
      },
      update: {
        status: status as any,
      },
    });

    return NextResponse.json(record, { status: 200 });
  } catch (error) {
    console.error("Error updating region status:", error);
    return NextResponse.json(
      { error: "Failed to update region status" },
      { status: 500 }
    );
  }
}
