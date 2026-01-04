export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const baseGroupId = Number(body.baseGroupId);
    const cardId = Number(body.cardId);
    if (Number.isNaN(baseGroupId) || Number.isNaN(cardId)) {
      return NextResponse.json(
        { error: "Invalid baseGroupId or cardId" },
        { status: 400 }
      );
    }

    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: {
        id: true,
        isFirstEdition: true,
        alternateArt: true,
        illustrator: true,
        alias: true,
        region: true,
        language: true,
      },
    });
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    if (card.isFirstEdition) {
      return NextResponse.json(
        { error: "Only alternates can be linked to variant groups" },
        { status: 400 }
      );
    }

    const variantGroup = await prisma.cardVariantGroup.create({
      data: {
        baseGroupId,
        variantKey: card.alias ?? null,
        alternateArt: card.alternateArt ?? null,
        illustrator: card.illustrator ?? null,
      },
      select: { id: true },
    });

    await prisma.cardVariantLink.create({
      data: {
        variantGroupId: variantGroup.id,
        cardId,
        region: card.region,
        language: card.language,
      },
    });

    return NextResponse.json(
      { variantGroupId: variantGroup.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating variant group:", error);
    return NextResponse.json(
      { error: "Failed to create variant group" },
      { status: 500 }
    );
  }
}
