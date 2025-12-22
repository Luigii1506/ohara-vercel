export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const eventSelect = {
  id: true,
  title: true,
  slug: true,
  sourceUrl: true,
  region: true,
  locale: true,
};

function serializeMissingSet(entry: any) {
  const images =
    Array.isArray(entry.imagesJson) && entry.imagesJson.length > 0
      ? entry.imagesJson
      : [];

  return {
    id: entry.id,
    title: entry.title,
    translatedTitle: entry.translatedTitle,
    versionSignature: entry.versionSignature,
    isApproved: entry.isApproved,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    images,
    events:
      entry.events?.map((link: any) => ({
        linkId: link.id,
        eventId: link.eventId,
        createdAt: link.createdAt,
        event: link.event ?? null,
      })) ?? [],
  };
}

export async function GET(req: NextRequest) {
  try {
    const approved = req.nextUrl.searchParams.get("approved");
    const order = req.nextUrl.searchParams.get("order");
    const where: any = {};

    if (approved === "true") {
      where.isApproved = true;
    } else if (approved === "false") {
      where.isApproved = false;
    }

    // Determinar el orden de clasificación (por defecto: desc)
    const sortOrder: "asc" | "desc" = order === "asc" ? "asc" : "desc";

    const missingSets = await prisma.missingSet.findMany({
      where,
      include: {
        events: {
          include: {
            event: {
              select: eventSelect,
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: {
        createdAt: sortOrder,
      },
    });

    return NextResponse.json(missingSets.map(serializeMissingSet), {
      status: 200,
    });
  } catch (error) {
    console.error("Error fetching missing sets:", error);
    return NextResponse.json(
      { error: "Failed to fetch missing sets" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      eventId,
      title,
      translatedTitle,
      versionSignature,
      images = [],
    } = body;

    if (!eventId || !title) {
      return NextResponse.json(
        { error: "eventId and title are required" },
        { status: 400 }
      );
    }

    const missingSetRecord = await prisma.missingSet.upsert({
      where: { title },
      create: {
        title,
        translatedTitle,
        versionSignature,
        imagesJson: Array.isArray(images) ? images : [],
      },
      update: {
        translatedTitle: translatedTitle ?? undefined,
        versionSignature: versionSignature ?? undefined,
        imagesJson: Array.isArray(images) ? images : undefined,
      },
    });

    await prisma.eventMissingSet.upsert({
      where: {
        eventId_missingSetId: {
          eventId: Number(eventId),
          missingSetId: missingSetRecord.id,
        },
      },
      create: {
        eventId: Number(eventId),
        missingSetId: missingSetRecord.id,
      },
      update: {},
    });

    const populated = await prisma.missingSet.findUnique({
      where: { id: missingSetRecord.id },
      include: {
        events: {
          include: {
            event: {
              select: eventSelect,
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json(serializeMissingSet(populated), {
      status: 201,
    });
  } catch (error) {
    console.error("Error creating missing set:", error);
    return NextResponse.json(
      { error: "Failed to create missing set" },
      { status: 500 }
    );
  }
}
