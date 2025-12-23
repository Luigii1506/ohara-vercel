export const dynamic = 'force-dynamic';

// API Route para obtener un listado específico - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/listings/[id]
 * Obtener un listado específico por ID (público)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const listingId = Number(params.id);
  if (!Number.isFinite(listingId)) {
    return NextResponse.json(
      { error: "ID de listado inválido" },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      error: "Listings feature is no longer available.",
    },
    { status: 410 }
  );
}
