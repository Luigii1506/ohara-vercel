export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const setCode = searchParams.get("setCode")?.toUpperCase();
    const firstEditionOnly = searchParams.get("firstEditionOnly") === "true";
    const baseCardsOnly = searchParams.get("baseCardsOnly") === "true";

    if (!setCode) {
      return NextResponse.json(
        { error: "setCode is required" },
        { status: 400 }
      );
    }

    const whereCondition: any = {
      setCode: setCode,
    };

    if (firstEditionOnly) {
      whereCondition.isFirstEdition = true;
    }

    if (baseCardsOnly) {
      whereCondition.baseCardId = null;
    }

    const cards = await prisma.card.findMany({
      where: whereCondition,
      orderBy: {
        code: "asc",
      },
      select: {
        id: true,
        name: true,
        code: true,
        src: true,
        setCode: true,
      },
    });

    return NextResponse.json(cards, { status: 200 });
  } catch (error) {
    console.error("Error fetching cards by set code:", error);
    return NextResponse.json(
      { error: "Failed to fetch cards" },
      { status: 500 }
    );
  }
}
