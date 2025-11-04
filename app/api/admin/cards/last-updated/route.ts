export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const lastUpdatedRecord = await prisma.card.aggregate({
      _max: { updatedAt: true },
    });

    const lastUpdated = lastUpdatedRecord._max.updatedAt ?? new Date(0);

    return NextResponse.json({ lastUpdated }, { status: 200 });
  } catch (error: any) {
    console.error("Error en GET /api/cards/last-updated:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
