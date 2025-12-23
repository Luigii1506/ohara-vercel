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
  try {
    const { prisma } = await import("@/lib/prisma");

    // Obtener parámetros de consulta
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

    // Construir query base - solo listados activos con stock
    const where: any = {
      isActive: true,
      stock: { gt: 0 }, // Solo listados con stock disponible
    };

    // Aplicar filtros en la carta relacionada
    if (filters.search) {
      where.card = {
        OR: [
          { name: { contains: filters.search, mode: "insensitive" } },
          { code: { contains: filters.search, mode: "insensitive" } },
        ],
      };
    }

    if (filters.minPrice !== undefined) {
      where.price = { ...where.price, gte: filters.minPrice * 100 }; // Convertir a centavos
    }

    if (filters.maxPrice !== undefined) {
      where.price = { ...where.price, lte: filters.maxPrice * 100 }; // Convertir a centavos
    }

    // Calcular offset para paginación
    const skip = ((filters.page || 1) - 1) * (filters.limit || 20);

    // Obtener total para metadata de paginación
    const total = await prisma.cardListing.count({ where });

    // Obtener listados con datos relacionados
    const cardListings = await prisma.cardListing.findMany({
      where,
      include: {
        card: {
          include: {
            sets: {
              include: {
                set: true,
              },
            },
          },
        },
        seller: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: {
        [filters.sortBy === "price" ? "price" : "listingDate"]:
          filters.sortOrder || "desc",
      },
      skip,
      take: filters.limit || 20,
    });

    await prisma.$disconnect();

    // Formatear respuesta para compatibilidad con el cliente
    const formattedListings = cardListings.map((listing) => ({
      id: listing.id,
      seller_id: listing.sellerId,
      title: listing.card.name,
      description: listing.card.name,
      price: Number(listing.price) / 100, // Convertir centavos a dólares
      currency: "USD",
      status: "active" as const,
      condition: listing.conditionForSale as any,
      language: "ES", // Por defecto español
      quantity: listing.stock,
      image: listing.card.src,
      created_at: listing.listingDate.toISOString(),
      updated_at: listing.updatedAt.toISOString(),
      seller: listing.seller
        ? {
            id: listing.seller.id,
            name: listing.seller.name,
            image: listing.seller.image,
          }
        : null,
      card: {
        id: listing.card.id,
        name: listing.card.name,
        code: listing.card.code,
        rarity: listing.card.rarity || "",
        set: listing.card.sets?.[0]?.set?.title || listing.card.setCode,
      },
    }));

    return NextResponse.json({
      data: formattedListings,
      meta: {
        current_page: filters.page || 1,
        last_page: Math.ceil(total / (filters.limit || 20)),
        per_page: filters.limit || 20,
        total,
      },
    });
  } catch (error) {
    console.error("Error en GET /api/listings:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
