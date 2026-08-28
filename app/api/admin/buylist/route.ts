import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";
import {
  validateBuylistSourceList,
  validateOwnedOperationalList,
} from "@/lib/buylist/session";

export const dynamic = "force-dynamic";
const db = prisma as any;

function assertAdmin(user: { role?: string | null }) {
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(_request: NextRequest) {
  try {
    const user = await requireAuth();
    const forbidden = assertAdmin(user);
    if (forbidden) return forbidden;

    const sessions = await db.buylistSession.findMany({
      where: { userId: user.id },
      include: {
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
                  include: {
                    set: {
                      select: {
                        title: true,
                      },
                    },
                  },
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
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 40,
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const forbidden = assertAdmin(user);
    if (forbidden) return forbidden;

    const body = await request.json().catch(() => ({}));
    const title =
      typeof body?.title === "string" && body.title.trim()
        ? body.title.trim()
        : `Buylist ${new Date().toLocaleDateString("en-CA")}`;
    const customerName =
      typeof body?.customerName === "string" && body.customerName.trim()
        ? body.customerName.trim()
        : null;
    const sourceType =
      body?.sourceType === "SINGLES" ||
      body?.sourceType === "BINDER" ||
      body?.sourceType === "MIXED"
        ? body.sourceType
        : "MIXED";
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

    if (
      ("error" in sourceListResult && sourceListResult.error === "invalid") ||
      ("error" in resultListResult && resultListResult.error === "invalid")
    ) {
      return NextResponse.json(
        { error: "ID de carpeta inválido" },
        { status: 400 }
      );
    }

    if ("error" in sourceListResult || "error" in resultListResult) {
      return NextResponse.json(
        { error: "Carpeta no encontrada o sin permisos" },
        { status: 404 }
      );
    }

    if (resultListResult.list && resultListResult.list.isOrdered) {
      return NextResponse.json(
        { error: "El inventario destino no puede ser una carpeta ordenada" },
        { status: 400 }
      );
    }

    const existingEmptyDraft = await db.buylistSession.findFirst({
      where: {
        userId: user.id,
        status: "DRAFT",
        totalItems: 0,
        totalQuantity: 0,
      },
      include: {
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
        items: true,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });

    if (existingEmptyDraft) {
      return NextResponse.json(
        { session: existingEmptyDraft, reusedExistingDraft: true },
        { status: 200 }
      );
    }

    const session = await db.buylistSession.create({
      data: {
        userId: user.id,
        sourceListId: sourceListResult.list?.id ?? null,
        resultListId: resultListResult.list?.id ?? null,
        title,
        customerName,
        sourceType,
        currency,
      },
      include: {
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
        items: true,
      },
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
