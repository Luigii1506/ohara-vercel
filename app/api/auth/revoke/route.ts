export const dynamic = 'force-dynamic';

// API Route para revocar token - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/auth/revoke
 * Revocar token para compatibilidad con cliente Laravel
 */
export async function POST(request: NextRequest) {
  try {
    // Por compatibilidad, simplemente devolver éxito
    // En el futuro se puede implementar lógica real de revocación

    return NextResponse.json({
      message: "Token revocado exitosamente",
    });
  } catch (error) {
    console.error("Error en POST /api/auth/revoke:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
