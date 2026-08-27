export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  handleAuthError,
  validateListOwnership,
} from "@/lib/auth-helpers";

// PUT /api/lists/[id]/cards/assign-consignor
// Asigna (o quita, con consignorId: null) un consignatario a varias cartas
// ya colocadas en la lista de golpe. Identificamos cada fila por su propio
// id (listCardId), no por cardId — la misma carta de catálogo puede estar
// repetida varias veces en la carpeta.
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

    const body = await request.json();
    const listCardIds: number[] = Array.isArray(body?.listCardIds)
      ? body.listCardIds
          .map((id: any) => Number(id))
          .filter((id: number) => Number.isInteger(id))
      : [];
    const rawConsignorId = body?.consignorId;
    const consignorId =
      rawConsignorId === null || rawConsignorId === undefined
        ? null
        : Number(rawConsignorId);

    if (listCardIds.length === 0) {
      return NextResponse.json(
        { error: "No se enviaron cartas para asignar" },
        { status: 400 }
      );
    }
    if (consignorId !== null && !Number.isInteger(consignorId)) {
      return NextResponse.json(
        { error: "consignorId inválido" },
        { status: 400 }
      );
    }

    if (consignorId !== null) {
      const consignor = await prisma.consignor.findFirst({
        where: { id: consignorId, userId: user.id },
      });
      if (!consignor) {
        return NextResponse.json(
          { error: "Consignatario no encontrado" },
          { status: 404 }
        );
      }
    }

    const result = await prisma.userListCard.updateMany({
      where: { id: { in: listCardIds }, listId },
      data: { consignorId },
    });

    return NextResponse.json({
      message: "Consignatario asignado",
      updated: result.count,
      consignorId,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
