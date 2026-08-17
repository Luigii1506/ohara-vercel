export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  handleAuthError,
  validateListOwnership,
} from "@/lib/auth-helpers";

// PUT /api/lists/[id]/cards/move-batch
// Mueve varias cartas ya colocadas a la vez, dentro de la MISMA carpeta.
// Se acomodan en orden de lectura a partir de (toPage, toRow, toColumn),
// en el mismo orden en que vienen en `cardIds`, saltando cualquier casilla
// ya ocupada por OTRA carta (no se elimina ni se sobrescribe nada).
export async function PUT(
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
    const rawCardIds: number[] = Array.isArray(body?.cardIds)
      ? body.cardIds
          .map((id: any) => Number(id))
          .filter((id: number) => Number.isInteger(id))
      : [];
    // Dedup preservando el orden de selección.
    const cardIds = Array.from(new Set(rawCardIds));

    const toPage = Number(body?.toPage);
    const toRow = Number(body?.toRow);
    const toColumn = Number(body?.toColumn);

    const maxRows = list.maxRows || 3;
    const maxColumns = list.maxColumns || 3;

    if (cardIds.length === 0) {
      return NextResponse.json(
        { error: "No se enviaron cartas para mover" },
        { status: 400 }
      );
    }
    if (
      !Number.isInteger(toPage) ||
      toPage < 1 ||
      !Number.isInteger(toRow) ||
      toRow < 1 ||
      toRow > maxRows ||
      !Number.isInteger(toColumn) ||
      toColumn < 1 ||
      toColumn > maxColumns
    ) {
      return NextResponse.json(
        { error: "Posición destino inválida" },
        { status: 400 }
      );
    }

    const sourceCards = await prisma.userListCard.findMany({
      where: { listId, cardId: { in: cardIds } },
    });

    if (sourceCards.length !== cardIds.length) {
      return NextResponse.json(
        { error: "Alguna carta no se encontró en la lista" },
        { status: 404 }
      );
    }

    const sourceByCardId = new Map(sourceCards.map((c) => [c.cardId, c]));
    // Mantener el orden en que el cliente seleccionó las cartas.
    const orderedSources = cardIds.map((id) => sourceByCardId.get(id)!);
    const movingIds = new Set(orderedSources.map((c) => c.id));

    // Todo lo que bloquea el paso: cartas que NO se están moviendo, y
    // backcards. Todo lo demás (vacío, o la posición original de una carta
    // que sí se está moviendo) cuenta como disponible.
    const [otherCards, backcards] = await Promise.all([
      prisma.userListCard.findMany({
        where: {
          listId,
          id: { notIn: Array.from(movingIds) },
          page: { not: null },
        },
        select: { page: true, row: true, column: true },
      }),
      prisma.userListBackcard.findMany({
        where: { listId },
        select: { page: true, row: true, column: true },
      }),
    ]);

    const blocked = new Set<string>();
    otherCards.forEach((c) => blocked.add(`${c.page}-${c.row}-${c.column}`));
    backcards.forEach((b) => blocked.add(`${b.page}-${b.row}-${b.column}`));

    // Recorrer en orden de lectura desde el destino, saltando posiciones
    // bloqueadas, asignando cada carta (en el orden pedido) a la siguiente
    // casilla libre.
    const assignments: {
      cardId: number;
      rowId: number;
      page: number;
      row: number;
      column: number;
    }[] = [];
    let page = toPage;
    let row = toRow;
    let column = toColumn;
    const maxIterations = (cardIds.length + blocked.size + 50) * maxRows * maxColumns + 1000;
    let guard = 0;

    for (const source of orderedSources) {
      while (blocked.has(`${page}-${row}-${column}`)) {
        column++;
        if (column > maxColumns) {
          column = 1;
          row++;
        }
        if (row > maxRows) {
          row = 1;
          page++;
        }
        guard++;
        if (guard > maxIterations) {
          return NextResponse.json(
            { error: "No se encontró suficiente espacio para mover todas las cartas" },
            { status: 400 }
          );
        }
      }

      assignments.push({ cardId: source.cardId, rowId: source.id, page, row, column });
      blocked.add(`${page}-${row}-${column}`); // ya asignada, no reusar

      column++;
      if (column > maxColumns) {
        column = 1;
        row++;
      }
      if (row > maxRows) {
        row = 1;
        page++;
      }
    }

    const maxPageUsed = Math.max(...assignments.map((a) => a.page));

    await prisma.$transaction(
      async (tx) => {
        // 1. Liberar todas las posiciones de origen (evita choques con la
        //    restricción única mientras reubicamos).
        await tx.userListCard.updateMany({
          where: { id: { in: Array.from(movingIds) } },
          data: { page: null, row: null, column: null },
        });

        // 2. Colocar cada carta en su posición final.
        for (const a of assignments) {
          await tx.userListCard.update({
            where: { id: a.rowId },
            data: { page: a.page, row: a.row, column: a.column },
          });
        }

        if (maxPageUsed > list.totalPages) {
          await tx.userList.update({
            where: { id: listId },
            data: { totalPages: maxPageUsed },
          });
        }
      },
      { timeout: 30000 }
    );

    return NextResponse.json({
      message: "Cartas movidas",
      assignments: assignments.map((a) => ({
        cardId: a.cardId,
        page: a.page,
        row: a.row,
        column: a.column,
      })),
      totalPages: Math.max(maxPageUsed, list.totalPages),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
