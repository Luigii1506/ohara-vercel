import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  DON_CATEGORY,
  findDonById,
  parseSetIds,
  sanitizeOptionalString,
} from "../utils";

export const dynamic = "force-dynamic";

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
      updateData.imageKey = body.imageKey ?? null;
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
