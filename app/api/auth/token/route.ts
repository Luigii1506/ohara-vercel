export const dynamic = 'force-dynamic';

// API Routes de autenticación para compatibilidad con cliente Laravel - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

/**
 * POST /api/auth/token
 * Obtener token de autenticación para compatibilidad con cliente Laravel
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    // Por compatibilidad con el cliente Laravel, devolver un token ficticio
    // En el futuro se puede implementar un JWT real si se necesita
    const token = `nextauth-token-${Date.now()}`;

    return NextResponse.json({
      token,
      user: {
        id: session.user.email, // Usar email como ID por ahora
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      },
    });
  } catch (error) {
    console.error("Error en POST /api/auth/token:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
