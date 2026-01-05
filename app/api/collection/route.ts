export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";

// GET /api/collection - Obtener la colección del usuario con estadísticas
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const slotClient = (prisma as any).collectionCardSlot;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sortBy") || "";
  const sortOrder = searchParams.get("sortOrder") || "asc";
  const includeSlots = searchParams.get("includeSlots") === "1";
  const parseList = (key: string) =>
    (searchParams.get(key) ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const selectedSets = parseList("sets");
  const selectedCodes = parseList("setCodes");
  const selectedColors = parseList("colors");
  const selectedRarities = parseList("rarities");
  const selectedCategories = parseList("categories");
  const selectedEffects = parseList("effects");
  const selectedTypes = parseList("types");
  const selectedCosts = parseList("costs");
  const selectedPower = parseList("power");
  const selectedAttributes = parseList("attributes");
  const selectedAltArts = parseList("altArts");
  const selectedRegion = searchParams.get("region") || "";
  const selectedCounter = searchParams.get("counter") || "";
  const selectedTrigger = searchParams.get("trigger") || "";

    // Buscar la colección del usuario
    let collection = await prisma.collection.findUnique({
      where: { userId: user.id },
      include: {
        _count: {
          select: { cards: true },
        },
      },
    });

    // Crear la colección si no existe (fallback para usuarios existentes sin migrar)
    if (!collection) {
      collection = await prisma.collection.create({
        data: { userId: user.id },
        include: {
          _count: {
            select: { cards: true },
          },
        },
      });
    }

    // Construir filtros para las cartas
    const cardFilters: any = { collectionId: collection.id };

    const cardConditions: any[] = [];

    if (search) {
      cardConditions.push({
        name: {
          contains: search,
          mode: "insensitive",
        },
      });
    }

    if (selectedSets.length) {
      cardConditions.push({
        sets: {
          some: {
            set: { code: { in: selectedSets } },
          },
        },
      });
    }

    if (selectedCodes.length) {
      cardConditions.push({
        OR: selectedCodes.map((code) => ({
          code: { contains: code, mode: "insensitive" },
        })),
      });
    }

    if (selectedColors.length) {
      cardConditions.push({
        colors: {
          some: {
            OR: selectedColors.map((color) => ({
              color: { equals: color, mode: "insensitive" },
            })),
          },
        },
      });
    }

    if (selectedTypes.length) {
      cardConditions.push({
        types: {
          some: {
            OR: selectedTypes.map((type) => ({
              type: { equals: type, mode: "insensitive" },
            })),
          },
        },
      });
    }

    if (selectedEffects.length) {
      cardConditions.push({
        effects: {
          some: {
            OR: selectedEffects.map((effect) => ({
              effect: { equals: effect, mode: "insensitive" },
            })),
          },
        },
      });
    }

    if (selectedRarities.length) {
      cardConditions.push({
        rarity: { in: selectedRarities },
      });
    }

    if (selectedCategories.length) {
      cardConditions.push({
        category: { in: selectedCategories },
      });
    }

    if (selectedCosts.length) {
      cardConditions.push({
        cost: { in: selectedCosts },
      });
    }

    if (selectedPower.length) {
      cardConditions.push({
        power: { in: selectedPower },
      });
    }

    if (selectedAttributes.length) {
      cardConditions.push({
        attribute: { in: selectedAttributes },
      });
    }

    if (selectedAltArts.length) {
      cardConditions.push({
        alternateArt: { in: selectedAltArts },
      });
    }

    if (selectedRegion) {
      cardConditions.push({
        region: selectedRegion,
      });
    }

    if (selectedCounter) {
      if (selectedCounter === "No counter") {
        cardConditions.push({ counter: null });
      } else {
        cardConditions.push({
          counter: { contains: selectedCounter, mode: "insensitive" },
        });
      }
    }

    if (selectedTrigger) {
      if (selectedTrigger === "No trigger") {
        cardConditions.push({ triggerCard: null });
      } else {
        cardConditions.push({
          triggerCard: { contains: selectedTrigger, mode: "insensitive" },
        });
      }
    }

    if (cardConditions.length) {
      cardFilters.card = { AND: cardConditions };
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
      case "quantity":
        orderBy = [{ quantity: sortOrder }];
        break;
      default:
        orderBy = [{ sortOrder: "asc" }, { createdAt: "asc" }];
        break;
    }

    // Obtener cartas con paginación (limit=0 significa sin límite)
    const offset = limit > 0 ? (page - 1) * limit : 0;

    const cards = await prisma.collectionCard.findMany({
      where: cardFilters,
      include: {
        card: {
          include: {
            colors: true,
            types: true,
            effects: true,
            sets: {
              include: {
                set: true,
              },
            },
          },
        },
      },
      orderBy,
      ...(limit > 0 && { skip: offset, take: limit }),
    });

    // Contar total de cartas para paginación
    const totalCards = await prisma.collectionCard.count({
      where: cardFilters,
    });

    const totalPages = limit > 0 ? Math.ceil(totalCards / limit) : 1;

    // Obtener estadísticas
    const stats = await prisma.collectionCard.aggregate({
      where: { collectionId: collection.id },
      _sum: { quantity: true },
      _count: { cardId: true },
    });

    // Obtener distribución por rareza
    const rarityDistribution = await prisma.collectionCard.findMany({
      where: { collectionId: collection.id },
      include: {
        card: {
          select: { rarity: true },
        },
      },
    });

    const rarityStats = rarityDistribution.reduce(
      (acc: Record<string, number>, item) => {
        const rarity = item.card.rarity || "Unknown";
        if (!acc[rarity]) {
          acc[rarity] = 0;
        }
        acc[rarity] += item.quantity;
        return acc;
      },
      {}
    );

    let slots: Array<{
      id: number;
      collectionCardId: number;
      sortOrder: number;
      cardId: number;
      card: any;
    }> = [];

    if (includeSlots && cards.length) {
      if (!slotClient) {
        return NextResponse.json(
          {
            error:
              "Collection slots not available. Run prisma migrate/generate.",
          },
          { status: 500 }
        );
      }
      const slotRows = await slotClient.findMany({
        where: {
          collectionId: collection.id,
          collectionCardId: { in: cards.map((item) => item.id) },
        },
        orderBy: { sortOrder: "asc" },
        include: {
          collectionCard: {
            include: {
              card: {
                include: {
                  colors: true,
                  types: true,
                  effects: true,
                  sets: {
                    include: {
                      set: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      slots = slotRows.map((slot) => ({
        id: slot.id,
        collectionCardId: slot.collectionCardId,
        sortOrder: slot.sortOrder,
        cardId: slot.collectionCard.cardId,
        card: slot.collectionCard.card,
      }));
    }

    return NextResponse.json({
      collection: {
        id: collection.id,
        userId: collection.userId,
        isPublic: collection.isPublic,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
        stats: {
          totalUniqueCards: stats._count.cardId,
          totalCardsCount: stats._sum.quantity || 0,
          rarityDistribution: rarityStats,
        },
      },
      cards,
      slots,
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
    console.error("[api/collection] Error al obtener colección:", error);
    return handleAuthError(error);
  }
}

// PATCH /api/collection - Actualizar configuración de la colección
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const { isPublic } = body;

    const collection = await prisma.collection.update({
      where: { userId: user.id },
      data: {
        ...(typeof isPublic === "boolean" && { isPublic }),
      },
    });

    return NextResponse.json({ collection });
  } catch (error) {
    console.error("[api/collection] Error al actualizar colección:", error);
    return handleAuthError(error);
  }
}
