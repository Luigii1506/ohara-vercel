export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/market/cards/[id]/history?days=90
 * Historial DIARIO de precio (MARKET) de una carta + sus stats y meta, para el
 * modal de detalle del dashboard de mercado.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cardId = Number(params.id);
    if (!Number.isFinite(cardId)) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }
    const daysParam = req.nextUrl.searchParams.get("days");
    const days =
      daysParam === "all" ? 3650 : Math.min(Number(daysParam) || 90, 730);
    const since = new Date(Date.now() - days * 86400_000);

    const [card, stat, series] = await Promise.all([
      prisma.card.findUnique({
        where: { id: cardId },
        select: {
          id: true,
          code: true,
          name: true,
          src: true,
          alternateArt: true,
          rarity: true,
          tcgUrl: true,
          sets: { select: { set: { select: { title: true } } } },
        },
      }),
      prisma.cardPriceStat.findUnique({ where: { cardId } }),
      prisma.$queryRaw<{ d: Date; p: string }[]>`
        SELECT date_trunc('day', "collectedAt") d, avg(price) p
        FROM "CardPriceLog"
        WHERE "cardId" = ${cardId}
          AND "priceType" = 'MARKET'
          AND "collectedAt" >= ${since}
        GROUP BY d
        ORDER BY d`,
    ]);

    if (!card) {
      return NextResponse.json({ error: "Carta no encontrada" }, { status: 404 });
    }

    const history = series.map((r) => ({
      date: r.d.toISOString().slice(0, 10),
      price: Math.round(Number(r.p) * 100) / 100,
    }));

    return NextResponse.json({
      card: {
        id: card.id,
        code: card.code,
        name: card.name,
        src: card.src,
        alternateArt: card.alternateArt,
        rarity: card.rarity,
        tcgUrl: card.tcgUrl,
        set: card.sets[0]?.set?.title ?? null,
      },
      stat: stat
        ? {
            priceNow: stat.priceNow,
            pct7d: stat.pct7d,
            pct30d: stat.pct30d,
            pct90d: stat.pct90d,
            ath: stat.ath,
            atl: stat.atl,
            athPct: stat.athPct,
            points: stat.points,
          }
        : null,
      history,
    });
  } catch (error: any) {
    console.error("[market/history] failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
