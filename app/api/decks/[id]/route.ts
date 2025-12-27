export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";

// GET - Fetch deck by ID or uniqueUrl (public)
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const deckId = parseInt(id, 10);
    const isNumericId = !isNaN(deckId);

    // Query by id if numeric, otherwise by uniqueUrl
    const deck = await prisma.deck.findUnique({
      where: isNumericId ? { id: deckId } : { uniqueUrl: id },
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
                texts: true,
                effects: true,
                conditions: true,
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

// PUT - Update deck (only owner or admin)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = params;
    const deckId = parseInt(id, 10);

    if (isNaN(deckId)) {
      return NextResponse.json(
        { error: "ID de deck inválido" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { payloadCards, name } = body;

    // Verify deck exists and user has permission
    const existingDeck = await prisma.deck.findUnique({
      where: { id: deckId },
      select: { id: true, userId: true },
    });

    if (!existingDeck) {
      return NextResponse.json(
        { error: "Deck no encontrado." },
        { status: 404 }
      );
    }

    // Check ownership (allow admins to edit any deck)
    if (
      existingDeck.userId !== parseInt(session.user.id) &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "No tienes permiso para editar este deck." },
        { status: 403 }
      );
    }

    // Update deck in a transaction
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

// DELETE - Delete deck (only owner or admin)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = params;
    const deckId = parseInt(id, 10);

    if (isNaN(deckId)) {
      return NextResponse.json(
        { error: "ID de deck inválido" },
        { status: 400 }
      );
    }

    // Verify deck exists and user has permission
    const existingDeck = await prisma.deck.findUnique({
      where: { id: deckId },
      select: { id: true, userId: true },
    });

    if (!existingDeck) {
      return NextResponse.json(
        { error: "Deck no encontrado." },
        { status: 404 }
      );
    }

    // Check ownership (allow admins to delete any deck)
    if (
      existingDeck.userId !== parseInt(session.user.id) &&
      session.user.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "No tienes permiso para eliminar este deck." },
        { status: 403 }
      );
    }

    // Delete deck and its cards in a transaction
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
