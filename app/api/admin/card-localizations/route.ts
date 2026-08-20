import { NextRequest, NextResponse } from "next/server";

import { handleAuthError, requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const db = prisma as any;
const DEFAULT_PAGE_SIZE = 24;

function assertAdmin(user: { role?: string | null }) {
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

function getPageSize(value: string | null) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(parsed, 100);
}

function getPage(value: string | null) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return 1;
  return parsed;
}

function getAllowedValue<T extends string>(
  value: string | null,
  allowed: readonly T[]
): T | null {
  if (!value) return null;
  return allowed.includes(value as T) ? (value as T) : null;
}

const STATUS_VALUES = ["DRAFT", "REVIEWED", "APPROVED", "NEEDS_REVIEW"] as const;
const SOURCE_VALUES = ["GLOSSARY", "AI", "HUMAN", "IMPORTED"] as const;
const CONTENT_VALUES = ["NAME", "TRIGGER", "EFFECT", "TEXT"] as const;

function buildLocalizationWhere(searchParams: URLSearchParams) {
  const language = searchParams.get("language")?.trim() || "es";
  const status = getAllowedValue(searchParams.get("status"), STATUS_VALUES);
  const translationSource = getAllowedValue(
    searchParams.get("translationSource"),
    SOURCE_VALUES
  );
  const contentType = getAllowedValue(
    searchParams.get("contentType"),
    CONTENT_VALUES
  );

  return {
    language,
    where: {
      language,
      ...(status ? { status } : {}),
      ...(translationSource ? { translationSource } : {}),
      ...(contentType ? { contentType } : {}),
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const forbidden = assertAdmin(user);
    if (forbidden) return forbidden;

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim() || "";
    const page = getPage(searchParams.get("page"));
    const pageSize = getPageSize(searchParams.get("pageSize"));
    const skip = (page - 1) * pageSize;

    const { language, where: localizationWhere } = buildLocalizationWhere(searchParams);

    const cardWhere = {
      localizations: { some: localizationWhere },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
              { setCode: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [cards, totalCards, rowStats] = await Promise.all([
      db.card.findMany({
        where: cardWhere,
        select: {
          id: true,
          name: true,
          code: true,
          setCode: true,
          src: true,
          imageKey: true,
          region: true,
          updatedAt: true,
          localizations: {
            where: localizationWhere,
            orderBy: [{ sourceOrder: "asc" }, { id: "asc" }],
            select: {
              id: true,
              contentType: true,
              sourceKey: true,
              translatedText: true,
              translationSource: true,
              status: true,
              updatedAt: true,
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip,
        take: pageSize,
      }),
      db.card.count({ where: cardWhere }),
      Promise.all([
        db.cardLocalization.count({ where: { language } }),
        db.cardLocalization.count({ where: { language, status: "DRAFT" } }),
        db.cardLocalization.count({ where: { language, status: "REVIEWED" } }),
        db.cardLocalization.count({ where: { language, status: "APPROVED" } }),
        db.cardLocalization.count({ where: { language, status: "NEEDS_REVIEW" } }),
        db.cardLocalization.count({
          where: { language, translationSource: "AI" },
        }),
        db.cardLocalization.count({
          where: { language, translationSource: "GLOSSARY" },
        }),
        db.cardLocalization.count({
          where: { language, translationSource: "HUMAN" },
        }),
      ]),
    ]);

    const items = cards.map((card: any) => {
      const previewEntry =
        card.localizations.find((entry: any) => entry.contentType === "TEXT") ??
        card.localizations[0] ??
        null;

      const counts = card.localizations.reduce(
        (acc: Record<string, number>, entry: any) => {
          acc[entry.status] = (acc[entry.status] ?? 0) + 1;
          return acc;
        },
        {}
      );

      return {
        id: card.id,
        name: card.name,
        code: card.code,
        setCode: card.setCode,
        src: card.src,
        imageKey: card.imageKey,
        region: card.region,
        updatedAt: card.updatedAt,
        preview: previewEntry?.translatedText ?? null,
        translationSources: Array.from(
          new Set(card.localizations.map((entry: any) => entry.translationSource))
        ),
        statusCounts: {
          draft: counts.DRAFT ?? 0,
          reviewed: counts.REVIEWED ?? 0,
          approved: counts.APPROVED ?? 0,
          needsReview: counts.NEEDS_REVIEW ?? 0,
        },
        rowCount: card.localizations.length,
      };
    });

    return NextResponse.json({
      items,
      page,
      pageSize,
      totalCards,
      totalPages: Math.max(1, Math.ceil(totalCards / pageSize)),
      filters: {
        search,
        language,
        status: searchParams.get("status") || null,
        translationSource: searchParams.get("translationSource") || null,
        contentType: searchParams.get("contentType") || null,
      },
      stats: {
        totalRows: rowStats[0],
        draftRows: rowStats[1],
        reviewedRows: rowStats[2],
        approvedRows: rowStats[3],
        needsReviewRows: rowStats[4],
        aiRows: rowStats[5],
        glossaryRows: rowStats[6],
        humanRows: rowStats[7],
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
