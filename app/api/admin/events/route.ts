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
        missingCards: {
          where: { missingCard: { isApproved: false } },
          orderBy: { createdAt: "desc" },
          include: { missingCard: true },
        },
        sets: {
          include: {
            set: {
              select: {
                id: true,
                title: true,
                code: true,
                image: true,
                cards: {
                  include: {
                    card: {
                      select: {
                        id: true,
                        name: true,
                        code: true,
                        src: true,
                      },
                    },
                  },
                  take: 12,
                  orderBy: { cardId: "asc" },
                },
              },
            },
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
      missingCards: event.missingCards.map((entry) => ({
        id: entry.id,
        missingCardId: entry.missingCardId,
        code: entry.missingCard?.code ?? "",
        title: entry.missingCard?.title ?? "",
        imageUrl: entry.missingCard?.imageUrl ?? "",
      })),
      setDetails: event.sets
        .filter((entry) => entry.set)
        .map((entry) => {
          const set = entry.set!;
          const images: string[] = [];
          if (set.image) images.push(set.image);
          const cards =
            set.cards?.map((setCard) => ({
              id: setCard.card.id,
              title: setCard.card.name,
              code: setCard.card.code,
              image: setCard.card.src,
            })) ?? [];
          return {
            id: set.id,
            title: set.title,
            code: set.code,
            images,
            cards,
          };
        }),
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
