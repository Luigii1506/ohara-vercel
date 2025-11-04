export const dynamic = 'force-dynamic';

// app/api/decks/[uniqueUrl]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { uniqueUrl: string } }
) {
  try {
    const { uniqueUrl } = params;

    // Buscar el deck mediante su URL única y traer sus cartas asociadas
    const deck = await prisma.deck.findUnique({
      where: { uniqueUrl },
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
