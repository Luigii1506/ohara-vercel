export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  handleAuthError,
  validateListOwnership,
} from "@/lib/auth-helpers";

// GET /api/lists/[id]/snapshots/[snapshotId] - Detalle completo de un snapshot (solo dueño)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; snapshotId: string } }
) {
  try {
    const user = await requireAuth();

    const listId = parseInt(params.id);
    const snapshotId = parseInt(params.snapshotId);
    if (isNaN(listId) || isNaN(snapshotId)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    const isOwner = await validateListOwnership(listId, user.id);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Lista no encontrada o sin permisos" },
        { status: 404 }
      );
    }

    const snapshot = await prisma.userListSnapshot.findFirst({
      where: { id: snapshotId, listId },
    });

    if (!snapshot) {
      return NextResponse.json(
        { error: "Snapshot no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ snapshot });
  } catch (error) {
    return handleAuthError(error);
  }
}

// DELETE /api/lists/[id]/snapshots/[snapshotId] - Eliminar un snapshot (solo dueño)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; snapshotId: string } }
) {
  try {
    const user = await requireAuth();

    const listId = parseInt(params.id);
    const snapshotId = parseInt(params.snapshotId);
    if (isNaN(listId) || isNaN(snapshotId)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    const isOwner = await validateListOwnership(listId, user.id);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Lista no encontrada o sin permisos" },
        { status: 404 }
      );
    }

    const snapshot = await prisma.userListSnapshot.findFirst({
      where: { id: snapshotId, listId },
    });

    if (!snapshot) {
      return NextResponse.json(
        { error: "Snapshot no encontrado" },
        { status: 404 }
      );
    }

    await prisma.userListSnapshot.delete({ where: { id: snapshotId } });

    return NextResponse.json({ message: "Snapshot eliminado exitosamente" });
  } catch (error) {
    return handleAuthError(error);
  }
}
