export const dynamic = 'force-dynamic';

// app/api/decks/[uniqueUrl]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Buscar el deck mediante su URL única y traer sus cartas asociadas
    const deck = await prisma.deck.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
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
      },
    });

    if (!deck) {
      return NextResponse.json(
        { error: "Deck no encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json(deck, { status: 200 });
  } catch (error: any) {
    console.error("Error obteniendo deck:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const deckId = parseInt(id, 10);
    const body = await req.json();
    const { payloadCards, name } = body; // payloadCards: [{ cardId: number, quantity: number }, ...], name: string

    // Verificar que el deck exista
    const deckExists = await prisma.deck.findUnique({
      where: { id: deckId },
    });

    if (!deckExists) {
      return NextResponse.json(
        { error: "Deck no encontrado." },
        { status: 404 }
      );
    }

    // Usamos una transacción para:
    // 1. Eliminar todas las cartas actuales del deck
    // 2. Actualizar el nombre del deck si se proporciona
    // 3. Crear las nuevas cartas según el payload
    const updatedDeck = await prisma.$transaction(async (tx) => {
      await tx.deckCard.deleteMany({
        where: { deckId },
      });

      const updateData: any = {
        deckCards: {
          create: payloadCards.map(
            (card: { cardId: number; quantity: number }) => ({
              cardId: card.cardId,
              quantity: card.quantity,
            })
          ),
        },
      };

      // Solo actualizar el nombre si se proporciona
      if (name !== undefined) {
        updateData.name = name;
      }

      const deck = await tx.deck.update({
        where: { id: deckId },
        data: updateData,
        include: {
          deckCards: {
            include: {
              card: true,
            },
          },
        },
      });

      return deck;
    });

    return NextResponse.json(updatedDeck, { status: 200 });
  } catch (error: any) {
    console.error("Error updating deck:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const deckId = parseInt(id, 10);

    // Verificar que el deck exista
    const deckExists = await prisma.deck.findUnique({
      where: { id: deckId },
    });

    if (!deckExists) {
      return NextResponse.json(
        { error: "Deck no encontrado." },
        { status: 404 }
      );
    }

    // Usamos una transacción para eliminar primero las cartas asociadas y luego el deck
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
    console.error("Error eliminando deck:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
