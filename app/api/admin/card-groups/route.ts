export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const REGION_ORDER = ["CN", "JP", "US", "FR", "KR"];
const SET_PREFIX_ORDER = ["OP", "ST", "EB", "PRB", "P"];

function getSetPrefixOrder(code: string): number {
  const prefix = code.split("-")[0]?.toUpperCase() ?? "";
  const idx = SET_PREFIX_ORDER.indexOf(prefix);
  return idx === -1 ? SET_PREFIX_ORDER.length : idx;
}

function parseCardNumber(code: string): number {
  const match = code.match(/-(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function compareCanonicalCodes(a: string, b: string): number {
  const prefixA = a.split("-")[0]?.toUpperCase() ?? "";
  const prefixB = b.split("-")[0]?.toUpperCase() ?? "";

  // First compare by prefix order (OP, ST, EB, PRB, P)
  const prefixOrderA = getSetPrefixOrder(a);
  const prefixOrderB = getSetPrefixOrder(b);
  if (prefixOrderA !== prefixOrderB) {
    return prefixOrderA - prefixOrderB;
  }

  // If same prefix type, compare full set code alphabetically (OP01 vs OP02)
  if (prefixA !== prefixB) {
    return prefixA.localeCompare(prefixB);
  }

  // Same set, compare card number
  const numA = parseCardNumber(a);
  const numB = parseCardNumber(b);
  return numA - numB;
}

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get("search")?.trim() ?? "";
    const region = req.nextUrl.searchParams.get("region")?.trim() ?? "all";
    const groupIdParam = req.nextUrl.searchParams.get("groupId");
    const pageParam = req.nextUrl.searchParams.get("page");
    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = Math.min(Math.max(Number(limitParam) || 30, 10), 3000);
    const page = Math.max(Number(pageParam) || 1, 1);
    const skip = (page - 1) * limit;

    const where: any = {};
    // If groupId is provided, fetch only that specific group
    if (groupIdParam) {
      const groupId = parseInt(groupIdParam, 10);
      if (!isNaN(groupId)) {
        where.id = groupId;
      }
    } else {
      if (search.length > 0) {
        where.OR = [
          { canonicalCode: { contains: search, mode: "insensitive" } },
          { canonicalName: { contains: search, mode: "insensitive" } },
        ];
      }
      if (region !== "all") {
        where.links = { some: { region } };
      }
    }

    const [items, total] = await Promise.all([
      prisma.cardGroup.findMany({
        where,
        orderBy: { canonicalCode: "asc" },
        skip,
        take: limit,
        select: {
          id: true,
          canonicalCode: true,
          canonicalName: true,
          links: {
            select: {
              cardId: true,
              region: true,
              language: true,
              card: {
                select: {
                  id: true,
                  name: true,
                  src: true,
                  imageKey: true,
                  code: true,
                },
              },
            },
          },
          regionReviews: {
            select: {
              region: true,
              status: true,
            },
          },
        },
      }),
      prisma.cardGroup.count({ where }),
    ]);

    const groupIds = items.map((group) => group.id);
    const canonicalCodes = Array.from(
      new Set(items.map((group) => group.canonicalCode.toUpperCase()))
    );

    const setCodes = Array.from(
      new Set(
        items
          .map((group) => group.canonicalCode.split("-")[0]?.trim().toUpperCase())
          .filter(Boolean)
      )
    );
    const expectedSets = await prisma.set.findMany({
      where: {
        code: { in: setCodes },
        region: { in: REGION_ORDER },
      },
      select: { code: true, region: true },
    });
    const expectedKey = new Set(
      expectedSets.map((set) => `${set.code?.toUpperCase() ?? ""}|${set.region}`)
    );

    const [variantGroups, alternates] = await Promise.all([
      prisma.cardVariantGroup.findMany({
        where: { baseGroupId: { in: groupIds } },
        select: {
          id: true,
          baseGroupId: true,
          regionReviews: {
            select: { region: true, status: true },
          },
          links: {
            select: {
              card: {
                select: { region: true },
              },
            },
          },
        },
      }),
      prisma.card.findMany({
        where: {
          code: { in: canonicalCodes },
          isFirstEdition: false,
          region: { in: REGION_ORDER },
        },
        select: {
          id: true,
          code: true,
          region: true,
          variantGroupLinks: {
            where: {
              variantGroup: { baseGroupId: { in: groupIds } },
            },
            select: { variantGroupId: true },
          },
        },
      }),
    ]);

    const variantGroupsByBase = new Map<number, typeof variantGroups>();
    for (const group of variantGroups) {
      if (!variantGroupsByBase.has(group.baseGroupId)) {
        variantGroupsByBase.set(group.baseGroupId, []);
      }
      variantGroupsByBase.get(group.baseGroupId)!.push(group);
    }

    const alternatesByCode = new Map<string, typeof alternates>();
    for (const card of alternates) {
      const key = card.code.toUpperCase();
      if (!alternatesByCode.has(key)) {
        alternatesByCode.set(key, []);
      }
      alternatesByCode.get(key)!.push(card);
    }

    const payload = items.map((group) => {
      const canonicalSetCode = group.canonicalCode
        .split("-")[0]
        ?.trim()
        .toUpperCase();
      const regions = Array.from(
        new Set(group.links.map((link) => link.region).filter(Boolean))
      ) as string[];
      const reviewStatus = new Map(
        group.regionReviews.map((review) => [review.region, review.status])
      );
      const regionStatus: Record<
        string,
        "present" | "missing" | "not-available" | "unknown" | "exclusive" | "not-exists"
      > = {};
      const missingRegions: string[] = [];
      const notAvailableRegions: string[] = [];
      const reviewedNotExists = new Set<string>();
      let hasExclusiveReview = false;
      for (const code of REGION_ORDER) {
        if (regions.includes(code)) {
          regionStatus[code] = "present";
          continue;
        }
        if (reviewStatus.get(code) === "EXCLUSIVE") {
          regionStatus[code] = "exclusive";
          notAvailableRegions.push(code);
          hasExclusiveReview = true;
          continue;
        }
        if (reviewStatus.get(code) === "NOT_EXISTS") {
          regionStatus[code] = "not-exists";
          notAvailableRegions.push(code);
          reviewedNotExists.add(code);
          continue;
        }
        if (reviewStatus.get(code) === "UNKNOWN") {
          regionStatus[code] = "unknown";
          continue;
        }
        const expected = canonicalSetCode
          ? expectedKey.has(`${canonicalSetCode}|${code}`)
          : false;
        if (expected) {
          regionStatus[code] = "missing";
        } else {
          regionStatus[code] = "not-available";
          notAvailableRegions.push(code);
        }
      }
      const isExclusive = hasExclusiveReview;
      const baseComplete = REGION_ORDER.every((code) => {
        const status = regionStatus[code];
        return (
          status === "present" ||
          status === "not-exists" ||
          status === "exclusive"
        );
      });
      for (const code of REGION_ORDER) {
        const status = regionStatus[code];
        if (
          status !== "present" &&
          status !== "not-exists" &&
          status !== "exclusive"
        ) {
          missingRegions.push(code);
        }
      }

      const groupVariantGroups = variantGroupsByBase.get(group.id) ?? [];
      const groupVariantIds = new Set(groupVariantGroups.map((vg) => vg.id));
      const groupAlternates = alternatesByCode.get(
        group.canonicalCode.toUpperCase()
      ) ?? [];
      const hasUnlinkedAlternates = groupAlternates.some((card) => {
        const links = card.variantGroupLinks ?? [];
        return !links.some((link) => groupVariantIds.has(link.variantGroupId));
      });
      const hasVariantGroups = groupVariantGroups.length > 0;
      const hasAnyAlternates = groupAlternates.length > 0;
      let variantCoverageComplete = true;
      if (hasVariantGroups) {
        for (const variantGroup of groupVariantGroups) {
          const linkedRegions = new Set(
            variantGroup.links
              .map((link) => link.card?.region)
              .filter((region): region is string => Boolean(region))
          );
          const reviewedRegionsForGroup = new Set(
            variantGroup.regionReviews.map((review) => review.region)
          );
          for (const code of REGION_ORDER) {
            if (
              !linkedRegions.has(code) &&
              !reviewedRegionsForGroup.has(code)
            ) {
              variantCoverageComplete = false;
              break;
            }
          }
          if (!variantCoverageComplete) break;
        }
      }
      const fullComplete =
        baseComplete &&
        !hasUnlinkedAlternates &&
        (!hasAnyAlternates || variantCoverageComplete);
      const heroCard = group.links[0]?.card ?? null;
      return {
        id: group.id,
        canonicalCode: group.canonicalCode,
        canonicalName: group.canonicalName,
        regions,
        missingRegions,
        notAvailableRegions,
        regionStatus,
        isExclusive,
        baseComplete,
        fullComplete,
        totalLinks: group.links.length,
        heroCard,
        links: group.links.map((link) => ({
          cardId: link.cardId,
          region: link.region,
          language: link.language,
          card: link.card,
        })),
      };
    });

    // Sort payload by custom order: OP, ST, EB, PRB, P
    payload.sort((a, b) => compareCanonicalCodes(a.canonicalCode, b.canonicalCode));

    return NextResponse.json(
      {
        items: payload,
        total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
        regionOrder: REGION_ORDER,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching card groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch card groups" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { canonicalCode, canonicalName } = body;
    if (!canonicalCode || typeof canonicalCode !== "string") {
      return NextResponse.json(
        { error: "canonicalCode is required" },
        { status: 400 }
      );
    }
    const created = await prisma.cardGroup.create({
      data: {
        canonicalCode: canonicalCode.trim(),
        canonicalName:
          typeof canonicalName === "string" && canonicalName.trim().length
            ? canonicalName.trim()
            : null,
      },
      select: { id: true, canonicalCode: true, canonicalName: true },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Error creating card group:", error);
    return NextResponse.json(
      { error: "Failed to create card group" },
      { status: 500 }
    );
  }
}
