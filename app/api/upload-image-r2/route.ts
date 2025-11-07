import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

// Image size configurations (matching migration script)
const IMAGE_SIZES = {
  tiny: { width: 20, height: 28, quality: 40, suffix: "-tiny" },
  xs: { width: 100, height: 140, quality: 60, suffix: "-xs" },
  thumb: { width: 200, height: 280, quality: 70, suffix: "-thumb" },
  small: { width: 300, height: 420, quality: 75, suffix: "-small" },
  medium: { width: 600, height: 840, quality: 80, suffix: "-medium" },
  large: { width: 800, height: 1120, quality: 85, suffix: "-large" },
  original: { width: null, height: null, quality: 90, suffix: "" },
} as const;

// Initialize S3 client for R2
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
    const { imageUrl, filename } = await request.json();

    if (!imageUrl || !filename) {
      return NextResponse.json(
        { error: "Missing imageUrl or filename" },
        { status: 400 }
      );
    }

    // Validate credentials
    if (
      !process.env.CLOUDFLARE_ACCOUNT_ID ||
      !process.env.R2_ACCESS_KEY_ID ||
      !process.env.R2_SECRET_ACCESS_KEY
    ) {
      return NextResponse.json(
        { error: "Missing R2 credentials in environment" },
        { status: 500 }
      );
    }

    console.log(`📥 Downloading image from: ${imageUrl}`);

    // Download image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    console.log(`✅ Downloaded ${imageBuffer.length} bytes`);

    // Clean filename (remove extension if provided)
    const cleanFilename = filename.replace(/\.(jpg|jpeg|png|webp|gif)$/i, "");

    // Generate and upload all sizes
    let uploadedCount = 0;

    for (const [sizeName, config] of Object.entries(IMAGE_SIZES)) {
      const r2Key = `cards/${cleanFilename}${config.suffix}.webp`;

      console.log(`🔄 Processing ${sizeName}...`);

      // Transform image
      let transformer = sharp(imageBuffer);

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

      // Upload to R2
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key,
        Body: transformedBuffer,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      });

      await s3Client.send(command);

      const fileSize = Math.round(transformedBuffer.length / 1024);
      console.log(`✅ Uploaded ${sizeName}: ${r2Key} (${fileSize}KB)`);
      uploadedCount++;
    }

    const publicUrl = `${R2_PUBLIC_URL}/cards/${cleanFilename}.webp`;

    console.log(`\n✅ All sizes uploaded! Public URL: ${publicUrl}`);

    return NextResponse.json({
      success: true,
      uploadedCount,
      filename: cleanFilename,
      r2Url: publicUrl,
      message: `Successfully uploaded ${uploadedCount} variants`,
    });
  } catch (error) {
    console.error("❌ Upload error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Upload failed",
      },
      { status: 500 }
    );
  }
}
