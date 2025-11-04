export const dynamic = 'force-dynamic';

// API Route para subir imágenes a listings de vendedor - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { canManageProducts } from "@/lib/shop/utils";

/**
 * POST /api/seller/listings/[id]/image
 * Subir imagen para un listado del vendedor
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { prisma } = await import("@/lib/prisma");

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    });

    if (!user || !canManageProducts(user.role)) {
      await prisma.$disconnect();
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const listingId = parseInt(params.id);
    if (isNaN(listingId)) {
      await prisma.$disconnect();
      return NextResponse.json(
        { error: "ID de listado inválido" },
        { status: 400 }
      );
    }

    // Verificar que el listado pertenece al vendedor
    const listing = await prisma.cardListing.findFirst({
      where: {
        id: listingId,
        sellerId: user.id,
      },
    });

    if (!listing) {
      await prisma.$disconnect();
      return NextResponse.json(
        { error: "Listado no encontrado" },
        { status: 404 }
      );
    }

    // Por ahora, respuesta básica - se puede expandir con almacenamiento real
    await prisma.$disconnect();

    return NextResponse.json({
      message: "Imagen subida exitosamente",
      listing_id: listingId,
      image_url: "/placeholder-image.jpg", // Placeholder por ahora
    });
  } catch (error) {
    console.error("Error en POST /api/seller/listings/[id]/image:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
