export const dynamic = 'force-dynamic';

// API para gestión individual de listados del vendedor
// Fecha de modificación: 2025-01-19

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - Obtener listado por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || (user.role !== "SELLER" && user.role !== "ADMIN")) {
      return NextResponse.json(
        { success: false, error: "Sin permisos de vendedor" },
        { status: 403 }
      );
    }

    const listingId = parseInt(params.id);

    const listing = await prisma.cardListing.findFirst({
      where: {
        id: listingId,
        sellerId: user.id, // Solo puede ver sus propios listados
      },
      include: {
        card: {
          include: {
            types: true,
            colors: true,
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
            email: true,
          },
        },
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { success: false, error: "Listado no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: listing,
    });
  } catch (error) {
    console.error("Error obteniendo listado:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PUT - Actualizar listado
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || (user.role !== "SELLER" && user.role !== "ADMIN")) {
      return NextResponse.json(
        { success: false, error: "Sin permisos de vendedor" },
        { status: 403 }
      );
    }

    const listingId = parseInt(params.id);
    const body = await request.json();

    // Verificar que el listado existe y pertenece al usuario
    const existingListing = await prisma.cardListing.findFirst({
      where: {
        id: listingId,
        sellerId: user.id,
      },
    });

    if (!existingListing) {
      return NextResponse.json(
        { success: false, error: "Listado no encontrado" },
        { status: 404 }
      );
    }

    const {
      price,
      stock,
      conditionForSale,
      sku,
      lowStockThreshold,
      isFeatured,
      isDraft,
      isActive,
    } = body;

    // Validaciones
    if (price !== undefined && price <= 0) {
      return NextResponse.json(
        { success: false, error: "El precio debe ser positivo" },
        { status: 400 }
      );
    }

    if (stock !== undefined && stock < 0) {
      return NextResponse.json(
        { success: false, error: "El stock no puede ser negativo" },
        { status: 400 }
      );
    }

    // Construir datos de actualización solo con campos proporcionados
    const updateData: any = {};

    if (price !== undefined)
      updateData.price = Math.round(parseFloat(price) * 100);
    if (stock !== undefined) updateData.stock = parseInt(stock);
    if (conditionForSale !== undefined)
      updateData.conditionForSale = conditionForSale;
    if (sku !== undefined) updateData.sku = sku;
    if (lowStockThreshold !== undefined)
      updateData.lowStockThreshold = parseInt(lowStockThreshold);
    if (isFeatured !== undefined) updateData.isFeatured = Boolean(isFeatured);
    if (isDraft !== undefined) updateData.isDraft = Boolean(isDraft);
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    // Actualizar listado
    const updatedListing = await prisma.cardListing.update({
      where: { id: listingId },
      data: updateData,
      include: {
        card: true,
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedListing,
      message: "Listado actualizado exitosamente",
    });
  } catch (error) {
    console.error("Error actualizando listado:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE - Desactivar listado (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || (user.role !== "SELLER" && user.role !== "ADMIN")) {
      return NextResponse.json(
        { success: false, error: "Sin permisos de vendedor" },
        { status: 403 }
      );
    }

    const listingId = parseInt(params.id);

    // Verificar que el listado existe y pertenece al usuario
    const existingListing = await prisma.cardListing.findFirst({
      where: {
        id: listingId,
        sellerId: user.id,
      },
    });

    if (!existingListing) {
      return NextResponse.json(
        { success: false, error: "Listado no encontrado" },
        { status: 404 }
      );
    }

    // Desactivar listado (soft delete)
    const updatedListing = await prisma.cardListing.update({
      where: { id: listingId },
      data: {
        isActive: false,
        isDraft: true, // Convertir a borrador al desactivar
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedListing,
      message: "Listado desactivado exitosamente",
    });
  } catch (error) {
    console.error("Error desactivando listado:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
