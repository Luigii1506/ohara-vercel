export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const serializeEventMissingSet = (entry: any) => {
  const images =
    Array.isArray(entry.missingSet?.imagesJson) &&
    entry.missingSet.imagesJson.length > 0
      ? entry.missingSet.imagesJson
      : [];

  return {
    id: entry.id,
    eventId: entry.eventId,
    missingSetId: entry.missingSetId,
    title: entry.missingSet?.title ?? "",
    translatedTitle: entry.missingSet?.translatedTitle,
    versionSignature: entry.missingSet?.versionSignature,
    isApproved: entry.missingSet?.isApproved ?? false,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    images,
  };
};

export async function GET(req: NextRequest) {
  try {
    const approved = req.nextUrl.searchParams.get("approved");
    const search = req.nextUrl.searchParams.get("search");

    const where: any = {};

    if (approved === "true") {
      where.isApproved = true;
    } else if (approved === "false") {
      where.isApproved = false;
    }

    if (search && search.trim().length > 0) {
      const term = search.trim();
      where.OR = [
        { title: { contains: term, mode: "insensitive" } },
        { slug: { contains: term, mode: "insensitive" } },
        { sourceUrl: { contains: term, mode: "insensitive" } },
      ];
    }

    const events = await prisma.event.findMany({
      where,
      include: {
        missingSets: {
          where: { missingSet: { isApproved: false } },
          orderBy: { createdAt: "desc" },
          include: {
            missingSet: true,
          },
        },
        _count: {
          select: {
            sets: true,
            cards: true,
            missingSets: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const serialized = events.map((event) => ({
      ...event,
      missingSets: event.missingSets.map(serializeEventMissingSet),
    }));

    return NextResponse.json(serialized, { status: 200 });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
