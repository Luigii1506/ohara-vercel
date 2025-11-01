export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Card } from "@prisma/client";

const prisma = new PrismaClient();

// Extensión de tipos según uso
type CardWithCount = Card & { numOfVariations?: number };
type CardWithAlternates = Card & { alternates: Card[] };
// Define un tipo para las cartas alternas con las propiedades necesarias
type AlternateCard = {
  id: number;
  src: string;
  code: string;
  alias: string | null;
  order: string;
};

// Función optimizada para obtener el índice de orden según el prefijo
function getPrefixIndex(code: string): number {
  if (code.startsWith("OP")) return 0;
  if (code.startsWith("EB")) return 1;
  if (code.startsWith("ST")) return 2;
  if (code.startsWith("P")) return 3;
  if (code.startsWith("PRB")) return 4;
  return 4;
}

// Función auxiliar para obtener el primer número del alias
function getAliasNumber(alias: string | null): number {
  if (!alias) return 0;
  const trimmed = alias.trim();
  const match = trimmed.match(/^\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

export async function GET(req: NextRequest) {
  // Parámetros de la query string
  const setCode = req.nextUrl.searchParams.get("setCode");

  // Definimos las opciones para incluir relaciones (si corresponde)
  const includeOptions = {
    types: { select: { type: true } },
    colors: { select: { color: true } },
    texts: { select: { text: true } },
    sets: { select: { set: { select: { title: true } } } },
    effects: { select: { effect: true } },
    rulings: {
      select: {
        answer: true,
        question: true,
      },
    },
    conditions: { select: { condition: true } },
  };

  // Función auxiliar para obtener el primer número del alias
  function getAliasNumber(alias: string | null): number {
    if (!alias) return 0;
    const trimmed = alias.trim();
    const match = trimmed.match(/^\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  try {
    // 1. Se obtienen las cartas first edition
    const firstEditionCards: CardWithAlternates[] = (
      await prisma.card.findMany({
        where: {
          ...(setCode ? { setCode } : {}),
          isFirstEdition: true,
        },
        include: includeOptions,
        orderBy: { code: "asc" },
      })
    ).map((card) => ({ ...card, alternates: [] }));

    // 2. Se obtienen las cartas no first edition cuyos códigos estén presentes en las first edition
    const codes = firstEditionCards.map((card) => card.code);
    const alternateCards: AlternateCard[] = await prisma.card.findMany({
      where: {
        ...(setCode ? { setCode } : {}),
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

    // 3. Agrupamos las cartas alternas por código
    const alternatesByCode: Record<string, AlternateCard[]> = {};
    for (const alt of alternateCards) {
      if (!alternatesByCode[alt.code]) {
        alternatesByCode[alt.code] = [];
      }
      alternatesByCode[alt.code].push(alt);
    }

    // Ordenamos cada grupo de alternates según el primer número del alias (de forma ascendente)
    for (const code in alternatesByCode) {
      alternatesByCode[code].sort((a, b) => {
        const numA = getAliasNumber(a.order);
        const numB = getAliasNumber(b.order);
        return numA - numB;
      });
    }

    // 4. Se adjuntan las cartas alternas a cada carta first edition
    const cardsWithAlternates = firstEditionCards.map((card) => ({
      ...card,
      alternates: alternatesByCode[card.code] || [],
    }));

    // 5. Ordenamos las cartas first edition (se mantienen las alternates en el orden ya establecido)
    const sortedCards = cardsWithAlternates.sort((a, b) => {
      const idxA = getPrefixIndex(a.code);
      const idxB = getPrefixIndex(b.code);
      if (idxA !== idxB) return idxA - idxB;
      return a.code.localeCompare(b.code);
    });

    return NextResponse.json(sortedCards, { status: 200 });
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
    } = body;

    // Buscamos si existe una carta con el mismo code y que sea isFirstEdition true
    const existingCard = await prisma.card.findFirst({
      where: {
        code,
        isFirstEdition: true,
      },
      include: {
        types: true,
        colors: true,
        effects: true,
        conditions: true,
        texts: true,
      },
    });

    let newCard: Card;
    if (existingCard) {
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
      } = existingCard;

      // Se arma el objeto de datos para la nueva carta,
      // copiando toda la info de la carta encontrada y sobrescribiendo los campos indicados.
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
        types:
          existingCard.types.length > 0
            ? { create: existingCard.types.map((t: any) => ({ type: t.type })) }
            : undefined,
        colors:
          existingCard.colors.length > 0
            ? {
                create: existingCard.colors.map((c: any) => ({
                  color: c.color,
                })),
              }
            : undefined,
        effects:
          existingCard.effects.length > 0
            ? {
                create: existingCard.effects.map((e: any) => ({
                  effect: e.effect,
                })),
              }
            : undefined,
        conditions:
          existingCard.conditions.length > 0
            ? {
                create: existingCard.conditions.map((c: any) => ({
                  condition: c.condition,
                })),
              }
            : undefined,
        texts:
          existingCard.texts.length > 0
            ? { create: existingCard.texts.map((t: any) => ({ text: t.text })) }
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
        },
      });
    }

    // En ambos casos, se usan los setIds enviados en el body para crear las relaciones en CardSet
    if (setIds && Array.isArray(setIds)) {
      const setRelations = setIds.map((setId: number) => ({
        cardId: newCard.id,
        setId,
      }));

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
