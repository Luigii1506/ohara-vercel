import {
  AlertNotificationMethod,
  AlertThresholdType,
  Prisma,
} from "@prisma/client";

export const cardSelect = {
  id: true,
  name: true,
  code: true,
  src: true,
  setCode: true,
  marketPrice: true,
  priceCurrency: true,
  isWatchlisted: true,
};

export const alertInclude = {
  card: {
    select: cardSelect,
  },
  logs: {
    orderBy: { triggeredAt: "desc" as const },
    take: 1,
  },
} as const;

export const decimalToNumber = (value?: Prisma.Decimal | null) =>
  value ? Number(value) : null;

export const serializeAlert = (
  alert: Prisma.CardPriceAlertGetPayload<{ include: typeof alertInclude }>
) => {
  const lastLog = alert.logs?.[0];
  return {
    id: alert.id,
    cardId: alert.cardId,
    card: alert.card,
    thresholdType: alert.thresholdType,
    thresholdValue: decimalToNumber(alert.thresholdValue),
    percentChange: alert.percentChange,
    percentWindowHours: alert.percentWindowHours,
    notificationMethod: alert.notificationMethod,
    isActive: alert.isActive,
    createdAt: alert.createdAt,
    updatedAt: alert.updatedAt,
    lastTriggeredAt: lastLog?.triggeredAt ?? null,
    lastTriggerPrice: lastLog?.price ? Number(lastLog.price) : null,
    priceType: lastLog?.priceType ?? null,
  };
};

export const validateThreshold = (body: any) => {
  const thresholdType = body.thresholdType as AlertThresholdType;
  const notificationMethod =
    (body.notificationMethod as AlertNotificationMethod) ||
    AlertNotificationMethod.IN_APP;

  if (
    ![
      AlertThresholdType.ABOVE_VALUE,
      AlertThresholdType.BELOW_VALUE,
      AlertThresholdType.PERCENT_CHANGE,
    ].includes(thresholdType)
  ) {
    throw new Error("Invalid thresholdType");
  }

  if (
    ![
      AlertNotificationMethod.IN_APP,
      AlertNotificationMethod.EMAIL,
      AlertNotificationMethod.SLACK,
    ].includes(notificationMethod)
  ) {
    throw new Error("Invalid notification method");
  }

  return { thresholdType, notificationMethod };
};
