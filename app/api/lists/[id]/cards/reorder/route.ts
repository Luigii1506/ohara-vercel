export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  requireAuth,
  handleAuthError,
  validateListOwnership,
} from "@/lib/auth-helpers";

const prisma = new PrismaClient();

// POST /api/lists/[id]/cards/reorder - Reordenar cartas en lista
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const listId = parseInt(params.id);
    if (isNaN(listId)) {
      return NextResponse.json(
        { error: "ID de lista inválido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { reorderData } = body;

    // Validar que se proporcione data de reordenamiento
    if (!reorderData || !Array.isArray(reorderData)) {
      return NextResponse.json(
        {
          error: "Se requiere un array de datos de reordenamiento",
        },
        { status: 400 }
      );
    }

    // Verificar que el usuario es propietario de la lista
    const isOwner = await validateListOwnership(listId, user.id);
    if (!isOwner) {
      return NextResponse.json(
        {
          error: "Lista no encontrada o sin permisos",
        },
        { status: 404 }
      );
    }

    // Obtener información de la lista
    const list = await prisma.userList.findUnique({
      where: { id: listId },
    });

    if (!list) {
      return NextResponse.json(
        { error: "Lista no encontrada" },
        { status: 404 }
      );
    }

    // Verificar que todas las cartas especificadas existan en la lista
    const cardIds = reorderData.map((item: any) => item.cardId);
    const existingCards = await prisma.userListCard.findMany({
      where: {
        listId,
        cardId: { in: cardIds },
      },
    });

    if (existingCards.length !== cardIds.length) {
      return NextResponse.json(
        {
          error: "Una o más cartas no se encontraron en la lista",
        },
        { status: 400 }
      );
    }

    if (list.isOrdered) {
      // Reordenamiento para lista ordenada (posiciones físicas)
      const positionUpdates: Array<{
        id: number;
        page: number;
        row: number;
        column: number;
      }> = [];
      const usedPositions = new Set<string>();

      for (const item of reorderData) {
        const { cardId, page, row, column } = item;

        // Validar posición
        if (
          !page ||
          !row ||
          !column ||
          page < 1 ||
          row < 1 ||
          row > list.maxRows! ||
          column < 1 ||
          column > list.maxColumns!
        ) {
          return NextResponse.json(
            {
              error: `Posición inválida para carta ${cardId}`,
            },
            { status: 400 }
          );
        }

        const positionKey = `${page}-${row}-${column}`;
        if (usedPositions.has(positionKey)) {
          return NextResponse.json(
            {
              error: `Posición duplicada: página ${page}, fila ${row}, columna ${column}`,
            },
            { status: 400 }
          );
        }

        usedPositions.add(positionKey);

        const existingCard = existingCards.find(
          (card) => card.cardId === cardId
        );
        if (existingCard) {
          positionUpdates.push({
            id: existingCard.id,
            page,
            row,
            column,
          });
        }
      }

      // Ejecutar actualizaciones en una transacción
      await prisma.$transaction(async (tx) => {
        for (const update of positionUpdates) {
          await tx.userListCard.update({
            where: { id: update.id },
            data: {
              page: update.page,
              row: update.row,
              column: update.column,
            },
          });
        }

        // Actualizar totalPages si es necesario
        const maxPage = Math.max(...positionUpdates.map((u) => u.page));
        if (maxPage > list.totalPages) {
          await tx.userList.update({
            where: { id: listId },
            data: { totalPages: maxPage },
          });
        }
      });
    } else {
      // Reordenamiento para lista no ordenada (sortOrder)
      const sortUpdates: Array<{ id: number; sortOrder: number }> = [];

      for (let i = 0; i < reorderData.length; i++) {
        const { cardId } = reorderData[i];
        const newSortOrder = (i + 1) * 10; // Usar múltiplos de 10 para facilitar inserciones futuras

        const existingCard = existingCards.find(
          (card) => card.cardId === cardId
        );
        if (existingCard) {
          sortUpdates.push({
            id: existingCard.id,
            sortOrder: newSortOrder,
          });
        }
      }

      // Ejecutar actualizaciones en una transacción
      await prisma.$transaction(async (tx) => {
        for (const update of sortUpdates) {
          await tx.userListCard.update({
            where: { id: update.id },
            data: { sortOrder: update.sortOrder },
          });
        }
      });
    }

    // Obtener la lista actualizada con las cartas reordenadas
    const updatedCards = await prisma.userListCard.findMany({
      where: { listId },
      include: {
        card: {
          include: {
            colors: true,
            types: true,
            sets: {
              include: { set: true },
            },
          },
        },
      },
      orderBy: list.isOrdered
        ? [{ page: "asc" }, { row: "asc" }, { column: "asc" }]
        : [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({
      message: "Cartas reordenadas exitosamente",
      cards: updatedCards,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
