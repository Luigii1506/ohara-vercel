export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";

interface RouteParams {
  params: Promise<{ slotId: string }>;
}

// DELETE /api/collection/slots/[slotId] - Eliminar una copia específica
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { slotId } = await params;
    const slotClient = (prisma as any).collectionCardSlot;

    if (!slotClient) {
      return NextResponse.json(
        {
          error: "Collection slots not available. Run prisma migrate/generate.",
        },
        { status: 500 }
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

    const slot = await slotClient.findFirst({
      where: {
        id: parseInt(slotId),
        collectionId: collection.id,
      },
      select: {
        id: true,
        collectionCardId: true,
      },
    });

    if (!slot) {
      return NextResponse.json(
        { error: "Copia no encontrada" },
        { status: 404 }
      );
    }

    await slotClient.delete({ where: { id: slot.id } });

    const collectionCard = await prisma.collectionCard.update({
      where: { id: slot.collectionCardId },
      data: { quantity: { decrement: 1 } },
      select: { id: true, quantity: true },
    });

    if (collectionCard.quantity <= 0) {
      await prisma.collectionCard.delete({ where: { id: collectionCard.id } });
      await slotClient.deleteMany({
        where: { collectionCardId: collectionCard.id },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/collection/slots/[slotId]] Error:", error);
    return handleAuthError(error);
  }
}
