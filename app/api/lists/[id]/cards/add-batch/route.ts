export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  handleAuthError,
  validateListOwnership,
} from "@/lib/auth-helpers";

const MAX_QUANTITY_PER_CARD = 50;

// POST /api/lists/[id]/cards/add-batch
// Agrega varias cartas NUEVAS a la vez, dentro de una carpeta (isOrdered).
// Se acomodan en orden de lectura a partir de (toPage, toRow, toColumn), en
// el mismo orden en que vienen en `cards`, saltando cualquier casilla ya
// ocupada. `quantity` por carta crea esa cantidad de casillas separadas
// (en carpetas cada casilla física es siempre 1 carta).
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
    const rawCards: Array<{ cardId: number; quantity: number }> = Array.isArray(
      body?.cards
    )
      ? body.cards
          .map((c: any) => ({
            cardId: Number(c?.cardId),
            quantity: Number(c?.quantity) || 1,
          }))
          .filter((c: any) => Number.isInteger(c.cardId))
      : [];

    if (rawCards.length === 0) {
      return NextResponse.json(
        { error: "No se enviaron cartas para agregar" },
        { status: 400 }
      );
    }

    for (const c of rawCards) {
      if (
        !Number.isInteger(c.quantity) ||
        c.quantity < 1 ||
        c.quantity > MAX_QUANTITY_PER_CARD
      ) {
        return NextResponse.json(
          { error: `Cantidad inválida para la carta ${c.cardId}` },
          { status: 400 }
        );
      }
    }

    const toPage = Number(body?.toPage);
    const toRow = Number(body?.toRow);
    const toColumn = Number(body?.toColumn);

    const maxRows = list.maxRows || 3;
    const maxColumns = list.maxColumns || 3;

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

    const uniqueCardIds = Array.from(new Set(rawCards.map((c) => c.cardId)));
    const existingCards = await prisma.card.findMany({
      where: { id: { in: uniqueCardIds } },
      select: { id: true },
    });
    if (existingCards.length !== uniqueCardIds.length) {
      return NextResponse.json(
        { error: "Alguna carta no existe en el catálogo" },
        { status: 404 }
      );
    }

    // Expandir cada {cardId, quantity} en `quantity` casillas individuales,
    // preservando el orden en que se seleccionaron las cartas.
    const flattenedCardIds: number[] = [];
    for (const c of rawCards) {
      for (let i = 0; i < c.quantity; i++) {
        flattenedCardIds.push(c.cardId);
      }
    }

    const [existingPositions, backcards] = await Promise.all([
      prisma.userListCard.findMany({
        where: { listId, page: { not: null } },
        select: { page: true, row: true, column: true },
      }),
      prisma.userListBackcard.findMany({
        where: { listId },
        select: { page: true, row: true, column: true },
      }),
    ]);

    const blocked = new Set<string>();
    existingPositions.forEach((c) => blocked.add(`${c.page}-${c.row}-${c.column}`));
    backcards.forEach((b) => blocked.add(`${b.page}-${b.row}-${b.column}`));

    const assignments: { cardId: number; page: number; row: number; column: number }[] =
      [];
    let page = toPage;
    let row = toRow;
    let column = toColumn;
    const maxIterations =
      (flattenedCardIds.length + blocked.size + 50) * maxRows * maxColumns + 1000;
    let guard = 0;

    for (const cardId of flattenedCardIds) {
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
            { error: "No se encontró suficiente espacio para agregar todas las cartas" },
            { status: 400 }
          );
        }
      }

      assignments.push({ cardId, page, row, column });
      blocked.add(`${page}-${row}-${column}`);

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
        await tx.userListCard.createMany({
          data: assignments.map((a) => ({
            listId,
            cardId: a.cardId,
            quantity: 1,
            page: a.page,
            row: a.row,
            column: a.column,
          })),
        });

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
      message: "Cartas agregadas",
      count: assignments.length,
      assignments,
      totalPages: Math.max(maxPageUsed, list.totalPages),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
