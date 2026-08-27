import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";

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

    const existingEmptyDraft = await db.buylistSession.findFirst({
      where: {
        userId: user.id,
        status: "DRAFT",
        totalItems: 0,
        totalQuantity: 0,
      },
      include: { items: true },
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
        title,
        customerName,
        sourceType,
        currency,
      },
      include: { items: true },
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}
