import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { findBestProductMatch } from "@/lib/tcgplayer/match";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cardId, code, dryRun = false } = body ?? {};

    if (!cardId && !code) {
      return NextResponse.json(
        { error: "cardId or code is required" },
        { status: 400 }
      );
    }

    const card = await prisma.card.findFirst({
      where: cardId
        ? { id: Number(cardId) }
        : {
            code: String(code),
            isFirstEdition: true,
          },
    });

    if (!card) {
      return NextResponse.json(
        { error: "Card not found" },
        { status: 404 }
      );
    }

    const { bestMatch, candidates } = await findBestProductMatch(card);

    if (!bestMatch) {
      return NextResponse.json(
        {
          error: "No TCGplayer product match found",
          candidates,
        },
        { status: 404 }
      );
    }

    if (dryRun) {
      return NextResponse.json(
        { cardId: card.id, bestMatch, candidates },
        { status: 200 }
      );
    }

    const updated = await prisma.card.update({
      where: { id: card.id },
      data: {
        tcgplayerProductId: bestMatch.productId,
        tcgplayerGroupId: bestMatch.groupId,
      },
    });

    return NextResponse.json(
      {
        cardId: updated.id,
        productId: updated.tcgplayerProductId,
        groupId: updated.tcgplayerGroupId,
        candidates,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("TCGplayer map error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected mapping error",
      },
      { status: 500 }
    );
  }
}
