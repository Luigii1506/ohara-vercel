export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const deckId = parseInt(params.id);
    if (isNaN(deckId)) {
      return NextResponse.json(
        { error: "ID de deck inválido" },
        { status: 400 }
      );
    }

    // Obtener el deck original con sus cartas
    const originalDeck = await prisma.deck.findUnique({
      where: { id: deckId },
      include: {
        deckCards: {
          include: {
            card: true,
          },
        },
        user: true,
      },
    });

    if (!originalDeck) {
      return NextResponse.json(
        { error: "Deck no encontrado" },
        { status: 404 }
      );
    }

    // Verificar que el usuario no sea ya el propietario
    if (originalDeck.userId === parseInt(session.user.id)) {
      return NextResponse.json(
        { error: "No puedes copiar tu propio deck" },
        { status: 400 }
      );
    }

    // Generar un uniqueUrl único para el fork
    const generateUniqueUrl = () => {
      const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let result = "";
      for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    let uniqueUrl = generateUniqueUrl();

    // Verificar que el uniqueUrl sea único
    let existingDeck = await prisma.deck.findUnique({
      where: { uniqueUrl },
    });

    // Si existe, generar uno nuevo hasta encontrar uno único
    while (existingDeck) {
      uniqueUrl = generateUniqueUrl();
      existingDeck = await prisma.deck.findUnique({
        where: { uniqueUrl },
      });
    }

    // Crear el fork del deck
    const forkedDeck = await prisma.deck.create({
      data: {
        name: `${originalDeck.name} (Copia)`,
        uniqueUrl,
        originalDeckId: originalDeck.id, // Establecer la relación de fork
        userId: parseInt(session.user.id),
        description: originalDeck.description,
        deckCards: {
          create: originalDeck.deckCards.map((deckCard) => ({
            cardId: deckCard.cardId,
            quantity: deckCard.quantity,
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

    return NextResponse.json({
      id: forkedDeck.id,
      uniqueUrl: forkedDeck.uniqueUrl,
      name: forkedDeck.name,
      message: "Deck copiado exitosamente",
    });
  } catch (error) {
    console.error("Error creando fork del deck:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
