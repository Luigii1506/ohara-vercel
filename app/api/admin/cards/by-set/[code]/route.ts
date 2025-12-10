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
        { error: "Set code is required" },
        { status: 400 }
      );
    }

    const cards = await prisma.card.findMany({
      where: {
        baseCardId: null,
        setCode: {
          contains: code,
          mode: "insensitive",
        },
      },
      orderBy: {
        code: "asc",
      },
      include: {
        alternateCards: true,
      },
    });

    const mapped = cards.map((card) =>
      mapCard(card, true, false)
    );

    return NextResponse.json(mapped, { status: 200 });
  } catch (error) {
    console.error("Error fetching cards by set code:", error);
    return NextResponse.json(
      { error: "Failed to fetch cards" },
      { status: 500 }
    );
  }
}
