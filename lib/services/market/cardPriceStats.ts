import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Precomputa CardPriceStat (precio actual, hace 7/30/90d, % cambios, ATH/ATL)
 * desde CardPriceLog. Se corre en un cron; el dashboard de mercado lee la tabla
 * chica al instante en vez de recorrer millones de logs.
 *
 * Usa DISTINCT ON (indexado por priceType,cardId,collectedAt) para sacar, por
 * carta, el precio MARKET más reciente y el vigente a cada fecha de corte.
 */
type Row = { cardId: number; price: string | number };

const num = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function latestOnOrBefore(cutoff: Date | null): Promise<Map<number, number>> {
  const rows = cutoff
    ? await prisma.$queryRaw<Row[]>`
        SELECT DISTINCT ON ("cardId") "cardId", price
        FROM "CardPriceLog"
        WHERE "priceType" = 'MARKET' AND "collectedAt" <= ${cutoff}
        ORDER BY "cardId", "collectedAt" DESC`
    : await prisma.$queryRaw<Row[]>`
        SELECT DISTINCT ON ("cardId") "cardId", price
        FROM "CardPriceLog"
        WHERE "priceType" = 'MARKET'
        ORDER BY "cardId", "collectedAt" DESC`;
  const m = new Map<number, number>();
  for (const r of rows) {
    const p = num(r.price);
    if (p != null) m.set(r.cardId, p);
  }
  return m;
}

const pct = (now: number | null, then: number | null): number | null =>
  now != null && then != null && then > 0
    ? Math.round(((now - then) / then) * 10000) / 100
    : null;

export async function computeCardPriceStats(now: Date = new Date()) {
  const d = (days: number) => new Date(now.getTime() - days * 86400_000);

  // Precios por carta en cada fecha de corte.
  const [pNow, p7, p30, p90] = await Promise.all([
    latestOnOrBefore(null),
    latestOnOrBefore(d(7)),
    latestOnOrBefore(d(30)),
    latestOnOrBefore(d(90)),
  ]);

  // ATH/ATL y # de puntos en los últimos 180 días.
  const since = d(180);
  const ext = await prisma.$queryRaw<
    { cardId: number; ath: string; atl: string; n: bigint }[]
  >`
    SELECT "cardId", max(price) ath, min(price) atl, count(*) n
    FROM "CardPriceLog"
    WHERE "priceType" = 'MARKET' AND "collectedAt" >= ${since}
    GROUP BY "cardId"`;
  const extMap = new Map<number, { ath: number; atl: number; n: number }>();
  for (const e of ext) {
    extMap.set(e.cardId, {
      ath: num(e.ath) ?? 0,
      atl: num(e.atl) ?? 0,
      n: Number(e.n),
    });
  }

  const rows: Prisma.CardPriceStatCreateManyInput[] = [];
  for (const [cardId, priceNow] of Array.from(pNow.entries())) {
    const e = extMap.get(cardId);
    const ath = e?.ath ?? null;
    rows.push({
      cardId,
      priceNow: priceNow as any,
      price7dAgo: (p7.get(cardId) ?? null) as any,
      price30dAgo: (p30.get(cardId) ?? null) as any,
      price90dAgo: (p90.get(cardId) ?? null) as any,
      pct7d: pct(priceNow, p7.get(cardId) ?? null),
      pct30d: pct(priceNow, p30.get(cardId) ?? null),
      pct90d: pct(priceNow, p90.get(cardId) ?? null),
      ath: (ath ?? null) as any,
      atl: (e?.atl ?? null) as any,
      athPct: pct(priceNow, ath),
      points: e?.n ?? 0,
      computedAt: now,
    });
  }

  // Reemplazo total (es un snapshot). Borra y recrea por lotes.
  await prisma.cardPriceStat.deleteMany({});
  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await prisma.cardPriceStat.createMany({
      data: rows.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
  }

  return { cards: rows.length };
}
