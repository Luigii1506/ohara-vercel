export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";

// GET /api/consignors - Listar los consignatarios del usuario (compartidos
// entre todas sus carpetas de venta).
export async function GET() {
  try {
    const user = await requireAuth();

    const consignors = await prisma.consignor.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ consignors });
  } catch (error) {
    return handleAuthError(error);
  }
}

// POST /api/consignors - Crear un consignatario nuevo.
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;
    const color = typeof body?.color === "string" ? body.color.trim() || null : null;

    if (!name) {
      return NextResponse.json(
        { error: "El nombre es obligatorio" },
        { status: 400 }
      );
    }

    const existing = await prisma.consignor.findFirst({
      where: { userId: user.id, name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Ya tienes un consignatario con ese nombre", consignor: existing },
        { status: 409 }
      );
    }

    const consignor = await prisma.consignor.create({
      data: { userId: user.id, name, notes, color },
    });

    return NextResponse.json({ consignor }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
