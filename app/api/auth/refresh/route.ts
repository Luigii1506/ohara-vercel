export const dynamic = 'force-dynamic';

// API Route para refresh token - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

/**
 * POST /api/auth/refresh
 * Refresh token para compatibilidad con cliente Laravel
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    // Generar nuevo token
    const token = `nextauth-refreshed-${Date.now()}`;

    return NextResponse.json({
      token,
    });
  } catch (error) {
    console.error("Error en POST /api/auth/refresh:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
