export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  handleAuthError,
  validateListOwnership,
} from "@/lib/auth-helpers";

// PUT /api/lists/[id]/consignors/[consignorId]/unassign-all
// Desliga TODAS las cartas de este consignatario dentro de esta lista de
// golpe (no borra el consignatario, solo quita el vínculo — sus cartas
// vuelven a contar como del dueño). Útil para deslindar a alguien por
// completo sin perder su registro para reutilizarlo después.
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; consignorId: string } }
) {
  try {
    const user = await requireAuth();

    const listId = parseInt(params.id);
    const consignorId = parseInt(params.consignorId);
    if (isNaN(listId) || isNaN(consignorId)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    const isOwner = await validateListOwnership(listId, user.id);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Lista no encontrada o sin permisos" },
        { status: 404 }
      );
    }

    const consignor = await prisma.consignor.findFirst({
      where: { id: consignorId, userId: user.id },
    });
    if (!consignor) {
      return NextResponse.json(
        { error: "Consignatario no encontrado" },
        { status: 404 }
      );
    }

    const result = await prisma.userListCard.updateMany({
      where: { listId, consignorId },
      data: { consignorId: null },
    });

    return NextResponse.json({
      message: "Cartas desligadas",
      updated: result.count,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
