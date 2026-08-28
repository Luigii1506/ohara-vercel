import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";
import {
  BUYLIST_SESSION_INCLUDE,
  computeBuylistTotals,
  roundCurrency,
  toNumber,
  validateBuylistSourceList,
  validateOwnedOperationalList,
  type NormalizedBuylistItem,
} from "@/lib/buylist/session";

export const dynamic = "force-dynamic";
const db = prisma as any;

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
    const sourceListResult =
      body?.sourceListId === null || body?.sourceListId === undefined || body?.sourceListId === ""
        ? { list: null }
        : await validateBuylistSourceList(body?.sourceListId, user.id);
    const resultListResult = await validateOwnedOperationalList(
      body?.resultListId,
      user.id
    );

    if ("error" in sourceListResult || "error" in resultListResult) {
      const invalid =
        ("error" in sourceListResult && sourceListResult.error === "invalid") ||
        ("error" in resultListResult && resultListResult.error === "invalid");
      return NextResponse.json(
        {
          error: invalid
            ? "ID de carpeta inválido"
            : "Carpeta no encontrada o sin permisos",
        },
        { status: invalid ? 400 : 404 }
      );
    }

    if (resultListResult.list && resultListResult.list.isOrdered) {
      return NextResponse.json(
        { error: "El inventario destino no puede ser una carpeta ordenada" },
        { status: 400 }
      );
    }

    const normalizedItems = items
      .map(
        (item: any): NormalizedBuylistItem => ({
        cardId:
          item?.cardId !== null &&
          item?.cardId !== undefined &&
          Number.isInteger(Number(item.cardId))
            ? Number(item.cardId)
            : null,
        productId:
          item?.productId !== null &&
          item?.productId !== undefined &&
          Number.isInteger(Number(item.productId))
            ? Number(item.productId)
            : null,
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
      .filter(
        (item: NormalizedBuylistItem) =>
          (item.cardId !== null && item.cardId > 0) ||
          (item.productId !== null && item.productId > 0)
      );

    const totals = computeBuylistTotals(normalizedItems);

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
          sourceListId: sourceListResult.list?.id ?? null,
          resultListId: resultListResult.list?.id ?? null,
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
        include: BUYLIST_SESSION_INCLUDE,
      });
    });

    return NextResponse.json({ session: updated });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
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

    await prisma.$transaction(async (tx) => {
      await (tx as any).buylistItem.deleteMany({
        where: { sessionId },
      });

      await (tx as any).buylistSession.delete({
        where: { id: sessionId },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
