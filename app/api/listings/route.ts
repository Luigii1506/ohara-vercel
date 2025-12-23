export const dynamic = 'force-dynamic';

// API Routes públicas para obtener listados de cartas - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

import { NextRequest, NextResponse } from "next/server";
import { ProductFilters } from "@/lib/shop/types";

/**
 * GET /api/listings
 * Obtener todos los listados públicos de cartas disponibles para compra
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filters: Partial<ProductFilters> = {
    search: searchParams.get("search") || undefined,
    minPrice: searchParams.get("min_price")
      ? Number(searchParams.get("min_price"))
      : undefined,
    maxPrice: searchParams.get("max_price")
      ? Number(searchParams.get("max_price"))
      : undefined,
    sortBy: (searchParams.get("sortBy") as any) || "listingDate",
    sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") || "desc",
    page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
    limit: searchParams.get("per_page")
      ? Number(searchParams.get("per_page"))
      : 20,
  };

  return NextResponse.json(
    {
      data: [],
      meta: {
        current_page: filters.page || 1,
        last_page: 0,
        per_page: filters.limit || 20,
        total: 0,
      },
      warning:
        "Listings feature has been retired from this deployment; data source not available.",
    },
    { status: 410 }
  );
}
