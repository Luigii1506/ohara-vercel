export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  handleAuthError,
  validateListOwnership,
} from "@/lib/auth-helpers";

const num = (value: any): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

// GET /api/lists/[id]/consignment-report
// Agrupa las cartas de la carpeta por consignatario (null = dueño de la
// carpeta, "Yo") y calcula, por cada uno: cuánto tiene, cuánto vendió (con
// el precio REAL de venta) y cuánto le queda disponible (valor estimado).
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

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

    const list = await prisma.userList.findUnique({ where: { id: listId } });
    if (!list) {
      return NextResponse.json(
        { error: "Lista no encontrada" },
        { status: 404 }
      );
    }

    // Solo traemos las cartas de la lista — los grupos del reporte se
    // arman a partir de quién realmente tiene algo asignado aquí, no de
    // todos los consignatarios que existan en la cuenta (uno sin ninguna
    // carta en esta carpeta simplemente no debe aparecer).
    const cards = await prisma.userListCard.findMany({
      where: { listId },
      include: {
        card: {
          select: { id: true, name: true, code: true, src: true, marketPrice: true, midPrice: true },
        },
        consignor: { select: { id: true, name: true, color: true } },
      },
    });

    type SoldItem = {
      listCardId: number;
      cardId: number;
      code: string;
      name: string;
      src: string;
      quantity: number;
      soldPrice: number;
      /** true si no había soldPrice guardado y se usó un valor estimado como respaldo. */
      isEstimatedPrice: boolean;
      soldAt: string | null;
    };

    type AvailableItem = {
      listCardId: number;
      cardId: number;
      code: string;
      name: string;
      src: string;
      quantity: number;
      /** Siempre estimado (precio personalizado, market price o listed median) — no se ha vendido. */
      estimatedPrice: number;
    };

    type Group = {
      consignorId: number | null;
      name: string;
      color: string | null;
      totalCards: number;
      totalQuantity: number;
      soldCards: number;
      soldQuantity: number;
      soldValue: number;
      availableCards: number;
      availableQuantity: number;
      availableValue: number;
      soldItems: SoldItem[];
      availableItems: AvailableItem[];
    };

    const groups = new Map<number | null, Group>();
    groups.set(null, {
      consignorId: null,
      name: "Yo",
      color: null,
      totalCards: 0,
      totalQuantity: 0,
      soldCards: 0,
      soldQuantity: 0,
      soldValue: 0,
      availableCards: 0,
      availableQuantity: 0,
      availableValue: 0,
      soldItems: [],
      availableItems: [],
    });

    for (const c of cards) {
      const key = c.consignorId ?? null;
      if (!groups.has(key)) {
        groups.set(key, {
          consignorId: key,
          name: c.consignor?.name ?? "Yo",
          color: c.consignor?.color ?? null,
          totalCards: 0,
          totalQuantity: 0,
          soldCards: 0,
          soldQuantity: 0,
          soldValue: 0,
          availableCards: 0,
          availableQuantity: 0,
          availableValue: 0,
          soldItems: [],
          availableItems: [],
        });
      }
      const g = groups.get(key)!;
      const quantity = c.quantity || 1;

      g.totalCards += 1;
      g.totalQuantity += quantity;

      if (c.isSold) {
        const realSoldPrice = num(c.soldPrice);
        const soldUnitPrice = realSoldPrice ?? num(c.customPrice) ?? num(c.card.marketPrice) ?? 0;
        g.soldCards += 1;
        g.soldQuantity += quantity;
        g.soldValue += soldUnitPrice * quantity;
        g.soldItems.push({
          listCardId: c.id,
          cardId: c.card.id,
          code: c.card.code,
          name: c.card.name,
          src: c.card.src,
          quantity,
          soldPrice: soldUnitPrice,
          isEstimatedPrice: realSoldPrice === null,
          soldAt: c.soldAt ? c.soldAt.toISOString() : null,
        });
      } else {
        const estUnitPrice =
          num(c.customPrice) ?? num(c.card.marketPrice) ?? num(c.card.midPrice) ?? 0;
        g.availableCards += 1;
        g.availableQuantity += quantity;
        g.availableValue += estUnitPrice * quantity;
        g.availableItems.push({
          listCardId: c.id,
          cardId: c.card.id,
          code: c.card.code,
          name: c.card.name,
          src: c.card.src,
          quantity,
          estimatedPrice: estUnitPrice,
        });
      }
    }

    // Más recientes primero, dentro de cada consignatario; las disponibles
    // se ordenan de mayor a menor valor total (lo más valioso primero).
    for (const g of Array.from(groups.values())) {
      g.soldItems.sort((a, b) => {
        if (!a.soldAt && !b.soldAt) return 0;
        if (!a.soldAt) return 1;
        if (!b.soldAt) return -1;
        return b.soldAt.localeCompare(a.soldAt);
      });
      g.availableItems.sort(
        (a, b) => b.estimatedPrice * b.quantity - a.estimatedPrice * a.quantity
      );
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const groupList = Array.from(groups.values())
      .map((g) => ({
        ...g,
        soldValue: round2(g.soldValue),
        availableValue: round2(g.availableValue),
        totalValue: round2(g.soldValue + g.availableValue),
        soldItems: g.soldItems.map((it) => ({ ...it, soldPrice: round2(it.soldPrice) })),
        availableItems: g.availableItems.map((it) => ({
          ...it,
          estimatedPrice: round2(it.estimatedPrice),
        })),
      }))
      .sort((a, b) => {
        if (a.consignorId === null) return -1;
        if (b.consignorId === null) return 1;
        return a.name.localeCompare(b.name);
      });

    const grandTotal = groupList.reduce(
      (acc, g) => ({
        totalCards: acc.totalCards + g.totalCards,
        totalQuantity: acc.totalQuantity + g.totalQuantity,
        soldQuantity: acc.soldQuantity + g.soldQuantity,
        soldValue: round2(acc.soldValue + g.soldValue),
        availableQuantity: acc.availableQuantity + g.availableQuantity,
        availableValue: round2(acc.availableValue + g.availableValue),
        totalValue: round2(acc.totalValue + g.totalValue),
      }),
      {
        totalCards: 0,
        totalQuantity: 0,
        soldQuantity: 0,
        soldValue: 0,
        availableQuantity: 0,
        availableValue: 0,
        totalValue: 0,
      }
    );

    return NextResponse.json({
      listName: list.name,
      listId: list.id,
      generatedAt: new Date().toISOString(),
      groups: groupList,
      grandTotal,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
