import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleAuthError, requireAuth } from "@/lib/auth-helpers";
import {
  BUYLIST_SESSION_INCLUDE,
  computeBuylistTotals,
  percentValue,
  roundCurrency,
  toNumber,
  type NormalizedBuylistItem,
  validateBuylistSourceList,
} from "@/lib/buylist/session";

export const dynamic = "force-dynamic";

function formatImportNote(listName: string, existing: string | null | undefined) {
  const prefix = `Importado desde carpeta: ${listName}`;
  if (!existing?.trim()) return prefix;
  if (existing.includes(prefix)) return existing.trim();
  return `${prefix}\n${existing.trim()}`;
}

export async function POST(
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

    const session = await prisma.buylistSession.findFirst({
      where: { id: sessionId, userId: user.id },
      include: {
        items: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const replaceExisting = body?.replaceExisting !== false;
    const sourceResult = await validateBuylistSourceList(
      body?.listId ?? body?.listUrl ?? body?.reference,
      user.id
    );

    if ("error" in sourceResult) {
      return NextResponse.json(
        {
          error:
            sourceResult.error === "invalid"
              ? "URL o ID de carpeta inválido"
              : "Carpeta no encontrada o sin permisos",
        },
        { status: sourceResult.error === "invalid" ? 400 : 404 }
      );
    }

    const sourceList = await prisma.userList.findUnique({
      where: { id: sourceResult.list.id },
      include: {
        cards: {
          orderBy: [{ page: "asc" }, { row: "asc" }, { column: "asc" }, { sortOrder: "asc" }],
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
                marketPrice: true,
                midPrice: true,
                priceCurrency: true,
              },
            },
          },
        },
      },
    });

    if (!sourceList) {
      return NextResponse.json({ error: "Carpeta no encontrada" }, { status: 404 });
    }

    const importedItems: NormalizedBuylistItem[] = sourceList.cards.map((listCard) => {
      const market = roundCurrency(toNumber(listCard.card.marketPrice));
      const median = roundCurrency(toNumber(listCard.card.midPrice));
      const fallbackPaid = percentValue(median || market, 0.8);

      return {
        cardId: listCard.cardId,
        productId: null,
        quantity: Math.max(1, listCard.quantity || 1),
        condition: listCard.condition?.trim() || null,
        purchasePrice: roundCurrency(
          listCard.customPrice !== null && listCard.customPrice !== undefined
            ? toNumber(listCard.customPrice)
            : fallbackPaid
        ),
        purchaseCurrency:
          listCard.customCurrency?.trim().toUpperCase() ||
          listCard.card.priceCurrency?.trim().toUpperCase() ||
          session.currency,
        marketPriceSnapshot: market,
        midPriceSnapshot: median,
        market70Snapshot: percentValue(market, 0.7),
        market80Snapshot: percentValue(market, 0.8),
        median70Snapshot: percentValue(median, 0.7),
        median80Snapshot: percentValue(median, 0.8),
        notes: formatImportNote(sourceList.name, listCard.notes),
      };
    });

    const existingItems: NormalizedBuylistItem[] = session.items.map((item) => ({
      cardId: item.cardId,
      productId: item.productId,
      quantity: item.quantity,
      condition: item.condition,
      purchasePrice: roundCurrency(toNumber(item.purchasePrice)),
      purchaseCurrency: item.purchaseCurrency,
      marketPriceSnapshot: roundCurrency(toNumber(item.marketPriceSnapshot)),
      midPriceSnapshot: roundCurrency(toNumber(item.midPriceSnapshot)),
      market70Snapshot: roundCurrency(toNumber(item.market70Snapshot)),
      market80Snapshot: roundCurrency(toNumber(item.market80Snapshot)),
      median70Snapshot: roundCurrency(toNumber(item.median70Snapshot)),
      median80Snapshot: roundCurrency(toNumber(item.median80Snapshot)),
      notes: item.notes,
    }));

    const mergedItems: NormalizedBuylistItem[] = replaceExisting
      ? importedItems
      : [...existingItems, ...importedItems];

    const totals = computeBuylistTotals(mergedItems);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.buylistItem.deleteMany({
        where: { sessionId },
      });

      if (mergedItems.length > 0) {
        await tx.buylistItem.createMany({
          data: mergedItems.map((item) => ({
            sessionId,
            ...item,
          })),
        });
      }

      await tx.buylistSession.update({
        where: { id: sessionId },
        data: {
          sourceListId: sourceResult.list.id,
          ...Object.fromEntries(
            Object.entries(totals).map(([key, value]) => [key, roundCurrency(value)])
          ),
        },
      });

      return tx.buylistSession.findUnique({
        where: { id: sessionId },
        include: BUYLIST_SESSION_INCLUDE,
      });
    });

    return NextResponse.json(
      {
        session: updated,
        importedCards: importedItems.length,
        replaceExisting,
        sourceList: {
          id: sourceList.id,
          name: sourceList.name,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return handleAuthError(error);
  }
}
