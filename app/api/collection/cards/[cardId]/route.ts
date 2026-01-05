export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";

interface RouteParams {
  params: Promise<{ cardId: string }>;
}

// GET /api/collection/cards/[cardId] - Obtener una carta específica de la colección
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { cardId } = await params;

    const collection = await prisma.collection.findUnique({
      where: { userId: user.id },
    });

    if (!collection) {
      return NextResponse.json(
        { error: "Colección no encontrada" },
        { status: 404 }
      );
    }

    const collectionCard = await prisma.collectionCard.findUnique({
      where: {
        collectionId_cardId: {
          collectionId: collection.id,
          cardId: parseInt(cardId),
        },
      },
      include: {
        card: {
          include: {
            colors: true,
            types: true,
            sets: {
              include: {
                set: true,
              },
            },
          },
        },
      },
    });

    if (!collectionCard) {
      return NextResponse.json(
        { error: "Carta no encontrada en la colección" },
        { status: 404 }
      );
    }

    return NextResponse.json({ card: collectionCard });
  } catch (error) {
    console.error("[api/collection/cards/[cardId]] Error:", error);
    return handleAuthError(error);
  }
}

// PATCH /api/collection/cards/[cardId] - Actualizar cantidad, notas, condición de una carta
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const slotClient = (prisma as any).collectionCardSlot;
    const { cardId } = await params;
    const body = await request.json();

    const { quantity, notes, condition, customPrice, customCurrency } = body;

    const collection = await prisma.collection.findUnique({
      where: { userId: user.id },
    });

    if (!collection) {
      return NextResponse.json(
        { error: "Colección no encontrada" },
        { status: 404 }
      );
    }

    // Validar que quantity sea positivo si se proporciona
    if (quantity !== undefined && quantity < 1) {
      return NextResponse.json(
        { error: "La cantidad debe ser al menos 1" },
        { status: 400 }
      );
    }

    const existing = await prisma.collectionCard.findUnique({
      where: {
        collectionId_cardId: {
          collectionId: collection.id,
          cardId: parseInt(cardId),
        },
      },
      select: {
        id: true,
        quantity: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Carta no encontrada en la colección" },
        { status: 404 }
      );
    }

    const collectionCard = await prisma.collectionCard.update({
      where: {
        collectionId_cardId: {
          collectionId: collection.id,
          cardId: parseInt(cardId),
        },
      },
      data: {
        ...(quantity !== undefined && { quantity }),
        ...(notes !== undefined && { notes }),
        ...(condition !== undefined && { condition }),
        ...(customPrice !== undefined && { customPrice }),
        ...(customCurrency !== undefined && { customCurrency }),
      },
      include: {
        card: true,
      },
    });

    if (quantity !== undefined && quantity !== existing.quantity) {
      if (!slotClient) {
        return NextResponse.json(
          {
            error:
              "Collection slots not available. Run prisma migrate/generate.",
          },
          { status: 500 }
        );
      }
      if (quantity > existing.quantity) {
        const diff = quantity - existing.quantity;
        const maxSort = await slotClient.aggregate({
          where: { collectionId: collection.id },
          _max: { sortOrder: true },
        });
        const nextSortOrder = (maxSort._max.sortOrder ?? 0) + 10;
        const slotsToCreate = Array.from({ length: diff }, (_, slotIdx) => ({
          collectionId: collection.id,
          collectionCardId: existing.id,
          sortOrder: nextSortOrder + slotIdx * 10,
        }));
        await slotClient.createMany({
          data: slotsToCreate,
        });
      } else {
        const diff = existing.quantity - quantity;
        const slotsToRemove = await slotClient.findMany({
          where: {
            collectionId: collection.id,
            collectionCardId: existing.id,
          },
          orderBy: { sortOrder: "desc" },
          take: diff,
          select: { id: true },
        });
        if (slotsToRemove.length) {
          await slotClient.deleteMany({
            where: { id: { in: slotsToRemove.map((slot) => slot.id) } },
          });
        }
      }
    }

    return NextResponse.json({
      message: "Carta actualizada",
      card: collectionCard,
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Carta no encontrada en la colección" },
        { status: 404 }
      );
    }
    console.error("[api/collection/cards/[cardId]] Error:", error);
    return handleAuthError(error);
  }
}

// DELETE /api/collection/cards/[cardId] - Eliminar una carta de la colección
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { cardId } = await params;

    const collection = await prisma.collection.findUnique({
      where: { userId: user.id },
    });

    if (!collection) {
      return NextResponse.json(
        { error: "Colección no encontrada" },
        { status: 404 }
      );
    }

    await prisma.collectionCard.delete({
      where: {
        collectionId_cardId: {
          collectionId: collection.id,
          cardId: parseInt(cardId),
        },
      },
    });

    return NextResponse.json({
      message: "Carta eliminada de la colección",
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Carta no encontrada en la colección" },
        { status: 404 }
      );
    }
    console.error("[api/collection/cards/[cardId]] Error:", error);
    return handleAuthError(error);
  }
}
