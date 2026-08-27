export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  handleAuthError,
  validateListOwnership,
} from "@/lib/auth-helpers";

// Convierte (page, row, column) a un índice lineal en orden de lectura (0-based)
// y viceversa. Permite calcular "avanzar N casillas" con aritmética simple, sin
// loops manuales de wrap-around por fila/columna/página.
function toLinear(
  page: number,
  row: number,
  column: number,
  maxRows: number,
  maxColumns: number
): number {
  return (page - 1) * maxRows * maxColumns + (row - 1) * maxColumns + (column - 1);
}

function fromLinear(
  index: number,
  maxRows: number,
  maxColumns: number
): { page: number; row: number; column: number } {
  const column = (index % maxColumns) + 1;
  const row = (Math.floor(index / maxColumns) % maxRows) + 1;
  const page = Math.floor(index / (maxRows * maxColumns)) + 1;
  return { page, row, column };
}

// PUT /api/lists/[id]/cards/move-batch
// Mueve varias cartas ya colocadas a la vez, dentro de la MISMA carpeta.
//
// mode "fill" (default): se acomodan en orden de lectura a partir de
// (toPage, toRow, toColumn), en el mismo orden en que vienen en
// `listCardIds`/`cardIds`, saltando cualquier casilla ya ocupada por OTRA
// carta o backcard (no se elimina ni se sobrescribe nada).
//
// mode "insert": las cartas seleccionadas ocupan (toPage, toRow, toColumn) y
// las siguientes N-1 casillas en orden de lectura, sin importar si ya había
// algo ahí. Todo lo que ocupaba esas casillas (y todo lo que viene después,
// en orden de lectura, en TODA la carpeta) se recorre exactamente N
// posiciones hacia adelante para hacerle espacio — como insertar en un
// arreglo. Útil para reemplazar de golpe una hoja completa de cartas
// incorrectas sin tener que vaciarla primero.
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
    const rawListCardIds: number[] = Array.isArray(body?.listCardIds)
      ? body.listCardIds
          .map((id: any) => Number(id))
          .filter((id: number) => Number.isInteger(id))
      : [];
    const rawCardIds: number[] = Array.isArray(body?.cardIds)
      ? body.cardIds
          .map((id: any) => Number(id))
          .filter((id: number) => Number.isInteger(id))
      : [];

    const toPage = Number(body?.toPage);
    const toRow = Number(body?.toRow);
    const toColumn = Number(body?.toColumn);
    const mode = body?.mode === "insert" ? "insert" : "fill";

    const maxRows = list.maxRows || 3;
    const maxColumns = list.maxColumns || 3;

    if (rawListCardIds.length === 0 && rawCardIds.length === 0) {
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

    // Preferimos identificar cada fila por su propio id (listCardId). El id
    // de catálogo (cardId) puede repetirse varias veces en la misma carpeta
    // (copias duplicadas de la misma carta): deduplicar o buscar por cardId
    // colapsa esas copias entre sí y mueve/pierde la fila equivocada. Se
    // mantiene el fallback por cardId (con dedup) por compatibilidad.
    let orderedSources: { id: number; cardId: number }[];

    if (rawListCardIds.length > 0) {
      const listCardIds = Array.from(new Set(rawListCardIds));
      const sourceCards = await prisma.userListCard.findMany({
        where: { id: { in: listCardIds }, listId },
      });

      if (sourceCards.length !== listCardIds.length) {
        return NextResponse.json(
          { error: "Alguna carta no se encontró en la lista" },
          { status: 404 }
        );
      }

      const sourceById = new Map(sourceCards.map((c) => [c.id, c]));
      orderedSources = listCardIds.map((id) => sourceById.get(id)!);
    } else {
      const cardIds = Array.from(new Set(rawCardIds));
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
      orderedSources = cardIds.map((id) => sourceByCardId.get(id)!);
    }

    const movingIds = new Set(orderedSources.map((c) => c.id));

    const assignments: {
      cardId: number;
      rowId: number;
      page: number;
      row: number;
      column: number;
    }[] = [];
    let shiftedCards: { rowId: number; page: number; row: number; column: number }[] = [];
    let shiftedBackcards: { id: number; page: number; row: number; column: number }[] = [];
    let maxPageUsed: number;

    if (mode === "insert") {
      // Modo "insertar": las cartas seleccionadas ocupan (toPage,toRow,toColumn)
      // y las N-1 casillas siguientes en orden de lectura, sin importar si ya
      // había algo ahí. Todo lo que ocupaba esas casillas — y todo lo que viene
      // después en TODA la carpeta — se recorre exactamente N posiciones para
      // hacer espacio, como insertar en un arreglo.
      const targetLinear = toLinear(toPage, toRow, toColumn, maxRows, maxColumns);
      const n = orderedSources.length;

      orderedSources.forEach((source, i) => {
        const pos = fromLinear(targetLinear + i, maxRows, maxColumns);
        assignments.push({ cardId: source.cardId, rowId: source.id, ...pos });
      });

      const [otherCards, backcards] = await Promise.all([
        prisma.userListCard.findMany({
          where: { listId, id: { notIn: Array.from(movingIds) }, page: { not: null } },
          select: { id: true, page: true, row: true, column: true },
        }),
        prisma.userListBackcard.findMany({
          where: { listId },
          select: { id: true, page: true, row: true, column: true },
        }),
      ]);

      shiftedCards = otherCards
        .filter((c) => toLinear(c.page!, c.row!, c.column!, maxRows, maxColumns) >= targetLinear)
        .map((c) => ({
          rowId: c.id,
          ...fromLinear(
            toLinear(c.page!, c.row!, c.column!, maxRows, maxColumns) + n,
            maxRows,
            maxColumns
          ),
        }));

      // Los backcards no se pueden "liberar" temporalmente (page/row/column no
      // son nulables), así que se actualizan en orden DESCENDENTE de posición
      // actual: la que va más lejos se mueve primero, dejando libre el hueco
      // que la siguiente necesita. Evita chocar con la restricción única.
      shiftedBackcards = backcards
        .filter((b) => toLinear(b.page, b.row, b.column, maxRows, maxColumns) >= targetLinear)
        .map((b) => ({
          id: b.id,
          currentLinear: toLinear(b.page, b.row, b.column, maxRows, maxColumns),
          ...fromLinear(
            toLinear(b.page, b.row, b.column, maxRows, maxColumns) + n,
            maxRows,
            maxColumns
          ),
        }))
        .sort((a, b) => b.currentLinear - a.currentLinear)
        .map(({ currentLinear, ...rest }) => rest);

      maxPageUsed = Math.max(
        ...assignments.map((a) => a.page),
        ...shiftedCards.map((c) => c.page),
        ...shiftedBackcards.map((b) => b.page),
        list.totalPages
      );
    } else {
      // Modo "fill" (default): todo lo que bloquea el paso: cartas que NO se
      // están moviendo, y backcards. Todo lo demás (vacío, o la posición
      // original de una carta que sí se está moviendo) cuenta como disponible.
      const [otherCards, backcards] = await Promise.all([
        prisma.userListCard.findMany({
          where: { listId, id: { notIn: Array.from(movingIds) }, page: { not: null } },
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
      let page = toPage;
      let row = toRow;
      let column = toColumn;
      const maxIterations = (orderedSources.length + blocked.size + 50) * maxRows * maxColumns + 1000;
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

      maxPageUsed = Math.max(...assignments.map((a) => a.page), list.totalPages);
    }

    await prisma.$transaction(
      async (tx) => {
        // 1. Liberar las posiciones de todas las cartas que se van a
        //    reescribir (las seleccionadas + las desplazadas, si aplica) para
        //    evitar choques con la restricción única mientras reubicamos.
        const allCardIdsToFree = [
          ...Array.from(movingIds),
          ...shiftedCards.map((c) => c.rowId),
        ];
        await tx.userListCard.updateMany({
          where: { id: { in: allCardIdsToFree } },
          data: { page: null, row: null, column: null },
        });

        // 2. Colocar cada carta en su posición final.
        for (const a of [...assignments, ...shiftedCards]) {
          await tx.userListCard.update({
            where: { id: a.rowId },
            data: { page: a.page, row: a.row, column: a.column },
          });
        }

        // 3. Backcards desplazados (ver comentario arriba sobre el orden).
        for (const b of shiftedBackcards) {
          await tx.userListBackcard.update({
            where: { id: b.id },
            data: { page: b.page, row: b.row, column: b.column },
          });
        }

        if (maxPageUsed > list.totalPages) {
          await tx.userList.update({
            where: { id: listId },
            data: { totalPages: maxPageUsed },
          });
        }
      },
      // El modo "insert" puede tocar muchas más filas que "fill" (todo lo que
      // haya después del destino en la carpeta), le damos más margen.
      { timeout: mode === "insert" ? 60000 : 30000 }
    );

    return NextResponse.json({
      message: mode === "insert" ? "Cartas insertadas" : "Cartas movidas",
      assignments: assignments.map((a) => ({
        cardId: a.cardId,
        rowId: a.rowId,
        page: a.page,
        row: a.row,
        column: a.column,
      })),
      shiftedCount: shiftedCards.length + shiftedBackcards.length,
      totalPages: maxPageUsed,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
