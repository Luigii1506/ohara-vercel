export const dynamic = 'force-dynamic';

// API Route para toggle de favoritos en listings - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

/**
 * POST /api/listing/[id]/favorite-list
 * Toggle favorito en un listado
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const listingId = parseInt(params.id);
    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "ID de listado inválido" },
        { status: 400 }
      );
    }

    // Por ahora, respuesta básica - se puede expandir con tabla de favoritos
    return NextResponse.json({
      message: "Funcionalidad de favoritos agregada a la lista",
      listing_id: listingId,
      favorited: true,
    });
  } catch (error) {
    console.error("Error en POST /api/listing/[id]/favorite-list:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
