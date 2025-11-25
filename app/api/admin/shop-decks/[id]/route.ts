export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const validateCardsPayload = async (cards: any[]) => {
  if (!cards || !Array.isArray(cards) || cards.length === 0) {
    throw new Error("Debe incluir cartas para guardar el deck.");
  }

  const cardIds = cards.map((c) => c.cardId);
  const dbCards = await prisma.card.findMany({
    where: { id: { in: cardIds } },
    select: { id: true, category: true, code: true },
  });

  let leaderCount = 0;
  let totalNonLeaderCards = 0;
  const codeQuantities: Record<string, number> = {};

  for (const { cardId, quantity } of cards) {
    const found = dbCards.find((c) => c.id === cardId);
    if (!found) {
      throw new Error(`La carta con id ${cardId} no existe.`);
    }
    if (found.category === "Leader") {
      leaderCount += quantity;
    } else {
      totalNonLeaderCards += quantity;
    }
    if (!codeQuantities[found.code]) {
      codeQuantities[found.code] = 0;
    }
    codeQuantities[found.code] += quantity;
  }

  if (leaderCount !== 1) {
    throw new Error(`Se requiere exactamente 1 carta Leader, tienes ${leaderCount}.`);
  }

  if (totalNonLeaderCards !== 50) {
    throw new Error(
      `El deck debe tener 50 cartas no Leader, tienes ${totalNonLeaderCards}.`
    );
  }

  for (const code in codeQuantities) {
    if (codeQuantities[code] > 4) {
      throw new Error(
        `La carta con código '${code}' excede 4 copias (${codeQuantities[code]}).`
      );
    }
  }
};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deckId = Number(params.id);
    const deck = await prisma.deck.findUnique({
      where: { id: deckId },
      include: {
        deckCards: {
          include: {
            card: {
              include: {
                colors: true,
                types: true,
                sets: {
                  select: {
                    set: {
                      select: {
                        title: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!deck || !deck.isShopDeck) {
      return NextResponse.json(
        { error: "Deck de tienda no encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json(deck, { status: 200 });
  } catch (error: any) {
    console.error("Error obteniendo deck de tienda:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deckId = Number(params.id);
    const body = await req.json();
    const { name, cards, shopSlug, shopUrl, isPublished = false } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "El nombre del deck es obligatorio." },
        { status: 400 }
      );
    }
    const normalizedSlug = slugify(shopSlug || name);
    if (!normalizedSlug) {
      return NextResponse.json(
        { error: "Define un slug válido para la tienda." },
        { status: 400 }
      );
    }

    if (!shopUrl) {
      return NextResponse.json(
        { error: "La URL de la tienda es obligatoria." },
        { status: 400 }
      );
    }

    let normalizedUrl: string;
    try {
      const parsedUrl = new URL(shopUrl);
      normalizedUrl = parsedUrl.toString();
    } catch {
      return NextResponse.json(
        { error: "La URL de la tienda no es válida." },
        { status: 400 }
      );
    }

    const existingDeck = await prisma.deck.findUnique({
      where: { id: deckId },
      select: { id: true, isShopDeck: true },
    });

    if (!existingDeck || !existingDeck.isShopDeck) {
      return NextResponse.json(
        { error: "Deck de tienda no encontrado." },
        { status: 404 }
      );
    }

    const slugConflict = await prisma.deck.findFirst({
      where: {
        shopSlug: normalizedSlug,
        NOT: { id: deckId },
      },
      select: { id: true },
    });

    if (slugConflict) {
      return NextResponse.json(
        { error: "El slug ya está en uso por otro deck." },
        { status: 409 }
      );
    }

    await validateCardsPayload(cards);

    const updatedDeck = await prisma.$transaction(async (tx) => {
      await tx.deckCard.deleteMany({
        where: { deckId },
      });

      return tx.deck.update({
        where: { id: deckId },
        data: {
          name: name.trim(),
          isPublished: Boolean(isPublished),
          shopSlug: normalizedSlug,
          shopUrl: normalizedUrl,
          deckCards: {
            create: cards.map((card: { cardId: number; quantity: number }) => ({
              cardId: card.cardId,
              quantity: card.quantity,
            })),
          },
        },
        include: {
          deckCards: {
            include: {
              card: true,
            },
          },
        },
      });
    });

    return NextResponse.json(updatedDeck, { status: 200 });
  } catch (error: any) {
    console.error("Error actualizando deck de tienda:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deckId = Number(params.id);

    const existingDeck = await prisma.deck.findUnique({
      where: { id: deckId },
      select: { id: true, isShopDeck: true },
    });

    if (!existingDeck || !existingDeck.isShopDeck) {
      return NextResponse.json(
        { error: "Deck de tienda no encontrado." },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.deckCard.deleteMany({
        where: { deckId },
      });
      await tx.deck.delete({
        where: { id: deckId },
      });
    });

    return NextResponse.json(
      { message: "Deck eliminado correctamente." },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error eliminando deck de tienda:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
