export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const REGION_ORDER = ["CN", "JP", "US", "FR", "KR"];

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get("search")?.trim() ?? "";
    const region = req.nextUrl.searchParams.get("region")?.trim() ?? "all";
    const pageParam = req.nextUrl.searchParams.get("page");
    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = Math.min(Math.max(Number(limitParam) || 30, 10), 100);
    const page = Math.max(Number(pageParam) || 1, 1);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search.length > 0) {
      where.OR = [
        { canonicalCode: { contains: search, mode: "insensitive" } },
        { canonicalName: { contains: search, mode: "insensitive" } },
      ];
    }
    if (region !== "all") {
      where.links = { some: { region } };
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
        },
      }),
      prisma.cardGroup.count({ where }),
    ]);

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

    const payload = items.map((group) => {
      const canonicalSetCode = group.canonicalCode
        .split("-")[0]
        ?.trim()
        .toUpperCase();
      const regions = Array.from(
        new Set(group.links.map((link) => link.region).filter(Boolean))
      ) as string[];
      const regionStatus: Record<
        string,
        "present" | "missing" | "not-available"
      > = {};
      const missingRegions: string[] = [];
      const notAvailableRegions: string[] = [];
      for (const code of REGION_ORDER) {
        if (regions.includes(code)) {
          regionStatus[code] = "present";
          continue;
        }
        const expected = canonicalSetCode
          ? expectedKey.has(`${canonicalSetCode}|${code}`)
          : false;
        if (expected) {
          regionStatus[code] = "missing";
          missingRegions.push(code);
        } else {
          regionStatus[code] = "not-available";
          notAvailableRegions.push(code);
        }
      }
      const heroCard = group.links[0]?.card ?? null;
      return {
        id: group.id,
        canonicalCode: group.canonicalCode,
        canonicalName: group.canonicalName,
        regions,
        missingRegions,
        notAvailableRegions,
        regionStatus,
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
