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
    isProduct: entry.isProduct,
    productType: entry.productType,
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

export async function GET(
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

    const missingSet = await prisma.missingSet.findUnique({
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

    if (!missingSet) {
      return NextResponse.json(
        { error: "Missing set not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(serializeMissingSet(missingSet), {
      status: 200,
    });
  } catch (error) {
    console.error("Error fetching missing set:", error);
    return NextResponse.json(
      { error: "Failed to fetch missing set" },
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
      isProduct,
      productType,
    } = body;

    const data: any = {};
    if (typeof title === "string" && title.trim().length > 0) {
      data.title = title.trim();
    }
    if (typeof translatedTitle === "string") {
      data.translatedTitle = translatedTitle.trim();
    }
    if (typeof versionSignature === "string" || versionSignature === null) {
      data.versionSignature = versionSignature;
    }
    if (Array.isArray(images)) {
      data.imagesJson = images;
    }
    if (typeof isApproved === "boolean") {
      data.isApproved = isApproved;
    }
    if (typeof isProduct === "boolean") {
      data.isProduct = isProduct;
      if (!isProduct) {
        data.productType = null;
      }
    }
    if (
      typeof productType === "string" ||
      (productType === null && typeof isProduct !== "boolean")
    ) {
      data.productType = productType;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided for update" },
        { status: 400 }
      );
    }

    await prisma.missingSet.update({
      where: { id },
      data,
    });

    const updated = await prisma.missingSet.findUnique({
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

    await prisma.missingSet.update({
      where: { id },
      data: { isApproved: true },
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
