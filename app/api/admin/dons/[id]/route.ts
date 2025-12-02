import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  DON_CATEGORY,
  findDonById,
  parseSetIds,
  sanitizeOptionalString,
} from "../utils";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------------
// Cloudflare R2 helpers
// -----------------------------------------------------------------------------

const hasR2Config = Boolean(
  process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY
);

const r2Client = hasR2Config
  ? new S3Client({
      region: "auto",
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null;

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "ohara";
const R2_IMAGE_SUFFIXES = [
  "",
  "-tiny",
  "-xs",
  "-thumb",
  "-small",
  "-medium",
  "-large",
];

const sanitizeImageKey = (key?: string | null) => {
  if (!key) return null;
  return key.replace(/\.(jpg|jpeg|png|webp)$/i, "");
};

const deleteDonImagesFromR2 = async (imageKey?: string | null) => {
  if (!r2Client) return; // Missing configuration, nothing to do
  const cleanKey = sanitizeImageKey(imageKey);
  if (!cleanKey) return;

  const deletePromises = R2_IMAGE_SUFFIXES.map(async (suffix) => {
    const key = `cards/${cleanKey}${suffix}.webp`;
    try {
      await r2Client.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
        })
      );
    } catch (error) {
      console.error(`Error deleting R2 object ${key}`, error);
    }
  });

  await Promise.all(deletePromises);
};

const validateIdParam = (value: string) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = validateIdParam(params.id);
  if (!id) {
    return NextResponse.json({ error: "Invalid Don!! id" }, { status: 400 });
  }

  const card = await findDonById(id);
  if (!card || card.category !== DON_CATEGORY) {
    return NextResponse.json({ error: "Don!! not found" }, { status: 404 });
  }

  return NextResponse.json(card, { status: 200 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = validateIdParam(params.id);
  if (!id) {
    return NextResponse.json({ error: "Invalid Don!! id" }, { status: 400 });
  }

  const existing = await prisma.card.findUnique({ where: { id } });
  if (!existing || existing.category !== DON_CATEGORY) {
    return NextResponse.json({ error: "Don!! not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const updateData: any = {};

    if (Object.prototype.hasOwnProperty.call(body, "name")) {
      updateData.name = body.name;
    }

    if (Object.prototype.hasOwnProperty.call(body, "code")) {
      updateData.code = body.code;
    }

    if (Object.prototype.hasOwnProperty.call(body, "setCode")) {
      updateData.setCode = body.setCode;
    }

    if (Object.prototype.hasOwnProperty.call(body, "src")) {
      updateData.src = body.src;
    }

    if (Object.prototype.hasOwnProperty.call(body, "imageKey")) {
      const incomingKey = body.imageKey ?? null;
      if (existing.imageKey && existing.imageKey !== incomingKey) {
        await deleteDonImagesFromR2(existing.imageKey || existing.code);
      }
      updateData.imageKey = incomingKey;
    }

    if (Object.prototype.hasOwnProperty.call(body, "baseCardId")) {
      const incomingBaseCardId =
        body.baseCardId === null || body.baseCardId === ""
          ? null
          : Number(body.baseCardId);

      if (incomingBaseCardId !== null) {
        if (!Number.isInteger(incomingBaseCardId) || incomingBaseCardId <= 0) {
          return NextResponse.json(
            { error: "baseCardId must be a positive integer or null" },
            { status: 400 }
          );
        }
        const baseCardExists = await prisma.card.findUnique({
          where: { id: incomingBaseCardId },
          select: { id: true },
        });
        if (!baseCardExists) {
          return NextResponse.json(
            { error: "Base card not found" },
            { status: 400 }
          );
        }
      }

      updateData.baseCardId = incomingBaseCardId;
    }

    if (Object.prototype.hasOwnProperty.call(body, "alias")) {
      updateData.alias = sanitizeOptionalString(body.alias);
    }

    if (Object.prototype.hasOwnProperty.call(body, "tcgUrl")) {
      updateData.tcgUrl = sanitizeOptionalString(body.tcgUrl);
    }

    if (Object.prototype.hasOwnProperty.call(body, "order")) {
      updateData.order = sanitizeOptionalString(body.order) ?? "0";
    }

    if (Object.prototype.hasOwnProperty.call(body, "region")) {
      updateData.region = sanitizeOptionalString(body.region);
    }

    if (Object.prototype.hasOwnProperty.call(body, "isFirstEdition")) {
      updateData.isFirstEdition = Boolean(body.isFirstEdition);
    }

    if (Object.prototype.hasOwnProperty.call(body, "isPro")) {
      updateData.isPro = Boolean(body.isPro);
    }

    await prisma.card.update({
      where: { id },
      data: updateData,
    });

    if (Object.prototype.hasOwnProperty.call(body, "setIds")) {
      const setIds = parseSetIds(body.setIds);
      await prisma.cardSet.deleteMany({ where: { cardId: id } });
      if (setIds.length) {
        await prisma.cardSet.createMany({
          data: setIds.map((setId) => ({ cardId: id, setId })),
        });
      }
    }

    const fullCard = await findDonById(id);
    return NextResponse.json(fullCard, { status: 200 });
  } catch (error) {
    console.error(`Error updating Don!! ${id}`, error);
    return NextResponse.json(
      { error: "Failed to update Don!!" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = validateIdParam(params.id);
  if (!id) {
    return NextResponse.json({ error: "Invalid Don!! id" }, { status: 400 });
  }

  const existing = await prisma.card.findUnique({ where: { id } });
  if (!existing || existing.category !== DON_CATEGORY) {
    return NextResponse.json({ error: "Don!! not found" }, { status: 404 });
  }

  try {
    await deleteDonImagesFromR2(existing.imageKey || existing.code);
    await prisma.card.delete({ where: { id } });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting Don!! ${id}`, error);
    return NextResponse.json(
      { error: "Failed to delete Don!!" },
      { status: 500 }
    );
  }
}
