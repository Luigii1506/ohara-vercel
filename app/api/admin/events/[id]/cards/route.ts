export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = Number(params.id);
    if (Number.isNaN(eventId)) {
      return NextResponse.json(
        { error: "Invalid event id" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { cardId } = body;

    if (!cardId || Number.isNaN(Number(cardId))) {
      return NextResponse.json(
        { error: "cardId is required" },
        { status: 400 }
      );
    }

    const cardExists = await prisma.card.findUnique({
      where: { id: Number(cardId) },
    });

    if (!cardExists) {
      return NextResponse.json(
        { error: "Card not found" },
        { status: 404 }
      );
    }

    const linked = await prisma.eventCard.upsert({
      where: {
        eventId_cardId: {
          eventId,
          cardId: Number(cardId),
        },
      },
      create: {
        eventId,
        cardId: Number(cardId),
      },
      update: {},
      include: {
        card: true,
      },
    });

    return NextResponse.json(linked, { status: 200 });
  } catch (error) {
    console.error("Error linking card:", error);
    return NextResponse.json(
      { error: "Failed to link card" },
      { status: 500 }
    );
  }
}
