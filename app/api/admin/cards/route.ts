import { NextRequest, NextResponse } from "next/server";
import {
  buildFiltersFromSearchParams,
  fetchCardsPageFromDb,
} from "@/lib/cards/query";
import prisma from "@/lib/prisma";
import type { Card } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const setCode = searchParams.get("setCode");
    const includeRelations = searchParams.get("includeRelations") === "true";
    const includeAlternatesParam = searchParams.get("includeAlternates");
    const includeAlternates =
      includeAlternatesParam === null || includeAlternatesParam === "true";
    const includeCounts = searchParams.get("includeCounts") === "true";
    const limitParam = searchParams.get("limit");
    const cursorParam = searchParams.get("cursor");
    const paginate =
      cursorParam !== null ||
      (limitParam !== null && !Number.isNaN(Number(limitParam)));

    const filters = buildFiltersFromSearchParams(searchParams);

    if (setCode) {
      filters.sets = filters.sets ?? [];
      if (!filters.sets.includes(setCode)) {
        filters.sets.push(setCode);
      }
    }

    const limit =
      limitParam && !Number.isNaN(Number(limitParam))
        ? Math.min(Number(limitParam), 200)
        : 50;
    const cursor = cursorParam ? Number(cursorParam) : null;

    const result = await fetchCardsPageFromDb({
      filters,
      limit,
      cursor,
      includeRelations,
      includeAlternates,
      includeCounts,
    });

    if (paginate) {
      return NextResponse.json(result, { status: 200 });
    }

    return NextResponse.json(result.items, { status: 200 });
  } catch (error: any) {
    console.error("Error en GET /api/cards:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      src,
      illustrator,
      alternateArt,
      setCode,
      code,
      setIds,
      // Estos campos se usan en el caso de no encontrar una carta previa.
      name,
      cost,
      power,
      attribute,
      counter,
      category,
      life,
      rarity,
      status,
      triggerCard,
      tcgUrl,
      isFirstEdition,
      alias,
      types,
      colors,
      effects,
      conditions,
      texts,
      isPro,
      region,
      order,
      baseCardId: rawBaseCardId,
    } = body;

    let providedBaseCardId: number | null = null;
    if (
      rawBaseCardId !== undefined &&
      rawBaseCardId !== null &&
      rawBaseCardId !== ""
    ) {
      const parsedBaseCardId = Number(rawBaseCardId);
      if (!Number.isInteger(parsedBaseCardId) || parsedBaseCardId <= 0) {
        return NextResponse.json(
          { error: "baseCardId must be a positive integer" },
          { status: 400 }
        );
      }
      providedBaseCardId = parsedBaseCardId;
    }

    const templateInclude = {
      types: true,
      colors: true,
      effects: true,
      conditions: true,
      texts: true,
    };

    let templateCard: (Card & {
      types: { type: string }[];
      colors: { color: string }[];
      effects: { effect: string }[];
      conditions: { condition: string }[];
      texts: { text: string }[];
    }) | null = null;

    if (providedBaseCardId) {
      templateCard = await prisma.card.findUnique({
        where: { id: providedBaseCardId },
        include: templateInclude,
      });
      if (!templateCard) {
        return NextResponse.json(
          { error: "Base card not found" },
          { status: 400 }
        );
      }
    } else if (code) {
      templateCard = await prisma.card.findFirst({
        where: {
          code,
          isFirstEdition: true,
        },
        include: templateInclude,
      });
    }

    let newCard: Card;
    if (templateCard) {
      // Copiamos la información de la carta existente, excepto los campos que queremos sobrescribir
      // Desestructuramos para eliminar id y los campos a sobrescribir
      const {
        uuid,
        id, // no se copia
        src: _,
        illustrator: __,
        alternateArt: ___,
        setCode: ____,
        alias: _____,
        tcgUrl: ______,
        // El resto de los campos de la carta encontrada se agrupa en "otherData"
        ...otherData
      } = templateCard;

      // Se arma el objeto de datos para la nueva carta,
      // copiando toda la info de la carta encontrada y sobrescribiendo los campos indicados.
      const baseCardId =
        providedBaseCardId ?? templateCard.baseCardId ?? templateCard.id;

      const newCardData = {
        ...otherData,
        src, // campo sobrescrito
        illustrator, // campo sobrescrito
        alternateArt, // campo sobrescrito
        setCode, // campo sobrescrito
        isFirstEdition: false,
        tcgUrl,
        alias,
        order: order || "0", // Asegurar que siempre tenga un valor
        baseCardId,
        types:
          templateCard.types.length > 0
            ? { create: templateCard.types.map((t: any) => ({ type: t.type })) }
            : undefined,
        colors:
          templateCard.colors.length > 0
            ? {
                create: templateCard.colors.map((c: any) => ({
                  color: c.color,
                })),
              }
            : undefined,
        effects:
          templateCard.effects.length > 0
            ? {
                create: templateCard.effects.map((e: any) => ({
                  effect: e.effect,
                })),
              }
            : undefined,
        conditions:
          templateCard.conditions.length > 0
            ? {
                create: templateCard.conditions.map((c: any) => ({
                  condition: c.condition,
                })),
              }
            : undefined,
        texts:
          templateCard.texts.length > 0
            ? { create: templateCard.texts.map((t: any) => ({ text: t.text })) }
            : undefined,
        isPro,
        region,
      };

      newCard = await prisma.card.create({
        data: newCardData,
      });
    } else {
      // Si no se encontró una carta existente, se crea la carta usando todos los datos enviados
      newCard = await prisma.card.create({
        data: {
          src,
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
          alias,
          conditions: conditions
            ? { create: conditions.map((condition: string) => ({ condition })) }
            : undefined,
          types: types
            ? { create: types.map((type: string) => ({ type })) }
            : undefined,
          colors: colors
            ? { create: colors.map((color: string) => ({ color })) }
            : undefined,
          effects: effects
            ? { create: effects.map((effect: string) => ({ effect })) }
            : undefined,
          texts: texts
            ? { create: texts.map((text: string) => ({ text })) }
            : undefined,
          isPro,
          region,
          order: order || "0", // Asegurar que siempre tenga un valor
          baseCardId: providedBaseCardId ?? null,
        },
      });
    }

    // En ambos casos, se usan los setIds enviados en el body para crear las relaciones en CardSet
    if (setIds && Array.isArray(setIds)) {
      const setRelations = setIds
        .map((setId: number | string) => ({
          cardId: newCard.id,
          setId: Number(setId),
        }))
        .filter((relation) => !Number.isNaN(relation.setId));

      await prisma.cardSet.createMany({
        data: setRelations,
      });
    }

    // Se consulta la carta recién creada junto con sus relaciones para devolverla
    const fullCard = await prisma.card.findUnique({
      where: { id: newCard.id },
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

    return NextResponse.json(fullCard, { status: 201 });
  } catch (error: any) {
    console.error("Error en POST /api/cards:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
