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

    const [variantGroup, card] = await Promise.all([
      prisma.cardVariantGroup.findUnique({
        where: { id: variantGroupId },
        select: { id: true, baseGroupId: true },
      }),
      prisma.card.findUnique({
        where: { id: cardId },
        select: { id: true, isFirstEdition: true, region: true, language: true },
      }),
    ]);

    if (!variantGroup) {
      return NextResponse.json({ error: "Variant group not found" }, { status: 404 });
    }
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    if (card.isFirstEdition) {
      return NextResponse.json(
        { error: "Only alternates can be linked to variant groups" },
        { status: 400 }
      );
    }

    await prisma.cardVariantLink.deleteMany({
      where: {
        cardId,
        variantGroup: { baseGroupId: variantGroup.baseGroupId },
      },
    });

    const link = await prisma.cardVariantLink.create({
      data: {
        variantGroupId,
        cardId,
        region: card.region,
        language: card.language,
      },
    });

    return NextResponse.json(link, { status: 200 });
  } catch (error) {
    console.error("Error linking variant group:", error);
    return NextResponse.json(
      { error: "Failed to link variant group" },
      { status: 500 }
    );
  }
}
