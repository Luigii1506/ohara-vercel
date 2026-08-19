export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/products/sleeves
// Catálogo completo de sleeves (productType SLEEVE) para el picker del modal
// "Agregar cartas". Es un catálogo curado y acotado (~170 filas), así que se
// trae en una sola consulta — sin paginar — con el mínimo de columnas que
// la UI necesita. Excluye los "Sleeved Booster Pack" (paquetes que VIENEN
// con sleeve, no diseños de reverso) directo en el WHERE, en vez de traerlos
// y descartarlos en el cliente.
export async function GET() {
  try {
    const items = await prisma.product.findMany({
      where: {
        productType: "SLEEVE",
        isArchived: false,
        NOT: { name: { contains: "booster", mode: "insensitive" } },
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        thumbnailUrl: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(
      { items },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("[api/products/sleeves] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sleeves" },
      { status: 500 }
    );
  }
}
