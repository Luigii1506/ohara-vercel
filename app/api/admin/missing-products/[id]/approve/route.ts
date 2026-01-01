export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PutObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "ohara";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

const IMAGE_SIZES = {
  tiny: { width: 20, height: 28, quality: 40, suffix: "-tiny" },
  xs: { width: 100, height: 140, quality: 60, suffix: "-xs" },
  thumb: { width: 200, height: 280, quality: 70, suffix: "-thumb" },
  small: { width: 300, height: 420, quality: 75, suffix: "-small" },
  medium: { width: 600, height: 840, quality: 80, suffix: "-medium" },
  large: { width: 800, height: 1120, quality: 85, suffix: "-large" },
  original: { width: null, height: null, quality: 90, suffix: "" },
} as const;

const PRODUCT_TYPE_VALUES = new Set([
  "BOOSTER",
  "DECK",
  "STARTER_DECK",
  "PREMIUM_BOOSTER_BOX",
  "PLAYMAT",
  "SLEEVE",
  "DECK_BOX",
  "STORAGE_BOX",
  "UNCUT_SHEET",
  "PROMO_PACK",
  "DISPLAY_BOX",
  "COLLECTORS_SET",
  "TIN_PACK",
  "ILLUSTRATION_BOX",
  "ANNIVERSARY_SET",
  "PREMIUM_CARD_COLLECTION",
  "DOUBLE_PACK",
  "DEVIL_FRUIT",
  "OTHER",
]);

type ImageClassification = "PRODUCT" | "CARD" | "IGNORE";

interface ApprovalRequestBody {
  imageClassifications: Record<
    string,
    {
      type: ImageClassification;
      cardId?: number;
    }
  >;
  overrideTitle?: string | null;
  overrideProductType?: string | null;
  overrideReleaseDate?: string | null;
  overrideOfficialPrice?: string | number | null;
  overrideOfficialPriceCurrency?: string | null;
  overrideImages?: string[] | null;
  thumbnailUrl?: string | null;
}

const sanitizeForFilename = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

