export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
    }

    const body = await req.json();
    const { isArchived } = body;

    if (typeof isArchived !== "boolean") {
      return NextResponse.json(
        { error: "isArchived must be boolean" },
        { status: 400 }
      );
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        isArchived,
        archivedAt: isArchived ? new Date() : null,
      },
      select: {
        id: true,
        isArchived: true,
        archivedAt: true,
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    );
  }
}
