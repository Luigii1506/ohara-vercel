export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapCard } from "@/lib/cards/mapper";

const sanitizeForClient = (value: any) =>
  JSON.parse(JSON.stringify(value));

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const idParam = params.id;
    const setId = Number(idParam);
    if (!idParam || Number.isNaN(setId)) {
      return NextResponse.json(
        { error: "Valid set id is required" },
        { status: 400 }
      );
    }

    const relatedEntries = await prisma.cardSet.findMany({
      where: { setId },
      select: { cardId: true },
    });

    if (!relatedEntries.length) {
      return NextResponse.json([], { status: 200 });
    }

    const relatedIds = relatedEntries.map((entry) => entry.cardId);

    const cards = await prisma.card.findMany({
      where: {
        id: { in: relatedIds },
      },
      orderBy: {
        code: "asc",
      },
      include: {
        sets: {
          include: {
            set: true,
          },
        },
        alternateCards: {
          include: {
            sets: {
              include: {
                set: true,
              },
            },
          },
        },
      },
    });

    const mapped = cards.map((card) => mapCard(card, true, false));

    return NextResponse.json(mapped.map(sanitizeForClient), { status: 200 });
  } catch (error) {
    console.error("Error fetching cards by set id:", error);
    return NextResponse.json(
      { error: "Failed to fetch cards" },
      { status: 500 }
    );
  }
}
