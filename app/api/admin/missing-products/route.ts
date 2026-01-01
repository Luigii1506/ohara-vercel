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

    const sortOrder: "asc" | "desc" = order === "asc" ? "asc" : "desc";

    const items = await prisma.missingProduct.findMany({
      where,
      orderBy: {
        createdAt: sortOrder,
      },
    });

    return NextResponse.json(items.map(serializeMissingProduct), {
      status: 200,
    });
  } catch (error) {
    console.error("Error fetching missing products:", error);
    return NextResponse.json(
      { error: "Failed to fetch missing products" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
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
      images = [],
    } = body;

    if (!title) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    const created = await prisma.missingProduct.create({
      data: {
        title,
        sourceUrl: sourceUrl ?? null,
        productType: productType ?? null,
        category: category ?? null,
        releaseDate: releaseDate ? new Date(releaseDate) : null,
        officialPrice: officialPrice ?? null,
        officialPriceCurrency: officialPriceCurrency ?? null,
        thumbnailUrl: thumbnailUrl ?? null,
        imagesJson: Array.isArray(images) ? images : [],
      },
    });

    return NextResponse.json(serializeMissingProduct(created), { status: 201 });
  } catch (error) {
    console.error("Error creating missing product:", error);
    return NextResponse.json(
      { error: "Failed to create missing product" },
      { status: 500 }
    );
  }
}
