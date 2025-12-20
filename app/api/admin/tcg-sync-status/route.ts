export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ALLOWED_VIEWS = [
  "missing",
  "linked",
  "all",
  "removed",
  "orphan",
] as const;

const CLASSIFICATION_VALUES = ["all", "cards", "sealed"] as const;

const CARD_CLASSIFICATION_FILTER: Prisma.TcgCatalogProductWhereInput = {
  isSealed: false,
};

const SEALED_CLASSIFICATION_FILTER: Prisma.TcgCatalogProductWhereInput = {
  isSealed: true,
};

type SyncView = (typeof ALLOWED_VIEWS)[number];

type LinkedCardSummary = {
  entityType: "card";
  id: number;
  name: string;
  code: string;
  setCode: string | null;
  tcgplayerProductId: number;
  tcgplayerLinkStatus: boolean | null;
  imageUrl: string | null;
};

type LocalLinkData = {
  linkedEntities: Map<number, LinkedCardSummary>;
  linkedProductIds: number[];
  orphanEntities: LinkedCardSummary[];
};

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const rawView = (searchParams.get("status") ?? "missing").toLowerCase();
    const view: SyncView = (ALLOWED_VIEWS as readonly string[]).includes(rawView)
      ? (rawView as SyncView)
      : "missing";

    const page = clamp(
      Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
      1,
      Number.MAX_SAFE_INTEGER
    );
    const pageSize = clamp(
      Number.parseInt(
        searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE),
        10
      ) || DEFAULT_PAGE_SIZE,
      1,
      MAX_PAGE_SIZE
    );
    const skip = (page - 1) * pageSize;
    const classificationParam =
      (searchParams.get("classification") ?? "all").toLowerCase();
    const classification = (CLASSIFICATION_VALUES as readonly string[]).includes(
      classificationParam
    )
      ? (classificationParam as (typeof CLASSIFICATION_VALUES)[number])
      : "all";
    const classificationFilter: Prisma.TcgCatalogProductWhereInput =
      classification === "cards"
        ? CARD_CLASSIFICATION_FILTER
        : classification === "sealed"
        ? SEALED_CLASSIFICATION_FILTER
        : {};

    const searchTerm = (searchParams.get("search") ?? "").trim();
    const numericSearch = Number(searchTerm);
    const hasNumericSearch =
      searchTerm.length > 0 && Number.isFinite(numericSearch);

    const baseActiveWhere: Prisma.TcgCatalogProductWhereInput = {
      ...classificationFilter,
      productStatus: { not: "removed" },
    };

    const [activeCatalogIds, removedCount, latestSync, totalCards, totalSealed] =
      await Promise.all([
        prisma.tcgCatalogProduct.findMany({
          where: baseActiveWhere,
          select: { productId: true },
        }),
        prisma.tcgCatalogProduct.count({
          where: {
            ...classificationFilter,
            productStatus: "removed",
          },
        }),
        prisma.tcgCatalogProduct.aggregate({
          where: classificationFilter,
          _max: { lastSyncedAt: true },
        }),
        prisma.tcgCatalogProduct.count({
          where: {
            ...baseActiveWhere,
            ...CARD_CLASSIFICATION_FILTER,
          },
        }),
        prisma.tcgCatalogProduct.count({
          where: {
            ...baseActiveWhere,
            isSealed: true,
          },
        }),
      ]);

    const catalogIdSet = new Set(activeCatalogIds.map((entry) => entry.productId));
    const localData = await getLocalLinkData(catalogIdSet);
    const linkedCatalogProductIds = Array.from(localData.linkedEntities.keys());

    const totalCatalog = catalogIdSet.size;
    const totalLinked = linkedCatalogProductIds.length;
    const totalMissing = Math.max(totalCatalog - totalLinked, 0);
    const totalOrphaned = localData.orphanEntities.length;

    const summary = {
      totalCatalog,
      totalLinked,
      totalMissing,
      totalOrphaned,
      totalRemoved: removedCount,
      totalCards,
      totalSealed,
      lastCatalogSyncAt: latestSync._max.lastSyncedAt,
    };

    const searchFilters: Prisma.TcgCatalogProductWhereInput[] = [];
    if (searchTerm) {
      searchFilters.push({
        name: { contains: searchTerm, mode: "insensitive" },
      });
      searchFilters.push({
        cleanName: { contains: searchTerm, mode: "insensitive" },
      });
      if (hasNumericSearch) {
        searchFilters.push({ productId: numericSearch });
      }
    }

    if (view === "orphan") {
      const orphanItems = filterOrphanEntities(
        localData.orphanEntities,
        searchTerm,
        hasNumericSearch ? numericSearch : null
      );
      const totalItems = orphanItems.length;
      const paged = orphanItems.slice(skip, skip + pageSize);

      return NextResponse.json({
        summary,
        result: {
          status: view,
          page,
          pageSize,
          totalItems,
          items: paged.map((entity) => ({
            type: entity.entityType,
            id: entity.id,
            name: entity.name,
            code: entity.code,
            setCode: entity.setCode,
            tcgplayerProductId: entity.tcgplayerProductId,
            tcgplayerLinkStatus: entity.tcgplayerLinkStatus,
            imageUrl: entity.imageUrl,
          })),
        },
      });
    }

    const catalogWhere: Prisma.TcgCatalogProductWhereInput = {
      ...classificationFilter,
      ...(view === "removed"
        ? { productStatus: "removed" }
        : { productStatus: { not: "removed" } }),
    };

    if (searchFilters.length) {
      catalogWhere.AND = [...(catalogWhere.AND ?? []), { OR: searchFilters }];
    }

    if (view === "linked") {
      if (!linkedCatalogProductIds.length) {
        return NextResponse.json({
        summary,
        result: {
          status: view,
          page,
          pageSize,
          totalItems: 0,
          items: [],
          },
        });
      }
      catalogWhere.productId = { in: linkedCatalogProductIds };
    } else if (view === "missing") {
      if (linkedCatalogProductIds.length) {
        catalogWhere.productId = { notIn: linkedCatalogProductIds };
      }
    }

    const [catalogEntries, catalogTotal] = await prisma.$transaction([
      prisma.tcgCatalogProduct.findMany({
        where: catalogWhere,
        orderBy: { productId: "asc" },
        skip,
        take: pageSize,
        select: {
          productId: true,
          name: true,
          cleanName: true,
          productLineName: true,
          cardType: true,
          rarity: true,
          isSealed: true,
          url: true,
          sku: true,
          imageUrl: true,
          lastSyncedAt: true,
          linkedCardId: true,
          linkedAt: true,
          linkedById: true,
          productStatus: true,
        },
      }),
      prisma.tcgCatalogProduct.count({ where: catalogWhere }),
    ]);

    const items = catalogEntries.map((entry) => ({
      type: "catalog" as const,
      productId: entry.productId,
      name: entry.name,
      cleanName: entry.cleanName,
      productLineName: entry.productLineName,
      cardType: entry.cardType,
      rarity: entry.rarity,
      isSealed: entry.isSealed,
      url: entry.url,
      sku: entry.sku,
      imageUrl: entry.imageUrl,
      lastSyncedAt: entry.lastSyncedAt,
      productStatus: entry.productStatus,
      linkedAt: entry.linkedAt,
      linkedById: entry.linkedById,
      linkedCard: localData.linkedEntities.get(entry.productId) ?? null,
    }));

    return NextResponse.json({
      summary,
      result: {
        status: view,
        page,
        pageSize,
        totalItems: catalogTotal,
        items,
      },
    });
  } catch (error) {
    console.error("[admin/tcg-sync-status] Error:", error);
    return NextResponse.json(
      { error: "Failed to load TCG sync status" },
      { status: 500 }
    );
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

async function getLocalLinkData(
  catalogIdSet: Set<number>
): Promise<LocalLinkData> {
  const cards = await prisma.card.findMany({
    where: { tcgplayerProductId: { not: null } },
    select: {
      id: true,
      name: true,
      code: true,
      setCode: true,
      tcgplayerProductId: true,
      tcgplayerLinkStatus: true,
      src: true,
      imageKey: true,
    },
  });

  const linkedEntities = new Map<number, LinkedCardSummary>();
  const orphanEntities: LinkedCardSummary[] = [];
  const linkedProductIds: number[] = [];

  for (const card of cards) {
    const numericProductId = Number(card.tcgplayerProductId);
    if (!Number.isFinite(numericProductId)) {
      continue;
    }

    const summary: LinkedCardSummary = {
      entityType: "card",
      id: card.id,
      name: card.name,
      code: card.code,
      setCode: card.setCode ?? null,
      tcgplayerProductId: numericProductId,
      tcgplayerLinkStatus: card.tcgplayerLinkStatus ?? null,
      imageUrl: card.src ?? null,
    };

    linkedProductIds.push(numericProductId);

    if (catalogIdSet.has(numericProductId)) {
      linkedEntities.set(numericProductId, summary);
    } else {
      orphanEntities.push(summary);
    }
  }

  return {
    linkedEntities,
    linkedProductIds,
    orphanEntities,
  };
}

function filterOrphanEntities(
  items: LinkedCardSummary[],
  searchTerm: string,
  numericSearch: number | null
) {
  if (!searchTerm) {
    return items;
  }

  const lowered = searchTerm.toLowerCase();
  return items.filter((item) => {
    if (
      item.name.toLowerCase().includes(lowered) ||
      item.code.toLowerCase().includes(lowered) ||
      (item.setCode && item.setCode.toLowerCase().includes(lowered))
    ) {
      return true;
    }
    if (numericSearch !== null && item.tcgplayerProductId === numericSearch) {
      return true;
    }
    return false;
  });
}
