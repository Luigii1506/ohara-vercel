export const dynamic = 'force-dynamic';

// app/api/decks/[uniqueUrl]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;

    // Buscar el deck mediante su URL única y traer sus cartas asociadas
    const decks = await prisma.deck.findMany({
      where: { userId: parseInt(userId) },
      include: {
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

    if (!decks) {
      return NextResponse.json(
        { error: "Deck no encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json(decks, { status: 200 });
  } catch (error: any) {
    console.error("Error obteniendo deck:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
