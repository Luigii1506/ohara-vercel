export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const eventSelect = {
  id: true,
  title: true,
  slug: true,
  region: true,
  eventType: true,
  startDate: true,
  sourceUrl: true,
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

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (Number.isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid missing card id" },
        { status: 400 }
      );
    }

    const missingCard = await prisma.missingCard.findUnique({
      where: { id },
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

    if (!missingCard) {
      return NextResponse.json(
        { error: "Missing card not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(serializeMissingCard(missingCard), {
      status: 200,
    });
  } catch (error) {
    console.error("Error fetching missing card:", error);
    return NextResponse.json(
      { error: "Failed to fetch missing card" },
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
        { error: "Invalid missing card id" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { code, title, imageUrl, isApproved } = body;

    const data: any = {};
    if (typeof code === "string" && code.trim().length > 0) {
      data.code = code.trim();
    }
    if (typeof title === "string" && title.trim().length > 0) {
      data.title = title.trim();
    }
    if (typeof imageUrl === "string") {
      data.imageUrl = imageUrl.trim();
    }
    if (typeof isApproved === "boolean") {
      data.isApproved = isApproved;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided for update" },
        { status: 400 }
      );
    }

    await prisma.missingCard.update({
      where: { id },
      data,
    });

    const updated = await prisma.missingCard.findUnique({
      where: { id },
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

    return NextResponse.json(serializeMissingCard(updated), {
      status: 200,
    });
  } catch (error) {
    console.error("Error updating missing card:", error);
    return NextResponse.json(
      { error: "Failed to update missing card" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (Number.isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid missing card id" },
        { status: 400 }
      );
    }

    await prisma.missingCard.delete({
      where: { id },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting missing card:", error);
    return NextResponse.json(
      { error: "Failed to delete missing card" },
      { status: 500 }
    );
  }
}
