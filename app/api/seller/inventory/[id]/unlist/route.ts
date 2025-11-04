export const dynamic = 'force-dynamic';

// API para quitar productos de la lista - Ohara TCG Shop
// Fecha de modificación: 2025-01-19 - Desactivar listado desde inventario

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { canManageProducts } from "@/lib/shop/utils";

/**
 * POST /api/seller/inventory/[id]/unlist
 * Quitar producto de la venta (cambiar isActive a false)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticación
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
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
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Verificar permisos
    if (!canManageProducts(user.role)) {
      await prisma.$disconnect();
      return NextResponse.json(
        { error: "No tienes permisos para gestionar inventario" },
        { status: 403 }
      );
    }

    const inventoryId = parseInt(params.id);
    if (isNaN(inventoryId)) {
      await prisma.$disconnect();
      return NextResponse.json(
        { error: "ID de inventario inválido" },
        { status: 400 }
      );
    }

    // Buscar el item de inventario
    const inventoryItem = await prisma.cardListing.findFirst({
      where: {
        id: inventoryId,
        sellerId: user.id,
      },
      include: {
        card: true,
      },
    });

    if (!inventoryItem) {
      await prisma.$disconnect();
      return NextResponse.json(
        { error: "Item de inventario no encontrado" },
        { status: 404 }
      );
    }

    // Verificar si ya está inactivo
    if (!inventoryItem.isActive) {
      await prisma.$disconnect();
      return NextResponse.json(
        { error: "El producto ya está fuera de venta" },
        { status: 400 }
      );
    }

    // Actualizar el item para quitarlo de la lista
    const updatedItem = await prisma.cardListing.update({
      where: { id: inventoryId },
      data: {
        isActive: false,
        updatedAt: new Date(),
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
      },
    });

    await prisma.$disconnect();

    // Formatear respuesta
    const formattedItem = {
      id: updatedItem.id,
      cardId: updatedItem.cardId,
      card: {
        id: updatedItem.card.id,
        name: updatedItem.card.name,
        code: updatedItem.card.code,
        setCode: updatedItem.card.setCode,
        src: updatedItem.card.src,
        rarity: updatedItem.card.rarity,
        set: updatedItem.card.sets?.[0]?.set?.title || updatedItem.card.setCode,
      },
      sku: updatedItem.sku,
      currentStock: updatedItem.stock,
      listPrice: Number(updatedItem.price),
      condition: updatedItem.conditionForSale,
      isListed: updatedItem.isActive,
      listingDate: updatedItem.listingDate,
      updatedAt: updatedItem.updatedAt,
    };

    return NextResponse.json({
      success: true,
      message: "Producto removido de la venta exitosamente",
      data: formattedItem,
    });
  } catch (error) {
    console.error("Error en POST /api/seller/inventory/[id]/unlist:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
