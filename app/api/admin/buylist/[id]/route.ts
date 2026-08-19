import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
const db = prisma as any;

type NormalizedBuylistItem = {
  cardId: number;
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

type BuylistTotals = {
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

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

async function assertSessionOwnership(sessionId: number, userId: number) {
  return db.buylistSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, userId: true },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sessionId = Number(params.id);
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
    }

    const session = await assertSessionOwnership(sessionId, user.id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const body = await request.json();
    const items = Array.isArray(body?.items) ? body.items : [];
    const title =
      typeof body?.title === "string" && body.title.trim()
        ? body.title.trim()
        : "Buylist";
    const customerName =
      typeof body?.customerName === "string" && body.customerName.trim()
        ? body.customerName.trim()
        : null;
    const notes =
      typeof body?.notes === "string" && body.notes.trim()
        ? body.notes.trim()
        : null;
    const sourceType =
      body?.sourceType === "SINGLES" ||
      body?.sourceType === "BINDER" ||
      body?.sourceType === "MIXED"
        ? body.sourceType
        : "MIXED";
    const status =
      body?.status === "DRAFT" ||
      body?.status === "COMPLETED" ||
      body?.status === "CANCELLED"
        ? body.status
        : "DRAFT";
    const currency =
      typeof body?.currency === "string" && body.currency.trim()
        ? body.currency.trim().toUpperCase()
        : "USD";

    const normalizedItems = items
      .map(
        (item: any): NormalizedBuylistItem => ({
        cardId: Number(item?.cardId),
        quantity: Math.max(1, Math.trunc(toNumber(item?.quantity))),
        condition:
          typeof item?.condition === "string" && item.condition.trim()
            ? item.condition.trim()
            : null,
        purchasePrice: roundCurrency(toNumber(item?.purchasePrice)),
        purchaseCurrency:
          typeof item?.purchaseCurrency === "string" &&
          item.purchaseCurrency.trim()
            ? item.purchaseCurrency.trim().toUpperCase()
            : currency,
        marketPriceSnapshot: roundCurrency(toNumber(item?.marketPriceSnapshot)),
        midPriceSnapshot: roundCurrency(toNumber(item?.midPriceSnapshot)),
        market70Snapshot: roundCurrency(toNumber(item?.market70Snapshot)),
        market80Snapshot: roundCurrency(toNumber(item?.market80Snapshot)),
        median70Snapshot: roundCurrency(toNumber(item?.median70Snapshot)),
        median80Snapshot: roundCurrency(toNumber(item?.median80Snapshot)),
        notes:
          typeof item?.notes === "string" && item.notes.trim()
            ? item.notes.trim()
            : null,
        })
      )
      .filter((item: any) => Number.isInteger(item.cardId) && item.cardId > 0);

    const totals = normalizedItems.reduce(
      (acc: BuylistTotals, item: NormalizedBuylistItem) => {
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

    const updated = await prisma.$transaction(async (tx) => {
      await (tx as any).buylistItem.deleteMany({
        where: { sessionId },
      });

      if (normalizedItems.length > 0) {
        await (tx as any).buylistItem.createMany({
          data: normalizedItems.map((item: NormalizedBuylistItem) => ({
            sessionId,
            ...item,
          })),
        });
      }

      await (tx as any).buylistSession.update({
        where: { id: sessionId },
        data: {
          title,
          customerName,
          notes,
          sourceType,
          status,
          currency,
          ...Object.fromEntries(
            Object.entries(totals).map(([key, value]) => [
              key,
              typeof value === "number" ? roundCurrency(value) : value,
            ])
          ),
        },
      });

      return (tx as any).buylistSession.findUnique({
        where: { id: sessionId },
        include: {
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
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      });
    });

    return NextResponse.json({ session: updated });
  } catch (error) {
    return handleAuthError(error);
  }
}
