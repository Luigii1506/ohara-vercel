import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateListAccess, validateListOwnership } from "@/lib/auth-helpers";

export type NormalizedBuylistItem = {
  cardId: number | null;
  productId: number | null;
  quantity: number;
  condition: string | null;
  purchasePrice: number;
  purchaseCurrency: string;
  marketPriceSnapshot: number;
  midPriceSnapshot: number;
  market70Snapshot: number;
  market80Snapshot: number;
  median70Snapshot: number;
  median80Snapshot: number;
  notes: string | null;
};

export type BuylistTotals = {
  totalItems: number;
  totalQuantity: number;
  totalPaid: number;
  totalMarket: number;
  totalMedian: number;
  totalMarket70: number;
  totalMarket80: number;
  totalMedian70: number;
  totalMedian80: number;
};

export const BUYLIST_SESSION_INCLUDE: Prisma.BuylistSessionInclude = {
  sourceList: {
    select: {
      id: true,
      name: true,
      purpose: true,
      isOrdered: true,
    },
  },
  resultList: {
    select: {
      id: true,
      name: true,
      purpose: true,
      isOrdered: true,
    },
  },
  items: {
    include: {
      card: {
        select: {
          id: true,
          name: true,
          code: true,
          src: true,
          rarity: true,
          setCode: true,
          region: true,
          midPrice: true,
          marketPrice: true,
          priceCurrency: true,
          alternateArt: true,
          sets: {
            take: 1,
            include: { set: { select: { title: true } } },
          },
        },
      },
      product: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          thumbnailUrl: true,
          productType: true,
          marketPrice: true,
          lowPrice: true,
          priceCurrency: true,
        },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
};

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function percentValue(value: number, percent: number) {
  return roundCurrency(value * percent);
}

export function computeBuylistTotals(items: NormalizedBuylistItem[]): BuylistTotals {
  return items.reduce(
    (acc, item) => {
      acc.totalItems += 1;
      acc.totalQuantity += item.quantity;
      acc.totalPaid += item.purchasePrice * item.quantity;
      acc.totalMarket += item.marketPriceSnapshot * item.quantity;
      acc.totalMedian += item.midPriceSnapshot * item.quantity;
      acc.totalMarket70 += item.market70Snapshot * item.quantity;
      acc.totalMarket80 += item.market80Snapshot * item.quantity;
      acc.totalMedian70 += item.median70Snapshot * item.quantity;
      acc.totalMedian80 += item.median80Snapshot * item.quantity;
      return acc;
    },
    {
      totalItems: 0,
      totalQuantity: 0,
      totalPaid: 0,
      totalMarket: 0,
      totalMedian: 0,
      totalMarket70: 0,
      totalMarket80: 0,
      totalMedian70: 0,
      totalMedian80: 0,
    }
  );
}

export function parseListIdFromReference(value: string | number | undefined | null) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/lists\/(\d+)/);
    if (match?.[1]) return Number.parseInt(match[1], 10);
  } catch {
    const match = trimmed.match(/\/lists\/(\d+)/);
    if (match?.[1]) return Number.parseInt(match[1], 10);
  }

  return null;
}

export async function validateBuylistSourceList(reference: unknown, userId: number) {
  const parsed = parseListIdFromReference(
    typeof reference === "string" || typeof reference === "number" ? reference : null
  );

  if (!parsed) {
    return { error: "invalid" as const };
  }

  const access = await validateListAccess(parsed, userId);
  if (!access.hasAccess || !access.list) {
    return { error: "missing" as const };
  }

  return {
    list: access.list,
    isOwner: access.isOwner,
  };
}

export async function validateOwnedOperationalList(listId: unknown, userId: number) {
  if (listId === null || listId === undefined || listId === "") {
    return { list: null };
  }

  const parsed = Number(listId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: "invalid" as const };
  }

  const isOwner = await validateListOwnership(parsed, userId);
  if (!isOwner) {
    return { error: "missing" as const };
  }

  const list = await prisma.userList.findUnique({
    where: { id: parsed },
    select: {
      id: true,
      name: true,
      purpose: true,
      isOrdered: true,
      userId: true,
      isCollection: true,
    },
  });

  if (!list || list.isCollection) {
    return { error: "missing" as const };
  }

  return { list };
}
