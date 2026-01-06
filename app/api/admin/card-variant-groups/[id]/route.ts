export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const variantGroupId = Number(params.id);
    if (Number.isNaN(variantGroupId)) {
      return NextResponse.json(
        { error: "Invalid variantGroupId" },
        { status: 400 }
      );
    }
    const body = await req.json();
    const name =
      typeof body.name === "string" ? body.name.trim() : undefined;
    const updated = await prisma.cardVariantGroup.update({
      where: { id: variantGroupId },
      data: { variantKey: name && name.length ? name : null },
      select: { id: true, variantKey: true },
    });
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("Error updating variant group:", error);
    return NextResponse.json(
      { error: "Failed to update variant group" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const variantGroupId = Number(params.id);
    if (Number.isNaN(variantGroupId)) {
      return NextResponse.json(
        { error: "Invalid variantGroupId" },
        { status: 400 }
      );
    }
    await prisma.cardVariantGroup.delete({
      where: { id: variantGroupId },
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting variant group:", error);
    return NextResponse.json(
      { error: "Failed to delete variant group" },
      { status: 500 }
    );
  }
}
