export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLimitlessCatalogFeed } from "@/lib/services/limitlessSetSync";

export async function GET() {
  try {
    const { entries, stats } = await getLimitlessCatalogFeed({
      region: "US",
      staleHours: 24,
    });

    const dbSetIds = Array.from(
      new Set(entries.map((entry) => entry.dbSetId).filter((value): value is number => Number.isFinite(value)))
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
      prisma.missingSet.findMany({
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
      }),
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

    const enrichedEntries = entries.map((entry) => {
      const dbContext = entry.dbSetId ? dbSetMap.get(entry.dbSetId) : null;
      const missingContext =
        missingSetMap.get(entry.title.trim().toLowerCase()) ??
        (entry.dbSetTitle ? missingSetMap.get(entry.dbSetTitle.trim().toLowerCase()) : null);

      return {
        ...entry,
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

    return NextResponse.json({ ok: true, entries: enrichedEntries, stats }, { status: 200 });
  } catch (error: any) {
    console.error("[limitless/set-catalog] failed:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to load Limitless set catalog" },
      { status: 500 }
    );
  }
}
