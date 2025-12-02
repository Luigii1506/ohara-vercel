import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const IMAGE_SIZES = {
  tiny: { width: 20, height: 28, quality: 40, suffix: "-tiny" },
  xs: { width: 100, height: 140, quality: 60, suffix: "-xs" },
  thumb: { width: 200, height: 280, quality: 70, suffix: "-thumb" },
  small: { width: 300, height: 420, quality: 75, suffix: "-small" },
  medium: { width: 600, height: 840, quality: 80, suffix: "-medium" },
  large: { width: 800, height: 1120, quality: 85, suffix: "-large" },
  original: { width: null, height: null, quality: 90, suffix: "" },
} as const;

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const fileEntry = formData.get("file");
    const filenameEntry = formData.get("filename");

    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { error: "Falta el archivo" },
        { status: 400 }
      );
    }

    if (typeof filenameEntry !== "string" || filenameEntry.trim() === "") {
      return NextResponse.json(
        { error: "Falta el nombre de archivo" },
        { status: 400 }
      );
    }

    if (
      !process.env.CLOUDFLARE_ACCOUNT_ID ||
      !process.env.R2_ACCESS_KEY_ID ||
      !process.env.R2_SECRET_ACCESS_KEY
    ) {
      return NextResponse.json(
        { error: "Credenciales de R2 faltantes" },
        { status: 500 }
      );
    }

    const cleanFilename = filenameEntry
      .trim()
      .replace(
      /\.(jpg|jpeg|png|webp|gif)$/i,
      ""
    );

    const arrayBuffer = await fileEntry.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    let uploadedCount = 0;

    for (const config of Object.values(IMAGE_SIZES)) {
      const r2Key = `cards/${cleanFilename}${config.suffix}.webp`;
      let transformer = sharp(fileBuffer);

      if (config.width || config.height) {
        transformer = transformer.resize({
          width: config.width || undefined,
          height: config.height || undefined,
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        });
      }

      const transformedBuffer = await transformer
        .webp({ quality: config.quality, effort: 6 })
        .toBuffer();

      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key,
        Body: transformedBuffer,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      });

      await s3Client.send(command);
      uploadedCount++;
    }

    const publicUrl = `${R2_PUBLIC_URL}/cards/${cleanFilename}.webp`;

    return NextResponse.json({
      success: true,
      uploadedCount,
      filename: cleanFilename,
      r2Url: publicUrl,
      message: `Successfully uploaded ${uploadedCount} variants`,
    });
  } catch (error) {
    console.error("❌ Upload error (file)", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
