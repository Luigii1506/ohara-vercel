export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";

// POST /api/collection/cards - Agregar carta(s) a la colección
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const slotClient = (prisma as any).collectionCardSlot;
    const body = await request.json();

    const { cardId, cardIds, quantity = 1 } = body;

    // Obtener o crear la colección del usuario
    let collection = await prisma.collection.findUnique({
      where: { userId: user.id },
    });

    if (!collection) {
      collection = await prisma.collection.create({
        data: { userId: user.id },
      });
    }
    if (!slotClient) {
      return NextResponse.json(
        {
          error: "Collection slots not available. Run prisma migrate/generate.",
        },
        { status: 500 }
      );
    }
    const maxSort = await slotClient.aggregate({
      where: { collectionId: collection.id },
      _max: { sortOrder: true },
    });
    let nextSortOrder = (maxSort._max.sortOrder ?? 0) + 10;

    // Si se envía un array de cardIds, agregar múltiples cartas
    if (cardIds && Array.isArray(cardIds)) {
      const results = await Promise.all(
        cardIds.map(async (id: number) => {
          const existing = await prisma.collectionCard.findUnique({
            where: {
              collectionId_cardId: {
                collectionId: collection.id,
                cardId: id,
              },
            },
            select: { id: true },
          });

          const collectionCard = existing
            ? await prisma.collectionCard.update({
                where: {
                  collectionId_cardId: {
                    collectionId: collection.id,
                    cardId: id,
                  },
                },
                data: {
                  quantity: { increment: quantity },
                },
              })
            : await prisma.collectionCard.create({
                data: {
                  collectionId: collection.id,
                  cardId: id,
                  quantity,
                  sortOrder: nextSortOrder,
                },
              });

          const slotsToCreate = Array.from({ length: quantity }, (_, slotIdx) => ({
            collectionId: collection.id,
            collectionCardId: collectionCard.id,
            sortOrder: nextSortOrder + slotIdx * 10,
          }));

          if (slotsToCreate.length) {
            await slotClient.createMany({
              data: slotsToCreate,
            });
          }

          nextSortOrder += quantity * 10;
          return collectionCard;
        })
      );

      return NextResponse.json({
        message: `${results.length} carta(s) agregada(s) a la colección`,
        cards: results,
      });
    }

    // Si se envía un solo cardId
    if (!cardId) {
      return NextResponse.json(
        { error: "Se requiere cardId o cardIds" },
        { status: 400 }
      );
    }

    // Verificar que la carta existe
    const card = await prisma.card.findUnique({
      where: { id: cardId },
    });

    if (!card) {
      return NextResponse.json(
        { error: "Carta no encontrada" },
        { status: 404 }
      );
    }

    // Agregar o actualizar la carta en la colección
    const existing = await prisma.collectionCard.findUnique({
      where: {
        collectionId_cardId: {
          collectionId: collection.id,
          cardId,
        },
      },
      select: { id: true },
    });

    const collectionCard = existing
      ? await prisma.collectionCard.update({
          where: {
            collectionId_cardId: {
              collectionId: collection.id,
              cardId,
            },
          },
          data: {
            quantity: { increment: quantity },
          },
          include: {
            card: true,
          },
        })
      : await prisma.collectionCard.create({
          data: {
            collectionId: collection.id,
            cardId,
            quantity,
            sortOrder: nextSortOrder,
          },
          include: {
            card: true,
          },
        });

    const slotsToCreate = Array.from({ length: quantity }, (_, slotIdx) => ({
      collectionId: collection.id,
      collectionCardId: collectionCard.id,
      sortOrder: nextSortOrder + slotIdx * 10,
    }));

    if (slotsToCreate.length) {
      await slotClient.createMany({
        data: slotsToCreate,
      });
    }

    return NextResponse.json({
      message: "Carta agregada a la colección",
      card: collectionCard,
    });
  } catch (error) {
    console.error("[api/collection/cards] Error al agregar carta:", error);
    return handleAuthError(error);
  }
}

// DELETE /api/collection/cards - Eliminar carta(s) de la colección
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    const slotClient = (prisma as any).collectionCardSlot;
    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get("cardId");
    const cardIds = searchParams.get("cardIds");

    const collection = await prisma.collection.findUnique({
      where: { userId: user.id },
    });

    if (!collection) {
      return NextResponse.json(
        { error: "Colección no encontrada" },
        { status: 404 }
      );
    }
    if (!slotClient) {
      return NextResponse.json(
        {
          error: "Collection slots not available. Run prisma migrate/generate.",
        },
        { status: 500 }
      );
    }

    // Si se envía cardIds (múltiples), eliminar varias cartas
    if (cardIds) {
      const ids = cardIds.split(",").map((id) => parseInt(id.trim()));

      await slotClient.deleteMany({
        where: {
          collectionId: collection.id,
          collectionCard: {
            cardId: { in: ids },
          },
        },
      });

      const result = await prisma.collectionCard.deleteMany({
        where: {
          collectionId: collection.id,
          cardId: { in: ids },
        },
      });

      return NextResponse.json({
        message: `${result.count} carta(s) eliminada(s) de la colección`,
        deleted: result.count,
      });
    }

    // Si se envía un solo cardId
    if (!cardId) {
      return NextResponse.json(
        { error: "Se requiere cardId o cardIds" },
        { status: 400 }
      );
    }

    await slotClient.deleteMany({
      where: {
        collectionId: collection.id,
        collectionCard: {
          cardId: parseInt(cardId),
        },
      },
    });

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
    console.error("[api/collection/cards] Error al eliminar carta:", error);
    return handleAuthError(error);
  }
}
