export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * GET /api/market/cards?tab=movers|gems|dip|prize&tf=7|30|90&limit=
 *
 * Lee CardPriceStat (precomputado) para el dashboard de mercado:
 *  - movers: las que más suben en el timeframe.
 *  - gems:   baratas pero subiendo sostenido (sleepers).
 *  - dip:    cartas fuertes con descuento desde su máximo (comprar la baja).
 *  - prize:  alt-arts de evento/prize con momentum.
 */

// Filtros anti-ruido: precio con piso/techo (evita céntimos y listings absurdos)
// e historial mínimo (confianza).
const FLOOR = 1; // USD
const CEIL = 3000; // USD (arriba casi siempre son asks sin vendedores)
const MIN_POINTS = 20;

const PRIZE_KEYWORDS =
  /winner|finalist|top player|place|trophy|serial|treasure|event|regional|judge|champion|jumbo|participation|release|pre-?release/i;

const cardSelect = {
  id: true,
  code: true,
  name: true,
  src: true,
  alternateArt: true,
  rarity: true,
  region: true,
  tcgUrl: true,
  sets: { select: { set: { select: { title: true } } } },
} satisfies Prisma.CardSelect;

export async function GET(req: NextRequest) {
  try {
    const tab = req.nextUrl.searchParams.get("tab") ?? "movers";
    const tf = req.nextUrl.searchParams.get("tf") ?? "30";
    const limit = Math.min(
      Math.max(Number(req.nextUrl.searchParams.get("limit")) || 50, 10),
      100
    );
    const pctField =
      tf === "7" ? "pct7d" : tf === "90" ? "pct90d" : "pct30d";

    const priceFloor = { gte: FLOOR, lte: CEIL };

    let where: Prisma.CardPriceStatWhereInput;
    let orderBy: Prisma.CardPriceStatOrderByWithRelationInput;

    if (tab === "gems") {
      // Baratas ($1–$15) pero subiendo sostenido (30d y 90d positivos).
      where = {
        points: { gte: MIN_POINTS },
        priceNow: { gte: 1, lte: 15 },
        pct30d: { gte: 20 },
        pct90d: { gte: 0 },
        card: { OR: [{ region: "US" }, { region: null }] },
      };
      orderBy = { pct30d: "desc" };
    } else if (tab === "dip") {
      // Cartas fuertes (ATH alto) con descuento >= 25% desde su máximo.
      where = {
        points: { gte: MIN_POINTS },
        priceNow: { gte: 5, lte: CEIL },
        ath: { gte: 20 },
        athPct: { lte: -25, gte: -95 },
        card: { OR: [{ region: "US" }, { region: null }] },
      };
      orderBy = { athPct: "asc" }; // mayor descuento primero
    } else if (tab === "prize") {
      // Alt-arts de evento/prize con momentum (30d positivo).
      where = {
        points: { gte: MIN_POINTS },
        priceNow: priceFloor,
        pct30d: { gt: 0 },
        card: {
          OR: [{ region: "US" }, { region: null }],
          alternateArt: { not: null },
        },
      };
      orderBy = { pct30d: "desc" };
    } else {
      // movers
      where = {
        points: { gte: MIN_POINTS },
        priceNow: priceFloor,
        [pctField]: { gt: 0 },
        card: { OR: [{ region: "US" }, { region: null }] },
      } as Prisma.CardPriceStatWhereInput;
      orderBy = { [pctField]: "desc" } as Prisma.CardPriceStatOrderByWithRelationInput;
    }

    let stats = await prisma.cardPriceStat.findMany({
      where,
      orderBy,
      take: tab === "prize" ? limit * 3 : limit, // filtramos prize por keyword abajo
      include: { card: { select: cardSelect } },
    });

    // Para "prize" refinamos por keyword del alternateArt.
    if (tab === "prize") {
      stats = stats
        .filter((s) => PRIZE_KEYWORDS.test(s.card.alternateArt ?? ""))
        .slice(0, limit);
    }

    const items = stats.map((s) => ({
      cardId: s.cardId,
      code: s.card.code,
      name: s.card.name,
      src: s.card.src,
      alternateArt: s.card.alternateArt,
      rarity: s.card.rarity,
      set: s.card.sets[0]?.set?.title ?? null,
      tcgUrl: s.card.tcgUrl,
      priceNow: s.priceNow,
      price7dAgo: s.price7dAgo,
      price30dAgo: s.price30dAgo,
      price90dAgo: s.price90dAgo,
      pct7d: s.pct7d,
      pct30d: s.pct30d,
      pct90d: s.pct90d,
      ath: s.ath,
      athPct: s.athPct,
      points: s.points,
      spark: Array.isArray(s.spark) ? (s.spark as number[]) : [],
    }));

    return NextResponse.json({ items, tab, tf });
  } catch (error: any) {
    console.error("[market/cards] failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
