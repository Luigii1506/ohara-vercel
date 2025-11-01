export const dynamic = 'force-dynamic';

// API Routes para gestión de listados individuales de cartas - Ohara TCG Shop
// Fecha de modificación: 2025-01-19 - REFACTORIZADO para CardListing separado

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { updateCardListing, deactivateCardListing } from "@/lib/shop/services";
import { UpdateCardListingDto } from "@/lib/shop/types";
import { canManageProducts, dollarsToCents } from "@/lib/shop/utils";

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/shop/listings/[id]
 * Obtener un listado específico de carta
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const listingId = parseInt(params.id);
    if (isNaN(listingId)) {
      return NextResponse.json(
        { success: false, error: "ID de listado inválido" },
        { status: 400 }
      );
    }

    // Verificar autenticación
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    // Buscar usuario en la base de datos
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

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

    // Buscar el listado específico
    const listing = await prisma.cardListing.findFirst({
      where: {
        id: listingId,
        sellerId: user.id, // Solo el dueño puede ver sus listados
      },
      include: {
        card: {
          select: {
            id: true,
            uuid: true,
            name: true,
            code: true,
            setCode: true,
            rarity: true,
            src: true,
            category: true,
            cost: true,
            power: true,
            life: true,
          },
        },
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            sellerProfile: {
              select: {
                storeName: true,
                rating: true,
              },
            },
          },
        },
      },
    });

    await prisma.$disconnect();

    if (!listing) {
      return NextResponse.json(
        { success: false, error: "Listado no encontrado" },
        { status: 404 }
      );
    }

    // Formatear respuesta
    const response = {
      success: true,
      data: {
        id: listing.id,
        uuid: listing.uuid,
        cardId: listing.cardId,
        card: {
          id: listing.card.id,
          uuid: listing.card.uuid,
          name: listing.card.name,
          code: listing.card.code,
          setCode: listing.card.setCode,
          rarity: listing.card.rarity || undefined,
          src: listing.card.src,
          category: listing.card.category,
          cost: listing.card.cost || undefined,
          power: listing.card.power || undefined,
          life: listing.card.life || undefined,
        },
        sellerId: listing.sellerId,
        seller: listing.seller,
        price: listing.price.toNumber(), // Convertir de Decimal a number
        stock: listing.stock,
        conditionForSale: listing.conditionForSale,
        sku: listing.sku || undefined,
        isActive: listing.isActive,
        isDraft: listing.isDraft,
        isFeatured: listing.isFeatured,
        lowStockThreshold: listing.lowStockThreshold,
        listingDate: listing.listingDate,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error obteniendo listado:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/shop/listings/[id]
 * Actualizar un listado de carta
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const listingId = parseInt(params.id);
    if (isNaN(listingId)) {
      return NextResponse.json(
        { success: false, error: "ID de listado inválido" },
        { status: 400 }
      );
    }

    // Verificar autenticación
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    // Buscar usuario en la base de datos
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

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

    await prisma.$disconnect();

    // Parsear datos del cuerpo de la petición
    const body = await request.json();

    // Convertir precio de dólares a centavos si está presente
    const updateData: UpdateCardListingDto = {
      ...body,
      price: body.price ? dollarsToCents(body.price) : undefined,
    };

    // Actualizar usando el servicio
    const result = await updateCardListing(listingId, user.id, updateData);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error actualizando listado:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/shop/listings/[id]
 * Desactivar (soft delete) un listado de carta
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const listingId = parseInt(params.id);
    if (isNaN(listingId)) {
      return NextResponse.json(
        { success: false, error: "ID de listado inválido" },
        { status: 400 }
      );
    }

    // Verificar autenticación
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    // Buscar usuario en la base de datos
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

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

    await prisma.$disconnect();

    // Desactivar usando el servicio
    const result = await deactivateCardListing(listingId, user.id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Listado desactivado correctamente",
    });
  } catch (error) {
    console.error("Error desactivando listado:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
