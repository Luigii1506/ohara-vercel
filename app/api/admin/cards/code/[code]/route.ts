export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const cardFamilyInclude = {
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
} as const;

// GET: Obtener una carta por ID con soporte para "includeAlternates"
export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const { code } = params;
  const region = req.nextUrl.searchParams.get("region")?.trim() || null;

  try {
    // Leer el parámetro "includeAlternates" de la query (si existe)
    const includeAlternates = req.nextUrl.searchParams.get("includeAlternates");
    const includeAlternatesBool = includeAlternates === "true";

    const cardsByCode = await prisma.card.findMany({
      where: {
        code,
        ...(region
          ? region === "US"
            ? {
                OR: [{ region: "US" }, { region: null }, { region: "" }],
              }
            : { region }
          : {}),
      },
      include: cardFamilyInclude,
      orderBy: [
        { isFirstEdition: "desc" },
        { baseCardId: "asc" },
        { id: "asc" },
      ],
    });

    if (!cardsByCode.length) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const card =
      cardsByCode.find((item) => item.isFirstEdition) ??
      cardsByCode.find((item) => item.baseCardId === null) ??
      cardsByCode[0];

    let alternates: typeof cardsByCode = [];
    if (includeAlternatesBool) {
      alternates = cardsByCode.filter((item) => item.id !== card.id);
    }

    // Retornar la carta base y sus alternas si corresponde
    return NextResponse.json({ card, alternates }, { status: 200 });
  } catch (error: any) {
    console.error("Error en GET /api/cards/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
