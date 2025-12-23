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

      const roundedMarket = roundedPrice(
        pricing.marketPrice ?? pricing.midPrice ?? null
      );
      const roundedLow = roundedPrice(pricing.lowPrice ?? null);
      const roundedHigh = roundedPrice(
        pricing.highPrice ?? pricing.directLowPrice ?? null
      );

      const marketChanged = hasChanged(card.marketPrice, roundedMarket);
      const lowChanged = hasChanged(card.lowPrice, roundedLow);
      const highChanged = hasChanged(card.highPrice, roundedHigh);

      if (roundedMarket !== null) {
        logs.push({
          cardId: card.id,
          priceType: "MARKET",
          price: toDecimalOrNull(roundedMarket)!,
          collectedAt: now,
          source: "TCGplayer",
        });
      }
      if (roundedLow !== null) {
        logs.push({
          cardId: card.id,
          priceType: "LOW",
          price: toDecimalOrNull(roundedLow)!,
          collectedAt: now,
          source: "TCGplayer",
        });
      }
      if (roundedHigh !== null) {
        logs.push({
          cardId: card.id,
          priceType: "HIGH",
          price: toDecimalOrNull(roundedHigh)!,
          collectedAt: now,
          source: "TCGplayer",
        });
      }

      if (!marketChanged && !lowChanged && !highChanged) {
        continue;
      }

      const data: Prisma.CardUpdateInput = {
        priceUpdatedAt: now,
        priceCurrency: card.priceCurrency || "USD",
      };

      if (marketChanged) {
        data.marketPrice =
          roundedMarket !== null ? toDecimalOrNull(roundedMarket) : null;
      }

      if (lowChanged) {
        data.lowPrice =
          roundedLow !== null ? toDecimalOrNull(roundedLow) : null;
      }

      if (highChanged) {
        data.highPrice =
          roundedHigh !== null ? toDecimalOrNull(roundedHigh) : null;
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
    alertCardIds.push(...Array.from(new Set(logs.map((log) => log.cardId))));
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
