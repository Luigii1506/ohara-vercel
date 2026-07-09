// Resolución batch de códigos de carta → datos mínimos para el visor de replay.
//
// Los logs de OPTCGSim referencian cartas por código (OP11-040, ST25-003, P-084…).
// Cada código tiene varias filas en la BD (regiones + artes alternativos); aquí
// elegimos UNA carta canónica por código: arte base, priorizando región US→EN→JP.
//
// POST { codes: string[] } → { cards: { [code]: MinimalCard } }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface MinimalCard {
  id: number;
  code: string;
  name: string;
  src: string;
  category: string;
  cost: string | null;
  power: string | null;
  life: string | null;
}

// Menor score = carta preferida.
function scoreRow(row: {
  region: string | null;
  language: string | null;
  baseCardId: number | null;
  alternateArt: string | null;
}): number {
  let score = 0;
  // Preferir arte base (no alternativo / manga).
  if (row.alternateArt) score += 40;
  if (row.baseCardId !== null) score += 20;
  // Preferir región/idioma inglés, luego japonés, luego el resto.
  const region = row.region ?? "";
  const lang = row.language ?? "";
  if (region === "US" || lang === "en") score += 0;
  else if (region === "JP" || lang === "ja") score += 5;
  else if (region === "" ) score += 6;
  else score += 9; // CN, FR, KR, TH…
  return score;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const codes: string[] = Array.isArray(body?.codes) ? body.codes : [];
    const unique = Array.from(new Set(codes.filter((c) => typeof c === "string" && c)));

    if (unique.length === 0) {
      return NextResponse.json({ cards: {} }, { status: 200 });
    }

    const rows = await prisma.card.findMany({
      where: { code: { in: unique } },
      select: {
        id: true,
        code: true,
        name: true,
        src: true,
        category: true,
        cost: true,
        power: true,
        life: true,
        region: true,
        language: true,
        baseCardId: true,
        alternateArt: true,
      },
    });

    // Elegir la mejor fila por código.
    const best = new Map<string, { score: number; card: MinimalCard }>();
    for (const row of rows) {
      const score = scoreRow(row);
      const current = best.get(row.code);
      if (!current || score < current.score) {
        best.set(row.code, {
          score,
          card: {
            id: row.id,
            code: row.code,
            name: row.name,
            src: row.src,
            category: row.category,
            cost: row.cost,
            power: row.power,
            life: row.life,
          },
        });
      }
    }

    const cards: Record<string, MinimalCard> = {};
    best.forEach((v, code) => {
      cards[code] = v.card;
    });

    return NextResponse.json({ cards }, { status: 200 });
  } catch (error) {
    console.error("Error resolving cards by codes:", error);
    return NextResponse.json({ error: "Failed to resolve cards" }, { status: 500 });
  }
}
