export const dynamic = 'force-dynamic';

// app/api/decks/route.ts

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Función para generar un URL único para cada deck
function generateUniqueUrl() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

export async function POST(req: NextRequest) {
  try {
    const { name, cards, userId } = await req.json();

    if (!name) {
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

    // Extraer IDs de cartas del payload
    const cardIds = cards.map((c: any) => c.cardId);

    // Obtener la información necesaria de cada carta para validaciones
    const dbCards = await prisma.card.findMany({
      where: { id: { in: cardIds } },
      select: { id: true, category: true, code: true },
    });

    let leaderCount = 0;
    let totalNonLeaderCards = 0;
    const codeQuantities: Record<string, number> = {};

    // Validar cada carta según su categoría y cantidad
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

    // Validaciones específicas
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

    // Crear el deck y relacionarlo con el usuario (si se encontró)
    const newDeck = await prisma.deck.create({
      data: {
        name,
        uniqueUrl: generateUniqueUrl(),
        deckCards: {
          create: cards.map((c: any) => ({
            cardId: c.cardId,
            quantity: c.quantity,
          })),
        },
        userId: userId ? Number(userId) : undefined, // Relación con el usuario creador
      },
      include: {
        deckCards: { include: { card: true } },
      },
    });

    return NextResponse.json(newDeck, { status: 201 });
  } catch (error: any) {
    console.error("Error creando deck:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
