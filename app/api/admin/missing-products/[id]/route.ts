export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const serializeMissingProduct = (entry: any) => {
  const images =
    Array.isArray(entry.imagesJson) && entry.imagesJson.length > 0
      ? entry.imagesJson
      : [];
  return {
    id: entry.id,
    title: entry.title,
    sourceUrl: entry.sourceUrl,
    productType: entry.productType,
    category: entry.category,
    releaseDate: entry.releaseDate,
    officialPrice: entry.officialPrice,
    officialPriceCurrency: entry.officialPriceCurrency,
    thumbnailUrl: entry.thumbnailUrl,
    images,
    isApproved: entry.isApproved,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
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
        { error: "Invalid missing product id" },
        { status: 400 }
      );
    }

    const item = await prisma.missingProduct.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json(
        { error: "Missing product not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(serializeMissingProduct(item), { status: 200 });
  } catch (error) {
    console.error("Error fetching missing product:", error);
    return NextResponse.json(
      { error: "Failed to fetch missing product" },
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
        { error: "Invalid missing product id" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      title,
      sourceUrl,
      productType,
      category,
      releaseDate,
      officialPrice,
      officialPriceCurrency,
      thumbnailUrl,
      images,
      isApproved,
    } = body;

    const data: any = {};
    if (typeof title === "string" && title.trim().length > 0) {
      data.title = title.trim();
    }
    if (typeof sourceUrl === "string" || sourceUrl === null) {
      data.sourceUrl = sourceUrl;
    }
    if (typeof productType === "string" || productType === null) {
      data.productType = productType;
    }
    if (typeof category === "string" || category === null) {
      data.category = category;
    }
    if (typeof thumbnailUrl === "string" || thumbnailUrl === null) {
      data.thumbnailUrl = thumbnailUrl;
    }
    if (releaseDate) {
      data.releaseDate = new Date(releaseDate);
    }
    if (officialPrice !== undefined) {
      data.officialPrice = officialPrice;
    }
    if (typeof officialPriceCurrency === "string" || officialPriceCurrency === null) {
      data.officialPriceCurrency = officialPriceCurrency;
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

    await prisma.missingProduct.update({ where: { id }, data });
    const updated = await prisma.missingProduct.findUnique({ where: { id } });
    return NextResponse.json(serializeMissingProduct(updated), { status: 200 });
  } catch (error) {
    console.error("Error updating missing product:", error);
    return NextResponse.json(
      { error: "Failed to update missing product" },
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
        { error: "Invalid missing product id" },
        { status: 400 }
      );
    }

    await prisma.missingProduct.delete({ where: { id } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting missing product:", error);
    return NextResponse.json(
      { error: "Failed to delete missing product" },
      { status: 500 }
    );
  }
}
