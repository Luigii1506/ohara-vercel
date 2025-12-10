export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function serializeMissingSet(entry: any) {
  return {
    id: entry.id,
    eventId: entry.eventId,
    title: entry.title,
    translatedTitle: entry.translatedTitle,
    versionSignature: entry.versionSignature,
    isApproved: entry.isApproved,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    images:
      Array.isArray(entry.imagesJson) && entry.imagesJson.length > 0
        ? entry.imagesJson
        : [],
    event: entry.event,
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (Number.isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid missing set id" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      title,
      translatedTitle,
      versionSignature,
      images,
      isApproved,
    } = body;

    const data: any = {};
    if (typeof title === "string" && title.trim().length > 0) {
      data.title = title.trim();
    }
    if (typeof translatedTitle === "string") {
      data.translatedTitle = translatedTitle.trim();
    }
    if (
      typeof versionSignature === "string" ||
      versionSignature === null
    ) {
      data.versionSignature = versionSignature;
    }
    if (Array.isArray(images)) {
      data.imagesJson = images;
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

    const updated = await prisma.eventMissingSet.update({
      where: { id },
      data,
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

    return NextResponse.json(serializeMissingSet(updated), {
      status: 200,
    });
  } catch (error) {
    console.error("Error updating missing set:", error);
    return NextResponse.json(
      { error: "Failed to update missing set" },
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
        { error: "Invalid missing set id" },
        { status: 400 }
      );
    }

    await prisma.eventMissingSet.delete({
      where: { id },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting missing set:", error);
    return NextResponse.json(
      { error: "Failed to delete missing set" },
      { status: 500 }
    );
  }
}
