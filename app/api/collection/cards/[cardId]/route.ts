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
