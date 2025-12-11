export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; setId: string } }
) {
  try {
    const eventId = Number(params.id);
    const setId = Number(params.setId);
    if (Number.isNaN(eventId) || Number.isNaN(setId)) {
      return NextResponse.json(
        { error: "Invalid ids" },
        { status: 400 }
      );
    }

    await prisma.eventSet.deleteMany({
      where: {
        eventId,
        setId,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error unlinking set:", error);
    return NextResponse.json(
      { error: "Failed to unlink set" },
      { status: 500 }
    );
  }
}
