export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cardId = Number.parseInt(String(body?.cardId ?? ""), 10);
    const setId = Number.parseInt(String(body?.setId ?? ""), 10);

    if (!Number.isFinite(cardId) || !Number.isFinite(setId)) {
      return NextResponse.json(
        { error: "cardId and setId are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.cardSet.findFirst({
      where: {
        cardId,
        setId,
      },
      select: { id: true },
    });

    if (!existing) {
      await prisma.cardSet.create({
        data: {
          cardId,
          setId,
        },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        created: !existing,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[limitless/set-membership/add-card] failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to add card to set" },
      { status: 500 }
    );
  }
}
