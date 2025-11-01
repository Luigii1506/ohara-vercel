export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET: Obtener una carta por ID con soporte para "includeAlternates"
export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const { code } = params;

  try {
    // Leer el parámetro "includeAlternates" de la query (si existe)
    const includeAlternates = req.nextUrl.searchParams.get("includeAlternates");
    const includeAlternatesBool = includeAlternates === "true";

    // Obtener la carta por ID
    const card = await prisma.card.findFirst({
      where: {
        code: code, // Matching `code` con la carta base
        isFirstEdition: true, // Solo cartas que no son de primera edición
      },
      include: {
        types: true,
        colors: true,
        effects: true,
        conditions: true,
        //priceLogs: true,
        texts: true,
        rulings: true,
        sets: {
          include: {
            set: true,
          },
        },
      },
    });

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    let alternates: Array<
      | (typeof card & {
          types: { id: number; cardId: number; type: string }[];
          colors: { id: number; cardId: number; color: string }[];
          effects: { id: number; cardId: number; effect: string }[];
          conditions: { id: number; cardId: number; condition: string }[];
          texts: { id: number; cardId: number; text: string }[];
        })
      | null
    > = []; // Inicializar un array con tipado para las cartas alternas
    // Si includeAlternates es true, buscamos las cartas alternas con el mismo `code` pero `isFirstEdition: false`
    if (includeAlternatesBool) {
      alternates = await prisma.card.findMany({
        where: {
          code: card.code, // Matching `code` con la carta base
          isFirstEdition: false, // Solo cartas que no son de primera edición
        },
        include: {
          types: true,
          colors: true,
          effects: true,
          conditions: true,
          texts: true,
          rulings: true,
          sets: {
            include: {
              set: true,
            },
          },
        },
      });
    }

    // Retornar la carta base y sus alternas si corresponde
    return NextResponse.json({ card, alternates }, { status: 200 });
  } catch (error: any) {
    console.error("Error en GET /api/cards/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
