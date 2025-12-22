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
  type: "CARD" | "DON" | "UNCUT_SHEET" | "PLAYMAT" | "SLEEVE" | "COVER";
  cardId?: number;
}

type ApprovalAction =
  | "createNew"
  | "linkExisting"
  | "createAndReassign"
  | "eventCardOnly";

interface ApprovalRequestBody {
  imageClassifications: Record<string, ImageClassificationData>;
  eventLinkId?: number | null;
  action?: ApprovalAction;
  existingSetId?: number | null;
  overrideTitle?: string | null;
  overrideVersion?: string | null;
  setCode?: string | null;
  reassignCardIds?: number[];
  eventCardPayload?: {
    imageUrl: string;
    mode: "existing" | "alternate";
    cardId?: number;
    baseCardId?: number;
    classification?: string | null;
  };
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
    // DON se procesa igual que CARD (crea carta alterna), así que no hay que excluirlo

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

const sanitizeForFilename = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

async function resolveCoverImageUrl(
  imageClassifications: Record<string, ImageClassificationData>,
  missingSetData: any,
  fallbackTitle: string,
  versionSignature: string | null
) {
  const coverImage = Object.entries(imageClassifications).find(
    ([_, data]) => data.type === "COVER"
  );
  if (!coverImage) {
    return "";
  }

  const [imageUrl] = coverImage;
  const safeTitle = sanitizeForFilename(fallbackTitle);
  const versionPart = versionSignature
    ? `-${sanitizeForFilename(versionSignature)}`
    : "";
  const filename = `${safeTitle}${versionPart}`;
  return uploadImageToR2(imageUrl, filename);
}

async function linkEventsToSet(
  eventLinks: Array<{ eventId: number }>,
  setId: number
) {
  for (const link of eventLinks) {
    await prisma.eventSet.upsert({
      where: {
        eventId_setId: {
          eventId: link.eventId,
          setId,
        },
      },
      create: {
        eventId: link.eventId,
        setId,
      },
      update: {},
    });
  }
}

async function processAttachmentsForSet(
  imageClassifications: Record<string, ImageClassificationData>,
  missingSetData: any,
  setId: number
) {
  const attachments = Object.entries(imageClassifications).filter(
    ([_, data]) =>
      data.type === "UNCUT_SHEET" ||
      data.type === "PLAYMAT" ||
      data.type === "SLEEVE"
  );
  let created = 0;

  for (const [imageUrl, data] of attachments) {
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

    const timestamp = Date.now();
    const baseTitle = sanitizeForFilename(
      missingSetData.translatedTitle || missingSetData.title
    );
    const filename = `${filePrefix}-${baseTitle}-${timestamp}`;

    let attachmentImageUrl = imageUrl;
    try {
      attachmentImageUrl = await uploadImageToR2(
        imageUrl,
        filename,
        folderName
      );
    } catch (error) {
      console.error(`❌ Error uploading ${data.type} image:`, error);
    }

    await prisma.setAttachment.create({
      data: {
        setId,
        type: data.type as "UNCUT_SHEET" | "PLAYMAT" | "SLEEVE",
        title: `${missingSetData.translatedTitle || missingSetData.title} - ${data.type.replace(/_/g, " ")}`,
        imageUrl: attachmentImageUrl,
        releaseDate: new Date(),
      },
    });
    created++;
  }

  return created;
}

async function createAlternatesFromCardImages(
  imageClassifications: Record<string, ImageClassificationData>,
  missingSet: any,
  setId: number,
  setCode: string | null
) {
  const cardImages = Object.entries(imageClassifications).filter(
    ([_, data]) => data.type === "CARD" && data.cardId
  );

  let createdAlternatesCount = 0;

  for (const [imageUrl, data] of cardImages) {
    if (!data.cardId) continue;

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

    const alias = `${missingSet.translatedTitle || missingSet.title} - ${baseCard.name}`;
    const safeAlias = sanitizeForFilename(alias);
    const filename = `${baseCard.code}-${safeAlias}-${Date.now()}`;

    let alternateImageUrl = "";
    try {
      alternateImageUrl = await uploadImageToR2(imageUrl, filename, "cards");
    } catch (error) {
      console.error(`❌ Error uploading card image:`, error);
      alternateImageUrl = imageUrl;
    }

    const {
      id: _id,
      uuid: _uuid,
      src: _src,
      illustrator: _illustrator,
      alternateArt: _alternateArt,
      setCode: _setCode,
      alias: _alias,
      tcgUrl: _tcgUrl,
      tcgplayerProductId: _tcgplayerProductId,
      tcgplayerLinkStatus: _tcgplayerLinkStatus,
      marketPrice: _marketPrice,
      lowPrice: _lowPrice,
      highPrice: _highPrice,
      priceCurrency: _priceCurrency,
      priceUpdatedAt: _priceUpdatedAt,
      ...otherData
    } = baseCard;

    const newAlternate = await prisma.card.create({
      data: {
        ...otherData,
        src: alternateImageUrl,
        illustrator: baseCard.illustrator,
        alternateArt: null,
        setCode: setCode || "",
        isFirstEdition: false,
        alias,
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
        tcgplayerProductId: null,
        tcgplayerLinkStatus: null,
        marketPrice: null,
        lowPrice: null,
        highPrice: null,
        priceCurrency: null,
        priceUpdatedAt: null,
      },
    });

    await prisma.cardSet.create({
      data: {
        cardId: newAlternate.id,
        setId,
      },
    });

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

    createdAlternatesCount++;
  }

  return createdAlternatesCount;
}

async function reassignCardsToSet(
  cardIds: number[],
  setId: number,
  targetSetCode: string | null
) {
  if (!cardIds.length) return 0;
  let updated = 0;

  for (const cardId of cardIds) {
    const card = await prisma.card.findUnique({
      where: { id: cardId },
    });
    if (!card) continue;

    await prisma.card.update({
      where: { id: cardId },
      data: targetSetCode ? { setCode: targetSetCode } : {},
    });

    await prisma.cardSet.deleteMany({ where: { cardId } });
    await prisma.cardSet.create({
      data: {
        cardId,
        setId,
      },
    });
    updated++;
  }

  return updated;
}

async function finalizeMissingSet(missingSetId: number) {
  await prisma.eventMissingSet.deleteMany({
    where: { missingSetId },
  });
  await prisma.missingSet.delete({
    where: { id: missingSetId },
  });
}


export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const missingSetId = parseInt(params.id);
    const body = (await req.json()) as ApprovalRequestBody;
    const {
      imageClassifications = {},
      action = "createNew",
      existingSetId,
      overrideTitle,
      overrideVersion,
      setCode,
      reassignCardIds = [],
      eventCardPayload,
    } = body;

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

