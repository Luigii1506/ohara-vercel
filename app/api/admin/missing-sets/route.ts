export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function serializeMissingSet(entry: any) {
  const images =
    Array.isArray(entry.imagesJson) && entry.imagesJson.length > 0
      ? entry.imagesJson
      : [];

  return {
    id: entry.id,
    eventId: entry.eventId,
    title: entry.title,
    translatedTitle: entry.translatedTitle,
    versionSignature: entry.versionSignature,
    isApproved: entry.isApproved,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    images,
    event: entry.event,
  };
}

export async function GET(req: NextRequest) {
  try {
    const approved = req.nextUrl.searchParams.get("approved");
    const where: any = {};

    if (approved === "true") {
      where.isApproved = true;
    } else if (approved === "false") {
      where.isApproved = false;
    }

    const missingSets = await prisma.eventMissingSet.findMany({
      where,
      include: {
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
            sourceUrl: true,
            region: true,
            locale: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
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

    const newMissingSet = await prisma.eventMissingSet.create({
      data: {
        eventId: Number(eventId),
        title,
        translatedTitle,
        versionSignature,
        imagesJson: Array.isArray(images) ? images : [],
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
            sourceUrl: true,
            region: true,
            locale: true,
          },
        },
      },
    });

    return NextResponse.json(serializeMissingSet(newMissingSet), {
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
