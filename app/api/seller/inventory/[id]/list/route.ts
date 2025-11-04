export const dynamic = 'force-dynamic';

// API para activar productos del inventario para listado - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticación
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Verificar que el usuario tiene permisos de vendedor
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
    });

    if (!user || (user.role !== "SELLER" && user.role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Permisos insuficientes" },
        { status: 403 }
      );
    }

    // Obtener el ID del producto del inventario
    const inventoryItemId = parseInt(params.id);
    if (isNaN(inventoryItemId)) {
      return NextResponse.json(
        { error: "ID de producto inválido" },
        { status: 400 }
      );
    }

    // Verificar que el producto existe y pertenece al vendedor
    const inventoryItem = await prisma.cardListing.findFirst({
      where: {
        id: inventoryItemId,
        sellerId: user.id,
      },
      include: {
        card: true,
      },
    });

    if (!inventoryItem) {
      return NextResponse.json(
        { error: "Producto no encontrado en tu inventario" },
        { status: 404 }
      );
    }

    // Verificar que el producto no esté ya activo
    if (inventoryItem.isActive && !inventoryItem.isDraft) {
      return NextResponse.json(
        { error: "Este producto ya está listado para venta" },
        { status: 400 }
      );
    }

    // Verificar que tiene stock disponible
    if (inventoryItem.stock <= 0) {
      return NextResponse.json(
        { error: "No puedes listar un producto sin stock" },
        { status: 400 }
      );
    }

    // Obtener datos del body si se envían (por si quieren cambiar precio)
    const body = await request.json().catch(() => ({}));
    const { listPrice } = body;

    // Preparar datos de actualización
    const updateData: any = {
      isActive: true,
      isDraft: false,
      listingDate: new Date(),
    };

    // Si se proporciona un nuevo precio, actualizarlo (convertir a centavos)
    if (listPrice && typeof listPrice === "number" && listPrice > 0) {
      updateData.price = Math.round(listPrice * 100);
    }

    // Activar el producto para venta
    const updatedItem = await prisma.cardListing.update({
      where: { id: inventoryItemId },
      data: updateData,
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
      },
    });

    return NextResponse.json({
      success: true,
      message: "Producto listado exitosamente",
      data: {
        id: updatedItem.id,
        uuid: updatedItem.uuid,
        card: {
          id: updatedItem.card.id,
          name: updatedItem.card.name,
          code: updatedItem.card.code,
          src: updatedItem.card.src,
          setCode: updatedItem.card.setCode,
        },
        price: Number(updatedItem.price) / 100,
        stock: updatedItem.stock,
        condition: updatedItem.conditionForSale,
        isActive: updatedItem.isActive,
        isDraft: updatedItem.isDraft,
        listingDate: updatedItem.listingDate,
      },
    });
  } catch (error) {
    console.error("Error listing inventory item:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
