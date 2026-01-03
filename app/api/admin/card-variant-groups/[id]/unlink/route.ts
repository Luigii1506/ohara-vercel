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
    const cardId = Number(body.cardId);
    if (Number.isNaN(cardId)) {
      return NextResponse.json({ error: "Invalid cardId" }, { status: 400 });
    }

    await prisma.cardVariantLink.deleteMany({
      where: { variantGroupId, cardId },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Error unlinking variant group:", error);
    return NextResponse.json(
      { error: "Failed to unlink variant group" },
      { status: 500 }
    );
  }
}