    const finalTitle =
      (typeof overrideTitle === "string" && overrideTitle.trim().length
        ? overrideTitle.trim()
        : missingSetData.translatedTitle || missingSetData.title) ?? missingSetData.title;
    const finalVersion =
      typeof overrideVersion === "string" && overrideVersion.trim().length
        ? overrideVersion.trim()
        : missingSetData.versionSignature ?? null;
    const finalSetCode =
      typeof setCode === "string" && setCode.trim().length > 0
        ? setCode.trim()
        : null;

    if (action === "linkExisting") {
      if (!existingSetId) {
        return NextResponse.json(
          { error: "existingSetId is required for this action" },
          { status: 400 }
        );
      }

      const existingSet = await prisma.set.findUnique({
        where: { id: existingSetId },
      });

      if (!existingSet) {
        return NextResponse.json(
          { error: "Selected set not found" },
          { status: 404 }
        );
      }

      if (
        (finalTitle && finalTitle !== existingSet.title) ||
        finalVersion !== existingSet.version
      ) {
        await prisma.set.update({
          where: { id: existingSet.id },
          data: {
            title: finalTitle,
            version: finalVersion,
          },
        });
      }

      await linkEventsToSet(missingSet.events, existingSet.id);
      const attachmentsCount = await processAttachmentsForSet(
        imageClassifications,
        missingSetData,
        existingSet.id
      );

      await finalizeMissingSet(missingSetData.id);

      return NextResponse.json({
        success: true,
        mode: "linkExisting",
        setId: existingSet.id,
        setTitle: finalTitle,
        attachmentsCount,
      });
    }

