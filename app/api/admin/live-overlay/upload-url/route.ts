export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Devuelve una URL PRESIGNADA para subir un video directo del navegador a R2
 * (sin pasar por Vercel → sin límite de tamaño). Requiere que el bucket R2
 * tenga CORS que permita PUT desde el dominio del sitio.
 */

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME || "ohara";
const PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

const sanitize = (name: string) =>
  name
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "video";

export async function POST(request: NextRequest) {
  const sessionToken = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!sessionToken?.email || sessionToken.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    !process.env.CLOUDFLARE_ACCOUNT_ID ||
    !process.env.R2_ACCESS_KEY_ID ||
    !process.env.R2_SECRET_ACCESS_KEY ||
    !PUBLIC_URL
  ) {
    return NextResponse.json(
      { error: "Config de R2 faltante (CLOUDFLARE_ACCOUNT_ID / R2_* / R2_PUBLIC_URL)" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const contentType = String(body?.contentType ?? "video/mp4");
  if (!/^video\/(mp4|webm)$/.test(contentType)) {
    return NextResponse.json(
      { error: "Solo se permiten videos mp4 o webm" },
      { status: 400 }
    );
  }
  const ext = contentType.includes("webm") ? "webm" : "mp4";
  const base = sanitize(String(body?.filename ?? "video"));
  const key = `videos/${base}-${Date.now()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });
  const publicUrl = `${PUBLIC_URL.replace(/\/$/, "")}/${key}`;

  return NextResponse.json({ ok: true, uploadUrl, publicUrl, key, contentType });
}
