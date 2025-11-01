export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  requireAuth,
  handleAuthError,
  validateListOwnership,
} from "@/lib/auth-helpers";

const prisma = new PrismaClient();

// PUT /api/lists/[id]/cards/[cardId] - Actualizar carta en lista
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; cardId: string } }
) {
  try {
    const user = await requireAuth();

    const listId = parseInt(params.id);
    const cardId = parseInt(params.cardId);

    if (isNaN(listId) || isNaN(cardId)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
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

    const body = await request.json();
    const { quantity, notes, condition, position } = body;

    // Buscar la carta en la lista
    const listCard = await prisma.userListCard.findFirst({
      where: {
        listId,
        cardId,
      },
    });

    if (!listCard) {
      return NextResponse.json(
        { error: "Carta no encontrada en la lista" },
        { status: 404 }
      );
    }

    // Obtener información de la lista para validaciones de posición
    const list = await prisma.userList.findUnique({
      where: { id: listId },
    });

    if (!list) {
      return NextResponse.json(
        { error: "Lista no encontrada" },
        { status: 404 }
      );
    }

    // Preparar datos de actualización
    const updateData: any = {};

    if (quantity !== undefined) {
      if (quantity < 1) {
        return NextResponse.json(
          { error: "La cantidad debe ser mayor a 0" },
          { status: 400 }
        );
      }
      updateData.quantity = quantity;
    }

    if (notes !== undefined) {
      updateData.notes = notes || null;
    }

    if (condition !== undefined) {
      updateData.condition = condition || "Near Mint";
    }

    // Manejar cambio de posición para listas ordenadas
    if (list.isOrdered && position) {
      const { page, row, column } = position;

      // Validar nueva posición
      if (
        page < 1 ||
        row < 1 ||
        row > list.maxRows! ||
        column < 1 ||
        column > list.maxColumns!
      ) {
        return NextResponse.json(
          { error: "Posición inválida" },
          { status: 400 }
        );
      }

      // Verificar que la nueva posición no esté ocupada (excepto por la misma carta)
      const occupiedPosition = await prisma.userListCard.findFirst({
        where: {
          listId,
          page,
          row,
          column,
          id: { not: listCard.id },
        },
      });

      if (occupiedPosition) {
        return NextResponse.json(
          {
            error: `Posición ocupada: página ${page}, fila ${row}, columna ${column}`,
          },
          { status: 400 }
        );
      }

      updateData.page = page;
      updateData.row = row;
      updateData.column = column;

      // Actualizar totalPages si es necesario
      if (page > list.totalPages) {
        await prisma.userList.update({
          where: { id: listId },
          data: { totalPages: page },
        });
      }
    }

    // Actualizar la carta
    const updatedCard = await prisma.userListCard.update({
      where: { id: listCard.id },
      data: updateData,
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

    return NextResponse.json({
      message: "Carta actualizada exitosamente",
      card: updatedCard,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

// DELETE /api/lists/[id]/cards/[cardId] - Eliminar carta de lista
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; cardId: string } }
) {
  try {
    const user = await requireAuth();

    const listId = parseInt(params.id);
    const cardId = parseInt(params.cardId);

    if (isNaN(listId) || isNaN(cardId)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
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

    // Buscar la carta en la lista
    const listCard = await prisma.userListCard.findFirst({
      where: {
        listId,
        cardId,
      },
    });

    if (!listCard) {
      return NextResponse.json(
        { error: "Carta no encontrada en la lista" },
        { status: 404 }
      );
    }

    // Obtener parámetros de consulta para manejo de cantidad
    const { searchParams } = new URL(request.url);
    const decreaseBy = parseInt(searchParams.get("decreaseBy") || "0");

    if (decreaseBy > 0) {
      // Disminuir cantidad en lugar de eliminar completamente
      const newQuantity = listCard.quantity - decreaseBy;

      if (newQuantity <= 0) {
        // Si la nueva cantidad es 0 o menos, eliminar la carta
        await prisma.userListCard.delete({
          where: { id: listCard.id },
        });

        return NextResponse.json({
          message: "Carta eliminada de la lista",
          removed: true,
        });
      } else {
        // Actualizar la cantidad
        const updatedCard = await prisma.userListCard.update({
          where: { id: listCard.id },
          data: { quantity: newQuantity },
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

        return NextResponse.json({
          message: "Cantidad actualizada exitosamente",
          card: updatedCard,
          removed: false,
        });
      }
    } else {
      // Eliminar completamente la carta de la lista
      await prisma.userListCard.delete({
        where: { id: listCard.id },
      });

      return NextResponse.json({
        message: "Carta eliminada de la lista",
        removed: true,
      });
    }
  } catch (error) {
    return handleAuthError(error);
  }
}
