export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  handleAuthError,
  validateListOwnership,
} from "@/lib/auth-helpers";

// POST /api/lists/[id]/pages/insert
// Inserta una página en blanco después de `afterPage` (0 = antes de la
// página 1), recorriendo todas las páginas siguientes (+1) sin perder
// ninguna carta ni backcard. Las páginas se recorren de la más alta a la
// más baja para no chocar con la restricción única de posición.
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
        { error: "Esta lista no tiene páginas (no es una carpeta)" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const afterPage = Number(body?.afterPage);

    if (
      !Number.isInteger(afterPage) ||
      afterPage < 0 ||
      afterPage > list.totalPages
    ) {
      return NextResponse.json(
        { error: "Número de página inválido" },
        { status: 400 }
      );
    }

    const [cardPages, backcardPages] = await Promise.all([
      prisma.userListCard.findMany({
        where: { listId, page: { gt: afterPage } },
        select: { page: true },
        distinct: ["page"],
      }),
      prisma.userListBackcard.findMany({
        where: { listId, page: { gt: afterPage } },
        select: { page: true },
        distinct: ["page"],
      }),
    ]);

    const pagesToShift = Array.from(
      new Set<number>([
        ...cardPages.map((p) => p.page as number),
        ...backcardPages.map((p) => p.page as number),
      ])
    ).sort((a, b) => b - a);

    await prisma.$transaction(
      async (tx) => {
        for (const page of pagesToShift) {
          await tx.userListCard.updateMany({
            where: { listId, page },
            data: { page: page + 1 },
          });
          await tx.userListBackcard.updateMany({
            where: { listId, page },
            data: { page: page + 1 },
          });
        }

        await tx.userList.update({
          where: { id: listId },
          data: { totalPages: list.totalPages + 1 },
        });
      },
      { timeout: 20000 }
    );

    return NextResponse.json({
      message: "Página en blanco insertada",
      insertedPage: afterPage + 1,
      totalPages: list.totalPages + 1,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
