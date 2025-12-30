import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cardId = Number(params.id);
    if (!Number.isInteger(cardId) || cardId <= 0) {
      return NextResponse.json({ error: "Invalid card id." }, { status: 400 });
    }

    const body = await req.json();
    const sourceId = Number(body?.sourceCardId);
    if (!Number.isInteger(sourceId) || sourceId <= 0) {
      return NextResponse.json(
        { error: "sourceCardId is required." },
        { status: 400 }
      );
    }

    const sourceCard = await prisma.card.findUnique({
      where: { id: sourceId },
      select: { alternateArt: true, region: true },
    });

    if (!sourceCard) {
      return NextResponse.json(
        { error: "Source card not found." },
        { status: 404 }
      );
    }

    if (sourceCard.region !== "US") {
      return NextResponse.json(
        { error: "Source card must be from US region." },
        { status: 400 }
      );
    }

    const updated = await prisma.card.update({
      where: { id: cardId },
      data: { alternateArt: sourceCard.alternateArt ?? null },
      select: {
        id: true,
        alternateArt: true,
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    console.error("Error in PATCH /api/admin/region-alternates/[id]:", error);
    return NextResponse.json(
      { error: error.message ?? "Failed to update alternateArt." },
      { status: 500 }
    );
  }
}
