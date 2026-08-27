export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  handleAuthError,
  validateListOwnership,
} from "@/lib/auth-helpers";

// PUT /api/lists/[id]/cards/[cardId]/reposition
// Mueve una carta ya colocada a otra posición dentro de la MISMA carpeta.
// Si la casilla destino está ocupada por otra carta, se intercambian
// posiciones (swap) en vez de rechazar el movimiento. Si solo se manda
// `toPage` (sin toRow/toColumn), se coloca en la primera casilla libre de
// esa página.
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

    const isOwner = await validateListOwnership(listId, user.id);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Lista no encontrada o sin permisos" },
        { status: 404 }
      );
    }

    const list = await prisma.userList.findUnique({ where: { id: listId } });
    if (!list) {
      return NextResponse.json(
        { error: "Lista no encontrada" },
        { status: 404 }
      );
    }
    if (!list.isOrdered) {
      return NextResponse.json(
        { error: "Esta lista no tiene posiciones (no es una carpeta)" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const listCardId =
      body?.listCardId !== undefined && body?.listCardId !== null
        ? Number(body.listCardId)
        : null;

    // Preferimos identificar la fila exacta por su propio id (listCardId).
    // El id de catálogo (cardId) puede repetirse varias veces en la misma
    // carpeta (copias duplicadas de la misma carta), así que buscar solo por
    // {listId, cardId} puede devolver una fila distinta a la que el usuario
    // realmente seleccionó. Se mantiene el fallback por cardId por
    // compatibilidad con llamadas antiguas.
    const sourceCard =
      listCardId != null
        ? await prisma.userListCard.findFirst({
            where: { id: listCardId, listId },
          })
        : await prisma.userListCard.findFirst({
            where: { listId, cardId },
          });
    if (!sourceCard) {
      return NextResponse.json(
        { error: "Carta no encontrada en la lista" },
        { status: 404 }
      );
    }
    if (
      sourceCard.page == null ||
      sourceCard.row == null ||
      sourceCard.column == null
    ) {
      return NextResponse.json(
        { error: "La carta de origen no tiene una posición asignada" },
        { status: 400 }
      );
    }

    const toPage = Number(body?.toPage);
    const hasExplicitSlot =
      body?.toRow !== undefined && body?.toColumn !== undefined;

    const maxRows = list.maxRows || 3;
    const maxColumns = list.maxColumns || 3;

    if (!Number.isInteger(toPage) || toPage < 1) {
      return NextResponse.json(
        { error: "Página destino inválida" },
        { status: 400 }
      );
    }

    let targetRow: number;
    let targetColumn: number;

    if (hasExplicitSlot) {
      const toRow = Number(body.toRow);
      const toColumn = Number(body.toColumn);
      if (
        !Number.isInteger(toRow) ||
        !Number.isInteger(toColumn) ||
        toRow < 1 ||
        toRow > maxRows ||
        toColumn < 1 ||
        toColumn > maxColumns
      ) {
        return NextResponse.json(
          { error: "Posición destino inválida" },
          { status: 400 }
        );
      }
      targetRow = toRow;
      targetColumn = toColumn;
    } else {
      const [occupiedCards, occupiedBackcards] = await Promise.all([
        prisma.userListCard.findMany({
          where: { listId, page: toPage },
          select: { row: true, column: true },
        }),
        prisma.userListBackcard.findMany({
          where: { listId, page: toPage },
          select: { row: true, column: true },
        }),
      ]);
      const occupiedSet = new Set([
        ...occupiedCards.map((p) => `${p.row}-${p.column}`),
        ...occupiedBackcards.map((p) => `${p.row}-${p.column}`),
      ]);

      let found: { row: number; column: number } | null = null;
      outer: for (let r = 1; r <= maxRows; r++) {
        for (let c = 1; c <= maxColumns; c++) {
          if (!occupiedSet.has(`${r}-${c}`)) {
            found = { row: r, column: c };
            break outer;
          }
        }
      }

      if (!found) {
        return NextResponse.json(
          { error: `No hay espacio disponible en la página ${toPage}` },
          { status: 400 }
        );
      }
      targetRow = found.row;
      targetColumn = found.column;
    }

    if (
      sourceCard.page === toPage &&
      sourceCard.row === targetRow &&
      sourceCard.column === targetColumn
    ) {
      return NextResponse.json({
        message: "La carta ya está en esa posición",
        position: { page: toPage, row: targetRow, column: targetColumn },
        swapped: false,
      });
    }

    const destinationCard = await prisma.userListCard.findFirst({
      where: { listId, page: toPage, row: targetRow, column: targetColumn },
    });

    if (destinationCard) {
      // Swap: liberamos primero la posición destino (page/row/column a null,
      // lo cual no choca con la restricción única porque SQL no compara NULL
      // contra NULL para unicidad) y luego reubicamos ambas cartas.
      await prisma.$transaction([
        prisma.userListCard.update({
          where: { id: destinationCard.id },
          data: { page: null, row: null, column: null },
        }),
        prisma.userListCard.update({
          where: { id: sourceCard.id },
          data: { page: toPage, row: targetRow, column: targetColumn },
        }),
        prisma.userListCard.update({
          where: { id: destinationCard.id },
          data: {
            page: sourceCard.page,
            row: sourceCard.row,
            column: sourceCard.column,
          },
        }),
      ]);
    } else {
      await prisma.userListCard.update({
        where: { id: sourceCard.id },
        data: { page: toPage, row: targetRow, column: targetColumn },
      });
    }

    if (toPage > list.totalPages) {
      await prisma.userList.update({
        where: { id: listId },
        data: { totalPages: toPage },
      });
    }

    return NextResponse.json({
      message: "Carta movida",
      position: { page: toPage, row: targetRow, column: targetColumn },
      swapped: Boolean(destinationCard),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
