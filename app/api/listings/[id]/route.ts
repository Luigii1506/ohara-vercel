export const dynamic = 'force-dynamic';

// API Route para obtener un listado específico - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/listings/[id]
 * Obtener un listado específico por ID (público)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const listingId = parseInt(params.id);
    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "ID de listado inválido" },
        { status: 400 }
      );
    }

    // Obtener listado con datos relacionados
    const listing = await prisma.cardListing.findUnique({
      where: {
        id: listingId,
        isActive: true, // Solo listados activos
      },
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
            sellerProfile: {
              select: {
                storeName: true,
                rating: true,
                reviewsCount: true,
              },
            },
          },
        },
      },
    });

    await prisma.$disconnect();

    if (!listing) {
      return NextResponse.json(
        { error: "Listado no encontrado" },
        { status: 404 }
      );
    }

    // Formatear respuesta para compatibilidad con el cliente
    const formattedListing = {
      id: listing.id,
      seller_id: listing.sellerId,
      title: listing.card.name,
      description: listing.card.name,
      price: Number(listing.price) / 100, // Convertir centavos a dólares
      currency: "USD",
      status: "active" as const,
      condition: listing.conditionForSale,
      language: "ES",
      quantity: listing.stock,
      image: listing.card.src,
      created_at: listing.listingDate.toISOString(),
      updated_at: listing.updatedAt.toISOString(),
      seller: listing.seller
        ? {
            id: listing.seller.id,
            name: listing.seller.name,
            image: listing.seller.image,
            store_name: listing.seller.sellerProfile?.storeName,
            rating: listing.seller.sellerProfile?.rating,
            reviews_count: listing.seller.sellerProfile?.reviewsCount,
          }
        : null,
      card: {
        id: listing.card.id,
        name: listing.card.name,
        code: listing.card.code,
        rarity: listing.card.rarity || "",
        set: listing.card.sets?.[0]?.set?.title || listing.card.setCode,
      },
    };

    return NextResponse.json({
      data: formattedListing,
    });
  } catch (error) {
    console.error("Error en GET /api/listings/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
