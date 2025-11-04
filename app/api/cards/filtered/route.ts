import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Función optimizada para obtener el índice de orden según el prefijo
function getPrefixIndex(code: string): number {
  if (code.startsWith("OP")) return 0;
  if (code.startsWith("EB")) return 1;
  if (code.startsWith("ST")) return 2;
  if (code.startsWith("P")) return 3;
  if (code.startsWith("PRB")) return 4;
  return 4;
}

function getAliasNumber(alias: string | null): number {
  if (!alias) return 0;
  const trimmed = alias.trim();
  const match = trimmed.match(/^\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    // Extraer filtros de URL
    const colors = searchParams.get("colors")?.split(",").filter(Boolean) || [];
    const sets = searchParams.get("sets")?.split(",").filter(Boolean) || [];
    const rarities = searchParams.get("rarities")?.split(",").filter(Boolean) || [];
    const types = searchParams.get("types")?.split(",").filter(Boolean) || [];
    const costs = searchParams.get("costs")?.split(",").filter(Boolean) || [];
    const power = searchParams.get("power")?.split(",").filter(Boolean) || [];
    const attributes = searchParams.get("attributes")?.split(",").filter(Boolean) || [];
    const search = searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "24");
    const page = parseInt(searchParams.get("page") || "1");

    // Construir where clause dinámico
    const where: any = {
      isFirstEdition: true,
    };

    if (colors.length > 0) {
      where.colors = {
        some: {
          color: { in: colors.map(c => c.toUpperCase()) }
        }
      };
    }

    if (sets.length > 0) {
      where.sets = {
        some: {
          set: {
            title: { in: sets }
          }
        }
      };
    }

    if (rarities.length > 0) {
      where.rarity = { in: rarities };
    }

    if (types.length > 0) {
      where.types = {
        some: {
          type: { in: types }
        }
      };
    }

    if (costs.length > 0) {
      where.cost = { in: costs };
    }

    if (power.length > 0) {
      where.power = { in: power };
    }

    if (attributes.length > 0) {
      where.attribute = { in: attributes };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Incluir relaciones necesarias
    const includeOptions = {
      types: { select: { type: true } },
      colors: { select: { color: true } },
      texts: { select: { text: true } },
      sets: { select: { set: { select: { title: true } } } },
      effects: { select: { effect: true } },
    };

    // 1. Obtener cartas first edition con filtros
    const firstEditionCards = await prisma.card.findMany({
      where,
      include: includeOptions,
      orderBy: { code: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    // 2. Obtener alternates para estas cartas
    const codes = firstEditionCards.map((card) => card.code);
    const alternateCards = await prisma.card.findMany({
      where: {
        isFirstEdition: false,
        code: { in: codes },
      },
      select: {
        id: true,
        src: true,
        code: true,
        alternateArt: true,
        alias: true,
        tcgUrl: true,
        order: true,
        isPro: true,
        region: true,
        sets: {
          select: {
            set: {
              select: {
                title: true,
                id: true,
              },
            },
          },
        },
      },
    });

    // 3. Agrupar alternates por código
    const alternatesByCode: Record<string, any[]> = {};
    for (const alt of alternateCards) {
      if (!alternatesByCode[alt.code]) {
        alternatesByCode[alt.code] = [];
      }
      alternatesByCode[alt.code].push(alt);
    }

    // Ordenar alternates
    for (const code in alternatesByCode) {
      alternatesByCode[code].sort((a, b) => {
        const numA = getAliasNumber(a.order);
        const numB = getAliasNumber(b.order);
        return numA - numB;
      });
    }

    // 4. Combinar cartas con alternates
    const cardsWithAlternates = firstEditionCards.map((card) => ({
      ...card,
      alternates: alternatesByCode[card.code] || [],
    }));

    // 5. Ordenar
    const sortedCards = cardsWithAlternates.sort((a, b) => {
      const idxA = getPrefixIndex(a.code);
      const idxB = getPrefixIndex(b.code);
      if (idxA !== idxB) return idxA - idxB;
      return a.code.localeCompare(b.code);
    });

    // Obtener total count para paginación
    const total = await prisma.card.count({ where });

    return NextResponse.json({
      cards: sortedCards,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      }
    });

  } catch (error) {
    console.error("Error en GET /api/cards/filtered:", error);
    return NextResponse.json(
      { error: "Error al obtener cartas filtradas" },
      { status: 500 }
    );
  }
}
