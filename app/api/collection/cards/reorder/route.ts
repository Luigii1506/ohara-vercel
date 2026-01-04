export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";

// POST /api/collection/cards/reorder - Reordenar cartas de la colección
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
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

    const existing = await prisma.collectionCard.findMany({
      where: {
        id: { in: orderedIds },
        collectionId: collection.id,
      },
      select: { id: true },
    });

    if (existing.length !== orderedIds.length) {
      return NextResponse.json(
        { error: "Invalid card ids for this collection" },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      orderedIds.map((id: number, index: number) =>
        prisma.collectionCard.update({
          where: { id },
          data: { sortOrder: (index + 1) * 10 },
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/collection/cards/reorder] Error:", error);
    return handleAuthError(error);
  }
}
