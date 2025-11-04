export const dynamic = 'force-dynamic';

// API Routes para alertas de bajo stock - Ohara TCG Shop
// Fecha de modificación: 2025-01-19

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getLowStockAlerts } from "@/lib/shop/services";
import { canManageProducts } from "@/lib/shop/utils";

/**
 * GET /api/shop/alerts
 * Obtener alertas de bajo stock del vendedor
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
        { success: false, error: "No tienes permisos para ver alertas" },
        { status: 403 }
      );
    }

    // Obtener alertas de bajo stock
    const alertsResult = await getLowStockAlerts(user.id);
    await prisma.$disconnect();

    if (!alertsResult.success) {
      return NextResponse.json(
        { success: false, error: alertsResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: alertsResult.data,
    });
  } catch (error) {
    console.error("Error en GET /api/shop/alerts:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
