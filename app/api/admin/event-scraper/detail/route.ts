export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { EventRegion } from "@prisma/client";
import {
  scrapeEventDetail,
  findMatchingSets,
  dedupeMissingCandidates,
  dedupeCardCandidates,
  generateSlug,
  syncEventMissingSetsInDb,
  syncEventMissingCardsInDb,
  syncEventSetsInDb,
  type RenderMode,
} from "@/lib/services/scraper/eventScraper";
import { prisma } from "@/lib/prisma";

type DetailRequest = {
  eventUrl?: string;
  locale?: string;
  region?: string | null;
  renderMode?: RenderMode;
  renderWaitMs?: number | null;
  listThumbnail?: string | null;
  listEventTxt?: string | null;
  listRawDateText?: string | null;
  dryRun?: boolean;
};

const DEFAULT_RENDER_WAIT_MS = 2000;

function toRegion(value?: string | null): EventRegion | undefined {
  if (!value) return undefined;
  const upper = value.toUpperCase();
  if (upper in EventRegion) {
    return upper as EventRegion;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DetailRequest;
    const {
      eventUrl,
      locale = "en",
      region,
      renderMode = "static",
      renderWaitMs,
      listThumbnail,
      listEventTxt,
      listRawDateText,
      dryRun = true,
    } = body;

    if (!eventUrl || eventUrl.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "eventUrl is required" },
        { status: 400 }
      );
    }

    const render = {
      mode: renderMode,
      waitMs:
        typeof renderWaitMs === "number" && renderWaitMs >= 0
          ? Math.floor(renderWaitMs)
          : DEFAULT_RENDER_WAIT_MS,
    };

    const detail = await scrapeEventDetail(eventUrl.trim(), {
      regionOverride: toRegion(region),
      locale,
      render,
      translator: null,
      listThumbnail: listThumbnail ?? null,
      listEventTxt: listEventTxt ?? null,
      listRawDateText: listRawDateText ?? null,
      listOrder: null,
    });

    if (!detail) {
      return NextResponse.json(
        { success: false, error: "Unable to scrape the provided event URL." },
        { status: 500 }
      );
    }

    const { matches: matchedSets, unmatchedCandidates } =
      await findMatchingSets(detail.detectedSets);
    const matchedSetDetails = await prisma.set.findMany({
      where: { id: { in: matchedSets.map((set) => set.id) } },
      include: {
        attachments: {
          select: { imageUrl: true },
          orderBy: { id: "asc" },
        },
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
          orderBy: { cardId: "asc" },
          take: 20,
        },
      },
    });
    const matchedSetImages = matchedSets.map((set) => {
      const detail = matchedSetDetails.find((item) => item.id === set.id);
      const images: string[] = [];
      if (detail?.image) images.push(detail.image);
      if (detail?.attachments) {
        detail.attachments.forEach((attachment) => {
          if (attachment.imageUrl) images.push(attachment.imageUrl);
        });
      }
      const cards =
        detail?.cards?.map((setCard) => ({
          id: setCard.card.id,
          title: setCard.card.name,
          code: setCard.card.code,
          image: setCard.card.src,
        })) ?? [];
      return {
        ...set,
        images,
        cards,
      };
    });
    const missingSets = dedupeMissingCandidates(unmatchedCandidates);
    const missingCards = dedupeCardCandidates(detail.detectedCards);

    const slug = generateSlug(
      detail.title,
      detail.region,
      detail.sourceUrl || eventUrl.trim()
    );

    if (dryRun) {
      return NextResponse.json(
        {
          success: true,
          dryRun: true,
          event: detail,
          slug,
          matchedSets: matchedSetImages,
          missingSets,
          missingCards,
        },
        { status: 200 }
      );
    }

    const existing = await prisma.event.findUnique({ where: { slug } });

    const event = await prisma.event.upsert({
      where: { slug },
      create: {
        slug,
        title: detail.title,
        description: detail.description,
        content: detail.content,
        originalContent: detail.originalContent,
        locale: detail.locale,
        region: detail.region,
        status: detail.status,
        eventType: detail.eventType,
        category: detail.category,
        startDate: detail.startDate,
        endDate: detail.endDate,
        rawDateText: detail.rawDateText,
        location: detail.location,
        sourceUrl: detail.sourceUrl,
        imageUrl: detail.imageUrl,
        eventThumbnail: detail.eventThumbnail,
        eventTxt: detail.eventTxt,
        listOrder: detail.listOrder,
        isApproved: true,
      },
      update: {
        title: existing?.title ?? detail.title,
        description: existing?.description ?? detail.description,
        content: existing?.content ?? detail.content,
        originalContent: existing?.originalContent ?? detail.originalContent,
        locale: existing?.locale ?? detail.locale,
        region: existing?.region ?? detail.region,
        eventType: existing?.eventType ?? detail.eventType,
        category: existing?.category ?? detail.category,
        startDate: existing?.startDate ?? detail.startDate,
        endDate: existing?.endDate ?? detail.endDate,
        rawDateText: existing?.rawDateText ?? detail.rawDateText,
        location: existing?.location ?? detail.location,
        sourceUrl: existing?.sourceUrl ?? detail.sourceUrl,
        imageUrl: existing?.imageUrl ?? detail.imageUrl,
        eventThumbnail: existing?.eventThumbnail ?? detail.eventThumbnail,
        eventTxt: existing?.eventTxt ?? detail.eventTxt,
        listOrder: existing?.listOrder ?? detail.listOrder,
        status:
          existing?.status === "COMPLETED"
            ? existing.status
            : detail.status,
      },
    });

    const linkedCount = await syncEventSetsInDb(event.id, matchedSets);
    await syncEventMissingSetsInDb(event.id, missingSets);
    await syncEventMissingCardsInDb(event.id, missingCards);

    return NextResponse.json(
      {
        success: true,
        dryRun: false,
        event: detail,
        matchedSets: matchedSetImages,
        missingSets,
        missingCards,
        slug,
        eventId: event.id,
        setsLinked: linkedCount,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Event detail scrape failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
