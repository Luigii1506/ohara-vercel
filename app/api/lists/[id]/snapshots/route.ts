export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  handleAuthError,
  validateListOwnership,
} from "@/lib/auth-helpers";

const getNumericPrice = (value: any) => {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

// GET /api/lists/[id]/snapshots - Listar snapshots de una carpeta (solo dueño)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const listId = parseInt(params.id);
    if (isNaN(listId) || listId <= 0) {
      return NextResponse.json(
        { error: "ID de lista inválido" },
        { status: 400 }
      );
    }

    const isOwner = await validateListOwnership(listId, user.id);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Lista no encontrada o sin permisos" },
        { status: 404 }
      );
    }

    const snapshots = await prisma.userListSnapshot.findMany({
      where: { listId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        label: true,
        createdAt: true,
        totalCards: true,
        totalUnique: true,
        soldCount: true,
        soldValue: true,
        availableValue: true,
        totalValue: true,
        currency: true,
      },
    });

    return NextResponse.json({ snapshots });
  } catch (error) {
    return handleAuthError(error);
  }
}

// POST /api/lists/[id]/snapshots - Crear un snapshot del estado actual (solo dueño)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();

    const listId = parseInt(params.id);
    if (isNaN(listId) || listId <= 0) {
      return NextResponse.json(
        { error: "ID de lista inválido" },
        { status: 400 }
      );
    }

    const isOwner = await validateListOwnership(listId, user.id);
    if (!isOwner) {
      return NextResponse.json(
        { error: "Lista no encontrada o sin permisos" },
        { status: 404 }
      );
    }

    let label: string | null = null;
    try {
      const body = await request.json();
      if (typeof body?.label === "string" && body.label.trim()) {
        label = body.label.trim().slice(0, 200);
      }
    } catch {
      // body vacío u opcional, no es un error
    }

    const listCards = await prisma.userListCard.findMany({
      where: { listId },
      include: {
        card: {
          select: {
            id: true,
            code: true,
            name: true,
            src: true,
            marketPrice: true,
            priceCurrency: true,
          },
        },
      },
    });

    let totalCards = 0;
    let soldCount = 0;
    let soldValue = 0;
    let availableValue = 0;
    let currency = "USD";

    const cardsSnapshot = listCards.map((lc) => {
      const quantity = lc.quantity || 1;
      totalCards += quantity;

      const customPrice = getNumericPrice(lc.customPrice);
      const marketPrice = getNumericPrice(lc.card.marketPrice);
      const soldPrice = getNumericPrice(lc.soldPrice);
      const cardCurrency =
        lc.customCurrency || lc.card.priceCurrency || currency;

      if (lc.isSold) {
        soldCount += quantity;
        const unitValue = soldPrice ?? customPrice ?? marketPrice ?? 0;
        soldValue += unitValue * quantity;
        currency = cardCurrency;
      } else {
        const unitValue = customPrice ?? marketPrice ?? 0;
        availableValue += unitValue * quantity;
        currency = cardCurrency;
      }

      return {
        listCardId: lc.id,
        cardId: lc.cardId,
        code: lc.card.code,
        name: lc.card.name,
        src: lc.card.src,
        quantity,
        customPrice,
        customCurrency: lc.customCurrency,
        marketPrice,
        priceCurrency: lc.card.priceCurrency,
        isSold: lc.isSold,
        soldAt: lc.soldAt ? lc.soldAt.toISOString() : null,
        soldPrice,
        page: lc.page,
        row: lc.row,
        column: lc.column,
      };
    });

    const snapshot = await prisma.userListSnapshot.create({
      data: {
        listId,
        label,
        totalCards,
        totalUnique: listCards.length,
        soldCount,
        soldValue: Math.round(soldValue * 100) / 100,
        availableValue: Math.round(availableValue * 100) / 100,
        totalValue: Math.round((soldValue + availableValue) * 100) / 100,
        currency,
        cardsSnapshot,
      },
      select: {
        id: true,
        label: true,
        createdAt: true,
        totalCards: true,
        totalUnique: true,
        soldCount: true,
        soldValue: true,
        availableValue: true,
        totalValue: true,
        currency: true,
      },
    });

    return NextResponse.json(
      { message: "Snapshot creado exitosamente", snapshot },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating snapshot:", error);
    return handleAuthError(error);
  }
}
