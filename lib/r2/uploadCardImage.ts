import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

/**
 * Tamaños pre-generados de imagen (debe coincidir con app/api/upload-image-r2
 * y con lib/imageOptimization.ts).
 */
export const IMAGE_SIZES = {
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

export function hasR2Credentials(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY
  );
}

export interface UploadCardImageResult {
  r2Url: string;
  filename: string;
  uploadedCount: number;
  exists?: boolean;
}

/**
 * Descarga una imagen, genera todas las variantes WebP y las sube a R2.
 * Devuelve la URL pública (variante "original").
 *
 * @param imageUrl  URL de origen de la imagen (ej. Limitless).
 * @param filename  nombre base SIN extensión (ej. "EB03-001-v1718000000").
 * @param overwrite si es false y ya existe `cards/{filename}.webp`, no vuelve a subir.
 */
export async function uploadCardImageToR2(
  imageUrl: string,
  filename: string,
  overwrite = true
): Promise<UploadCardImageResult> {
  if (!imageUrl || !filename) {
    throw new Error("uploadCardImageToR2: faltan imageUrl o filename");
  }
  if (!hasR2Credentials()) {
    throw new Error("uploadCardImageToR2: faltan credenciales de R2 en el entorno");
  }

  const cleanFilename = filename.replace(/\.(jpg|jpeg|png|webp|gif)$/i, "");

  // Si no se permite overwrite, verificar existencia previa.
  if (!overwrite) {
    try {
      await s3Client.send(
        new HeadObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: `cards/${cleanFilename}.webp`,
        })
      );
      // Existe: no re-subir.
      return {
        r2Url: `${R2_PUBLIC_URL}/cards/${cleanFilename}.webp`,
        filename: cleanFilename,
        uploadedCount: 0,
        exists: true,
      };
    } catch (error: any) {
      if (error.name !== "NotFound" && error.$metadata?.httpStatusCode !== 404) {
        throw error;
      }
      // No existe → continuar con la subida.
    }
  }

  // Descargar la imagen original.
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(
      `No se pudo descargar la imagen (${imageResponse.status} ${imageResponse.statusText})`
    );
  }
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  let uploadedCount = 0;
  for (const config of Object.values(IMAGE_SIZES)) {
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

    await s3Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: `cards/${cleanFilename}${config.suffix}.webp`,
        Body: transformedBuffer,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    uploadedCount++;
  }

  return {
    r2Url: `${R2_PUBLIC_URL}/cards/${cleanFilename}.webp`,
    filename: cleanFilename,
    uploadedCount,
  };
}
