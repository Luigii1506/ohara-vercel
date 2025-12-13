import {
  Prisma,
  AlertThresholdType,
  PriceType,
  AlertNotificationMethod,
  AdminNotificationType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notificationContent } from "./notificationContent";

const percentChange = (previous: Prisma.Decimal, current: Prisma.Decimal) => {
  if (previous.equals(0)) {
    return current.equals(0) ? 0 : 100;
  }
  const diff = current.minus(previous);
  return Number(diff.dividedBy(previous).times(100).toFixed(2));
};

export async function evaluatePriceAlerts(cardIds?: number[]) {
  const alerts = await prisma.cardPriceAlert.findMany({
    where: {
      isActive: true,
      ...(cardIds?.length ? { cardId: { in: cardIds } } : {}),
    },
    include: {
      card: {
        select: {
          id: true,
          name: true,
          marketPrice: true,
          priceCurrency: true,
        },
      },
    },
  });

  if (!alerts.length) {
    return { alertsEvaluated: 0, alertsTriggered: 0 };
  }

  let triggered = 0;
  const logs: Prisma.CardPriceAlertLogCreateManyInput[] = [];
  const adminNotifications: Prisma.AdminNotificationCreateManyInput[] = [];
  const notifications: {
    cardId: number;
    message: string;
    thresholdType: AlertThresholdType;
  }[] = [];

  for (const alert of alerts) {
    const current = alert.card.marketPrice;
    if (!current) continue;

    let shouldTrigger = false;
    const priceType = PriceType.MARKET;

    if (
      alert.thresholdType === AlertThresholdType.ABOVE_VALUE &&
      alert.thresholdValue
    ) {
      shouldTrigger = current.gt(alert.thresholdValue);
    } else if (
      alert.thresholdType === AlertThresholdType.BELOW_VALUE &&
      alert.thresholdValue
    ) {
      shouldTrigger = current.lt(alert.thresholdValue);
    } else if (
      alert.thresholdType === AlertThresholdType.PERCENT_CHANGE &&
      alert.percentChange &&
      alert.percentWindowHours
    ) {
      const windowDate = new Date(
        Date.now() - alert.percentWindowHours * 60 * 60 * 1000
      );
      const previousLog = await prisma.cardPriceLog.findFirst({
        where: {
          cardId: alert.cardId,
          priceType,
          collectedAt: { lte: windowDate },
        },
        orderBy: { collectedAt: "desc" },
      });
      if (previousLog) {
        const change = percentChange(previousLog.price, current);
        shouldTrigger = Math.abs(change) >= alert.percentChange;
      }
    }

    if (shouldTrigger) {
      triggered += 1;
      logs.push({
        alertId: alert.id,
        cardId: alert.cardId,
        price: current,
        triggeredAt: new Date(),
        priceType,
      });
      if (alert.notificationMethod === AlertNotificationMethod.IN_APP) {
        const message = notificationContent(
          alert.card.name,
          `${current.toString()} ${alert.card.priceCurrency || "USD"}`
        );
        notifications.push({
          cardId: alert.cardId,
          message,
          thresholdType: alert.thresholdType,
        });
        adminNotifications.push({
          title: `${alert.card.name} price alert`,
          message,
          type: AdminNotificationType.PRICE_ALERT,
          cardId: alert.cardId,
          alertId: alert.id,
          metadata: {
            thresholdType: alert.thresholdType,
            thresholdValue: alert.thresholdValue
              ? Number(alert.thresholdValue)
              : null,
            percentChange: alert.percentChange ?? null,
            percentWindowHours: alert.percentWindowHours ?? null,
            priceCurrency: alert.card.priceCurrency ?? "USD",
          },
        });
      }
    }
  }

  if (logs.length) {
    await prisma.cardPriceAlertLog.createMany({ data: logs });
    await prisma.cardPriceAlert.updateMany({
      where: { id: { in: logs.map((log) => log.alertId) } },
      data: { updatedAt: new Date() },
    });
  }

  if (adminNotifications.length) {
    await prisma.adminNotification.createMany({
      data: adminNotifications,
    });
  }

  return {
    alertsEvaluated: alerts.length,
    alertsTriggered: triggered,
    notifications,
  };
}
