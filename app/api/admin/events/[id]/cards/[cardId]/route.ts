export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; cardId: string } }
) {
  try {
    const eventId = Number(params.id);
    const cardId = Number(params.cardId);
    if (Number.isNaN(eventId) || Number.isNaN(cardId)) {
      return NextResponse.json(
        { error: "Invalid ids" },
        { status: 400 }
      );
    }

    await prisma.eventCard.deleteMany({
      where: {
        eventId,
        cardId,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error unlinking card:", error);
    return NextResponse.json(
      { error: "Failed to unlink card" },
      { status: 500 }
    );
  }
}
