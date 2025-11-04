export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  handleAuthError,
  validateListOwnership,
} from "@/lib/auth-helpers";

// POST /api/lists/[id]/move-card - Mover carta entre listas
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const sourceListId = parseInt(params.id);
    if (isNaN(sourceListId)) {
      return NextResponse.json(
        { error: "ID de lista origen inválido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      cardId,
      targetListId,
      quantity = 1,
      notes,
      condition,
      position,
    } = body;

    // Validaciones básicas
    if (!cardId || !targetListId || quantity < 1) {
      return NextResponse.json(
        {
          error: "cardId, targetListId y quantity válida son requeridos",
        },
        { status: 400 }
      );
    }

    if (sourceListId === targetListId) {
      return NextResponse.json(
        {
          error: "No se puede mover una carta a la misma lista",
        },
        { status: 400 }
      );
    }

    // Verificar que el usuario es propietario de ambas listas
    const [isSourceOwner, isTargetOwner] = await Promise.all([
      validateListOwnership(sourceListId, user.id),
      validateListOwnership(targetListId, user.id),
    ]);

    if (!isSourceOwner || !isTargetOwner) {
      return NextResponse.json(
        {
          error: "Una o ambas listas no fueron encontradas o sin permisos",
        },
        { status: 404 }
      );
    }

    // Obtener información de ambas listas
    const [sourceList, targetList] = await Promise.all([
      prisma.userList.findUnique({ where: { id: sourceListId } }),
      prisma.userList.findUnique({ where: { id: targetListId } }),
    ]);

    if (!sourceList || !targetList) {
      return NextResponse.json(
        { error: "Una o ambas listas no fueron encontradas" },
        { status: 404 }
      );
    }

    // Buscar la carta en la lista origen
    const sourceCard = await prisma.userListCard.findFirst({
      where: {
        listId: sourceListId,
        cardId: parseInt(cardId.toString()),
      },
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
    });

    if (!sourceCard) {
      return NextResponse.json(
        { error: "Carta no encontrada en la lista origen" },
        { status: 404 }
      );
    }

    // Verificar que hay suficiente cantidad para mover
    if (quantity > sourceCard.quantity) {
      return NextResponse.json(
        {
          error: `Solo hay ${sourceCard.quantity} unidades disponibles`,
        },
        { status: 400 }
      );
    }

    // Verificar si la carta ya existe en la lista destino
    const existingTargetCard = await prisma.userListCard.findFirst({
      where: {
        listId: targetListId,
        cardId: parseInt(cardId.toString()),
      },
    });

    // Ejecutar el movimiento en una transacción
    const result = await prisma.$transaction(async (tx) => {
      let targetCard;

      if (existingTargetCard) {
        // La carta ya existe en el destino, actualizar cantidad
        targetCard = await tx.userListCard.update({
          where: { id: existingTargetCard.id },
          data: {
            quantity: existingTargetCard.quantity + quantity,
            notes: notes || existingTargetCard.notes,
            condition: condition || existingTargetCard.condition,
          },
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
        });
      } else {
        // Crear nueva entrada en la lista destino
        const targetCardData: any = {
          listId: targetListId,
          cardId: parseInt(cardId.toString()),
          quantity,
          notes: notes || sourceCard.notes,
          condition: condition || sourceCard.condition,
        };

        if (targetList.isOrdered) {
          // Lista ordenada - manejar posicionamiento
          if (position && position.page && position.row && position.column) {
            // Posición específica proporcionada
            const { page, row, column } = position;

            // Validar posición
            if (
              page < 1 ||
              row < 1 ||
              row > targetList.maxRows! ||
              column < 1 ||
              column > targetList.maxColumns!
            ) {
              throw new Error("Posición inválida");
            }

            // Verificar que la posición esté libre
            const occupiedPosition = await tx.userListCard.findFirst({
              where: {
                listId: targetListId,
                page,
                row,
                column,
              },
            });

            if (occupiedPosition) {
              throw new Error(
                `Posición ocupada: página ${page}, fila ${row}, columna ${column}`
              );
            }

            targetCardData.page = page;
            targetCardData.row = row;
            targetCardData.column = column;

            // Actualizar totalPages si es necesario
            if (page > targetList.totalPages) {
              await tx.userList.update({
                where: { id: targetListId },
                data: { totalPages: page },
              });
            }
          } else {
            // Encontrar primera posición disponible
            const nextPosition = await findNextAvailablePosition(
              tx,
              targetListId,
              targetList
            );
            targetCardData.page = nextPosition.page;
            targetCardData.row = nextPosition.row;
            targetCardData.column = nextPosition.column;

            // Actualizar totalPages si es necesario
            if (nextPosition.page > targetList.totalPages) {
              await tx.userList.update({
                where: { id: targetListId },
                data: { totalPages: nextPosition.page },
              });
            }
          }
        } else {
          // Lista no ordenada - usar sortOrder
          const maxSortOrder = await tx.userListCard.findFirst({
            where: { listId: targetListId },
            orderBy: { sortOrder: "desc" },
            select: { sortOrder: true },
          });

          targetCardData.sortOrder = (maxSortOrder?.sortOrder || 0) + 10;
        }

        targetCard = await tx.userListCard.create({
          data: targetCardData,
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
        });
      }

      // Actualizar o eliminar de la lista origen
      if (sourceCard.quantity === quantity) {
        // Eliminar completamente si se mueve toda la cantidad
        await tx.userListCard.delete({
          where: { id: sourceCard.id },
        });
      } else {
        // Reducir cantidad en la lista origen
        await tx.userListCard.update({
          where: { id: sourceCard.id },
          data: {
            quantity: sourceCard.quantity - quantity,
          },
        });
      }

      return { targetCard, movedAll: sourceCard.quantity === quantity };
    });

    return NextResponse.json({
      message: "Carta movida exitosamente",
      card: result.targetCard,
      movedAll: result.movedAll,
    });
  } catch (error: any) {
    if (error.message?.includes("Posición")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleAuthError(error);
  }
}

// Función auxiliar para encontrar la siguiente posición disponible en lista ordenada
async function findNextAvailablePosition(
  tx: any,
  listId: number,
  list: any
): Promise<{ page: number; row: number; column: number }> {
  const maxRows = list.maxRows!;
  const maxColumns = list.maxColumns!;

  // Obtener todas las posiciones ocupadas ordenadas
  const occupiedPositions = await tx.userListCard.findMany({
    where: { listId },
    select: { page: true, row: true, column: true },
    orderBy: [{ page: "asc" }, { row: "asc" }, { column: "asc" }],
  });

  // Crear un Set para búsqueda rápida
  const occupiedSet = new Set(
    occupiedPositions.map((pos: any) => `${pos.page}-${pos.row}-${pos.column}`)
  );

  // Buscar primera posición libre
  for (let page = 1; page <= list.totalPages + 1; page++) {
    for (let row = 1; row <= maxRows; row++) {
      for (let column = 1; column <= maxColumns; column++) {
        const positionKey = `${page}-${row}-${column}`;
        if (!occupiedSet.has(positionKey)) {
          return { page, row, column };
        }
      }
    }
  }

  // Si llegamos aquí, algo salió mal
  throw new Error("No se pudo encontrar una posición disponible");
}
