export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const REGION_ORDER = ["CN", "JP", "US", "FR", "KR"];

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const groupId = Number(params.id);
    if (Number.isNaN(groupId)) {
      return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
    }
    const regionParam = req.nextUrl.searchParams.get("region")?.trim();
    const resolvedRegions =
      !regionParam || regionParam === "all"
        ? REGION_ORDER
        : [regionParam];

    const group = await prisma.cardGroup.findUnique({
      where: { id: groupId },
      select: { id: true, canonicalCode: true },
    });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const cards = await prisma.card.findMany({
      where: {
        code: group.canonicalCode,
        region: { in: resolvedRegions },
      },
      orderBy: [{ isFirstEdition: "desc" }, { alias: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        src: true,
        region: true,
        isFirstEdition: true,
        alternateArt: true,
        illustrator: true,
        alias: true,
        order: true,
        setCode: true,
        baseGroupLinks: {
          where: { groupId },
          select: { id: true },
        },
        variantGroupLinks: {
          where: {
            variantGroup: { baseGroupId: groupId },
          },
          select: { variantGroupId: true },
        },
      },
    });

    const [variantGroups, baseRegionReviews] = await Promise.all([
      prisma.cardVariantGroup.findMany({
        where: { baseGroupId: groupId },
        orderBy: { id: "asc" },
        select: {
          id: true,
          variantKey: true,
          alternateArt: true,
          illustrator: true,
          links: {
            select: {
              cardId: true,
              card: {
                select: {
                  id: true,
                  code: true,
                  region: true,
                  src: true,
                },
              },
            },
          },
          regionReviews: {
            select: { region: true, status: true },
          },
        },
      }),
      prisma.cardGroupRegionReview.findMany({
        where: { groupId, region: { in: resolvedRegions } },
        select: { region: true, status: true },
      }),
    ]);

    const baseRegionStatus = baseRegionReviews.reduce<Record<string, string>>(
      (acc, review) => {
        acc[review.region] = review.status;
        return acc;
      },
      {}
    );

    const variantRegionStatus = variantGroups.reduce<
      Record<number, Record<string, string>>
    >((acc, group) => {
      acc[group.id] = group.regionReviews.reduce<Record<string, string>>(
        (inner, review) => {
          inner[review.region] = review.status;
          return inner;
        },
        {}
      );
      return acc;
    }, {});

    return NextResponse.json(
      {
        cards,
        variantGroups,
        baseRegionStatus,
        variantRegionStatus,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching region cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch region cards" },
      { status: 500 }
    );
  }
}
