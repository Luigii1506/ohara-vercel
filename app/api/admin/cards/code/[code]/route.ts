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
  localizations: {
    where: { language: "es" },
  },
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
  // Puede venir uno o varios códigos separados por coma (ej. "US,JP") — el
  // selector de región del sitio permite elegir más de una a la vez.
  const regions = (req.nextUrl.searchParams.get("region") ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);

  try {
    // Leer el parámetro "includeAlternates" de la query (si existe)
    const includeAlternates = req.nextUrl.searchParams.get("includeAlternates");
    const includeAlternatesBool = includeAlternates === "true";

    const cardsByCode = await prisma.card.findMany({
      where: {
        code,
        ...(regions.length
          ? {
              OR: [
                ...regions.map((region) => ({ region })),
                ...(regions.includes("US")
                  ? [{ region: null }, { region: "" }]
                  : []),
              ],
            }
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

    // Las cartas DON!! comparten un código genérico ("DON-001") entre decenas
    // de productos físicamente distintos y sin relación entre sí (confirmado:
    // cada una isFirstEdition=true, baseCardId=null, sin jerarquía real) — a
    // diferencia de una carta normal, donde "mismo código" SÍ significa
    // "misma carta, distintas ediciones/alternas". Agruparlas como familia
    // hacía que SIEMPRE se mostrara la primera creada (id más bajo) sin
    // importar cuál se pidió, y que las ~70 restantes aparecieran como
    // "variantes" de ella. Para DON, cada fila es su propia familia de una
    // sola carta — se usa la específicamente pedida (por cardId) y no se
    // arma ninguna lista de alternas.
    const isDonFamily = cardsByCode.every((item) => item.category === "DON");
    const requestedCardId = req.nextUrl.searchParams.get("cardId");

    let card: (typeof cardsByCode)[number];
    let alternates: typeof cardsByCode = [];

    if (isDonFamily) {
      card =
        (requestedCardId &&
          cardsByCode.find((item) => String(item.id) === requestedCardId)) ||
        cardsByCode[0];
    } else {
      // Comportamiento sin cambios para cartas normales: "card" es siempre
      // el ancla de la familia (first edition / base), no la variante
      // específicamente clickeada — eso es lo que espera el resto del flujo
      // (ej. la etiqueta "(Base)" en la lista de variantes).
      card =
        cardsByCode.find((item) => item.isFirstEdition) ??
        cardsByCode.find((item) => item.baseCardId === null) ??
        cardsByCode[0];

      if (includeAlternatesBool) {
        alternates = cardsByCode.filter((item) => item.id !== card.id);
      }
    }

    // Retornar la carta base y sus alternas si corresponde
    return NextResponse.json({ card, alternates }, { status: 200 });
  } catch (error: any) {
    console.error("Error en GET /api/cards/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
