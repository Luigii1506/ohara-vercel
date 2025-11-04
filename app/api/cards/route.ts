// API para obtener todas las cartas - Ohara TCG
// Fecha de modificación: 2025-01-19 - Migrado de MongoDB a Prisma/MySQL

import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const limit = searchParams.get("limit");
    const setCode = searchParams.get("setCode");
    const rarity = searchParams.get("rarity");

    // Construir condiciones de filtro
    const where: any = {};

    // Filtro por búsqueda (nombre o código)
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }

    // Filtro por set
    if (setCode) {
      where.setCode = setCode;
    }

    // Filtro por rareza
    if (rarity) {
      where.rarity = rarity;
    }

    // Obtener cartas con límite opcional
    const cardsQuery = {
      where,
      select: {
        id: true,
        uuid: true,
        src: true,
        name: true,
        alias: true,
        cost: true,
        power: true,
        attribute: true,
        counter: true,
        category: true,
        life: true,
        rarity: true,
        illustrator: true,
        alternateArt: true,
        status: true,
        triggerCard: true,
        code: true,
        setCode: true,
        tcgUrl: true,
        isFirstEdition: true,
        order: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { setCode: "asc" as const },
        { order: "asc" as const },
        { name: "asc" as const },
      ],
    };

    // Aplicar límite si se especifica
    if (limit) {
      const limitNum = parseInt(limit);
      if (!isNaN(limitNum) && limitNum > 0) {
        (cardsQuery as any).take = limitNum;
      }
    }

    const cards = await prisma.card.findMany(cardsQuery);

    return NextResponse.json({
      success: true,
      data: cards,
      count: cards.length,
    });
  } catch (error) {
    console.error("Error fetching cards:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch cards",
        message: "Error interno del servidor",
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
