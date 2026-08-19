export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  handleAuthError,
  validateListOwnership,
} from "@/lib/auth-helpers";

// POST /api/lists/[id]/backcards/set-image
// Coloca (o reemplaza) la imagen de un backcard en una casilla vacía —
// usado por la pestaña "Sleeves" del modal de Agregar cartas para poner un
// reverso temático en vez del genérico. A diferencia de /toggle, esto es un
// upsert: si ya había un backcard en blanco ahí, se le agrega la imagen.
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

    const body = await request.json();
    const page = Number(body?.page);
    const row = Number(body?.row);
    const column = Number(body?.column);
    const imageUrl =
      typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "";

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(row) ||
      row < 1 ||
      !Number.isInteger(column) ||
      column < 1
    ) {
      return NextResponse.json(
        { error: "Posición inválida" },
        { status: 400 }
      );
    }
    if (!imageUrl) {
      return NextResponse.json(
        { error: "imageUrl es requerido" },
        { status: 400 }
      );
    }

    const existingCard = await prisma.userListCard.findUnique({
      where: {
        unique_physical_position: { listId, page, row, column },
      },
    });
    if (existingCard) {
      return NextResponse.json(
        { error: "Ya existe una carta en esa posición" },
        { status: 409 }
      );
    }

    const backcard = await prisma.userListBackcard.upsert({
      where: {
        unique_backcard_position: { listId, page, row, column },
      },
      update: { imageUrl },
      create: { listId, page, row, column, imageUrl },
    });

    return NextResponse.json({ success: true, backcard });
  } catch (error) {
    return handleAuthError(error);
  }
}
