export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const generateUniqueUrl = () =>
  Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export async function GET(req: NextRequest) {
  try {
    const includeUnpublished =
      req.nextUrl.searchParams.get("includeUnpublished") === "true";

    const decks = await prisma.deck.findMany({
      where: {
        isShopDeck: true,
        ...(includeUnpublished ? {} : { isPublished: true }),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        deckCards: { include: { card: true } },
        user: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(decks, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching shop decks:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, cards, shopSlug, shopUrl, isPublished = false, userId } =
      await req.json();

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "El campo 'name' es obligatorio." },
        { status: 400 }
      );
    }

    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json(
        { error: "Debe incluir cartas para crear el deck." },
        { status: 400 }
      );
    }

    const normalizedSlug = slugify(shopSlug || name);
    if (!normalizedSlug) {
      return NextResponse.json(
        { error: "Debes definir un slug válido para la tienda." },
        { status: 400 }
      );
    }

    if (!shopUrl) {
      return NextResponse.json(
        { error: "Debes proporcionar la URL de la tienda." },
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

    const existingSlug = await prisma.deck.findUnique({
      where: { shopSlug: normalizedSlug },
    });

    if (existingSlug) {
      return NextResponse.json(
        { error: "El slug de la tienda ya está en uso." },
        { status: 409 }
      );
    }

    const cardIds = cards.map((c: any) => c.cardId);
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
        return NextResponse.json(
          { error: `La carta con id ${cardId} no existe.` },
          { status: 400 }
        );
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
      return NextResponse.json(
        {
          error: `Se requiere exactamente 1 carta Leader, tienes ${leaderCount}.`,
        },
        { status: 400 }
      );
    }

    if (totalNonLeaderCards !== 50) {
      return NextResponse.json(
        {
          error: `El deck debe tener 50 cartas no Leader, tienes ${totalNonLeaderCards}.`,
        },
        { status: 400 }
      );
    }

    for (const code in codeQuantities) {
      if (codeQuantities[code] > 4) {
        return NextResponse.json(
          {
            error: `La carta con código '${code}' excede 4 copias (${codeQuantities[code]}).`,
          },
          { status: 400 }
        );
      }
    }

    const newDeck = await prisma.deck.create({
      data: {
        name: name.trim(),
        uniqueUrl: generateUniqueUrl(),
        isShopDeck: true,
        isPublished: Boolean(isPublished),
        shopSlug: normalizedSlug,
        shopUrl: normalizedUrl,
        deckCards: {
          create: cards.map((c: any) => ({
            cardId: c.cardId,
            quantity: c.quantity,
          })),
        },
        userId: userId ? Number(userId) : undefined,
      },
      include: {
        deckCards: { include: { card: true } },
      },
    });

    return NextResponse.json(newDeck, { status: 201 });
  } catch (error: any) {
    console.error("Error creando deck de tienda:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
