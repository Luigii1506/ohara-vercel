export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

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

interface ImageClassificationData {
  type: "CARD" | "UNCUT_SHEET" | "PLAYMAT" | "SLEEVE" | "COVER";
  cardId?: number;
}

async function uploadImageToR2(
  imageUrl: string,
  filename: string,
  folder: string = "sets"
): Promise<string> {
  try {
    const baseKey = `${folder}/${filename}`;
    const publicUrl = `${R2_PUBLIC_URL}/${folder}/${filename}.webp`;

    // Check if file already exists in R2 (check original version)
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: `${baseKey}.webp`,
      });

      await s3Client.send(headCommand);

      // If we get here, the file exists - use existing image
      console.log(`⚠️  File already exists in R2: ${baseKey}.webp`);
      console.log(`✅ Using existing image: ${publicUrl}`);
      return publicUrl;
    } catch (error: any) {
      // If error code is NotFound, file doesn't exist - continue with upload
      if (error.name !== "NotFound" && error.$metadata?.httpStatusCode !== 404) {
        // Some other error occurred
        throw error;
      }
      // File doesn't exist, continue with upload
      console.log(`✅ File doesn't exist, proceeding with upload`);
    }

    console.log(`📥 Downloading image from: ${imageUrl}`);

    // Download image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    console.log(`✅ Downloaded ${imageBuffer.length} bytes`);

    // Generate and upload all size variants
    let uploadedCount = 0;

    for (const [sizeName, config] of Object.entries(IMAGE_SIZES)) {
      const r2Key = `${baseKey}${config.suffix}.webp`;

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

    console.log(`✅ All ${uploadedCount} variants uploaded to R2: ${publicUrl}`);

    return publicUrl;
  } catch (error) {
    console.error("❌ Upload error:", error);
    throw error;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const missingSetId = parseInt(params.id);
    const body = await req.json();
    const { imageClassifications, eventLinkId } = body as {
      imageClassifications: Record<string, ImageClassificationData>;
      eventLinkId?: number | null;
    };

    if (!imageClassifications) {
      return NextResponse.json(
        { error: "imageClassifications is required" },
        { status: 400 }
      );
    }

    // Obtener el missing set canonico
    const missingSet = await prisma.missingSet.findUnique({
      where: { id: missingSetId },
      include: {
        events: {
          include: {
            event: true,
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

    const missingSetData = missingSet;

    if (!missingSet.events.length) {
      return NextResponse.json(
        { error: "Missing set is not linked to any event" },
        { status: 400 }
      );
    }

    console.log(`🔄 Processing approval for: ${missingSetData.title}`);

    // 1. Procesar la imagen de cover (si existe)
    let coverImageUrl = "";
    const coverImage = Object.entries(imageClassifications).find(
      ([_, data]) => data.type === "COVER"
    );

    if (coverImage) {
      const [imageUrl] = coverImage;

      // Generar nombre de archivo único y seguro
      const baseTitle = (missingSetData.translatedTitle || missingSetData.title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-") // Solo letras, números y guiones
        .replace(/^-+|-+$/g, ""); // Remover guiones al inicio/final

      const versionPart = missingSetData.versionSignature
        ? `-${missingSetData.versionSignature.replace(/[^a-z0-9]+/gi, "-")}`
        : "";

      // Nombre final: titulo-version (si no existe en R2, se agregará timestamp en la función)
      const filename = `${baseTitle}${versionPart}`;

      // La función uploadImageToR2 verificará si existe y retornará la URL existente o subirá nueva
      coverImageUrl = await uploadImageToR2(imageUrl, filename);
      console.log(`✅ Cover image processed: ${coverImageUrl}`);
    }

    // 2. Crear el Set
    const newSet = await prisma.set.create({
      data: {
        title: missingSetData.translatedTitle || missingSetData.title,
        image: coverImageUrl,
        code: null, // No tenemos código de set aún
        releaseDate: new Date(),
        isOpen: false,
        version: missingSetData.versionSignature || null,
      },
    });

    console.log(`✅ Set created: ${newSet.title} (ID: ${newSet.id})`);

    // 2.1. Crear relaciones EventSet para todos los eventos relacionados
    for (const link of missingSet.events) {
      await prisma.eventSet.upsert({
        where: {
          eventId_setId: {
            eventId: link.eventId,
            setId: newSet.id,
          },
        },
        create: {
          eventId: link.eventId,
          setId: newSet.id,
        },
        update: {},
      });
    }

    console.log(
      `✅ EventSet relations created for ${missingSet.events.length} evento(s)`
    );

    // 4. Procesar attachments (UNCUT_SHEET, PLAYMAT, SLEEVE)
    const attachments = Object.entries(imageClassifications).filter(
      ([_, data]) =>
        data.type === "UNCUT_SHEET" ||
        data.type === "PLAYMAT" ||
        data.type === "SLEEVE"
    );

    for (const [imageUrl, data] of attachments) {
      // Determinar el folder según el tipo
      let folderName = "";
      let filePrefix = "";

      switch (data.type) {
        case "UNCUT_SHEET":
          folderName = "uncut-sheets";
          filePrefix = "uncut-sheet";
          break;
        case "PLAYMAT":
          folderName = "playmats";
          filePrefix = "playmat";
          break;
        case "SLEEVE":
          folderName = "sleeves";
          filePrefix = "sleeve";
          break;
      }

      // Generar nombre de archivo único
      const timestamp = Date.now();
      const baseTitle = (missingSetData.translatedTitle || missingSetData.title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const filename = `${filePrefix}-${baseTitle}-${timestamp}`;

      // Subir imagen a R2 con todas las variantes
      let attachmentImageUrl = imageUrl; // Por defecto, usar la URL original

      try {
        attachmentImageUrl = await uploadImageToR2(imageUrl, filename, folderName);
      } catch (error) {
        console.error(`❌ Error uploading ${data.type} image:`, error);
        // Si falla el upload, usar la imagen original
        attachmentImageUrl = imageUrl;
      }

      // Crear SetAttachment con la imagen de R2
      await prisma.setAttachment.create({
        data: {
          setId: newSet.id,
          type: data.type as "UNCUT_SHEET" | "PLAYMAT" | "SLEEVE",
          title: `${missingSetData.translatedTitle || missingSetData.title} - ${data.type.replace(/_/g, " ")}`,
          imageUrl: attachmentImageUrl,
          releaseDate: new Date(),
        },
      });

      console.log(`✅ Attachment created: ${data.type} with R2 image`);
    }

    // 5. Procesar CARD images: crear alternates y EventCard relations
    const cardImages = Object.entries(imageClassifications).filter(
      ([_, data]) => data.type === "CARD" && data.cardId
    );

    let createdAlternatesCount = 0;

    for (const [imageUrl, data] of cardImages) {
      if (data.cardId) {
        // Obtener la carta base completa
        const baseCard = await prisma.card.findUnique({
          where: { id: data.cardId },
          include: {
            types: true,
            colors: true,
            effects: true,
            conditions: true,
            texts: true,
          },
        });

        if (!baseCard) {
          console.error(`❌ Base card not found: ${data.cardId}`);
          continue;
        }

        // Generar nombre de archivo para la alterna
        const timestamp = Date.now();
        const alias = `${missingSetData.translatedTitle || missingSetData.title} - ${baseCard.name}`;
        const safeAlias = alias
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        const filename = `${baseCard.code}-${safeAlias}-${timestamp}`;

        // Subir imagen a R2 con todas las variantes
        let alternateImageUrl = "";
        try {
          alternateImageUrl = await uploadImageToR2(imageUrl, filename, "cards");
        } catch (error) {
          console.error(`❌ Error uploading card image:`, error);
          // Si falla el upload, usar la imagen original
          alternateImageUrl = imageUrl;
        }

        // Crear carta alterna
        const {
          id: _id,
          uuid: _uuid,
          src: _src,
          illustrator: _illustrator,
          alternateArt: _alternateArt,
          setCode: _setCode,
          alias: _alias,
          tcgUrl: _tcgUrl,
          ...otherData
        } = baseCard;

        const newAlternate = await prisma.card.create({
          data: {
            ...otherData,
            src: alternateImageUrl,
            illustrator: baseCard.illustrator,
            alternateArt: null,
            setCode: newSet.code || "",
            isFirstEdition: false, // CRÍTICO: las alternas nunca son first edition
            alias: alias,
            order: "0",
            baseCardId: baseCard.baseCardId ?? baseCard.id,
            types:
              baseCard.types.length > 0
                ? { create: baseCard.types.map((t) => ({ type: t.type })) }
                : undefined,
            colors:
              baseCard.colors.length > 0
                ? { create: baseCard.colors.map((c) => ({ color: c.color })) }
                : undefined,
            effects:
              baseCard.effects.length > 0
                ? { create: baseCard.effects.map((e) => ({ effect: e.effect })) }
                : undefined,
            conditions:
              baseCard.conditions.length > 0
                ? { create: baseCard.conditions.map((c) => ({ condition: c.condition })) }
                : undefined,
            texts:
              baseCard.texts.length > 0
                ? { create: baseCard.texts.map((t) => ({ text: t.text })) }
                : undefined,
          },
        });

        // Crear relación CardSet con el nuevo set
        await prisma.cardSet.create({
          data: {
            cardId: newAlternate.id,
            setId: newSet.id,
          },
        });

        // Crear relación EventCard para todos los eventos relacionados
        for (const link of missingSet.events) {
          await prisma.eventCard.upsert({
            where: {
              eventId_cardId: {
                eventId: link.eventId,
                cardId: newAlternate.id,
              },
            },
            create: {
              eventId: link.eventId,
              cardId: newAlternate.id,
            },
            update: {},
          });
        }

        console.log(`✅ Alternate card created: ${newAlternate.code} (ID: ${newAlternate.id})`);
        createdAlternatesCount++;
      }
    }

    // 6. Eliminar el EventMissingSet ya que ya fue aprobado y creado
    await prisma.eventMissingSet.deleteMany({
      where: { missingSetId: missingSetData.id },
    });

    await prisma.missingSet.update({
      where: { id: missingSetData.id },
      data: { isApproved: true },
    });

    console.log(`✅ EventMissingSet deleted (no longer missing)`);

    return NextResponse.json({
      success: true,
      setId: newSet.id,
      setTitle: newSet.title,
      coverImageUrl,
      attachmentsCount: attachments.length,
      alternatesCount: createdAlternatesCount,
    });
  } catch (error) {
    console.error("❌ Approval error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Approval failed",
      },
      { status: 500 }
    );
  }
}
