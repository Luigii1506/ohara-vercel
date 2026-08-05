export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status");
    const takeRaw = Number.parseInt(
      request.nextUrl.searchParams.get("take") ?? "50",
      10
    );
    const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 200) : 50;

    const reviews = await prisma.limitlessSetReview.findMany({
      where:
        status && status !== "all"
          ? {
              status: status as any,
            }
          : undefined,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take,
      select: {
        id: true,
        slug: true,
        sourceUrl: true,
        sourceTitle: true,
        sourceCategory: true,
        region: true,
        dbSetId: true,
        status: true,
        declaredCount: true,
        dbSetCardCount: true,
        matchedCount: true,
        wrongSetCount: true,
        missingCount: true,
        extraCount: true,
        updatedAt: true,
        dbSet: {
          select: {
            id: true,
            title: true,
            code: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    const dbSetIds = Array.from(
      new Set(reviews.map((review) => review.dbSetId).filter((value): value is number => Number.isFinite(value)))
    );
    const titleKeys = Array.from(
      new Set(
        reviews.flatMap((review) =>
          [review.sourceTitle, review.dbSet?.title ?? ""]
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean)
        )
      )
    );

    const [dbSets, missingSets] = await Promise.all([
      dbSetIds.length
        ? prisma.set.findMany({
            where: { id: { in: dbSetIds } },
            select: {
              id: true,
              _count: { select: { events: true } },
              events: {
                take: 3,
                select: {
                  event: {
                    select: {
                      id: true,
                      title: true,
                      slug: true,
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
      titleKeys.length
        ? prisma.missingSet.findMany({
            where: { isApproved: false },
            select: {
              id: true,
              title: true,
              events: {
                take: 3,
                select: {
                  event: {
                    select: {
                      id: true,
                      title: true,
                      slug: true,
                    },
                  },
                },
              },
              _count: {
                select: {
                  events: true,
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const dbSetMap = new Map(
      dbSets.map((set) => [
        set.id,
        {
          eventCount: set._count.events,
          events: set.events.map((entry) => entry.event),
        },
      ])
    );
    const missingSetMap = new Map(
      missingSets.map((entry) => [
        entry.title.trim().toLowerCase(),
        {
          id: entry.id,
          title: entry.title,
          eventCount: entry._count.events,
          events: entry.events.map((eventLink) => eventLink.event),
        },
      ])
    );

    const enrichedReviews = reviews.map((review) => {
      const dbContext = review.dbSetId ? dbSetMap.get(review.dbSetId) : null;
      const missingContext =
        missingSetMap.get(review.sourceTitle.trim().toLowerCase()) ??
        (review.dbSet?.title ? missingSetMap.get(review.dbSet.title.trim().toLowerCase()) : null);

      return {
        ...review,
        workflow: {
          dbEventCount: dbContext?.eventCount ?? 0,
          dbEvents: dbContext?.events ?? [],
          missingSetId: missingContext?.id ?? null,
          missingSetTitle: missingContext?.title ?? null,
          missingSetEventCount: missingContext?.eventCount ?? 0,
          missingSetEvents: missingContext?.events ?? [],
        },
      };
    });

    return NextResponse.json({ ok: true, reviews: enrichedReviews }, { status: 200 });
  } catch (error: any) {
    console.error("[limitless/reviews] failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to load Limitless reviews" },
      { status: 500 }
    );
  }
}