async function uploadImageToR2(
  imageUrl: string,
  filename: string,
  folder: string = "products"
): Promise<{ publicUrl: string; imageKey: string }> {
  const baseKey = `${folder}/${filename}`;
  const publicUrl = `${R2_PUBLIC_URL}/${folder}/${filename}.webp`;

  try {
    const headCommand = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: `${baseKey}.webp`,
    });
    await s3Client.send(headCommand);
    return { publicUrl, imageKey: baseKey };
  } catch (error: any) {
    if (error.name !== "NotFound" && error.$metadata?.httpStatusCode !== 404) {
      throw error;
    }
  }

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.statusText}`);
  }
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  for (const config of Object.values(IMAGE_SIZES)) {
    const r2Key = `${baseKey}${config.suffix}.webp`;
    let transformer = sharp(imageBuffer);
    if (config.width || config.height) {
      transformer = transformer.resize({
        width: config.width || undefined,
        height: config.height || undefined,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
    }
    const transformed = await transformer
      .webp({ quality: config.quality, effort: 6 })
      .toBuffer();
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: r2Key,
      Body: transformed,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    });
    await s3Client.send(command);
  }

  return { publicUrl, imageKey: baseKey };
}

const parseDateOrNull = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseDecimalOrNull = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const finalizeMissingProduct = async (missingProductId: number) => {
  await prisma.missingProduct.update({
    where: { id: missingProductId },
    data: { isApproved: true },
  });
};

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const missingProductId = Number(params.id);
    if (Number.isNaN(missingProductId)) {
      return NextResponse.json(
        { error: "Invalid missing product id" },
        { status: 400 }
      );
    }

    const body = (await req.json()) as ApprovalRequestBody;
    const {
      imageClassifications = {},
      overrideTitle,
      overrideProductType,
      overrideReleaseDate,
      overrideOfficialPrice,
      overrideOfficialPriceCurrency,
      overrideImages,
      thumbnailUrl,
    } = body;

    const missingProduct = await prisma.missingProduct.findUnique({
      where: { id: missingProductId },
    });
    if (!missingProduct) {
      return NextResponse.json(
        { error: "Missing product not found" },
        { status: 404 }
      );
    }

    const storedImages =
      Array.isArray(missingProduct.imagesJson) &&
      missingProduct.imagesJson.length > 0
        ? (missingProduct.imagesJson as string[])
        : [];
    const images =
      Array.isArray(overrideImages) && overrideImages.length > 0
        ? overrideImages.map((url) => String(url).trim()).filter(Boolean)
        : storedImages;

    const finalTitle =
      (overrideTitle || "").trim() ||
      missingProduct.title ||
      "Producto";
    const finalProductType =
      (overrideProductType || "").trim() ||
      missingProduct.productType ||
      "OTHER";
    if (!PRODUCT_TYPE_VALUES.has(finalProductType)) {
      return NextResponse.json(
        { error: "Invalid product type" },
        { status: 400 }
      );
    }

    const finalReleaseDate =
      parseDateOrNull(overrideReleaseDate) || missingProduct.releaseDate || null;
    const finalOfficialPrice =
      parseDecimalOrNull(overrideOfficialPrice) ??
      missingProduct.officialPrice ??
      null;
    const finalOfficialPriceCurrency =
      overrideOfficialPriceCurrency ||
      missingProduct.officialPriceCurrency ||
      null;

    const baseImage =
      thumbnailUrl || missingProduct.thumbnailUrl || images[0] || null;

    let baseImageData: { publicUrl: string; imageKey: string } | null = null;
    if (baseImage) {
      const baseName = `${sanitizeForFilename(finalTitle)}-${Date.now()}`;
      baseImageData = await uploadImageToR2(baseImage, baseName);
    }

    const baseProduct = await prisma.product.create({
      data: {
        name: finalTitle,
        description: missingProduct.category ?? null,
        imageUrl: baseImageData?.publicUrl ?? null,
        thumbnailUrl: baseImage ?? missingProduct.thumbnailUrl ?? null,
        imageKey: baseImageData?.imageKey ?? null,
        productType: finalProductType as any,
        releaseDate: finalReleaseDate,
        officialPrice: finalOfficialPrice,
        officialPriceCurrency: finalOfficialPriceCurrency,
        metadata: {
          source: "missing-product",
          missingProductId: missingProduct.id,
          sourceUrl: missingProduct.sourceUrl ?? null,
        },
      },
    });

    const productImages = Object.entries(imageClassifications)
      .filter(([, value]) => value.type === "PRODUCT")
      .map(([url]) => url);
    const cardImages = Object.entries(imageClassifications)
      .filter(([, value]) => value.type === "CARD")
      .map(([url, value]) => ({ url, cardId: value.cardId }));

    const createdProducts: number[] = [];
    for (const [index, url] of productImages.entries()) {
      const nameSuffix = productImages.length > 1 ? ` ${index + 1}` : "";
      const filename = `${sanitizeForFilename(finalTitle)}-${index + 1}-${Date.now()}`;
      const uploaded = await uploadImageToR2(url, filename);
      const child = await prisma.product.create({
        data: {
          name: `${finalTitle}${nameSuffix}`,
          description: missingProduct.category ?? null,
          imageUrl: uploaded.publicUrl,
          thumbnailUrl: url,
          imageKey: uploaded.imageKey,
          productType: finalProductType as any,
          releaseDate: finalReleaseDate,
          officialPrice: finalOfficialPrice,
          officialPriceCurrency: finalOfficialPriceCurrency,
          metadata: {
            source: "missing-product",
            missingProductId: missingProduct.id,
            sourceUrl: missingProduct.sourceUrl ?? null,
          },
        },
      });
      createdProducts.push(child.id);
      await prisma.productLink.create({
        data: {
          sourceProductId: baseProduct.id,
          targetProductId: child.id,
        },
      });
    }

    for (const entry of cardImages) {
      if (!entry.cardId || !Number.isFinite(entry.cardId)) continue;
      await prisma.productCard.upsert({
        where: {
          productId_cardId: {
            productId: baseProduct.id,
            cardId: entry.cardId,
          },
        },
        create: {
          productId: baseProduct.id,
          cardId: entry.cardId,
        },
        update: {},
      });
    }

    await finalizeMissingProduct(missingProduct.id);

    return NextResponse.json(
      {
        success: true,
        productId: baseProduct.id,
        linkedProducts: createdProducts.length,
        linkedCards: cardImages.filter((entry) => entry.cardId).length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Missing product approval error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Approval failed",
      },
      { status: 500 }
    );
  }
}
