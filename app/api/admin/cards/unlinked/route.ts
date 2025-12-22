export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const searchTerm = (searchParams.get("search") ?? "").trim();
    const setIdParam = searchParams.get("setId");
    const setCodeParam = (searchParams.get("setCode") ?? "").trim();
    const limitParam = Number(searchParams.get("limit"));
    const limit = clamp(
      Number.isFinite(limitParam) && limitParam > 0 ? limitParam : DEFAULT_LIMIT,
      1,
      MAX_LIMIT
    );

    const where: Prisma.CardWhereInput = {
      OR: [{ tcgplayerLinkStatus: null }, { tcgplayerLinkStatus: false }],
    };

    if (searchTerm) {
      const likeFilter: Prisma.CardWhereInput = {
        OR: [
          { name: { contains: searchTerm, mode: "insensitive" } },
          { code: { contains: searchTerm, mode: "insensitive" } },
          { alias: { contains: searchTerm, mode: "insensitive" } },
        ],
      };
      where.AND = Array.isArray(where.AND)
        ? [...where.AND, likeFilter]
        : where.AND
        ? [where.AND, likeFilter]
        : [likeFilter];
    }

    const setFilters: Prisma.CardWhereInput[] = [];
    if (setIdParam) {
      const numericSetId = Number(setIdParam);
      if (Number.isFinite(numericSetId) && numericSetId > 0) {
        setFilters.push({
          sets: {
            some: {
              setId: numericSetId,
            },
          },
        });
      }
    }
    if (setCodeParam) {
      setFilters.push({
        OR: [
          { setCode: { contains: setCodeParam, mode: "insensitive" } },
          {
            sets: {
              some: {
                set: {
                  code: {
                    equals: setCodeParam,
                    mode: "insensitive",
                  },
                },
              },
            },
          },
        ],
      });
    }
    if (setFilters.length) {
      const combined: Prisma.CardWhereInput =
        setFilters.length === 1
          ? setFilters[0]
          : {
              OR: setFilters,
            };
      where.AND = Array.isArray(where.AND)
        ? [...where.AND, combined]
        : where.AND
        ? [where.AND, combined]
        : [combined];
    }

    const cards = await prisma.card.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: {
        sets: {
          include: {
            set: {
              select: {
                id: true,
                title: true,
                code: true,
              },
            },
          },
        },
      },
    });

    const payload = cards.map((card) => ({
      id: card.id,
      name: card.name,
      code: card.code,
      setCode: card.setCode,
      tcgplayerLinkStatus: card.tcgplayerLinkStatus,
      tcgplayerProductId: card.tcgplayerProductId,
      imageUrl: card.src,
      rarity: card.rarity,
      alternateArt: card.alternateArt,
      sets: card.sets
        .map((entry) => entry.set)
        .filter((set): set is { id: number; title: string; code: string | null } => Boolean(set)),
    }));

    return NextResponse.json({ items: payload }, { status: 200 });
  } catch (error) {
    console.error("[admin/cards/unlinked] GET error:", error);
    return NextResponse.json(
      { error: "Failed to load unlinked cards" },
      { status: 500 }
    );
  }
}
