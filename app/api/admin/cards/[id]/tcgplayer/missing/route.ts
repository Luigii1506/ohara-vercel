export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/cards/[id]/tcgplayer/missing
 * Marks a card as "missing" in TCGplayer (tcgplayerLinkStatus = false)
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cardId = Number(params.id);
  if (!Number.isFinite(cardId) || cardId <= 0) {
    return NextResponse.json(
      { error: "Invalid card id" },
      { status: 400 }
    );
  }

  try {
    const card = await prisma.card.findUnique({ where: { id: cardId } });
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const updated = await prisma.card.update({
      where: { id: cardId },
      data: {
        tcgplayerLinkStatus: false,
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("[admin/cards/[id]/tcgplayer/missing] POST error:", error);
    return NextResponse.json(
      { error: "Failed to mark card as missing" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/cards/[id]/tcgplayer/missing
 * Unmarks a card as "missing" (tcgplayerLinkStatus = null)
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cardId = Number(params.id);
  if (!Number.isFinite(cardId) || cardId <= 0) {
    return NextResponse.json(
      { error: "Invalid card id" },
      { status: 400 }
    );
  }

  try {
    const card = await prisma.card.findUnique({ where: { id: cardId } });
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const updated = await prisma.card.update({
      where: { id: cardId },
      data: {
        tcgplayerLinkStatus: null,
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("[admin/cards/[id]/tcgplayer/missing] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to unmark card as missing" },
      { status: 500 }
    );
  }
}
