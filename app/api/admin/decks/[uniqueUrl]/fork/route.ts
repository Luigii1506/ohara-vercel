export const dynamic = 'force-dynamic';

// app/api/decks/[uniqueUrl]/fork/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Función para generar un URL único para cada deck
function generateUniqueUrl() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { uniqueUrl: string } }
) {
  try {
    const { uniqueUrl } = params;
    // El payload incluye el nuevo nombre (opcional) y la nueva configuración de cartas
    const { name, cards } = await req.json();

    if (!name) {
      return NextResponse.json(
        { error: "El campo 'name' es obligatorio." },
        { status: 400 }
      );
    }
    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json(
        { error: "Debe incluir cartas para forkar el deck." },
        { status: 400 }
      );
    }

    // Verificar que el deck original exista
    const originalDeck = await prisma.deck.findUnique({
      where: { uniqueUrl },
      select: { id: true, name: true },
    });
    if (!originalDeck) {
      return NextResponse.json(
        { error: "Deck original no encontrado." },
        { status: 404 }
      );
    }

    // Validar las cartas del payload del fork (las que el usuario quiere usar)
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

    // Validaciones para el deck que se desea crear por fork:
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

    // Crear el deck forkeado con la configuración enviada y registrar el deck original
    const forkedDeck = await prisma.deck.create({
      data: {
        name: name || `${originalDeck.name} Fork`,
        uniqueUrl: generateUniqueUrl(),
        originalDeckId: originalDeck.id,
        deckCards: {
          create: cards.map((c: any) => ({
            cardId: c.cardId,
            quantity: c.quantity,
          })),
        },
      },
      include: { deckCards: { include: { card: true } } },
    });

    return NextResponse.json(forkedDeck, { status: 201 });
  } catch (error: any) {
    console.error("Error al forkar deck:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
