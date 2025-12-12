export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get("search");
    const region = req.nextUrl.searchParams.get("region");
    const eventType = req.nextUrl.searchParams.get("eventType");
    const statusFilter = req.nextUrl.searchParams.get("status");

    const where: any = {
      isApproved: true, // Solo eventos aprobados para vista pública
    };

    if (search && search.trim().length > 0) {
      const term = search.trim();
      where.OR = [
        { title: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { location: { contains: term, mode: "insensitive" } },
      ];
    }

    if (region && region.trim().length > 0) {
      where.region = region.trim();
    }

    if (eventType && eventType.trim().length > 0) {
      where.eventType = eventType.trim();
    }

    if (statusFilter && statusFilter.trim().length > 0 && statusFilter !== "all") {
      const value = statusFilter.trim().toUpperCase();
      if (value === "CURRENT") {
        where.status = { in: ["UPCOMING", "ONGOING"] };
      } else if (value === "PAST") {
        where.status = "COMPLETED";
      } else if (["UPCOMING", "ONGOING", "COMPLETED"].includes(value)) {
        where.status = value;
      }
    }

    const events = await prisma.event.findMany({
      where,
      include: {
        _count: {
          select: {
            sets: true,
            cards: true,
          },
        },
      },
      orderBy: [
        { status: "desc" },
        { listOrder: "asc" },
        { startDate: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json(events, { status: 200 });
  } catch (error) {
    console.error("Error fetching public events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
