// API para búsqueda de cartas del catálogo principal
// Fecha de modificación: 2025-01-19

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit") || "20");
    const page = parseInt(searchParams.get("page") || "1");
    const setCode = searchParams.get("setCode");
    const category = searchParams.get("category");

    const skip = (page - 1) * limit;

    // Construir condiciones de búsqueda
    const whereConditions: any = {};

    // Búsqueda por texto (nombre o código)
    if (query.trim()) {
      whereConditions.OR = [
        {
          name: {
            contains: query.trim(),
            mode: "insensitive",
          },
        },
        {
          code: {
            contains: query.trim(),
            mode: "insensitive",
          },
        },
        {
          alias: {
            contains: query.trim(),
            mode: "insensitive",
          },
        },
      ];
    }

    // Filtrar por set
    if (setCode) {
      whereConditions.setCode = setCode;
    }

    // Filtrar por categoría
    if (category) {
      whereConditions.category = category;
    }

    // Ejecutar búsqueda
    const [cards, total] = await Promise.all([
      prisma.card.findMany({
        where: whereConditions,
        include: {
          types: true,
          colors: true,
          sets: {
            include: {
              set: true,
            },
          },
        },
        orderBy: [
          {
            name: "asc",
          },
          {
            code: "asc",
          },
        ],
        skip,
        take: limit,
      }),
      prisma.card.count({
        where: whereConditions,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        cards,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error buscando cartas:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
