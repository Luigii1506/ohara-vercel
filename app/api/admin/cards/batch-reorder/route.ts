export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/admin/cards/batch-reorder - Reordenar múltiples cartas alternas eficientemente
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reorderData } = body;

    // Validar que se proporcione data de reordenamiento
    if (!reorderData || !Array.isArray(reorderData)) {
      return NextResponse.json(
        {
          error: "Se requiere un array de datos de reordenamiento",
        },
        { status: 400 }
      );
    }

    // Validar estructura de datos
    for (const item of reorderData) {
      if (!item.id || item.order === undefined) {
        return NextResponse.json(
          {
            error: "Cada elemento debe tener 'id' y 'order'",
          },
          { status: 400 }
        );
      }
    }

    // Extraer IDs para verificar existencia
    const cardIds = reorderData.map((item: any) => parseInt(item.id));

    // Verificar que todas las cartas existan
    const existingCards = await prisma.card.findMany({
      where: {
        id: { in: cardIds },
      },
      select: {
        id: true,
        order: true,
      },
    });

    if (existingCards.length !== cardIds.length) {
      return NextResponse.json(
        {
          error: "Una o más cartas no se encontraron",
          found: existingCards.length,
          expected: cardIds.length,
        },
        { status: 400 }
      );
    }

    // Preparar actualizaciones batch
    const orderUpdates: Array<{ id: number; order: string }> = [];

    for (const item of reorderData) {
      const cardId = parseInt(item.id);
      const newOrder = item.order.toString();

      orderUpdates.push({
        id: cardId,
        order: newOrder,
      });
    }

    // Verificar que no haya órdenes duplicados
    const orders = orderUpdates.map((update) => update.order);
    const uniqueOrders = new Set(orders);
    if (orders.length !== uniqueOrders.size) {
      return NextResponse.json(
        {
          error: "Se detectaron órdenes duplicados",
          orders: orders,
        },
        { status: 400 }
      );
    }

    // Ejecutar todas las actualizaciones en una sola transacción
    const updatedCards = await prisma.$transaction(async (tx) => {
      const results = [];

      // Usar updateMany cuando sea posible, o individuales si necesario
      for (const update of orderUpdates) {
        const result = await tx.card.update({
          where: { id: update.id },
          data: { order: update.order },
          select: {
            id: true,
            order: true,
            alias: true,
          },
        });
        results.push(result);
      }

      return results;
    });

    return NextResponse.json({
      message: `${updatedCards.length} cartas reordenadas exitosamente`,
      updatedCards: updatedCards,
      summary: {
        processed: updatedCards.length,
        successful: updatedCards.length,
        failed: 0,
      },
    });
  } catch (error: any) {
    console.error("❌ Error en batch-reorder:", error);

    return NextResponse.json(
      {
        error: "Error interno del servidor al reordenar cartas",
        message: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
