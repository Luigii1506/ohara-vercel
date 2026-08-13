export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";
import { buildDirectWhere } from "@/lib/cards/query";
import type { CardsFilters } from "@/lib/cards/types";

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

    // Construir filtros para las cartas — misma búsqueda compuesta que
    // /card-list y el resto del catálogo (buildDirectWhere), en vez de la
    // condición ad hoc anterior (`name contains search`, sin código/set/keywords).
    const cardFilters: any = { collectionId: collection.id };

    const cardsFilters: CardsFilters = {
      search: search || undefined,
      sets: selectedSets.length ? selectedSets : undefined,
      setCodes: selectedCodes.length ? selectedCodes : undefined,
      colors: selectedColors.length ? selectedColors : undefined,
      rarities: selectedRarities.length ? selectedRarities : undefined,
      categories: selectedCategories.length ? selectedCategories : undefined,
      costs: selectedCosts.length ? selectedCosts : undefined,
      power: selectedPower.length ? selectedPower : undefined,
      attributes: selectedAttributes.length ? selectedAttributes : undefined,
      types: selectedTypes.length ? selectedTypes : undefined,
      effects: selectedEffects.length ? selectedEffects : undefined,
      altArts: selectedAltArts.length ? selectedAltArts : undefined,
      region: selectedRegion || undefined,
      counter: selectedCounter || undefined,
      trigger: selectedTrigger || undefined,
      // Colección debe mostrar cartas de TODAS las regiones salvo que el
      // usuario pida una explícita — buildDirectWhere por defecto escopea a
      // la región default (US), lo cual escondería cartas propias de otras
      // regiones si no se pide esto.
      skipRegionScope: !selectedRegion,
    };

    const cardWhere = buildDirectWhere(cardsFilters);
    if (Object.keys(cardWhere).length > 0) {
      cardFilters.card = cardWhere;
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

      slots = slotRows.map(
        (slot: {
          id: number;
          collectionCardId: number;
          sortOrder: number;
          collectionCard: { cardId: number; card: any };
        }) => ({
          id: slot.id,
          collectionCardId: slot.collectionCardId,
          sortOrder: slot.sortOrder,
          cardId: slot.collectionCard.cardId,
          card: slot.collectionCard.card,
        })
      );
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
