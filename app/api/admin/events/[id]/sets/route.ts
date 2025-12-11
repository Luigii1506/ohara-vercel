export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = Number(params.id);
    if (Number.isNaN(eventId)) {
      return NextResponse.json(
        { error: "Invalid event id" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { setId, missingSetId } = body;

    if (!setId || Number.isNaN(Number(setId))) {
      return NextResponse.json(
        { error: "setId is required" },
        { status: 400 }
      );
    }

    const setExists = await prisma.set.findUnique({
      where: { id: Number(setId) },
    });

    if (!setExists) {
      return NextResponse.json(
        { error: "Set not found" },
        { status: 404 }
      );
    }

    const linked = await prisma.eventSet.upsert({
      where: {
        eventId_setId: {
          eventId,
          setId: Number(setId),
        },
      },
      create: {
        eventId,
        setId: Number(setId),
      },
      update: {},
      include: {
        set: true,
      },
    });

    if (missingSetId) {
      const link = await prisma.eventMissingSet.findUnique({
        where: { id: Number(missingSetId) },
        select: { missingSetId: true },
      });

      if (link) {
        await prisma.eventMissingSet.deleteMany({
          where: { id: Number(missingSetId), eventId },
        });

        await prisma.missingSet.deleteMany({
          where: {
            id: link.missingSetId,
            isApproved: false,
            events: { none: true },
          },
        });
      }
    }

    return NextResponse.json(linked, { status: 200 });
  } catch (error) {
    console.error("Error linking set:", error);
    return NextResponse.json(
      { error: "Failed to link set" },
      { status: 500 }
    );
  }
}
