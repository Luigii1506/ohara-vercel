export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCollectionShareToken } from "@/lib/collection-share";

// GET /api/collection/public - Obtener la colección pública por ID
export async function GET(request: NextRequest) {
  try {
    const slotClient = (prisma as any).collectionCardSlot;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token") || "";
    let tokenCollectionId: number | null = null;
    if (token) {
      try {
        tokenCollectionId = parseCollectionShareToken(token);
      } catch (error) {
        console.error("[api/collection/public] Token error:", error);
        return NextResponse.json(
          { error: "Invalid token" },
          { status: 400 }
        );
      }
    }
    const collectionId = tokenCollectionId
      ? tokenCollectionId
      : Number.parseInt(searchParams.get("collectionId") || "", 10);
    const limit = Number.parseInt(searchParams.get("limit") || "0", 10);
    const includeSlots = searchParams.get("includeSlots") === "1";

    if (!Number.isFinite(collectionId)) {
      return NextResponse.json(
        { error: "Invalid collectionId" },
        { status: 400 }
      );
    }

    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        _count: {
          select: { cards: true },
        },
      },
    });

    if (!collection || !collection.isPublic) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    const cardFilters = { collectionId: collection.id };
    const cards = await prisma.collectionCard.findMany({
      where: cardFilters,
      include: {
        card: {
          include: {
            colors: true,
            types: true,
            effects: true,
            sets: {
              include: {
                set: true,
              },
            },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      ...(limit > 0 && { take: limit }),
    });

    const totalCards = await prisma.collectionCard.count({
      where: cardFilters,
    });

    const totalPages = limit > 0 ? Math.ceil(totalCards / limit) : 1;

    const stats = await prisma.collectionCard.aggregate({
      where: cardFilters,
      _sum: { quantity: true },
      _count: { cardId: true },
    });

    const rarityDistribution = await prisma.collectionCard.findMany({
      where: cardFilters,
      include: {
        card: {
          select: { rarity: true },
        },
      },
    });

    const rarityStats = rarityDistribution.reduce(
      (acc: Record<string, number>, item) => {
        const rarity = item.card.rarity || "Unknown";
        if (!acc[rarity]) {
          acc[rarity] = 0;
        }
        acc[rarity] += item.quantity;
        return acc;
      },
      {}
    );

    let slots: Array<{
      id: number;
      collectionCardId: number;
      sortOrder: number;
      cardId: number;
      card: any;
    }> = [];

    if (includeSlots && cards.length) {
      if (!slotClient) {
        return NextResponse.json(
          {
            error:
              "Collection slots not available. Run prisma migrate/generate.",
          },
          { status: 500 }
        );
      }
      const slotRows = await slotClient.findMany({
        where: {
          collectionId: collection.id,
          collectionCardId: { in: cards.map((item) => item.id) },
        },
        orderBy: { sortOrder: "asc" },
        include: {
          collectionCard: {
            include: {
              card: {
                include: {
                  colors: true,
                  types: true,
                  effects: true,
                  sets: {
                    include: {
                      set: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      slots = slotRows.map(
        (slot: {
          id: number;
          collectionCardId: number;
          sortOrder: number;
          collectionCard: { cardId: number; card: any };
        }) => ({
          id: slot.id,
          collectionCardId: slot.collectionCardId,
          sortOrder: slot.sortOrder,
          cardId: slot.collectionCard.cardId,
          card: slot.collectionCard.card,
        })
      );
    }

    return NextResponse.json({
      collection: {
        id: collection.id,
        userId: collection.userId,
        isPublic: collection.isPublic,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
        stats: {
          totalUniqueCards: stats._count.cardId,
          totalCardsCount: stats._sum.quantity || 0,
          rarityDistribution: rarityStats,
        },
      },
      cards,
      slots,
      pagination: {
        currentPage: 1,
        totalPages,
        totalCards,
        limit,
        hasNext: false,
        hasPrev: false,
      },
    });
  } catch (error) {
    console.error("[api/collection/public] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch collection" },
      { status: 500 }
    );
  }
}
