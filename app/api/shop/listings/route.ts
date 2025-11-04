export const dynamic = 'force-dynamic';

// API Routes para gestión de listados de cartas - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createCardListing, getSellerCardListings } from "@/lib/shop/services";
import { CreateCardListingDto, ProductFilters } from "@/lib/shop/types";
import { canManageProducts, dollarsToCents } from "@/lib/shop/utils";

/**
 * GET /api/shop/listings
 * Obtener listados de cartas del vendedor actual
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    // Buscar usuario en la base de datos
    const { prisma } = await import("@/lib/prisma");

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    });

    if (!user) {
      await prisma.$disconnect();
      return NextResponse.json(
        { success: false, error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Verificar permisos
    if (!canManageProducts(user.role)) {
      await prisma.$disconnect();
      return NextResponse.json(
        {
          success: false,
          error: "No tienes permisos para gestionar productos",
        },
        { status: 403 }
      );
    }

    // Obtener parámetros de consulta
    const { searchParams } = new URL(request.url);
    const filters: ProductFilters = {
      search: searchParams.get("search") || undefined,
      isActive: searchParams.get("isActive")
        ? searchParams.get("isActive") === "true"
        : undefined,
      isDraft: searchParams.get("isDraft")
        ? searchParams.get("isDraft") === "true"
        : undefined,
      isFeatured: searchParams.get("isFeatured")
        ? searchParams.get("isFeatured") === "true"
        : undefined,
      inStock: searchParams.get("inStock")
        ? searchParams.get("inStock") === "true"
        : undefined,
      lowStock: searchParams.get("lowStock")
        ? searchParams.get("lowStock") === "true"
        : undefined,
      minPrice: searchParams.get("minPrice")
        ? Number(searchParams.get("minPrice"))
        : undefined,
      maxPrice: searchParams.get("maxPrice")
        ? Number(searchParams.get("maxPrice"))
        : undefined,
      sortBy: (searchParams.get("sortBy") as any) || "listingDate",
      sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") || "desc",
      page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 20,
    };

    // Obtener listados
    const result = await getSellerCardListings(user.id, filters);
    await prisma.$disconnect();

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("Error en GET /api/shop/listings:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/shop/listings
 * Crear un nuevo listado de carta para venta
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    // Buscar usuario en la base de datos
    const { prisma } = await import("@/lib/prisma");

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    });

    if (!user) {
      await prisma.$disconnect();
      return NextResponse.json(
        { success: false, error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Verificar permisos
    if (!canManageProducts(user.role)) {
      await prisma.$disconnect();
      return NextResponse.json(
        { success: false, error: "No tienes permisos para crear listados" },
        { status: 403 }
      );
    }

    // Parsear datos del request
    const body = await request.json();

    // Convertir precio de dólares a centavos si viene en formato de dólares
    const price =
      typeof body.price === "string"
        ? dollarsToCents(parseFloat(body.price))
        : body.price;

    const listingData: CreateCardListingDto = {
      cardId: body.cardId,
      price: price,
      stock: body.stock,
      conditionForSale: body.conditionForSale,
      sku: body.sku,
      isFeatured: body.isFeatured || false,
      lowStockThreshold: body.lowStockThreshold || 5,
    };

    // Crear listado
    const result = await createCardListing(user.id, listingData);
    await prisma.$disconnect();

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error en POST /api/shop/listings:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
