export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapCard } from "@/lib/cards/mapper";

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const code = params.code?.toUpperCase();
    if (!code) {
      return NextResponse.json(
        { error: "Card code is required" },
        { status: 400 }
      );
    }

    // Buscar todas las cartas con ese código (incluyendo alternas)
    const cards = await prisma.card.findMany({
      where: {
        code: {
          equals: code,
          mode: "insensitive",
        },
      },
      orderBy: [
        { isFirstEdition: "desc" }, // First editions primero
        { id: "asc" },
      ],
      include: {
        sets: {
          include: {
            set: true,
          },
        },
        types: true,
        colors: true,
        effects: true,
        conditions: true,
        texts: true,
      },
    });

    const mapped = cards.map((card) => mapCard(card, true, false));

    return NextResponse.json(mapped, { status: 200 });
  } catch (error) {
    console.error("Error fetching cards by code:", error);
    return NextResponse.json(
      { error: "Failed to fetch cards" },
      { status: 500 }
    );
  }
}
