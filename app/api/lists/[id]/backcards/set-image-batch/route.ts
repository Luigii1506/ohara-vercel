export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  handleAuthError,
  validateListOwnership,
} from "@/lib/auth-helpers";

const MAX_QUANTITY_PER_SLEEVE = 50;

// POST /api/lists/[id]/backcards/set-image-batch
// Coloca varios sleeves de una vez (pestaña "Sleeves" del carrito del modal
// de Agregar cartas): se acomodan en orden de lectura a partir de
// (toPage, toRow, toColumn), en el mismo orden en que vienen en `sleeves`,
// saltando cualquier casilla ya ocupada por una carta o por otro backcard.
// Mismo patrón que /cards/add-batch, para no depender de N llamadas
// secuenciales al confirmar el carrito.
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
    const rawSleeves: Array<{ imageUrl: string; quantity: number }> =
      Array.isArray(body?.sleeves)
        ? body.sleeves
            .map((s: any) => ({
              imageUrl: typeof s?.imageUrl === "string" ? s.imageUrl.trim() : "",
              quantity: Number(s?.quantity) || 1,
            }))
            .filter((s: any) => Boolean(s.imageUrl))
        : [];

    if (rawSleeves.length === 0) {
      return NextResponse.json(
        { error: "No se enviaron sleeves para colocar" },
        { status: 400 }
      );
    }

    for (const s of rawSleeves) {
      if (
        !Number.isInteger(s.quantity) ||
        s.quantity < 1 ||
        s.quantity > MAX_QUANTITY_PER_SLEEVE
      ) {
        return NextResponse.json(
          { error: "Cantidad inválida para un sleeve" },
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

    // Expandir cada {imageUrl, quantity} en `quantity` casillas individuales,
    // preservando el orden en que se seleccionaron los sleeves.
    const flattenedImages: string[] = [];
    for (const s of rawSleeves) {
      for (let i = 0; i < s.quantity; i++) {
        flattenedImages.push(s.imageUrl);
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

    const assignments: {
      imageUrl: string;
      page: number;
      row: number;
      column: number;
    }[] = [];
    let page = toPage;
    let row = toRow;
    let column = toColumn;
    const maxIterations =
      (flattenedImages.length + blocked.size + 50) * maxRows * maxColumns + 1000;
    let guard = 0;

    for (const imageUrl of flattenedImages) {
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
            { error: "No se encontró suficiente espacio para colocar todos los sleeves" },
            { status: 400 }
          );
        }
      }

      assignments.push({ imageUrl, page, row, column });
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
        await tx.userListBackcard.createMany({
          data: assignments.map((a) => ({
            listId,
            page: a.page,
            row: a.row,
            column: a.column,
            imageUrl: a.imageUrl,
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
      message: "Sleeves colocados",
      count: assignments.length,
      assignments,
      totalPages: Math.max(maxPageUsed, list.totalPages),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
