export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import type { Card } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type CardWithAlternates = Card & { alternates: Card[] };

type AlternateCard = {
  id: number;
  src: string;
  code: string;
  alias: string | null;
  order: string;
};

// GET: Obtener una carta por ID con soporte para "includeAlternates"
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    // Leer el parámetro "includeAlternates" de la query (si existe)
    const includeAlternates = req.nextUrl.searchParams.get("includeAlternates");
    const includeAlternatesBool = includeAlternates === "true";

    // Obtener la carta por ID
    const card = await prisma.card.findUnique({
      where: { id: parseInt(id) },
      include: {
        types: true,
        colors: true,
        effects: true,
        conditions: true,
        //priceLogs: true,
        texts: true,
        sets: {
          include: {
            set: true,
          },
        },
      },
    });

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    let alternates: Array<
      | (typeof card & {
          types: { id: number; cardId: number; type: string }[];
          colors: { id: number; cardId: number; color: string }[];
          effects: { id: number; cardId: number; effect: string }[];
          conditions: { id: number; cardId: number; condition: string }[];
          texts: { id: number; cardId: number; text: string }[];
        })
      | null
    > = []; // Inicializar un array con tipado para las cartas alternas
    // Si includeAlternates es true, buscamos las cartas alternas con el mismo `code` pero `isFirstEdition: false`
    if (includeAlternatesBool) {
      alternates = await prisma.card.findMany({
        where: {
          code: card.code, // Matching `code` con la carta base
          isFirstEdition: false, // Solo cartas que no son de primera edición
          id: { not: card.id }, // CRÍTICO: Excluir la carta actual para evitar duplicados
        },
        include: {
          types: true,
          colors: true,
          effects: true,
          conditions: true,
          texts: true,
          sets: {
            include: {
              set: true,
            },
          },
        },
      });
    }

    return NextResponse.json({ card, alternates }, { status: 200 });
  } catch (error: any) {
    console.error("Error en GET /api/cards/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // Función auxiliar para obtener el primer número del alias
  function getAliasNumber(alias: string | null): number {
    if (!alias) return 0;
    const trimmed = alias.trim();
    const match = trimmed.match(/^\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  try {
    const body = await req.json();

    // 🔍 DEBUG: Log what we're receiving
    console.log("🔍 API recibiendo datos para card ID:", id);
    console.log("🔍 Body completo:", JSON.stringify(body, null, 2));

    const {
      src,
      alias,
      name,
      cost,
      power,
      attribute,
      counter,
      category,
      life,
      rarity,
      illustrator,
      alternateArt,
      status,
      triggerCard,
      code,
      setCode,
      tcgUrl,
      isFirstEdition,
      types,
      colors,
      effects,
      conditions,
      setIds,
      order,
      texts, // Relación opcional: textos de la carta
      isPro,
      region,
    } = body;

    // Obtener los datos actuales de la carta
    const currentCard = await prisma.card.findUnique({
      where: { id: parseInt(id) },
    });

    if (!currentCard) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    // 🔧 FIXED: Build update data object with only provided fields
    const updateData: any = {};

    // Only add fields to updateData if they are provided (null values allowed to clear fields)
    if (src !== undefined) updateData.src = src;
    if (alias !== undefined) updateData.alias = alias;
    if (name !== undefined) updateData.name = name;
    if (cost !== undefined) updateData.cost = cost;
    if (power !== undefined) updateData.power = power;
    if (attribute !== undefined) updateData.attribute = attribute;
    if (counter !== undefined) updateData.counter = counter;
    if (category !== undefined) updateData.category = category;
    if (life !== undefined) updateData.life = life;
    if (rarity !== undefined) updateData.rarity = rarity;
    if (illustrator !== undefined) updateData.illustrator = illustrator;
    if (alternateArt !== undefined) updateData.alternateArt = alternateArt;
    if (status !== undefined) updateData.status = status;
    if (triggerCard !== undefined)
      updateData.triggerCard =
        triggerCard && triggerCard.trim() === "" ? null : triggerCard;
    if (code !== undefined) updateData.code = code;
    if (setCode !== undefined) updateData.setCode = setCode;
    if (tcgUrl !== undefined)
      updateData.tcgUrl = tcgUrl && tcgUrl.trim() === "" ? null : tcgUrl;
    if (isFirstEdition !== undefined)
      updateData.isFirstEdition = isFirstEdition;
    if (order !== undefined) updateData.order = order;
    if (isPro !== undefined) updateData.isPro = isPro;
    if (region !== undefined) updateData.region = region;

    // Handle relational data only if provided (including empty arrays to clear fields)
    if (types && Array.isArray(types)) {
      updateData.types = {
        deleteMany: {},
        ...(types.length > 0
          ? { create: types.map((type: string) => ({ type })) }
          : {}),
      };
    }

    if (colors && Array.isArray(colors)) {
      updateData.colors = {
        deleteMany: {},
        ...(colors.length > 0
          ? { create: colors.map((color: string) => ({ color })) }
          : {}),
      };
    }

    if (effects && Array.isArray(effects)) {
      updateData.effects = {
        deleteMany: {},
        ...(effects.length > 0
          ? {
              create: effects.map((effectObj: any) => ({
                effect:
                  typeof effectObj === "string" ? effectObj : effectObj.effect,
              })),
            }
          : {}),
      };
    }

    if (conditions && Array.isArray(conditions)) {
      updateData.conditions = {
        deleteMany: {},
        ...(conditions.length > 0
          ? {
              create: conditions.map((conditionObj: any) => ({
                condition:
                  typeof conditionObj === "string"
                    ? conditionObj
                    : conditionObj.condition,
              })),
            }
          : {}),
      };
    }

    if (texts && Array.isArray(texts)) {
      updateData.texts = {
        deleteMany: {},
        ...(texts.length > 0
          ? {
              create: texts.map((textObj: any) => ({
                text: typeof textObj === "string" ? textObj : textObj.text,
              })),
            }
          : {}),
      };
    }

    console.log(
      "🔍 Datos de actualización preparados:",
      JSON.stringify(updateData, null, 2)
    );

    // Inicializamos una transacción Prisma para manejar la actualización y el log consistentemente
    const updatedCard = await prisma.$transaction(async (tx) => {
      // Actualizamos la carta incluyendo solo los datos proporcionados
      const updated = await tx.card.update({
        where: { id: parseInt(id) },
        data: updateData,
      });

      console.log("🔍 Carta actualizada exitosamente:", updated.id);

      // Devolvemos la carta actualizada
      return updated;
    });

    // Manejar relaciones M-N con Sets (tabla pivote CardSet)
    if (setIds && Array.isArray(setIds)) {
      await prisma.cardSet.deleteMany({
        where: { cardId: updatedCard.id },
      });

      const setRelations = setIds.map((setId: number) => ({
        cardId: updatedCard.id,
        setId,
      }));

      await prisma.cardSet.createMany({
        data: setRelations,
      });
    }

    // Volvemos a obtener la carta actualizada con las relaciones incluidas
    const resultCard = await prisma.card.findUnique({
      where: { id: updatedCard.id },
      include: {
        types: true,
        colors: true,
        effects: true,
        conditions: true,
        texts: true,
        sets: {
          include: {
            set: true,
          },
        },
      },
    });

    // Inicializamos el arreglo de alternates en la respuesta
    let alternates: AlternateCard[] = [];

    // Si la carta actualizada es first edition, buscamos sus cartas alternas
    if (resultCard?.isFirstEdition) {
      alternates = await prisma.card.findMany({
        where: {
          setCode: resultCard.setCode,
          isFirstEdition: false,
          code: resultCard.code,
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

      // Ordenamos las alternates de forma ascendente según el número inicial del alias
      alternates.sort(
        (a, b) => getAliasNumber(a.order) - getAliasNumber(b.order)
      );
    }

    // Creamos el objeto de respuesta incluyendo la propiedad alternates
    const resultCardWithAlternates = {
      ...resultCard,
      alternates,
    };

    return NextResponse.json(resultCardWithAlternates, { status: 200 });
  } catch (error: any) {
    console.error("Error en PUT /api/cards/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// * DELETE: Eliminar una carta por ID, incluyendo la limpieza de relaciones
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    // Primero eliminamos las relaciones asociadas para garantizar la integridad referencial
    await prisma.cardType.deleteMany({
      where: { cardId: parseInt(id) },
    });
    await prisma.cardColor.deleteMany({
      where: { cardId: parseInt(id) },
    });
    await prisma.cardEffect.deleteMany({
      where: { cardId: parseInt(id) },
    });
    await prisma.cardCondition.deleteMany({
      where: { cardId: parseInt(id) },
    });
    await prisma.cardSet.deleteMany({
      where: { cardId: parseInt(id) },
    });

    // Luego eliminamos la carta
    await prisma.card.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json(
      { message: "Card and its relationships deleted successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error en DELETE /api/cards/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
