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
    const cardId = Number(body.cardId);
    if (Number.isNaN(cardId)) {
      return NextResponse.json({ error: "Invalid cardId" }, { status: 400 });
    }

    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { id: true, region: true, language: true, isFirstEdition: true },
    });
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    if (!card.isFirstEdition) {
      return NextResponse.json(
        { error: "Only base cards can be linked here" },
        { status: 400 }
      );
    }

    const link = await prisma.cardGroupLink.upsert({
      where: {
        groupId_cardId: {
          groupId,
          cardId,
        },
      },
      create: {
        groupId,
        cardId,
        region: card.region,
        language: card.language,
      },
      update: {
        region: card.region,
        language: card.language,
      },
    });

    return NextResponse.json(link, { status: 200 });
  } catch (error) {
    console.error("Error linking card group:", error);
    return NextResponse.json(
      { error: "Failed to link card group" },
      { status: 500 }
    );
  }
}
