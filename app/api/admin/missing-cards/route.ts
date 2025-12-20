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

function serializeMissingCard(entry: any) {
  return {
    id: entry.id,
    code: entry.code,
    title: entry.title,
    imageUrl: entry.imageUrl,
    isApproved: entry.isApproved,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
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
    const where: any = {};

    if (approved === "true") {
      where.isApproved = true;
    } else if (approved === "false") {
      where.isApproved = false;
    }

    const missingCards = await prisma.missingCard.findMany({
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
        createdAt: "desc",
      },
    });

    return NextResponse.json(missingCards.map(serializeMissingCard), {
      status: 200,
    });
  } catch (error) {
    console.error("Error fetching missing cards:", error);
    return NextResponse.json(
      { error: "Failed to fetch missing cards" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventId, code, title, imageUrl } = body;

    if (!eventId || !code || !title) {
      return NextResponse.json(
        { error: "eventId, code, and title are required" },
        { status: 400 }
      );
    }

    // Usar code + title como identificador único
    const missingCardRecord = await prisma.missingCard.upsert({
      where: {
        code_title_imageUrl: {
          code,
          title,
          imageUrl: imageUrl || "",
        },
      },
      create: {
        code,
        title,
        imageUrl: imageUrl || "",
      },
      update: {
        imageUrl: imageUrl || undefined,
      },
    });

    // Crear relación EventMissingCard si no existe
    await prisma.eventMissingCard.upsert({
      where: {
        eventId_missingCardId: {
          eventId: Number(eventId),
          missingCardId: missingCardRecord.id,
        },
      },
      create: {
        eventId: Number(eventId),
        missingCardId: missingCardRecord.id,
      },
      update: {},
    });

    // Obtener el registro completo con relaciones
    const populated = await prisma.missingCard.findUnique({
      where: { id: missingCardRecord.id },
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

    return NextResponse.json(serializeMissingCard(populated), {
      status: 201,
    });
  } catch (error) {
    console.error("Error creating missing card:", error);
    return NextResponse.json(
      { error: "Failed to create missing card" },
      { status: 500 }
    );
  }
}
