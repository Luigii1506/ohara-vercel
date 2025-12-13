import { Prisma, Card } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTcgplayerProductPricing } from "./tcgplayerClient";
import { evaluatePriceAlerts } from "./tcgplayerAlerts";

const BATCH_SIZE = 100;

type CardSnapshot = Pick<
  Card,
  | "id"
  | "tcgplayerProductId"
  | "marketPrice"
  | "lowPrice"
  | "highPrice"
  | "priceCurrency"
>;

type SyncOptions = {
  onlyWatchlisted?: boolean;
};

const toDecimalOrNull = (value?: number | null) =>
  value === undefined || value === null
    ? null
    : new Prisma.Decimal(value.toString());

const hasChanged = (
  current: Prisma.Decimal | null,
  incoming?: number | null
) => {
  if (incoming === undefined) {
    return false;
  }
  if (current === null) {
    return incoming !== null && incoming !== undefined;
  }
  if (incoming === null || incoming === undefined) {
    return true;
  }
  return !current.equals(incoming.toString());
};

export const roundedPrice = (value?: number | null) =>
  typeof value === "number"
    ? Math.round((value + Number.EPSILON) * 100) / 100
    : null;

export async function syncTcgplayerPrices(options: SyncOptions = {}) {
  const whereClause: Prisma.CardWhereInput = {
    tcgplayerProductId: { not: null },
  };
  if (options.onlyWatchlisted) {
    whereClause.isWatchlisted = true;
  }

  const cards = await prisma.card.findMany({
    where: whereClause,
    select: {
      id: true,
      tcgplayerProductId: true,
      marketPrice: true,
      lowPrice: true,
      highPrice: true,
      priceCurrency: true,
    },
  });

  if (!cards.length) {
    return {
      cardsProcessed: 0,
      cardsUpdated: 0,
      logsCreated: 0,
    };
  }

  const now = new Date();
  let cardsUpdated = 0;
  const logs: Prisma.CardPriceLogCreateManyInput[] = [];
  const updateOperations: Prisma.PrismaPromise<any>[] = [];

  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const chunk = cards.slice(i, i + BATCH_SIZE);
    const validProductIds = chunk
      .map((card) => Number(card.tcgplayerProductId))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (!validProductIds.length) {
      continue;
    }

    const pricingEntries = await getTcgplayerProductPricing(validProductIds);
    const priceMap = new Map(
      pricingEntries.map((entry) => [entry.productId, entry])
    );

    for (const card of chunk) {
      const productId = Number(card.tcgplayerProductId);
      const pricing = priceMap.get(productId);
      if (!pricing) {
        continue;
      }

      const market = pricing.marketPrice ?? pricing.midPrice ?? null;
      const low = pricing.lowPrice ?? null;
      const high = pricing.highPrice ?? pricing.directLowPrice ?? null;

      const marketChanged = hasChanged(card.marketPrice, market);
      const lowChanged = hasChanged(card.lowPrice, low);
      const highChanged = hasChanged(card.highPrice, high);

      if (!marketChanged && !lowChanged && !highChanged) {
        continue;
      }

      const data: Prisma.CardUpdateInput = {
        priceUpdatedAt: now,
        priceCurrency: card.priceCurrency || "USD",
      };

      if (marketChanged) {
        const rounded = roundedPrice(market);
        data.marketPrice = rounded !== null ? toDecimalOrNull(rounded) : null;
        if (rounded !== null) {
          logs.push({
            cardId: card.id,
            priceType: "MARKET",
            price: toDecimalOrNull(rounded)!,
            collectedAt: now,
            source: "TCGplayer",
          });
        }
      }

      if (lowChanged) {
        const rounded = roundedPrice(low);
        data.lowPrice = rounded !== null ? toDecimalOrNull(rounded) : null;
        if (rounded !== null) {
          logs.push({
            cardId: card.id,
            priceType: "LOW",
            price: toDecimalOrNull(rounded)!,
            collectedAt: now,
            source: "TCGplayer",
          });
        }
      }

      if (highChanged) {
        const rounded = roundedPrice(high);
        data.highPrice = rounded !== null ? toDecimalOrNull(rounded) : null;
        if (rounded !== null) {
          logs.push({
            cardId: card.id,
            priceType: "HIGH",
            price: toDecimalOrNull(rounded)!,
            collectedAt: now,
            source: "TCGplayer",
          });
        }
      }

      cardsUpdated += 1;
      updateOperations.push(
        prisma.card.update({
          where: { id: card.id },
          data,
        })
      );
    }
  }

  if (updateOperations.length) {
    await prisma.$transaction(updateOperations);
  }

  const alertCardIds: number[] = [];
  if (logs.length) {
    await prisma.cardPriceLog.createMany({
      data: logs,
    });
    alertCardIds.push(...new Set(logs.map((log) => log.cardId)));
  }

  let alertsTriggered = 0;
  if (alertCardIds.length) {
    const alertResult = await evaluatePriceAlerts(alertCardIds);
    alertsTriggered = alertResult.alertsTriggered;
  }

  return {
    cardsProcessed: cards.length,
    cardsUpdated,
    logsCreated: logs.length,
    alertsTriggered,
  };
}
