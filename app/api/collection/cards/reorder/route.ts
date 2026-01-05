export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";

// POST /api/collection/cards/reorder - Reordenar cartas de la colección
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const slotClient = (prisma as any).collectionCardSlot;
    const body = await request.json();
    const orderedIds = Array.isArray(body?.orderedIds) ? body.orderedIds : [];

    if (!orderedIds.length) {
      return NextResponse.json(
        { error: "orderedIds is required" },
        { status: 400 }
      );
    }

    const collection = await prisma.collection.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!collection) {
      return NextResponse.json(
        { error: "Colección no encontrada" },
        { status: 404 }
      );
    }

    if (!slotClient) {
      return NextResponse.json(
        {
          error: "Collection slots not available. Run prisma migrate/generate.",
        },
        { status: 500 }
      );
    }
    const existing = await slotClient.findMany({
      where: {
        id: { in: orderedIds },
        collectionId: collection.id,
      },
      select: { id: true, collectionCardId: true },
    });

    if (existing.length !== orderedIds.length) {
      return NextResponse.json(
        { error: "Invalid slot ids for this collection" },
        { status: 400 }
      );
    }

    const slotToCard = new Map<number, number>();
    existing.forEach((slot) => {
      slotToCard.set(slot.id, slot.collectionCardId);
    });

    const cardSortMap = new Map<number, number>();

    await prisma.$transaction(
      orderedIds.map((id: number, index: number) => {
        const sortOrder = (index + 1) * 10;
        const cardId = slotToCard.get(id);
        if (cardId !== undefined && !cardSortMap.has(cardId)) {
          cardSortMap.set(cardId, sortOrder);
        }
        return slotClient.update({
          where: { id },
          data: { sortOrder },
        });
      })
    );

    if (cardSortMap.size) {
      await prisma.$transaction(
        Array.from(cardSortMap.entries()).map(([cardId, sortOrder]) =>
          prisma.collectionCard.update({
            where: { id: cardId },
            data: { sortOrder },
          })
        )
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/collection/cards/reorder] Error:", error);
    return handleAuthError(error);
  }
}
