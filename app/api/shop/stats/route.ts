export const dynamic = 'force-dynamic';

// API Routes para estadísticas y alertas del vendedor - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSellerStats, getLowStockAlerts } from "@/lib/shop/services";
import { canManageProducts } from "@/lib/shop/utils";

/**
 * GET /api/shop/stats
 * Obtener estadísticas del vendedor
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
        { success: false, error: "No tienes permisos para ver estadísticas" },
        { status: 403 }
      );
    }

    // Obtener estadísticas
    const statsResult = await getSellerStats(user.id);
    await prisma.$disconnect();

    if (!statsResult.success) {
      return NextResponse.json(
        { success: false, error: statsResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: statsResult.data,
    });
  } catch (error) {
    console.error("Error en GET /api/shop/stats:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
