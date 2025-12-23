export const dynamic = 'force-dynamic';

// API para activar productos del inventario para listado - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json(
    {
      error:
        "Inventory listing endpoint disabled; ecommerce catalog handled by external service.",
      listing_id: Number(params.id) || null,
    },
    { status: 410 }
  );
}
