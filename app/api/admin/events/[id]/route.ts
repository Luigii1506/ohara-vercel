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
    isProduct: entry.missingSet?.isProduct ?? false,
    productType: entry.missingSet?.productType ?? null,
    isApproved: entry.missingSet?.isApproved ?? false,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    images,
  };
};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (Number.isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid event id" },
        { status: 400 }
      );
    }

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        sets: {
          include: {
            set: true,
          },
        },
        cards: {
          include: {
            card: true,
          },
        },
        missingSets: {
          where: { missingSet: { isApproved: false } },
          orderBy: { createdAt: "desc" },
          include: {
            missingSet: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const serializedEvent = {
      ...event,
      missingSets: event.missingSets.map(serializeEventMissingSet),
    };

    return NextResponse.json(serializedEvent, { status: 200 });
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json(
      { error: "Failed to fetch event" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (Number.isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid event id" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      title,
      description,
      content,
      locale,
      region,
      status,
      eventType,
      category,
      startDate,
      endDate,
      rawDateText,
      location,
      sourceUrl,
      imageUrl,
      eventThumbnail,
      isApproved,
    } = body;

    const data: any = {};

    if (typeof title === "string") data.title = title.trim();
    if (typeof description === "string" || description === null)
      data.description = description;
    if (typeof content === "string" || content === null)
      data.content = content;
    if (typeof locale === "string") data.locale = locale.trim();
    if (typeof region === "string") data.region = region;
    if (typeof status === "string") data.status = status;
    if (typeof eventType === "string") data.eventType = eventType;
    if (typeof category === "string" || category === null)
      data.category = category;
    if (typeof rawDateText === "string" || rawDateText === null)
      data.rawDateText = rawDateText;
    if (typeof location === "string" || location === null)
      data.location = location;
    if (typeof sourceUrl === "string" || sourceUrl === null)
      data.sourceUrl = sourceUrl;
    if (typeof imageUrl === "string" || imageUrl === null)
      data.imageUrl = imageUrl;
    if (typeof eventThumbnail === "string" || eventThumbnail === null)
      data.eventThumbnail = eventThumbnail;
    if (typeof isApproved === "boolean") data.isApproved = isApproved;

    if (startDate) {
      const parsed = new Date(startDate);
      if (!isNaN(parsed.getTime())) data.startDate = parsed;
    } else if (startDate === null) {
      data.startDate = null;
    }

    if (endDate) {
      const parsed = new Date(endDate);
      if (!isNaN(parsed.getTime())) data.endDate = parsed;
    } else if (endDate === null) {
      data.endDate = null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided for update" },
        { status: 400 }
      );
    }

    const updated = await prisma.event.update({
      where: { id },
      data,
      include: {
        sets: true,
        cards: true,
        missingSets: {
          where: { missingSet: { isApproved: false } },
          orderBy: { createdAt: "desc" },
          include: {
            missingSet: true,
          },
        },
      },
    });

    const serializedEvent = {
      ...updated,
      missingSets: updated.missingSets.map(serializeEventMissingSet),
    };

    return NextResponse.json(serializedEvent, { status: 200 });
  } catch (error) {
    console.error("Error updating event:", error);
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}