    if (action === "eventCardOnly") {
      if (!missingSet.events.length) {
        return NextResponse.json(
          { error: "Missing set is not linked to any event" },
          { status: 400 }
        );
      }
      if (!eventCardPayload) {
        return NextResponse.json(
          { error: "eventCardPayload is required for eventCardOnly" },
          { status: 400 }
        );
      }
      const { cardId, baseCardId, imageUrl, mode = "existing" } =
        eventCardPayload;
      let targetCardId: number | null = null;

      if (mode === "existing") {
        if (!cardId || !Number.isFinite(cardId)) {
          return NextResponse.json(
            { error: "A valid cardId is required when using an existing card" },
            { status: 400 }
          );
        }
        const existingCard = await prisma.card.findUnique({
          where: { id: cardId },
          select: { id: true },
        });
        if (!existingCard) {
          return NextResponse.json(
            { error: "Selected card not found" },
            { status: 404 }
          );
        }
        targetCardId = existingCard.id;
      } else {
        if (
          !baseCardId ||
          !Number.isFinite(baseCardId) ||
          typeof imageUrl !== "string" ||
          imageUrl.trim().length === 0
        ) {
          return NextResponse.json(
            {
              error:
                "baseCardId and imageUrl are required when creating an alternate",
            },
            { status: 400 }
          );
        }
        const baseCard = await prisma.card.findUnique({
          where: { id: baseCardId },
          include: {
            types: true,
            colors: true,
            effects: true,
            conditions: true,
            texts: true,
            sets: true,
          },
        });
        if (!baseCard) {
          return NextResponse.json(
            { error: "Base card not found" },
            { status: 404 }
          );
        }
        const safeAlias = `${finalTitle || "Event Card"} - ${baseCard.name}`;
        const filename = `${baseCard.code}-${sanitizeForFilename(safeAlias)}-${Date.now()}`;
        let alternateImageUrl = "";
        try {
          alternateImageUrl = await uploadImageToR2(imageUrl, filename, "cards");
        } catch (error) {
          console.error("❌ Error uploading event card image:", error);
          alternateImageUrl = imageUrl;
        }

        const {
          id: _id,
          uuid: _uuid,
          src: _src,
          illustrator: _illustrator,
          alternateArt: _alternateArt,
          setCode: _setCode,
          alias: _alias,
          tcgUrl: _tcgUrl,
          sets: _sets,
          tcgplayerProductId: _tcgplayerProductId,
          tcgplayerLinkStatus: _tcgplayerLinkStatus,
          marketPrice: _marketPrice,
          lowPrice: _lowPrice,
          highPrice: _highPrice,
          priceCurrency: _priceCurrency,
          priceUpdatedAt: _priceUpdatedAt,
          ...otherData
        } = baseCard;

        const newAlternate = await prisma.card.create({
          data: {
            ...otherData,
            src: alternateImageUrl,
            illustrator: baseCard.illustrator,
            alternateArt: null,
            setCode: baseCard.setCode || "",
            isFirstEdition: false,
            alias: safeAlias,
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
            tcgplayerProductId: null,
            tcgplayerLinkStatus: null,
            marketPrice: null,
            lowPrice: null,
            highPrice: null,
            priceCurrency: null,
            priceUpdatedAt: null,
          },
        });

        if (baseCard.sets.length > 0) {
          await prisma.cardSet.createMany({
            data: baseCard.sets.map((setLink) => ({
              cardId: newAlternate.id,
              setId: setLink.setId,
            })),
          });
        }

        targetCardId = newAlternate.id;
      }

      if (!targetCardId) {
        return NextResponse.json(
          { error: "Failed to resolve card for eventCardOnly" },
          { status: 400 }
        );
      }

      for (const link of missingSet.events) {
        await prisma.eventCard.upsert({
          where: {
            eventId_cardId: {
              eventId: link.eventId,
              cardId: targetCardId,
            },
          },
          create: {
            eventId: link.eventId,
            cardId: targetCardId,
          },
          update: {},
        });
      }

      await finalizeMissingSet(missingSetData.id);

      return NextResponse.json({
        success: true,
        mode: "eventCardOnly",
        setTitle: finalTitle,
        cardId: targetCardId,
      });
    }

    if (!missingSet.events.length) {
      return NextResponse.json(
        { error: "Missing set is not linked to any event" },
        { status: 400 }
      );
    }

    console.log(`🔄 Processing approval for: ${missingSetData.title}`);

    const coverImageUrl = await resolveCoverImageUrl(
      imageClassifications,
      missingSetData,
      finalTitle,
      finalVersion
    );

    // 2. Crear el Set
    const newSet = await prisma.set.create({
      data: {
        title: finalTitle,
        image: coverImageUrl,
        code: finalSetCode,
        releaseDate: new Date(),
        isOpen: false,
        version: finalVersion,
      },
    });

    console.log(`✅ Set created: ${newSet.title} (ID: ${newSet.id})`);

    await linkEventsToSet(missingSet.events, newSet.id);

    const attachmentsCount = await processAttachmentsForSet(
      imageClassifications,
      missingSetData,
      newSet.id
    );

    if (action === "createAndReassign") {
      const reassignedCards = await reassignCardsToSet(
        reassignCardIds,
        newSet.id,
        finalSetCode
      );

      await finalizeMissingSet(missingSetData.id);

      return NextResponse.json({
        success: true,
        mode: "createAndReassign",
        setId: newSet.id,
        setTitle: newSet.title,
        coverImageUrl,
        attachmentsCount,
        reassignedCards,
      });
    }

    // 5. Procesar CARD images: crear alternates y EventCard relations
    const createdAlternatesCount = await createAlternatesFromCardImages(
      imageClassifications,
      missingSetData,
      newSet.id,
      finalSetCode
    );

    await finalizeMissingSet(missingSetData.id);

    return NextResponse.json({
      success: true,
      mode: "createNew",
      setId: newSet.id,
      setTitle: newSet.title,
      coverImageUrl,
      attachmentsCount,
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
