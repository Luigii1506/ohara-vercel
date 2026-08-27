export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";

// PATCH /api/consignors/[id] - Renombrar / editar notas o color.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const consignorId = parseInt(params.id);
    if (isNaN(consignorId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const existing = await prisma.consignor.findFirst({
      where: { id: consignorId, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Consignatario no encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updateData: { name?: string; notes?: string | null; color?: string | null } = {};

    if (body?.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return NextResponse.json(
          { error: "El nombre no puede estar vacío" },
          { status: 400 }
        );
      }
      const clashing = await prisma.consignor.findFirst({
        where: {
          userId: user.id,
          name: { equals: name, mode: "insensitive" },
          id: { not: consignorId },
        },
      });
      if (clashing) {
        return NextResponse.json(
          { error: "Ya tienes un consignatario con ese nombre" },
          { status: 409 }
        );
      }
      updateData.name = name;
    }

    if (body?.notes !== undefined) {
      updateData.notes = body.notes ? String(body.notes).trim() : null;
    }
    if (body?.color !== undefined) {
      updateData.color = body.color ? String(body.color).trim() : null;
    }

    const consignor = await prisma.consignor.update({
      where: { id: consignorId },
      data: updateData,
    });

    return NextResponse.json({ consignor });
  } catch (error) {
    return handleAuthError(error);
  }
}

// DELETE /api/consignors/[id] - Eliminar un consignatario. Sus cartas
// vuelven a quedar sin asignar (consignorId -> null vía onDelete: SetNull).
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const consignorId = parseInt(params.id);
    if (isNaN(consignorId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const existing = await prisma.consignor.findFirst({
      where: { id: consignorId, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Consignatario no encontrado" },
        { status: 404 }
      );
    }

    await prisma.consignor.delete({ where: { id: consignorId } });

    return NextResponse.json({ message: "Consignatario eliminado" });
  } catch (error) {
    return handleAuthError(error);
  }
}
