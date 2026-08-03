export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { computeProductEv } from "@/lib/services/ev/boosterEV";

const DEFAULT_LIMIT = 24;

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get("search")?.trim() ?? "";
    const type = req.nextUrl.searchParams.get("type") ?? "all";
    const sort = req.nextUrl.searchParams.get("sort") ?? "recent";
    const archived = req.nextUrl.searchParams.get("archived") ?? "false";
    const setIdParam = req.nextUrl.searchParams.get("setId") ?? "";
    const limitParam = req.nextUrl.searchParams.get("limit");
    const pageParam = req.nextUrl.searchParams.get("page");

    const limit = Math.min(
      Math.max(Number(limitParam) || DEFAULT_LIMIT, 6),
      60
    );
    const page = Math.max(Number(pageParam) || 1, 1);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search.length > 0) {
      where.name = { contains: search, mode: "insensitive" };
    }
    if (type !== "all") {
      where.productType = type;
    }
    if (archived !== "all") {
      where.isArchived = archived === "true";
    }
    if (setIdParam && Number(setIdParam)) {
      where.setId = Number(setIdParam);
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      sort === "name"
        ? { name: "asc" }
        : sort === "type"
        ? { productType: "asc" }
        : sort === "price_desc"
        ? { marketPrice: { sort: "desc", nulls: "last" } }
        : sort === "price_asc"
        ? { marketPrice: { sort: "asc", nulls: "last" } }
        : { createdAt: "desc" };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          imageUrl: true,
          thumbnailUrl: true,
          productType: true,
          isArchived: true,
          releaseDate: true,
          officialPrice: true,
          officialPriceCurrency: true,
          marketPrice: true,
          lowPrice: true,
          highPrice: true,
          priceCurrency: true,
          tcgUrl: true,
          set: {
            select: {
              id: true,
              title: true,
            },
          },
          createdAt: true,
        },
      }),
      prisma.product.count({ where }),
    ]);

    // EV opcional para el badge del grid: una sola query de cartas para todos
    // los sets de la página, luego EV por producto.
    let itemsOut: any[] = items;
    if (req.nextUrl.searchParams.get("withEv") === "1") {
      const setIds = Array.from(
        new Set(items.map((p) => p.set?.id).filter((v): v is number => !!v))
      );
      if (setIds.length) {
        const cards = await prisma.card.findMany({
          where: {
            sets: { some: { setId: { in: setIds } } },
            OR: [{ region: "US" }, { region: null }],
          },
          select: {
            code: true,
            rarity: true,
            alternateArt: true,
            marketPrice: true,
            sets: { select: { setId: true } },
          },
        });
        const cardsBySet = new Map<number, any[]>();
        for (const c of cards) {
          for (const s of c.sets) {
            if (!setIds.includes(s.setId)) continue;
            const arr = cardsBySet.get(s.setId) ?? [];
            arr.push(c);
            cardsBySet.set(s.setId, arr);
          }
        }
        itemsOut = items.map((p) => {
          const setId = p.set?.id;
          const pool = setId ? cardsBySet.get(setId) ?? [] : [];
          if (!pool.length) return { ...p, ev: null };
          const ev = computeProductEv(
            { productType: p.productType, name: p.name, marketPrice: p.marketPrice as any },
            pool,
            p.set?.title
          );
          return {
            ...p,
            ev: ev.applicable
              ? {
                  unit: ev.unit,
                  ev: ev.ev,
                  marginPct: ev.marginPct,
                  verdict: ev.verdict,
                }
              : null,
          };
        });
      }
    }

    return NextResponse.json(
      {
        items: itemsOut,
        total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[api/products] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
