export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";

// GET /api/lists/collection - Obtener o crear la lista "Colección" del usuario
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Obtener parámetros de consulta para paginación y filtros
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "name"; // name, cost, rarity, createdAt
    const sortOrder = searchParams.get("sortOrder") || "asc"; // asc, desc

    // Buscar o crear la lista "Colección"
    let collection = await prisma.userList.findFirst({
      where: {
        userId: user.id,
        isCollection: true,
      },
      include: {
        _count: {
          select: { cards: true },
        },
      },
    });

    // Crear la colección si no existe
    if (!collection) {
      try {
        collection = await prisma.userList.create({
          data: {
            userId: user.id,
            name: "Colección",
            description: "Tu colección personal de cartas",
            isOrdered: false,
            isDeletable: false,
            isCollection: true,
            isPublic: false,
            totalPages: 1,
          },
          include: {
            _count: {
              select: { cards: true },
            },
          },
        });
      } catch (createError: any) {
        // Si falla por constraint único, buscar la colección existente
        if (
          createError.code === "P2002" &&
          createError.meta?.target?.includes("userId_isCollection")
        ) {
          console.log("Colección ya existe, buscando...");
          collection = await prisma.userList.findFirst({
            where: {
              userId: user.id,
              isCollection: true,
            },
            include: {
              _count: {
                select: { cards: true },
              },
            },
          });

          if (!collection) {
            throw new Error(
              "No se pudo crear ni encontrar la lista de colección"
            );
          }
        } else {
          throw createError;
        }
      }
    }

    // Construir filtros para las cartas
    const cardFilters: any = { listId: collection.id };

    if (search) {
      cardFilters.card = {
        name: {
          contains: search,
          mode: "insensitive",
        },
      };
    }

    // Configurar ordenamiento
    let orderBy: any = [{ createdAt: "asc" }];

    switch (sortBy) {
      case "name":
        orderBy = [{ card: { name: sortOrder } }];
        break;
      case "cost":
        orderBy = [{ card: { cost: sortOrder } }];
        break;
      case "rarity":
        orderBy = [{ card: { rarity: sortOrder } }];
        break;
      case "createdAt":
        orderBy = [{ createdAt: sortOrder }];
        break;
      default:
        if (collection.isOrdered) {
          orderBy = [{ page: "asc" }, { row: "asc" }, { column: "asc" }];
        } else {
          orderBy = [{ sortOrder: "asc" }, { createdAt: "asc" }];
        }
    }

    // Obtener cartas con paginación
    const offset = (page - 1) * limit;

    const cards = await prisma.userListCard.findMany({
      where: cardFilters,
      include: {
        card: {
          include: {
            colors: true,
            types: true,
            sets: {
              include: {
                set: true,
              },
            },
          },
        },
      },
      orderBy,
      skip: offset,
      take: limit,
    });

    // Contar total de cartas para paginación
    const totalCards = await prisma.userListCard.count({
      where: cardFilters,
    });

    const totalPages = Math.ceil(totalCards / limit);

    // Obtener estadísticas adicionales para la colección
    const stats = await prisma.userListCard.groupBy({
      by: ["cardId"],
      where: { listId: collection.id },
      _sum: {
        quantity: true,
      },
    });

    const totalUniqueCards = stats.length;
    const totalCardsCount = stats.reduce(
      (sum, stat) => sum + (stat._sum.quantity || 0),
      0
    );

    // Obtener distribución por rareza
    const rarityDistribution = await prisma.userListCard.findMany({
      where: { listId: collection.id },
      include: {
        card: {
          select: { rarity: true },
        },
      },
    });

    const rarityStats = rarityDistribution.reduce((acc: any, item) => {
      const rarity = item.card.rarity || "Unknown";
      if (!acc[rarity]) {
        acc[rarity] = 0;
      }
      acc[rarity] += item.quantity;
      return acc;
    }, {});

    return NextResponse.json({
      collection: {
        ...collection,
        stats: {
          totalUniqueCards,
          totalCardsCount,
          rarityDistribution: rarityStats,
        },
      },
      cards,
      pagination: {
        currentPage: page,
        totalPages,
        totalCards,
        limit,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      filters: {
        search,
        sortBy,
        sortOrder,
      },
    });
  } catch (error) {
    console.error("Error al obtener colección:", error);
    return handleAuthError(error);
  }
}
